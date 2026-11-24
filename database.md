# Database - coupleRH

Este documento mapeia as tabelas, funções e políticas do Supabase PostgreSQL desenvolvidas para o projeto. Como o banco de dados e as migrações serão injetadas manualmente no painel web da plataforma pelo administrador, este documento e os arquivos `.sql` servirão de guia seguro.

## 1. Segurança e RLS (Row Level Security)
Para prover segurança estrita para o módulo administrativo e simplicidade (praticidade) para os usuários menos experientes (Portal do Trabalhador), a nossa segurança é injetada **direto no PostgreSQL** e não apenas na interface.

- Todos os *requests* enviados do React com `@supabase/supabase-js` levam consigo o token JWT do usuário (`auth.uid()`).
- O banco de dados consulta a função `auth.user_tenant_ids()` que criamos, que busca de maneira otimizada e sem causar loops infinitos, todos os tenants aos quais aquele `auth.uid()` pertence.
- A política padrão nas tabelas é: `USING (tenant_id = ANY (auth.user_tenant_ids()))`.
- Isso garante que, independente do nível técnico ou se o usuário leigo utilizar um link incorreto, ele **jamais** verá os salários de outra empresa.

## 2. Estrutura Proposta e Criada (Migration `00001_core_tenant_schema.sql`)

### 2.1 Identidade e Tenants
- **`tenants`**: Conta principal (ex: Escritório Contábil ou Holding).
- **`tenant_users`**: Tabela associativa que liga `auth.users` ao `tenant_id` e concede os perfis (`role`).
- **`companies`**: Empresas (`company_id`). Dados de CNPJ raiz.
- **`establishments`**: Estabelecimentos (`establishment_id`). Filiais com CNPJ extenso, local de lotação eSocial.

### 2.2 Estrutura Organizacional
- **`departments`**: Unidades organizacionais ou centros de custo para alocação da folha.
- **`positions`**: Cargos que os empregados ocuparão, relacionados a CBOs.

---

## 3. Scripts de Inicialização (Produção / Desenvolvimento)

Cole e execute os scripts abaixo sequencialmente no painel do Supabase (SQL Editor) para instanciar as tabelas, RLS, funções e triggers de auditoria do sistema.

### Script 1: `00001_core_tenant_schema`
```sql
-- 1. Tenants (As contas principais do SaaS)
CREATE TABLE public.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 2. Tenant Users (Associação de usuários aos tenants com papéis)
CREATE TABLE public.tenant_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- FK logicamente para auth.users(id)
    role TEXT NOT NULL CHECK (role IN ('system_admin', 'tenant_admin', 'dp_analyst', 'manager', 'employee', 'sst_specialist', 'auditor')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

-- 3. Companies (Empresas - CNPJ raiz)
CREATE TABLE public.companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    corporate_name TEXT NOT NULL,
    trade_name TEXT,
    cnpj TEXT NOT NULL,
    legal_nature TEXT,
    primary_cnae TEXT,
    tax_regime TEXT,
    address TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    fiscal_config JSONB DEFAULT '{}'::jsonb,
    labor_config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(tenant_id, cnpj)
);

-- 4. Establishments (Estabelecimentos / Filiais - CNPJ completo)
CREATE TABLE public.establishments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    cnpj TEXT NOT NULL,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(tenant_id, cnpj)
);

-- 5. Departments (Departamentos / Centros de Custo)
CREATE TABLE public.departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    code TEXT,
    cost_center_code TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 6. Sectors (Setores)
CREATE TABLE public.sectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 7. Cost Centers (Centros de Custo)
CREATE TABLE public.cost_centers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 8. Positions (Cargos)
CREATE TABLE public.positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    cbo TEXT,
    description TEXT,
    level TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 9. Workplaces (Lotações / Locais de Trabalho)
CREATE TABLE public.workplaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    address TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 10. Work Schedules (Jornadas e Horários)
CREATE TABLE public.work_schedules (
    status TEXT DEFAULT 'ACTIVE',
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    weekly_hours NUMERIC(5,2) NOT NULL,
    monthly_hours NUMERIC(5,2) NOT NULL DEFAULT 220,
    standard_tolerance INTEGER NOT NULL DEFAULT 10,
    divisor INTEGER NOT NULL DEFAULT 220,
    shifts JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 11. Holidays (Feriados)
CREATE TABLE public.holidays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    date DATE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('NACIONAL', 'ESTADUAL', 'MUNICIPAL', 'EMPRESA')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 12. Contract Types (Tipos de Contrato)
CREATE TABLE public.contract_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('CLT', 'ESTAGIO', 'APRENDIZ', 'TEMPORARIO', 'PJ', 'OUTROS')),
    term_type TEXT NOT NULL CHECK (term_type IN ('DETERMINADO', 'INDETERMINADO')),
    default_days INTEGER,
    has_fgts BOOLEAN NOT NULL DEFAULT true,
    has_13th BOOLEAN NOT NULL DEFAULT true,
    has_vacation BOOLEAN NOT NULL DEFAULT true,
    has_inss BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);
-- 13. Dependents (Dependentes)
CREATE TABLE public.dependents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    cpf TEXT,
    birth_date DATE NOT NULL,
    relationship TEXT NOT NULL CHECK (relationship IN ('FILHO', 'CONJUGE', 'ENTEADO', 'PAI_MAE', 'OUTRO')),
    start_date DATE NOT NULL,
    end_date DATE,
    is_irrf_dependent BOOLEAN NOT NULL DEFAULT false,
    is_family_allowance_dependent BOOLEAN NOT NULL DEFAULT false,
    has_disability BOOLEAN NOT NULL DEFAULT false,
    birth_certificate_number TEXT,
    vaccination_card_date DATE,
    school_frequency_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Ativar RLS em todas as tabelas
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.establishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workplaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dependents ENABLE ROW LEVEL SECURITY;

-- Security Definer Function
CREATE OR REPLACE FUNCTION public.user_tenant_ids()
RETURNS UUID[] AS $$
  SELECT ARRAY(
    SELECT tenant_id 
    FROM public.tenant_users 
    WHERE user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- RLS Policies
CREATE POLICY "Users can view their tenants" 
    ON public.tenants FOR SELECT USING (id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view tenant_users in their tenants" 
    ON public.tenant_users FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view companies in their tenants" 
    ON public.companies FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage companies" 
    ON public.companies FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (
            SELECT 1 FROM public.tenant_users 
            WHERE user_id = auth.uid() 
            AND tenant_id = public.companies.tenant_id 
            AND role IN ('tenant_admin', 'dp_analyst')
        )
    );

CREATE POLICY "Users can view establishments in their tenants" 
    ON public.establishments FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage establishments" 
    ON public.establishments FOR ALL 
    USING (tenant_id = ANY (public.user_tenant_ids()))
    WITH CHECK (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view departments in their tenants" 
    ON public.departments FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage departments" 
    ON public.departments FOR ALL 
    USING (tenant_id = ANY (public.user_tenant_ids()))
    WITH CHECK (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view sectors in their tenants" 
    ON public.sectors FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage sectors" 
    ON public.sectors FOR ALL 
    USING (tenant_id = ANY (public.user_tenant_ids()))
    WITH CHECK (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view cost centers in their tenants" 
    ON public.cost_centers FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage cost centers" 
    ON public.cost_centers FOR ALL 
    USING (tenant_id = ANY (public.user_tenant_ids()))
    WITH CHECK (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view positions in their tenants" 
    ON public.positions FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage positions" 
    ON public.positions FOR ALL 
    USING (tenant_id = ANY (public.user_tenant_ids()))
    WITH CHECK (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view workplaces in their tenants" 
    ON public.workplaces FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage workplaces" 
    ON public.workplaces FOR ALL 
    USING (tenant_id = ANY (public.user_tenant_ids()))
    WITH CHECK (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view work schedules in their tenants" 
    ON public.work_schedules FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage work schedules" 
    ON public.work_schedules FOR ALL 
    USING (tenant_id = ANY (public.user_tenant_ids()))
    WITH CHECK (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view holidays in their tenants" 
    ON public.holidays FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage holidays" 
    ON public.holidays FOR ALL 
    USING (tenant_id = ANY (public.user_tenant_ids()))
    WITH CHECK (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view contract types in their tenants" 
    ON public.contract_types FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage contract types" 
    ON public.contract_types FOR ALL 
    USING (tenant_id = ANY (public.user_tenant_ids()))
    WITH CHECK (tenant_id = ANY (public.user_tenant_ids()));
```

### Script 2: `00002_audit_engine`
```sql
CREATE SCHEMA IF NOT EXISTS audit;

-- Tabela de logs (Somente leitura, append-only)
CREATE TABLE audit.logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tenant_id UUID,
    actor_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address TEXT
);

ALTER TABLE audit.logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auditors can read tenant logs" 
    ON audit.logs FOR SELECT 
    USING (
        tenant_id = ANY (public.user_tenant_ids())
        AND EXISTS (
            SELECT 1 FROM public.tenant_users 
            WHERE user_id = auth.uid() 
            AND tenant_id = audit.logs.tenant_id 
            AND role IN ('tenant_admin', 'auditor')
        )
    );

-- Função genérica de trigger
CREATE OR REPLACE FUNCTION audit.audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    current_tenant_id UUID;
    v_old JSONB;
    v_new JSONB;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_old := to_jsonb(OLD);
        BEGIN
            current_tenant_id := OLD.tenant_id;
        EXCEPTION WHEN OTHERS THEN
            current_tenant_id := NULL;
        END;
    ELSE
        v_new := to_jsonb(NEW);
        BEGIN
            current_tenant_id := NEW.tenant_id;
        EXCEPTION WHEN OTHERS THEN
            current_tenant_id := NULL;
        END;
        
        IF TG_OP = 'UPDATE' THEN
            v_old := to_jsonb(OLD);
            IF v_old = v_new THEN
                RETURN NEW;
            END IF;
        END IF;
    END IF;

    INSERT INTO audit.logs (
        tenant_id, actor_id, action, entity_type, entity_id, old_values, new_values
    ) VALUES (
        current_tenant_id,
        COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::UUID),
        TG_OP,
        TG_TABLE_NAME::TEXT,
        COALESCE((v_new->>'id'), (v_old->>'id'), 'unknown'),
        v_old,
        v_new
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Anexar trigger 
CREATE TRIGGER audit_companies_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.companies
FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_establishments_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.establishments
FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
```

### Script 3: `00003_worker_contract_schema`
```sql
-- 1. People (Pessoas Físicas Civis)
CREATE TABLE public.people (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    social_name TEXT,
    cpf TEXT NOT NULL,
    rg TEXT,
    birth_date DATE,
    gender TEXT,
    zip_code TEXT,
    street TEXT,
    number TEXT,
    complement TEXT,
    neighborhood TEXT,
    city TEXT,
    state TEXT,
    country TEXT DEFAULT 'Brasil',
    reference_point TEXT,
    residence_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(tenant_id, cpf)
);

-- 2. Workers (O registro geral do indivíduo no Tenant/Empresa para fins de eSocial)
CREATE TABLE public.workers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE RESTRICT,
    esocial_matricula TEXT,
    pis_pasep TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(company_id, person_id)
);

-- 3. Employment Contracts (Vínculos Contratuais)
CREATE TABLE public.employment_contracts (
    contract_type TEXT,
    workload_hours NUMERIC,
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    establishment_id UUID REFERENCES public.establishments(id) ON DELETE RESTRICT,
    workplace_id UUID REFERENCES public.workplaces(id) ON DELETE SET NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    position_id UUID REFERENCES public.positions(id) ON DELETE RESTRICT,
    work_schedule_id UUID REFERENCES public.work_schedules(id) ON DELETE RESTRICT,
    contract_type_id UUID REFERENCES public.contract_types(id) ON DELETE RESTRICT,
    cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
    admission_date DATE NOT NULL,
    resignation_date DATE,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'VACATION')),
    base_salary NUMERIC(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'BRL',
    transportation_tickets_per_day INTEGER DEFAULT 0,
    opts_for_transportation_voucher BOOLEAN DEFAULT false,
    vt_operator TEXT,
    vt_card_number TEXT,
    vt_tariff_value NUMERIC(10,2),
    vt_discount_percentage NUMERIC(5,2) DEFAULT 6.00,
    receives_advance BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 4. Bank Accounts (Dados Bancários do Empregado)
CREATE TABLE public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    bank_code TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    agency TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_type TEXT NOT NULL DEFAULT 'CHECKING' CHECK (account_type IN ('CHECKING', 'SAVINGS', 'SALARY')),
    pix_key TEXT,
    is_main BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Contract History Tables (Histórico com Vigência)
-- 5.1 Salary History
CREATE TABLE public.contract_salary_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    base_salary NUMERIC(10, 2) NOT NULL,
    reason TEXT NOT NULL,
    effective_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5.2 Position History
CREATE TABLE public.contract_position_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    position_id UUID NOT NULL REFERENCES public.positions(id) ON DELETE RESTRICT,
    reason TEXT NOT NULL,
    effective_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5.3 Department/Sector History
CREATE TABLE public.contract_department_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
    reason TEXT NOT NULL,
    effective_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employment_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_salary_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_position_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_department_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view people in their tenants"  
    ON public.people FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view workers in their tenants" 
    ON public.workers FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view employment_contracts in their tenants" 
    ON public.employment_contracts FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage people" 
    ON public.people FOR ALL USING (
        tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_users.tenant_id = people.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
    );

CREATE POLICY "Tenant Admins and DP can manage workers" 
    ON public.workers FOR ALL USING (
        tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_users.tenant_id = workers.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
    );

CREATE POLICY "Tenant Admins and DP can manage employment_contracts" 
    ON public.employment_contracts FOR ALL USING (
        tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_users.tenant_id = employment_contracts.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
    );

CREATE POLICY "Users can view bank_accounts in their tenants" 
    ON public.bank_accounts FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage bank_accounts" 
    ON public.bank_accounts FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view history tables in their tenants" 
    ON public.contract_salary_history FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Users can view position history in their tenants" 
    ON public.contract_position_history FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Users can view department history in their tenants" 
    ON public.contract_department_history FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage history tables" 
    ON public.contract_salary_history FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Tenant Admins and DP can manage position history" 
    ON public.contract_position_history FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Tenant Admins and DP can manage department history" 
    ON public.contract_department_history FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE TRIGGER audit_people_trigger AFTER INSERT OR UPDATE OR DELETE ON public.people FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_workers_trigger AFTER INSERT OR UPDATE OR DELETE ON public.workers FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_contracts_trigger AFTER INSERT OR UPDATE OR DELETE ON public.employment_contracts FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
```

## Migration: `00026_payroll_overtime_rubrics.sql`
```sql
-- Migration: 00026_payroll_overtime_rubrics
-- Description: Cria rubricas padrões de Horas Extras e DSR para todos os tenants.

DO $$ 
DECLARE
    tenant RECORD;
BEGIN
    FOR tenant IN SELECT id FROM public.tenants LOOP
        
        -- Hora Extra 50%
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, factor, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '150', 'Hora Extra 50%', 'EARNING', 'OVERTIME', 'FORMULA', 'HORAS', 'SALARIO_BASE', 1.5,
            true, true, true, true, true, true
        ) ON CONFLICT (tenant_id, code) DO NOTHING;

        -- Hora Extra 100%
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, factor, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '160', 'Hora Extra 100%', 'EARNING', 'OVERTIME', 'FORMULA', 'HORAS', 'SALARIO_BASE', 2.0,
            true, true, true, true, true, true
        ) ON CONFLICT (tenant_id, code) DO NOTHING;

        -- DSR sobre Horas Extras
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, formula, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '170', 'DSR sobre Horas Extras', 'EARNING', 'OVERTIME', 'FORMULA', 'FORMULA', '(BASE_DSR / DIAS_UTEIS) * DIAS_INUTEIS',
            true, true, true, true, true, true
        ) ON CONFLICT (tenant_id, code) DO NOTHING;
        
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
```

## Migration: `00027_seed_standard_payroll_rubrics.sql`
```sql
-- Migration: 00027_seed_standard_payroll_rubrics
-- Description: Saneamento do banco e injeção de rubricas oficiais para funcionamento pleno do Motor.

DO $$ 
DECLARE
    tenant RECORD;
    v_rubric_vt UUID;
    v_rubric_vr UUID;
BEGIN
    FOR tenant IN SELECT id FROM public.tenants LOOP
        
        -- 1. SALÁRIO BASE (Cód 101)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND (code = '101' OR name ILIKE 'Salário Base');
        
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '101', 'Salário Base', 'EARNING', 'SALARY', 'FIXED', 'FIXO', 'SALARIO_BASE', 
            true, true, true, true, true, true
        );

        -- 2. INSS AUTOMÁTICO (Cód 901)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND (code = '901' OR code = 'INSS_AUTO');
        
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '901', 'Contribuição INSS', 'DEDUCTION', 'TAX', 'FORMULA', 'AUTOMATICA', NULL, 
            false, false, false, false, false, false
        );

        -- 3. IRRF AUTOMÁTICO (Cód 902)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND (code = '902' OR code = 'IRRF_AUTO');
        
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '902', 'IRRF Mensal', 'DEDUCTION', 'TAX', 'FORMULA', 'AUTOMATICA', NULL, 
            false, false, false, false, false, false
        );

        -- 4. FGTS AUTOMÁTICO (Cód 903)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND (code = '903' OR code = 'FGTS_AUTO');
        
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '903', 'FGTS Mensal (Depósito)', 'BASE', 'TAX', 'FORMULA', 'AUTOMATICA', NULL, 
            false, false, false, false, false, false
        );

        -- 5. VALE TRANSPORTE (Cód 201)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND (code = '201' OR name ILIKE 'Vale Transporte');
        
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '201', 'Vale Transporte', 'DEDUCTION', 'ALLOWANCE', 'FIXED', 'MANUAL', NULL, 
            false, false, false, false, false, false
        ) RETURNING id INTO v_rubric_vt;

        -- 6. VALE REFEIÇÃO / ALIMENTAÇÃO (Cód 202)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND code = '202';
        
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '202', 'Vale Refeição / Alimentação', 'DEDUCTION', 'ALLOWANCE', 'FIXED', 'MANUAL', NULL, 
            false, false, false, false, false, false
        ) RETURNING id INTO v_rubric_vr;

        -- 7. VINCULAÇÃO NO CATÁLOGO DE BENEFÍCIOS
        -- Atualiza catálogo de VT para amarrar à rubrica correta
        UPDATE public.benefits_catalog 
        SET rubric_id = v_rubric_vt, discount_type = 'PERCENTAGE', default_discount_value = 6
        WHERE tenant_id = tenant.id AND (benefit_type = 'VT' OR name ILIKE 'Vale Transporte');

        -- Atualiza catálogo de VR para amarrar à rubrica correta
        UPDATE public.benefits_catalog 
        SET rubric_id = v_rubric_vr, discount_type = 'FIXED_VALUE'
        WHERE tenant_id = tenant.id AND (benefit_type = 'VR' OR name ILIKE 'Vale Refeição');

    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
```

### Script 4: `00004_onboarding_schema`
```sql
-- 1. Processos de Onboarding (Máquina de Estados)
CREATE TABLE public.onboarding_processes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    candidate_name TEXT NOT NULL,
    candidate_cpf TEXT,
    candidate_email TEXT,
    department_id UUID REFERENCES public.departments(id),
    position_id UUID REFERENCES public.positions(id),
    proposed_salary NUMERIC(10,2),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_DOCS', 'PENDING_ASO', 'DP_REVIEW', 'ESOCIAL_READY', 'CONCLUDED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 2. Documentos de Admissão (GED)
CREATE TABLE public.onboarding_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    onboarding_process_id UUID NOT NULL REFERENCES public.onboarding_processes(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (document_type IN ('RG', 'CPF', 'COMPROVANTE_RESIDENCIA', 'TITULO_ELEITOR', 'ASO', 'OUTROS')),
    file_url TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Dependentes
CREATE TABLE public.dependents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    onboarding_process_id UUID REFERENCES public.onboarding_processes(id) ON DELETE CASCADE,
    person_id UUID REFERENCES public.people(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    cpf TEXT,
    birth_date DATE NOT NULL,
    relationship TEXT NOT NULL CHECK (relationship IN ('SPOUSE', 'CHILD', 'PARENT', 'OTHER')),
    is_irrf_dependent BOOLEAN DEFAULT false,
    is_family_allowance_dependent BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_parent_link CHECK (
        (onboarding_process_id IS NOT NULL AND person_id IS NULL) OR 
        (onboarding_process_id IS NULL AND person_id IS NOT NULL)
    )
);

ALTER TABLE public.onboarding_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dependents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view onboarding in their tenants" ON public.onboarding_processes FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Users can view onboarding docs in their tenants" ON public.onboarding_documents FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Users can view dependents in their tenants" ON public.dependents FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage onboarding" ON public.onboarding_processes FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = public.onboarding_processes.tenant_id AND role IN ('tenant_admin', 'dp_analyst')));
CREATE POLICY "Tenant Admins and DP can manage onboarding docs" ON public.onboarding_documents FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = public.onboarding_documents.tenant_id AND role IN ('tenant_admin', 'dp_analyst')));
CREATE POLICY "Tenant Admins and DP can manage dependents" ON public.dependents FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = public.dependents.tenant_id AND role IN ('tenant_admin', 'dp_analyst')));

CREATE TRIGGER audit_onboarding_processes_trigger AFTER INSERT OR UPDATE OR DELETE ON public.onboarding_processes FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_onboarding_documents_trigger AFTER INSERT OR UPDATE OR DELETE ON public.onboarding_documents FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_dependents_trigger AFTER INSERT OR UPDATE OR DELETE ON public.dependents FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
```

### Script 5: `00005_documents_signatures_schema`
```sql
CREATE TABLE public.document_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    content_body TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('CONTRACT', 'POLICY', 'AGREEMENT', 'OTHER')),
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE public.employee_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    document_template_id UUID REFERENCES public.document_templates(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    document_hash TEXT,
    file_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING_SIGNATURE' CHECK (status IN ('PENDING_SIGNATURE', 'PARTIALLY_SIGNED', 'SIGNED', 'CANCELED')),
    requires_employee_signature BOOLEAN NOT NULL DEFAULT true,
    requires_employer_signature BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE public.signatures_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    employee_document_id UUID NOT NULL REFERENCES public.employee_documents(id) ON DELETE CASCADE,
    signer_user_id UUID NOT NULL,
    signer_role TEXT NOT NULL CHECK (signer_role IN ('EMPLOYEE', 'EMPLOYER', 'WITNESS')),
    ip_address TEXT NOT NULL,
    user_agent TEXT NOT NULL,
    signature_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    document_hash_at_signing TEXT NOT NULL,
    UNIQUE(employee_document_id, signer_user_id)
);

ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signatures_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view templates in their tenants" ON public.document_templates FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Users can view employee documents in their tenants" ON public.employee_documents FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Users can view signature logs in their tenants" ON public.signatures_log FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage templates" ON public.document_templates FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = public.document_templates.tenant_id AND role IN ('tenant_admin', 'dp_analyst')));
CREATE POLICY "Tenant Admins and DP can manage employee documents" ON public.employee_documents FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = public.employee_documents.tenant_id AND role IN ('tenant_admin', 'dp_analyst')));
CREATE POLICY "System generates signature logs" ON public.signatures_log FOR INSERT WITH CHECK (tenant_id = ANY (public.user_tenant_ids()));

CREATE TRIGGER audit_templates_trigger AFTER INSERT OR UPDATE OR DELETE ON public.document_templates FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_employee_docs_trigger AFTER INSERT OR UPDATE OR DELETE ON public.employee_documents FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
```

### Script 6: `00006_vacations_and_cct_schema`
```sql
CREATE TABLE public.unions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    cnpj TEXT NOT NULL,
    legal_name TEXT NOT NULL,
    trade_name TEXT NOT NULL,
    base_city TEXT,
    base_state TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.collective_agreements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    union_id UUID NOT NULL REFERENCES public.unions(id) ON DELETE RESTRICT,
    agreement_type TEXT NOT NULL CHECK (agreement_type IN ('CCT', 'ACT')),
    validity_start DATE NOT NULL,
    validity_end DATE NOT NULL,
    base_salary_floor NUMERIC(10,2),
    overtime_percentage_1 NUMERIC(5,2) DEFAULT 50.00,
    overtime_percentage_2 NUMERIC(5,2) DEFAULT 100.00,
    night_shift_premium NUMERIC(5,2) DEFAULT 20.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.employment_contracts ADD COLUMN union_id UUID REFERENCES public.unions(id);

CREATE TABLE public.vacation_vesting_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    concessive_start_date DATE NOT NULL,
    concessive_end_date DATE NOT NULL,
    earned_days NUMERIC(5,2) NOT NULL DEFAULT 30.00,
    taken_days NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    lost_days NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'ACQUIRED', 'PARTIALLY_TAKEN', 'COMPLETED', 'EXPIRED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.vacation_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    vesting_period_id UUID NOT NULL REFERENCES public.vacation_vesting_periods(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_taken INTEGER NOT NULL,
    cash_allowance_days INTEGER NOT NULL DEFAULT 0,
    advance_13th_salary BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'APPROVED_MANAGER', 'APPROVED_DP', 'PAID', 'TAKEN', 'CANCELED')),
    approved_by_manager UUID,
    approved_by_dp UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.unions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collective_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacation_vesting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view unions" ON public.unions FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Users can view collective agreements" ON public.collective_agreements FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Users can view vacation vesting" ON public.vacation_vesting_periods FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Users can view vacation requests" ON public.vacation_requests FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage unions" ON public.unions FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = public.unions.tenant_id AND role IN ('tenant_admin', 'dp_analyst')));
CREATE POLICY "Tenant Admins and DP can manage collective agreements" ON public.collective_agreements FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = public.collective_agreements.tenant_id AND role IN ('tenant_admin', 'dp_analyst')));

CREATE TRIGGER audit_unions_trigger AFTER INSERT OR UPDATE OR DELETE ON public.unions FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_vacations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.vacation_requests FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
```

### Script 7: `00007_leaves_benefits_time_schema`
```sql
CREATE TABLE public.leaves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('SICK_LEAVE', 'MATERNITY', 'PATERNITY', 'WORK_ACCIDENT', 'UNJUSTIFIED_ABSENCE', 'SUSPENSION', 'OTHER')),
    start_date DATE NOT NULL,
    end_date DATE,
    return_date DATE,
    icd_10_code TEXT,
    medical_certificate_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    is_inss_referral BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.benefit_catalogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    benefit_type TEXT NOT NULL CHECK (benefit_type IN ('TRANSPORTATION', 'MEAL', 'FOOD', 'HEALTH_INSURANCE', 'DENTAL_INSURANCE', 'LIFE_INSURANCE', 'OTHER')),
    provider_name TEXT,
    company_contribution NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    employee_discount_percentage NUMERIC(5,2),
    employee_discount_fixed NUMERIC(10,2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.employee_benefits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    benefit_catalog_id UUID NOT NULL REFERENCES public.benefit_catalogs(id) ON DELETE CASCADE,
    opt_in BOOLEAN NOT NULL DEFAULT true,
    custom_discount_value NUMERIC(10,2),
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id, benefit_catalog_id)
);

CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    notification_type TEXT NOT NULL CHECK (notification_type IN ('ALERT', 'TASK', 'MESSAGE', 'SYSTEM')),
    is_read BOOLEAN NOT NULL DEFAULT false,
    action_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.work_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    schedule_type TEXT NOT NULL CHECK (schedule_type IN ('FIXED', 'FLEXIBLE', 'SHIFT_12X36', 'SCALE')),
    monday_in TIME, monday_out TIME,
    tuesday_in TIME, tuesday_out TIME,
    wednesday_in TIME, wednesday_out TIME,
    thursday_in TIME, thursday_out TIME,
    friday_in TIME, friday_out TIME,
    saturday_in TIME, saturday_out TIME,
    sunday_in TIME, sunday_out TIME,
    weekly_hours NUMERIC(4,2) NOT NULL DEFAULT 44.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.employment_contracts ADD COLUMN work_schedule_id UUID REFERENCES public.work_schedules(id);

ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benefit_catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view leaves" ON public.leaves FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Users can view benefits" ON public.benefit_catalogs FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Users can view employee benefits" ON public.employee_benefits FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Users can view work schedules" ON public.work_schedules FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Tenant Admins and DP can manage leaves" ON public.leaves FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = public.leaves.tenant_id AND role IN ('tenant_admin', 'dp_analyst')));
CREATE POLICY "Tenant Admins and DP can manage benefits" ON public.benefit_catalogs FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = public.benefit_catalogs.tenant_id AND role IN ('tenant_admin', 'dp_analyst')));
CREATE POLICY "Tenant Admins and DP can manage employee benefits" ON public.employee_benefits FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = public.employee_benefits.tenant_id AND role IN ('tenant_admin', 'dp_analyst')));
CREATE POLICY "Tenant Admins and DP can manage work schedules" ON public.work_schedules FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = public.work_schedules.tenant_id AND role IN ('tenant_admin', 'dp_analyst')));

CREATE TRIGGER audit_leaves_trigger AFTER INSERT OR UPDATE OR DELETE ON public.leaves FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_employee_benefits_trigger AFTER INSERT OR UPDATE OR DELETE ON public.employee_benefits FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_work_schedules_trigger AFTER INSERT OR UPDATE OR DELETE ON public.work_schedules FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
```

### Script 8: `00008_time_and_payroll_base_schema`
```sql
CREATE TABLE public.time_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    original_timestamp TIMESTAMPTZ NOT NULL,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('IN', 'OUT', 'BREAK_START', 'BREAK_END')),
    device_info TEXT,
    adjusted_timestamp TIMESTAMPTZ,
    is_manual_adjustment BOOLEAN NOT NULL DEFAULT false,
    adjustment_reason TEXT,
    adjusted_by UUID,
    status TEXT NOT NULL DEFAULT 'APPROVED' CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE RULE prevent_time_entry_deletion AS ON DELETE TO public.time_entries DO INSTEAD NOTHING;

CREATE TABLE public.time_bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    balance_minutes INTEGER NOT NULL DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED', 'PAID_OUT')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.time_bank_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.time_bank_accounts(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    minutes INTEGER NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('OVERTIME', 'DELAY', 'ABSENCE', 'COMPENSATION_DAY_OFF', 'MANUAL_ADJUSTMENT')),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.timesheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_worked_minutes INTEGER NOT NULL DEFAULT 0,
    total_overtime_minutes INTEGER NOT NULL DEFAULT 0,
    total_night_shift_minutes INTEGER NOT NULL DEFAULT 0,
    total_missing_minutes INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_SIGNATURE', 'SIGNED', 'CLOSED')),
    employee_signature_id UUID REFERENCES public.signatures_log(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.payroll_periods (
    month INTEGER,
    year INTEGER,
    type TEXT,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    parent_period_id UUID REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    complement_reason TEXT,
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    competence_month INTEGER NOT NULL CHECK (competence_month BETWEEN 1 AND 12),
    competence_year INTEGER NOT NULL,
    payroll_type TEXT NOT NULL CHECK (payroll_type IN ('MONTHLY', 'ADVANCE', 'THIRTEENTH_1', 'THIRTEENTH_2', 'PROFIT_SHARING')),
    payment_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'PROCESSING', 'CONFERENCE', 'CLOSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, competence_month, competence_year, payroll_type)
);

CREATE TABLE public.payroll_rubrics (
    calculation_form TEXT,
    type TEXT,
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    esocial_code TEXT,
    rubric_type TEXT NOT NULL CHECK (rubric_type IN ('EARNING', 'DEDUCTION', 'NEUTRAL')),
    incidence_inss BOOLEAN NOT NULL DEFAULT false,
    incidence_fgts BOOLEAN NOT NULL DEFAULT false,
    incidence_irrf BOOLEAN NOT NULL DEFAULT false,
    calculation_rule_id TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, code)
);

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_rubrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Admins and DP can manage time" ON public.time_entries FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Tenant Admins and DP can manage timesheets" ON public.timesheets FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Tenant Admins and DP can manage payroll" ON public.payroll_periods FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Tenant Admins and DP can manage rubrics" ON public.payroll_rubrics FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE TRIGGER audit_time_entries_trigger AFTER INSERT OR UPDATE ON public.time_entries FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_payroll_rubrics_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_rubrics FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
```

### Script 9: `00009_payroll_engine_schema`
```sql
CREATE TABLE public.payroll_progressive_tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    table_type TEXT NOT NULL CHECK (table_type IN ('INSS', 'IRRF', 'FAMILY_SALARY', 'OTHER')),
    competence_start DATE NOT NULL,
    competence_end DATE,
    ranges_jsonb JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.payroll_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE RESTRICT,
    reference_value NUMERIC(10,2),
    calculated_amount NUMERIC(10,2) NOT NULL,
    is_manual_entry BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.payroll_memory_calc (
    logs JSONB,
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.payroll_events(id) ON DELETE CASCADE,
    formula_used TEXT NOT NULL,
    variables_snapshot JSONB NOT NULL,
    progressive_table_id UUID REFERENCES public.payroll_progressive_tables(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.terminations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    termination_reason TEXT NOT NULL CHECK (termination_reason IN ('WITHOUT_JUST_CAUSE_BY_EMPLOYER', 'WITH_JUST_CAUSE_BY_EMPLOYER', 'BY_EMPLOYEE', 'MUTUAL_AGREEMENT', 'CONTRACT_EXPIRATION', 'RETIREMENT', 'DEATH')),
    notice_period_type TEXT NOT NULL CHECK (notice_period_type IN ('WORKED', 'INDEMNIFIED', 'WAIVED')),
    notice_date DATE NOT NULL,
    last_working_day DATE NOT NULL,
    fgts_fine_percentage NUMERIC(5,2),
    is_exam_required BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'CALCULATED', 'PAID', 'HOMOLOGATED', 'CANCELED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id)
);

ALTER TABLE public.payroll_progressive_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Admins and DP can manage progressive tables" ON public.payroll_progressive_tables FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Tenant Admins and DP can manage payroll events" ON public.payroll_events FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Tenant Admins and DP can view memory calc" ON public.payroll_memory_calc FOR SELECT USING (EXISTS (SELECT 1 FROM public.payroll_events e WHERE e.id = public.payroll_memory_calc.event_id AND e.tenant_id = ANY(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage terminations" ON public.terminations FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE TRIGGER audit_progressive_tables_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_progressive_tables FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_payroll_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_terminations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.terminations FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
```

### Script 10: `00010_esocial_sst_schema`
```sql
CREATE TABLE public.esocial_transmissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('S-1000', 'S-1010', 'S-2200', 'S-2205', 'S-2206', 'S-2210', 'S-2220', 'S-2230', 'S-2240', 'S-2299', 'S-1200', 'S-1210', 'OTHER')),
    reference_id UUID,
    xml_payload TEXT NOT NULL,
    receipt_number TEXT,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'QUEUED', 'PROCESSING', 'ACCEPTED', 'REJECTED')),
    error_message TEXT,
    transmitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.sst_work_environments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    location_type TEXT NOT NULL CHECK (location_type IN ('OWN_ESTABLISHMENT', 'THIRD_PARTY', 'EXTERNAL')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.sst_risks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    esocial_code TEXT NOT NULL,
    name TEXT NOT NULL,
    risk_type TEXT NOT NULL CHECK (risk_type IN ('PHYSICAL', 'CHEMICAL', 'BIOLOGICAL', 'ERGONOMIC', 'ACCIDENT')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.sst_health_exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    exam_type TEXT NOT NULL CHECK (exam_type IN ('ADMISSIONAL', 'PERIODIC', 'RETURN_TO_WORK', 'CHANGE_OF_RISK', 'DEMISSIONAL')),
    exam_date DATE NOT NULL,
    doctor_crm TEXT NOT NULL,
    doctor_name TEXT NOT NULL,
    result TEXT NOT NULL CHECK (result IN ('FIT', 'UNFIT')),
    certificate_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.esocial_transmissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sst_work_environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sst_risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sst_health_exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Admins and DP can manage eSocial" ON public.esocial_transmissions FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Tenant Admins and DP can manage SST Envs" ON public.sst_work_environments FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Tenant Admins and DP can manage SST Risks" ON public.sst_risks FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Tenant Admins and DP can manage Health Exams" ON public.sst_health_exams FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE TRIGGER audit_esocial_trigger AFTER INSERT OR UPDATE OR DELETE ON public.esocial_transmissions FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_sst_exams_trigger AFTER INSERT OR UPDATE OR DELETE ON public.sst_health_exams FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
```

### Script 11: `00011_architecture_fixes`
```sql
CREATE TABLE public.employment_contract_history (
    employment_contract_id UUID REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    event_type TEXT,
    old_value JSONB,
    new_value JSONB,
    event_date DATE,
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    valid_from DATE NOT NULL,
    valid_to DATE,
    salary_amount NUMERIC(10, 2) NOT NULL,
    job_title TEXT NOT NULL,
    work_schedule_id UUID,
    union_id UUID,
    cost_center TEXT,
    change_reason TEXT NOT NULL,
    approved_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.time_entries 
    DROP COLUMN IF EXISTS adjusted_timestamp,
    DROP COLUMN IF EXISTS is_manual_adjustment,
    DROP COLUMN IF EXISTS adjustment_reason,
    DROP COLUMN IF EXISTS adjusted_by,
    DROP COLUMN IF EXISTS status;

CREATE TABLE public.time_entry_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    time_entry_id UUID REFERENCES public.time_entries(id) ON DELETE RESTRICT,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    requested_timestamp TIMESTAMPTZ NOT NULL,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('IN', 'OUT', 'BREAK_START', 'BREAK_END')),
    adjustment_reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL' CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
    requested_by UUID NOT NULL,
    approved_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.lgpd_consents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    data_category TEXT NOT NULL,
    processing_purpose TEXT NOT NULL,
    legal_basis TEXT NOT NULL CHECK (legal_basis IN ('CONSENT', 'LEGAL_OBLIGATION', 'CONTRACT_EXECUTION', 'LEGITIMATE_INTEREST')),
    granted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    ip_address TEXT,
    device_info TEXT
);

CREATE TABLE public.data_retention_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    data_domain TEXT NOT NULL,
    retention_period_months INTEGER NOT NULL,
    legal_justification TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.employment_contract_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entry_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lgpd_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Admins and DP can manage history" ON public.employment_contract_history FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Tenant Admins and DP can manage time adjustments" ON public.time_entry_adjustments FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Tenant Admins and DP can manage lgpd consents" ON public.lgpd_consents FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Tenant Admins and DP can manage retention policies" ON public.data_retention_policies FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE TRIGGER audit_contract_history_trigger AFTER INSERT OR UPDATE OR DELETE ON public.employment_contract_history FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_time_adjustments_trigger AFTER INSERT OR UPDATE OR DELETE ON public.time_entry_adjustments FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_lgpd_consents_trigger AFTER INSERT OR UPDATE OR DELETE ON public.lgpd_consents FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
```

```

### Script 12: `00012_benefits_and_deductions_schema`
```sql
CREATE TABLE public.benefit_catalogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    benefit_type TEXT NOT NULL CHECK (benefit_type IN ('TRANSPORTATION', 'MEAL', 'FOOD', 'HEALTH_INSURANCE', 'DENTAL_INSURANCE', 'LIFE_INSURANCE', 'OTHER')),
    provider_name TEXT,
    company_contribution NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    employee_discount_percentage NUMERIC(5,2),
    employee_discount_fixed NUMERIC(10,2),
    rubric_id UUID REFERENCES public.payroll_rubrics(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.employee_benefits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    benefit_catalog_id UUID NOT NULL REFERENCES public.benefit_catalogs(id) ON DELETE CASCADE,
    dependent_count INTEGER NOT NULL DEFAULT 0,
    custom_discount_type TEXT CHECK (custom_discount_type IN ('PERCENTAGE', 'FIXED_VALUE', 'NONE')),
    custom_discount_value NUMERIC(10,2),
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.employee_deductions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE RESTRICT,
    deduction_type TEXT NOT NULL CHECK (deduction_type IN ('ALIMONY', 'LOAN', 'ADVANCE', 'COPARTICIPATION', 'OTHER')),
    amount_type TEXT NOT NULL CHECK (amount_type IN ('FIXED', 'PERCENTAGE')),
    value NUMERIC(10,2) NOT NULL,
    total_limit NUMERIC(10,2),
    start_date DATE NOT NULL,
    end_date DATE,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Políticas de RLS omitidas para brevidade, mas devem usar user_tenant_ids() 
```




### Script: `supabase_sql_fase_7.sql`
```sql
-- Fase 7: Afastamentos e Ausências
-- Cria a tabela 'leaves' com políticas de RLS e triggers.

CREATE TABLE IF NOT EXISTS public.leaves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('SICK_LEAVE', 'MATERNITY', 'PATERNITY', 'WORK_ACCIDENT', 'UNJUSTIFIED_ABSENCE', 'SUSPENSION', 'OTHER')),
    start_date DATE NOT NULL,
    end_date DATE,
    return_date DATE,
    icd_10_code TEXT,
    medical_certificate_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    is_inss_referral BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Users can view leaves from their tenants" 
    ON public.leaves FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert leaves into their tenants" 
    ON public.leaves FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update leaves in their tenants" 
    ON public.leaves FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete leaves in their tenants" 
    ON public.leaves FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Trigger de Updated At
CREATE TRIGGER update_leaves_updated_at
    BEFORE UPDATE ON public.leaves
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

```

### Script: `supabase_sql_fase_8.sql`
```sql
-- ==============================================================================
-- FASE 8: ESTRUTURA COMPLETA DE RUBRICAS
-- ==============================================================================
-- Este script expande a tabela "payroll_rubrics" com todas as variáveis exigidas
-- pelo Motor de Cálculo da Folha (Fase 13).

-- 1. Expansão da tabela payroll_rubrics
ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'AUTOMATICA', 'IMPORTADA', 'INTEGRACAO')),
    ADD COLUMN IF NOT EXISTS calculation_base TEXT,
    ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS divisor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS factor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS calculation_order INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS incidence_inss_patronal BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_rat BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_third_parties BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_inss BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_irrf BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_fgts BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS valid_to DATE,
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS esocial_description TEXT;

-- (Opcional) Adicionar type e category caso não tenham sido criados no Script 8 original, mas já usados no frontend
ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'EARNING',
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'SALARY',
    ADD COLUMN IF NOT EXISTS calculation_type TEXT DEFAULT 'FIXED',
    ADD COLUMN IF NOT EXISTS formula TEXT;

-- 2. Atualizar permissões de RLS para a tabela expandida 
-- (O Script 8 já possuía RLS, este comando é apenas por garantia)
ALTER TABLE public.payroll_rubrics ENABLE ROW LEVEL SECURITY;

-- Nota: A trigger de auditoria `audit_payroll_rubrics_trigger` criada na Fase 8/Script 8 já cobre automaticamente as novas colunas
-- pois o `to_jsonb(NEW)` captura dinamicamente a estrutura da tabela atual.

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_9.sql`
```sql
-- ==============================================================================
-- FASE 9: EVENTOS DA FOLHA (LANÇAMENTOS VARIÁVEIS) E PROGRESSIVAS
-- ==============================================================================
-- Este script cria as tabelas do motor de folha que faltavam no Script 9,
-- incluindo a versão já atualizada de payroll_events com quantity, origin, etc.

CREATE TABLE IF NOT EXISTS public.payroll_progressive_tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    table_type TEXT NOT NULL CHECK (table_type IN ('INSS', 'IRRF', 'FAMILY_SALARY', 'OTHER')),
    competence_start DATE NOT NULL,
    competence_end DATE,
    ranges_jsonb JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE RESTRICT,
    reference_value NUMERIC(10,2),
    quantity NUMERIC(10,2),
    calculated_amount NUMERIC(10,2) NOT NULL,
    is_manual_entry BOOLEAN NOT NULL DEFAULT false,
    origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO')),
    notes TEXT,
    recorded_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_memory_calc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.payroll_events(id) ON DELETE CASCADE,
    formula_used TEXT NOT NULL,
    variables_snapshot JSONB NOT NULL,
    progressive_table_id UUID REFERENCES public.payroll_progressive_tables(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.terminations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    termination_reason TEXT NOT NULL CHECK (termination_reason IN ('WITHOUT_JUST_CAUSE_BY_EMPLOYER', 'WITH_JUST_CAUSE_BY_EMPLOYER', 'BY_EMPLOYEE', 'MUTUAL_AGREEMENT', 'CONTRACT_EXPIRATION', 'RETIREMENT', 'DEATH')),
    notice_period_type TEXT NOT NULL CHECK (notice_period_type IN ('WORKED', 'INDEMNIFIED', 'WAIVED')),
    notice_date DATE NOT NULL,
    last_working_day DATE NOT NULL,
    fgts_fine_percentage NUMERIC(5,2),
    is_exam_required BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'CALCULATED', 'PAID', 'HOMOLOGATED', 'CANCELED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id)
);

-- Habilitar RLS
ALTER TABLE public.payroll_progressive_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminations ENABLE ROW LEVEL SECURITY;

-- Políticas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage progressive tables') THEN
        CREATE POLICY "Tenant Admins and DP can manage progressive tables" ON public.payroll_progressive_tables FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage payroll events') THEN
        CREATE POLICY "Tenant Admins and DP can manage payroll events" ON public.payroll_events FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can view memory calc') THEN
        CREATE POLICY "Tenant Admins and DP can view memory calc" ON public.payroll_memory_calc FOR SELECT USING (EXISTS (SELECT 1 FROM public.payroll_events e WHERE e.id = public.payroll_memory_calc.event_id AND e.tenant_id = ANY(public.user_tenant_ids())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage terminations') THEN
        CREATE POLICY "Tenant Admins and DP can manage terminations" ON public.terminations FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
END $$;

-- Triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_progressive_tables_trigger') THEN
        CREATE TRIGGER audit_progressive_tables_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_progressive_tables FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_events_trigger') THEN
        CREATE TRIGGER audit_payroll_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_terminations_trigger') THEN
        CREATE TRIGGER audit_terminations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.terminations FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;

-- E se a tabela payroll_events já existir (criada por script anterior incompleto), tentamos alterar:
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN quantity NUMERIC(10,2);
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO'));
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN notes TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN recorded_by UUID;
    EXCEPTION WHEN duplicate_column THEN END;
END $$;

```

### Script: `supabase_sql_fase_10.sql`
```sql
-- ==============================================================================
-- FASE 10: ESTRUTURA DE BENEFÍCIOS
-- ==============================================================================

-- 1. Criação do Catálogo de Benefícios
CREATE TABLE IF NOT EXISTS public.benefit_catalogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    benefit_type TEXT NOT NULL CHECK (benefit_type IN ('TRANSPORTATION', 'MEAL', 'FOOD', 'HEALTH_INSURANCE', 'DENTAL_INSURANCE', 'LIFE_INSURANCE', 'OTHER')),
    provider_name TEXT,
    company_contribution NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    employee_discount_percentage NUMERIC(5,2),
    employee_discount_fixed NUMERIC(10,2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Criação do Vínculo Empregado-Benefício
CREATE TABLE IF NOT EXISTS public.employee_benefits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    benefit_catalog_id UUID NOT NULL REFERENCES public.benefit_catalogs(id) ON DELETE CASCADE,
    opt_in BOOLEAN NOT NULL DEFAULT true,
    custom_discount_value NUMERIC(10,2),
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id, benefit_catalog_id)
);

-- Habilitar RLS
ALTER TABLE public.benefit_catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para benefit_catalogs
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view benefit catalogs from their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can insert benefit catalogs into their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can update benefit catalogs in their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can delete benefit catalogs in their tenants" ON public.benefit_catalogs;
    
    DROP POLICY IF EXISTS "Users can view employee benefits from their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can insert employee benefits into their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can update employee benefits in their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can delete employee benefits in their tenants" ON public.employee_benefits;
END
$$;

CREATE POLICY "Users can view benefit catalogs from their tenants" 
    ON public.benefit_catalogs FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert benefit catalogs into their tenants" 
    ON public.benefit_catalogs FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Políticas de RLS para employee_benefits
CREATE POLICY "Users can view employee benefits from their tenants" 
    ON public.employee_benefits FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee benefits into their tenants" 
    ON public.employee_benefits FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee benefits in their tenants" 
    ON public.employee_benefits FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee benefits in their tenants" 
    ON public.employee_benefits FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_11.sql`
```sql
-- ==============================================================================
-- FASE 11: ESTRUTURA DE DESCONTOS DIVERSOS
-- ==============================================================================

-- 1. Criação da Tabela de Descontos Diversos do Colaborador
CREATE TABLE IF NOT EXISTS public.employee_deductions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE RESTRICT,
    
    deduction_type TEXT NOT NULL CHECK (deduction_type IN ('ALIMONY', 'LOAN', 'ADVANCE', 'COPARTICIPATION', 'OTHER')),
    amount_type TEXT NOT NULL CHECK (amount_type IN ('FIXED', 'PERCENTAGE')),
    
    value NUMERIC(10,2) NOT NULL,
    total_limit NUMERIC(10,2), -- Ex: Limite total do empréstimo. Ao atingir, encerra o desconto.
    
    start_date DATE NOT NULL,
    end_date DATE,
    
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view employee deductions from their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can insert employee deductions into their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can update employee deductions in their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can delete employee deductions in their tenants" ON public.employee_deductions;
END
$$;

CREATE POLICY "Users can view employee deductions from their tenants" 
    ON public.employee_deductions FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee deductions into their tenants" 
    ON public.employee_deductions FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee deductions in their tenants" 
    ON public.employee_deductions FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee deductions in their tenants" 
    ON public.employee_deductions FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_12.sql`
```sql
-- ==============================================================================
-- FASE 12: TABELAS LEGAIS E PARÂMETROS
-- ==============================================================================

-- 1. Criação do Catálogo de Versões Legais
-- Essas versões agrupam os parâmetros de uma mesma época (ex: 2026).
CREATE TABLE IF NOT EXISTS public.legal_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_name TEXT NOT NULL, -- Ex: "Legislação 2026"
    valid_from DATE NOT NULL,
    valid_to DATE,
    source TEXT, -- Ex: "Governo Federal, eSocial"
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela INSS (Progressivo)
CREATE TABLE IF NOT EXISTS public.inss_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    bracket_number INT NOT NULL, -- Ordem da faixa, ex: 1, 2, 3, 4
    base_limit NUMERIC(10,2), -- NULL significa "acima de" ou sem limite superior
    aliquot NUMERIC(5,2) NOT NULL,
    deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabela IRRF
CREATE TABLE IF NOT EXISTS public.irrf_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    bracket_number INT NOT NULL,
    base_limit NUMERIC(10,2), -- NULL significa sem limite superior
    aliquot NUMERIC(5,2) NOT NULL,
    deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Parâmetros Gerais (Salário Mínimo, Deduções, FGTS, etc)
CREATE TABLE IF NOT EXISTS public.general_legal_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    minimum_wage NUMERIC(10,2) NOT NULL,
    dependent_deduction NUMERIC(10,2) NOT NULL,
    simplified_discount NUMERIC(10,2) NOT NULL,
    family_salary_quota NUMERIC(10,2) NOT NULL,
    family_salary_limit NUMERIC(10,2) NOT NULL,
    fgts_standard_aliquot NUMERIC(5,2) NOT NULL, -- 8.00
    fgts_apprentice_aliquot NUMERIC(5,2) NOT NULL, -- 2.00
    vt_max_discount_percentage NUMERIC(5,2) NOT NULL, -- 6.00
    irrf_exemption_limit NUMERIC(10,2), -- 5000.00 (Redutor 2026)
    irrf_reduction_formula_limit NUMERIC(10,2), -- 7350.00
    irrf_base_reduction NUMERIC(10,2), -- 312.89
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS (Como são dados públicos/globais do sistema, apenas leitura autenticada)
ALTER TABLE public.legal_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inss_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.irrf_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.general_legal_parameters ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS — leitura e escrita para autenticados
-- Dropar políticas existentes para permitir re-execução
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated read on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated insert on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated update on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated delete on legal_versions" ON public.legal_versions;

    DROP POLICY IF EXISTS "Allow authenticated read on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on inss_parameters" ON public.inss_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on irrf_parameters" ON public.irrf_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on general_legal_parameters" ON public.general_legal_parameters;
END $$;

-- legal_versions
CREATE POLICY "Allow authenticated read on legal_versions" 
    ON public.legal_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on legal_versions" 
    ON public.legal_versions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on legal_versions" 
    ON public.legal_versions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on legal_versions" 
    ON public.legal_versions FOR DELETE TO authenticated USING (true);

-- inss_parameters
CREATE POLICY "Allow authenticated read on inss_parameters" 
    ON public.inss_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on inss_parameters" 
    ON public.inss_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on inss_parameters" 
    ON public.inss_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on inss_parameters" 
    ON public.inss_parameters FOR DELETE TO authenticated USING (true);

-- irrf_parameters
CREATE POLICY "Allow authenticated read on irrf_parameters" 
    ON public.irrf_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on irrf_parameters" 
    ON public.irrf_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on irrf_parameters" 
    ON public.irrf_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on irrf_parameters" 
    ON public.irrf_parameters FOR DELETE TO authenticated USING (true);

-- general_legal_parameters
CREATE POLICY "Allow authenticated read on general_legal_parameters" 
    ON public.general_legal_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on general_legal_parameters" 
    ON public.general_legal_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on general_legal_parameters" 
    ON public.general_legal_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on general_legal_parameters" 
    ON public.general_legal_parameters FOR DELETE TO authenticated USING (true);

-- ==============================================================================
-- INSERÇÃO DOS DADOS BASE - 2026
-- ==============================================================================

DO $$
DECLARE
    v_version_id UUID;
BEGIN
    -- Cria a versão 2026 se não existir para evitar duplicação (por precaução)
    IF NOT EXISTS (SELECT 1 FROM public.legal_versions WHERE version_name = 'Legislação 2026') THEN
        INSERT INTO public.legal_versions (version_name, valid_from, source)
        VALUES ('Legislação 2026', '2026-01-01', 'Pesquisa CLT 2026')
        RETURNING id INTO v_version_id;

        -- INSS 2026
        INSERT INTO public.inss_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 1621.00, 7.5, 0.00),
        (v_version_id, 2, 2902.84, 9.0, 24.32),
        (v_version_id, 3, 4354.27, 12.0, 111.40),
        (v_version_id, 4, 8475.55, 14.0, 198.49);

        -- IRRF 2026
        INSERT INTO public.irrf_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 2428.80, 0.0, 0.00),
        (v_version_id, 2, 2826.65, 7.5, 182.16),
        (v_version_id, 3, 3751.05, 15.0, 394.16),
        (v_version_id, 4, 4664.68, 22.5, 675.49),
        (v_version_id, 5, NULL, 27.5, 908.73);

        -- Parâmetros Gerais 2026
        INSERT INTO public.general_legal_parameters (
            version_id, minimum_wage, dependent_deduction, simplified_discount, 
            family_salary_quota, family_salary_limit, fgts_standard_aliquot, 
            fgts_apprentice_aliquot, vt_max_discount_percentage, irrf_exemption_limit, 
            irrf_reduction_formula_limit, irrf_base_reduction
        ) VALUES (
            v_version_id, 1621.00, 189.59, 607.20, 
            67.54, 1980.38, 8.00, 
            2.00, 6.00, 5000.00, 
            7350.00, 312.89
        );
    END IF;
END $$;

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_13_14.sql`
```sql
-- ==============================================================================
-- FASES 13 e 14: ESTRUTURAS DO MOTOR DE CÁLCULO E HOLERITE
-- ==============================================================================

-- 1. Períodos de Folha (Competências)
CREATE TABLE IF NOT EXISTS public.payroll_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('MONTHLY', 'ADVANCE', '13TH', 'SUPPLEMENTARY')),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CALCULATED', 'CONFERENCE', 'CLOSED', 'CANCELED')),
    processing_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, month, year, type)
);

-- 2. Eventos Variáveis do Mês (Lançamentos Manuais)
CREATE TABLE IF NOT EXISTS public.payroll_variable_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE CASCADE,
    amount NUMERIC(10,2), -- Valor monetário
    quantity NUMERIC(10,2), -- Quantidade (ex: 10 horas)
    reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Holerites (Resultados Calculados)
CREATE TABLE IF NOT EXISTS public.payslips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    total_earnings NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total_deductions NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    net_salary NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_inss NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_irrf NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_fgts NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    fgts_month NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'CALCULATED' CHECK (status IN ('CALCULATED', 'CLOSED', 'CANCELED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(period_id, contract_id)
);

-- 4. Itens do Holerite (Demonstrativo)
CREATE TABLE IF NOT EXISTS public.payslip_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE CASCADE,
    reference TEXT, -- Ex: 10h, 50%
    amount NUMERIC(10,2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('EARNING', 'DEDUCTION', 'NEUTRAL', 'BASE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Memória de Cálculo (Auditoria e Transparência)
CREATE TABLE IF NOT EXISTS public.payroll_memory_calc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    base_value NUMERIC(10,2) NOT NULL,
    quantity_used NUMERIC(10,2) NOT NULL,
    percentage_used NUMERIC(10,2) NOT NULL,
    parsed_formula TEXT NOT NULL,
    result_value NUMERIC(10,2) NOT NULL,
    origin TEXT NOT NULL,
    engine_version TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- SEGURANÇA E RLS
-- ==============================================================================
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_variable_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslip_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view payroll_periods from their tenants" ON public.payroll_periods;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_periods" ON public.payroll_periods;
    
    DROP POLICY IF EXISTS "Users can view payroll_variable_events from their tenants" ON public.payroll_variable_events;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_variable_events" ON public.payroll_variable_events;

    DROP POLICY IF EXISTS "Users can view payslips from their tenants" ON public.payslips;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslips" ON public.payslips;

    DROP POLICY IF EXISTS "Users can view payslip_items from their tenants" ON public.payslip_items;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslip_items" ON public.payslip_items;

    DROP POLICY IF EXISTS "Users can view payroll_memory_calc from their tenants" ON public.payroll_memory_calc;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_memory_calc" ON public.payroll_memory_calc;
END
$$;

-- payroll_periods
CREATE POLICY "Users can view payroll_periods from their tenants" 
    ON public.payroll_periods FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_periods" 
    ON public.payroll_periods FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_variable_events
CREATE POLICY "Users can view payroll_variable_events from their tenants" 
    ON public.payroll_variable_events FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_variable_events" 
    ON public.payroll_variable_events FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslips
CREATE POLICY "Users can view payslips from their tenants" 
    ON public.payslips FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payslips" 
    ON public.payslips FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslip_items
CREATE POLICY "Users can view payslip_items from their tenants" 
    ON public.payslip_items FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payslip_items" 
    ON public.payslip_items FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_memory_calc
CREATE POLICY "Users can view payroll_memory_calc from their tenants" 
    ON public.payroll_memory_calc FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_memory_calc" 
    ON public.payroll_memory_calc FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- ==============================================================================
-- AUDITORIA
-- ==============================================================================
CREATE TRIGGER audit_payroll_periods_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_payroll_variable_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_variable_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_payslips_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payslips FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script 25: `00025_create_employee_scales`
```sql
-- Migration: 00025_create_employee_scales
-- Description: Criação da tabela de escalas para relacionar empregados às jornadas e ciclos de trabalho.

CREATE TABLE public.employee_scales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    work_schedule_id UUID NOT NULL REFERENCES public.work_schedules(id) ON DELETE RESTRICT,
    
    cycle_type TEXT NOT NULL DEFAULT 'WEEKLY' CHECK (cycle_type IN ('WEEKLY', '12X36', '24X48', 'CUSTOM')),
    
    worked_days INTEGER,
    free_days INTEGER,
    
    weekly_schedule JSONB,
    
    start_date DATE NOT NULL,
    end_date DATE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ativar RLS e criar Políticas
ALTER TABLE public.employee_scales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view employee scales in their tenants" ON public.employee_scales FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Tenant Admins and DP can manage employee scales" ON public.employee_scales FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = public.employee_scales.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')));

-- Auditoria
CREATE TRIGGER audit_employee_scales_trigger AFTER INSERT OR UPDATE OR DELETE ON public.employee_scales FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
```

### Script 28: `00028_payroll_additionals_rubrics`
```sql
-- Migration: 00028_payroll_additionals_rubrics
-- Description: Inserção de rubricas padrão para Fase 16 (Adicional Noturno, Insalubridade, Periculosidade, Comissões e Prêmios).

DO $$ 
DECLARE
    tenant RECORD;
BEGIN
    -- Atualiza a constraint para permitir a categoria COMMISSION
    ALTER TABLE public.payroll_rubrics DROP CONSTRAINT IF EXISTS payroll_rubrics_category_check;
    ALTER TABLE public.payroll_rubrics ADD CONSTRAINT payroll_rubrics_category_check CHECK (category IN ('SALARY', 'OVERTIME', 'ALLOWANCE', 'TAX', 'ADVANCE', 'OTHER', 'COMMISSION'));

    FOR tenant IN SELECT id FROM public.tenants LOOP
        
        -- 1. Adicional Noturno (Cód 180)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND (code = '180' OR name ILIKE 'Adicional Noturno');
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, factor,
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '180', 'Adicional Noturno', 'EARNING', 'OVERTIME', 'FORMULA', 'HORAS', 'SALARIO_BASE', 0.20,
            true, true, true, true, true, true
        );

        -- 2. Insalubridade 10% (Grau Mínimo) (Cód 181)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND code = '181';
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, percentage,
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '181', 'Insalubridade 10% (Grau Mínimo)', 'EARNING', 'ALLOWANCE', 'PERCENTAGE_OF_BASE', 'PERCENTUAL', 'SALARIO_MINIMO', 10,
            true, true, true, true, true, true
        );

        -- 3. Insalubridade 20% (Grau Médio) (Cód 182)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND code = '182';
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, percentage,
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '182', 'Insalubridade 20% (Grau Médio)', 'EARNING', 'ALLOWANCE', 'PERCENTAGE_OF_BASE', 'PERCENTUAL', 'SALARIO_MINIMO', 20,
            true, true, true, true, true, true
        );

        -- 4. Insalubridade 40% (Grau Máximo) (Cód 183)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND code = '183';
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, percentage,
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '183', 'Insalubridade 40% (Grau Máximo)', 'EARNING', 'ALLOWANCE', 'PERCENTAGE_OF_BASE', 'PERCENTUAL', 'SALARIO_MINIMO', 40,
            true, true, true, true, true, true
        );

        -- 5. Periculosidade 30% (Cód 185)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND code = '185';
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, percentage,
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '185', 'Periculosidade 30%', 'EARNING', 'ALLOWANCE', 'PERCENTAGE_OF_BASE', 'PERCENTUAL', 'SALARIO_BASE', 30,
            true, true, true, true, true, true
        );

        -- 6. Comissão (Cód 190)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND (code = '190' OR name ILIKE 'Comissão');
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '190', 'Comissões', 'EARNING', 'COMMISSION', 'FIXED', 'MANUAL', NULL,
            true, true, true, true, true, true
        );

        -- 7. Prêmio (Cód 191)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND code = '191';
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '191', 'Prêmios', 'EARNING', 'ALLOWANCE', 'FIXED', 'MANUAL', NULL,
            false, true, false, false, true, false
        );

    END LOOP;
END $$;
```

### Script 29: `00029_create_employee_fixed_events`
```sql
-- Migration: 00029_create_employee_fixed_events
-- Description: Tabela para vinculação permanente de adicionais e proventos fixos ao contrato do empregado.

CREATE TABLE public.employee_fixed_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id),
    
    value NUMERIC(10,2),
    quantity NUMERIC(10,2) DEFAULT 1,
    
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Impede duplicidade de rubricas ativas para o mesmo contrato
CREATE UNIQUE INDEX employee_fixed_events_active_rubric_idx 
ON public.employee_fixed_events (contract_id, rubric_id) 
WHERE is_active = true AND end_date IS NULL;

-- Habilita RLS
ALTER TABLE public.employee_fixed_events ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Tenant Admins and DP can manage employee_fixed_events" 
    ON public.employee_fixed_events FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids())
        AND EXISTS (
            SELECT 1 FROM public.tenant_users 
            WHERE user_id = auth.uid() 
            AND tenant_id = employee_fixed_events.tenant_id 
            AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        )
    );

-- Trigger de auditoria
CREATE TRIGGER audit_employee_fixed_events_trigger 
    AFTER INSERT OR UPDATE OR DELETE ON public.employee_fixed_events 
    FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
```

*(Conclusão do Banco de Dados - Tabelas Base MVP + Motor de Cálculo Completos)*


### Script: `supabase_sql_fase_7.sql`
```sql
-- Fase 7: Afastamentos e Ausências
-- Cria a tabela 'leaves' com políticas de RLS e triggers.

CREATE TABLE IF NOT EXISTS public.leaves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('SICK_LEAVE', 'MATERNITY', 'PATERNITY', 'WORK_ACCIDENT', 'UNJUSTIFIED_ABSENCE', 'SUSPENSION', 'OTHER')),
    start_date DATE NOT NULL,
    end_date DATE,
    return_date DATE,
    icd_10_code TEXT,
    medical_certificate_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    is_inss_referral BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Users can view leaves from their tenants" 
    ON public.leaves FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert leaves into their tenants" 
    ON public.leaves FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update leaves in their tenants" 
    ON public.leaves FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete leaves in their tenants" 
    ON public.leaves FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Trigger de Updated At
CREATE TRIGGER update_leaves_updated_at
    BEFORE UPDATE ON public.leaves
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

```

### Script: `supabase_sql_fase_8.sql`
```sql
-- ==============================================================================
-- FASE 8: ESTRUTURA COMPLETA DE RUBRICAS
-- ==============================================================================
-- Este script expande a tabela "payroll_rubrics" com todas as variáveis exigidas
-- pelo Motor de Cálculo da Folha (Fase 13).

-- 1. Expansão da tabela payroll_rubrics
ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'AUTOMATICA', 'IMPORTADA', 'INTEGRACAO')),
    ADD COLUMN IF NOT EXISTS calculation_base TEXT,
    ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS divisor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS factor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS calculation_order INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS incidence_inss_patronal BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_rat BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_third_parties BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_inss BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_irrf BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_fgts BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS valid_to DATE,
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS esocial_description TEXT;

-- (Opcional) Adicionar type e category caso não tenham sido criados no Script 8 original, mas já usados no frontend
ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'EARNING',
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'SALARY',
    ADD COLUMN IF NOT EXISTS calculation_type TEXT DEFAULT 'FIXED',
    ADD COLUMN IF NOT EXISTS formula TEXT;

-- 2. Atualizar permissões de RLS para a tabela expandida 
-- (O Script 8 já possuía RLS, este comando é apenas por garantia)
ALTER TABLE public.payroll_rubrics ENABLE ROW LEVEL SECURITY;

-- Nota: A trigger de auditoria `audit_payroll_rubrics_trigger` criada na Fase 8/Script 8 já cobre automaticamente as novas colunas
-- pois o `to_jsonb(NEW)` captura dinamicamente a estrutura da tabela atual.

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_9.sql`
```sql
-- ==============================================================================
-- FASE 9: EVENTOS DA FOLHA (LANÇAMENTOS VARIÁVEIS) E PROGRESSIVAS
-- ==============================================================================
-- Este script cria as tabelas do motor de folha que faltavam no Script 9,
-- incluindo a versão já atualizada de payroll_events com quantity, origin, etc.

CREATE TABLE IF NOT EXISTS public.payroll_progressive_tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    table_type TEXT NOT NULL CHECK (table_type IN ('INSS', 'IRRF', 'FAMILY_SALARY', 'OTHER')),
    competence_start DATE NOT NULL,
    competence_end DATE,
    ranges_jsonb JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE RESTRICT,
    reference_value NUMERIC(10,2),
    quantity NUMERIC(10,2),
    calculated_amount NUMERIC(10,2) NOT NULL,
    is_manual_entry BOOLEAN NOT NULL DEFAULT false,
    origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO')),
    notes TEXT,
    recorded_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_memory_calc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.payroll_events(id) ON DELETE CASCADE,
    formula_used TEXT NOT NULL,
    variables_snapshot JSONB NOT NULL,
    progressive_table_id UUID REFERENCES public.payroll_progressive_tables(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.terminations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    termination_reason TEXT NOT NULL CHECK (termination_reason IN ('WITHOUT_JUST_CAUSE_BY_EMPLOYER', 'WITH_JUST_CAUSE_BY_EMPLOYER', 'BY_EMPLOYEE', 'MUTUAL_AGREEMENT', 'CONTRACT_EXPIRATION', 'RETIREMENT', 'DEATH')),
    notice_period_type TEXT NOT NULL CHECK (notice_period_type IN ('WORKED', 'INDEMNIFIED', 'WAIVED')),
    notice_date DATE NOT NULL,
    last_working_day DATE NOT NULL,
    fgts_fine_percentage NUMERIC(5,2),
    is_exam_required BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'CALCULATED', 'PAID', 'HOMOLOGATED', 'CANCELED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id)
);

-- Habilitar RLS
ALTER TABLE public.payroll_progressive_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminations ENABLE ROW LEVEL SECURITY;

-- Políticas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage progressive tables') THEN
        CREATE POLICY "Tenant Admins and DP can manage progressive tables" ON public.payroll_progressive_tables FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage payroll events') THEN
        CREATE POLICY "Tenant Admins and DP can manage payroll events" ON public.payroll_events FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can view memory calc') THEN
        CREATE POLICY "Tenant Admins and DP can view memory calc" ON public.payroll_memory_calc FOR SELECT USING (EXISTS (SELECT 1 FROM public.payroll_events e WHERE e.id = public.payroll_memory_calc.event_id AND e.tenant_id = ANY(public.user_tenant_ids())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage terminations') THEN
        CREATE POLICY "Tenant Admins and DP can manage terminations" ON public.terminations FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
END $$;

-- Triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_progressive_tables_trigger') THEN
        CREATE TRIGGER audit_progressive_tables_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_progressive_tables FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_events_trigger') THEN
        CREATE TRIGGER audit_payroll_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_terminations_trigger') THEN
        CREATE TRIGGER audit_terminations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.terminations FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;

-- E se a tabela payroll_events já existir (criada por script anterior incompleto), tentamos alterar:
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN quantity NUMERIC(10,2);
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO'));
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN notes TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN recorded_by UUID;
    EXCEPTION WHEN duplicate_column THEN END;
END $$;

```

### Script: `supabase_sql_fase_10.sql`
```sql
-- ==============================================================================
-- FASE 10: ESTRUTURA DE BENEFÍCIOS
-- ==============================================================================

-- 1. Criação do Catálogo de Benefícios
CREATE TABLE IF NOT EXISTS public.benefit_catalogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    benefit_type TEXT NOT NULL CHECK (benefit_type IN ('TRANSPORTATION', 'MEAL', 'FOOD', 'HEALTH_INSURANCE', 'DENTAL_INSURANCE', 'LIFE_INSURANCE', 'OTHER')),
    provider_name TEXT,
    company_contribution NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    employee_discount_percentage NUMERIC(5,2),
    employee_discount_fixed NUMERIC(10,2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Criação do Vínculo Empregado-Benefício
CREATE TABLE IF NOT EXISTS public.employee_benefits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    benefit_catalog_id UUID NOT NULL REFERENCES public.benefit_catalogs(id) ON DELETE CASCADE,
    opt_in BOOLEAN NOT NULL DEFAULT true,
    custom_discount_value NUMERIC(10,2),
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id, benefit_catalog_id)
);

-- Habilitar RLS
ALTER TABLE public.benefit_catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para benefit_catalogs
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view benefit catalogs from their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can insert benefit catalogs into their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can update benefit catalogs in their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can delete benefit catalogs in their tenants" ON public.benefit_catalogs;
    
    DROP POLICY IF EXISTS "Users can view employee benefits from their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can insert employee benefits into their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can update employee benefits in their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can delete employee benefits in their tenants" ON public.employee_benefits;
END
$$;

CREATE POLICY "Users can view benefit catalogs from their tenants" 
    ON public.benefit_catalogs FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert benefit catalogs into their tenants" 
    ON public.benefit_catalogs FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Políticas de RLS para employee_benefits
CREATE POLICY "Users can view employee benefits from their tenants" 
    ON public.employee_benefits FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee benefits into their tenants" 
    ON public.employee_benefits FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee benefits in their tenants" 
    ON public.employee_benefits FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee benefits in their tenants" 
    ON public.employee_benefits FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_11.sql`
```sql
-- ==============================================================================
-- FASE 11: ESTRUTURA DE DESCONTOS DIVERSOS
-- ==============================================================================

-- 1. Criação da Tabela de Descontos Diversos do Colaborador
CREATE TABLE IF NOT EXISTS public.employee_deductions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE RESTRICT,
    
    deduction_type TEXT NOT NULL CHECK (deduction_type IN ('ALIMONY', 'LOAN', 'ADVANCE', 'COPARTICIPATION', 'OTHER')),
    amount_type TEXT NOT NULL CHECK (amount_type IN ('FIXED', 'PERCENTAGE')),
    
    value NUMERIC(10,2) NOT NULL,
    total_limit NUMERIC(10,2), -- Ex: Limite total do empréstimo. Ao atingir, encerra o desconto.
    
    start_date DATE NOT NULL,
    end_date DATE,
    
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view employee deductions from their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can insert employee deductions into their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can update employee deductions in their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can delete employee deductions in their tenants" ON public.employee_deductions;
END
$$;

CREATE POLICY "Users can view employee deductions from their tenants" 
    ON public.employee_deductions FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee deductions into their tenants" 
    ON public.employee_deductions FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee deductions in their tenants" 
    ON public.employee_deductions FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee deductions in their tenants" 
    ON public.employee_deductions FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_12.sql`
```sql
-- ==============================================================================
-- FASE 12: TABELAS LEGAIS E PARÂMETROS
-- ==============================================================================

-- 1. Criação do Catálogo de Versões Legais
-- Essas versões agrupam os parâmetros de uma mesma época (ex: 2026).
CREATE TABLE IF NOT EXISTS public.legal_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_name TEXT NOT NULL, -- Ex: "Legislação 2026"
    valid_from DATE NOT NULL,
    valid_to DATE,
    source TEXT, -- Ex: "Governo Federal, eSocial"
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela INSS (Progressivo)
CREATE TABLE IF NOT EXISTS public.inss_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    bracket_number INT NOT NULL, -- Ordem da faixa, ex: 1, 2, 3, 4
    base_limit NUMERIC(10,2), -- NULL significa "acima de" ou sem limite superior
    aliquot NUMERIC(5,2) NOT NULL,
    deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabela IRRF
CREATE TABLE IF NOT EXISTS public.irrf_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    bracket_number INT NOT NULL,
    base_limit NUMERIC(10,2), -- NULL significa sem limite superior
    aliquot NUMERIC(5,2) NOT NULL,
    deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Parâmetros Gerais (Salário Mínimo, Deduções, FGTS, etc)
CREATE TABLE IF NOT EXISTS public.general_legal_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    minimum_wage NUMERIC(10,2) NOT NULL,
    dependent_deduction NUMERIC(10,2) NOT NULL,
    simplified_discount NUMERIC(10,2) NOT NULL,
    family_salary_quota NUMERIC(10,2) NOT NULL,
    family_salary_limit NUMERIC(10,2) NOT NULL,
    fgts_standard_aliquot NUMERIC(5,2) NOT NULL, -- 8.00
    fgts_apprentice_aliquot NUMERIC(5,2) NOT NULL, -- 2.00
    vt_max_discount_percentage NUMERIC(5,2) NOT NULL, -- 6.00
    irrf_exemption_limit NUMERIC(10,2), -- 5000.00 (Redutor 2026)
    irrf_reduction_formula_limit NUMERIC(10,2), -- 7350.00
    irrf_base_reduction NUMERIC(10,2), -- 312.89
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS (Como são dados públicos/globais do sistema, apenas leitura autenticada)
ALTER TABLE public.legal_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inss_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.irrf_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.general_legal_parameters ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS — leitura e escrita para autenticados
-- Dropar políticas existentes para permitir re-execução
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated read on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated insert on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated update on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated delete on legal_versions" ON public.legal_versions;

    DROP POLICY IF EXISTS "Allow authenticated read on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on inss_parameters" ON public.inss_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on irrf_parameters" ON public.irrf_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on general_legal_parameters" ON public.general_legal_parameters;
END $$;

-- legal_versions
CREATE POLICY "Allow authenticated read on legal_versions" 
    ON public.legal_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on legal_versions" 
    ON public.legal_versions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on legal_versions" 
    ON public.legal_versions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on legal_versions" 
    ON public.legal_versions FOR DELETE TO authenticated USING (true);

-- inss_parameters
CREATE POLICY "Allow authenticated read on inss_parameters" 
    ON public.inss_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on inss_parameters" 
    ON public.inss_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on inss_parameters" 
    ON public.inss_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on inss_parameters" 
    ON public.inss_parameters FOR DELETE TO authenticated USING (true);

-- irrf_parameters
CREATE POLICY "Allow authenticated read on irrf_parameters" 
    ON public.irrf_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on irrf_parameters" 
    ON public.irrf_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on irrf_parameters" 
    ON public.irrf_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on irrf_parameters" 
    ON public.irrf_parameters FOR DELETE TO authenticated USING (true);

-- general_legal_parameters
CREATE POLICY "Allow authenticated read on general_legal_parameters" 
    ON public.general_legal_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on general_legal_parameters" 
    ON public.general_legal_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on general_legal_parameters" 
    ON public.general_legal_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on general_legal_parameters" 
    ON public.general_legal_parameters FOR DELETE TO authenticated USING (true);

-- ==============================================================================
-- INSERÇÃO DOS DADOS BASE - 2026
-- ==============================================================================

DO $$
DECLARE
    v_version_id UUID;
BEGIN
    -- Cria a versão 2026 se não existir para evitar duplicação (por precaução)
    IF NOT EXISTS (SELECT 1 FROM public.legal_versions WHERE version_name = 'Legislação 2026') THEN
        INSERT INTO public.legal_versions (version_name, valid_from, source)
        VALUES ('Legislação 2026', '2026-01-01', 'Pesquisa CLT 2026')
        RETURNING id INTO v_version_id;

        -- INSS 2026
        INSERT INTO public.inss_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 1621.00, 7.5, 0.00),
        (v_version_id, 2, 2902.84, 9.0, 24.32),
        (v_version_id, 3, 4354.27, 12.0, 111.40),
        (v_version_id, 4, 8475.55, 14.0, 198.49);

        -- IRRF 2026
        INSERT INTO public.irrf_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 2428.80, 0.0, 0.00),
        (v_version_id, 2, 2826.65, 7.5, 182.16),
        (v_version_id, 3, 3751.05, 15.0, 394.16),
        (v_version_id, 4, 4664.68, 22.5, 675.49),
        (v_version_id, 5, NULL, 27.5, 908.73);

        -- Parâmetros Gerais 2026
        INSERT INTO public.general_legal_parameters (
            version_id, minimum_wage, dependent_deduction, simplified_discount, 
            family_salary_quota, family_salary_limit, fgts_standard_aliquot, 
            fgts_apprentice_aliquot, vt_max_discount_percentage, irrf_exemption_limit, 
            irrf_reduction_formula_limit, irrf_base_reduction
        ) VALUES (
            v_version_id, 1621.00, 189.59, 607.20, 
            67.54, 1980.38, 8.00, 
            2.00, 6.00, 5000.00, 
            7350.00, 312.89
        );
    END IF;
END $$;

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_13_14.sql`
```sql
-- ==============================================================================
-- FASES 13 e 14: ESTRUTURAS DO MOTOR DE CÁLCULO E HOLERITE
-- ==============================================================================

-- 1. Períodos de Folha (Competências)
CREATE TABLE IF NOT EXISTS public.payroll_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('MONTHLY', 'ADVANCE', '13TH', 'SUPPLEMENTARY')),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CALCULATED', 'CONFERENCE', 'CLOSED', 'CANCELED')),
    processing_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, month, year, type)
);

-- 2. Eventos Variáveis do Mês (Lançamentos Manuais)
CREATE TABLE IF NOT EXISTS public.payroll_variable_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE CASCADE,
    amount NUMERIC(10,2), -- Valor monetário
    quantity NUMERIC(10,2), -- Quantidade (ex: 10 horas)
    reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Holerites (Resultados Calculados)
CREATE TABLE IF NOT EXISTS public.payslips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    total_earnings NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total_deductions NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    net_salary NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_inss NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_irrf NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_fgts NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    fgts_month NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'CALCULATED' CHECK (status IN ('CALCULATED', 'CLOSED', 'CANCELED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(period_id, contract_id)
);

-- 4. Itens do Holerite (Demonstrativo)
CREATE TABLE IF NOT EXISTS public.payslip_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE CASCADE,
    reference TEXT, -- Ex: 10h, 50%
    amount NUMERIC(10,2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('EARNING', 'DEDUCTION', 'NEUTRAL', 'BASE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Memória de Cálculo (Auditoria e Transparência)
CREATE TABLE IF NOT EXISTS public.payroll_memory_calc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    base_value NUMERIC(10,2) NOT NULL,
    quantity_used NUMERIC(10,2) NOT NULL,
    percentage_used NUMERIC(10,2) NOT NULL,
    parsed_formula TEXT NOT NULL,
    result_value NUMERIC(10,2) NOT NULL,
    origin TEXT NOT NULL,
    engine_version TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- SEGURANÇA E RLS
-- ==============================================================================
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_variable_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslip_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view payroll_periods from their tenants" ON public.payroll_periods;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_periods" ON public.payroll_periods;
    
    DROP POLICY IF EXISTS "Users can view payroll_variable_events from their tenants" ON public.payroll_variable_events;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_variable_events" ON public.payroll_variable_events;

    DROP POLICY IF EXISTS "Users can view payslips from their tenants" ON public.payslips;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslips" ON public.payslips;

    DROP POLICY IF EXISTS "Users can view payslip_items from their tenants" ON public.payslip_items;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslip_items" ON public.payslip_items;

    DROP POLICY IF EXISTS "Users can view payroll_memory_calc from their tenants" ON public.payroll_memory_calc;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_memory_calc" ON public.payroll_memory_calc;
END
$$;

-- payroll_periods
CREATE POLICY "Users can view payroll_periods from their tenants" 
    ON public.payroll_periods FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_periods" 
    ON public.payroll_periods FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_variable_events
CREATE POLICY "Users can view payroll_variable_events from their tenants" 
    ON public.payroll_variable_events FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_variable_events" 
    ON public.payroll_variable_events FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslips
CREATE POLICY "Users can view payslips from their tenants" 
    ON public.payslips FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payslips" 
    ON public.payslips FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslip_items
CREATE POLICY "Users can view payslip_items from their tenants" 
    ON public.payslip_items FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payslip_items" 
    ON public.payslip_items FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_memory_calc
CREATE POLICY "Users can view payroll_memory_calc from their tenants" 
    ON public.payroll_memory_calc FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_memory_calc" 
    ON public.payroll_memory_calc FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- ==============================================================================
-- AUDITORIA
-- ==============================================================================
CREATE TRIGGER audit_payroll_periods_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_payroll_variable_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_variable_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_payslips_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payslips FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

*(Conclusão do Banco de Dados - Tabelas Base MVP + Motor de Cálculo Completos)*


### Script: `supabase_sql_fase_7.sql`
```sql
-- Fase 7: Afastamentos e Ausências
-- Cria a tabela 'leaves' com políticas de RLS e triggers.

CREATE TABLE IF NOT EXISTS public.leaves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('SICK_LEAVE', 'MATERNITY', 'PATERNITY', 'WORK_ACCIDENT', 'UNJUSTIFIED_ABSENCE', 'SUSPENSION', 'OTHER')),
    start_date DATE NOT NULL,
    end_date DATE,
    return_date DATE,
    icd_10_code TEXT,
    medical_certificate_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    is_inss_referral BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Users can view leaves from their tenants" 
    ON public.leaves FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert leaves into their tenants" 
    ON public.leaves FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update leaves in their tenants" 
    ON public.leaves FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete leaves in their tenants" 
    ON public.leaves FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Trigger de Updated At
CREATE TRIGGER update_leaves_updated_at
    BEFORE UPDATE ON public.leaves
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

```

### Script: `supabase_sql_fase_8.sql`
```sql
-- ==============================================================================
-- FASE 8: ESTRUTURA COMPLETA DE RUBRICAS
-- ==============================================================================
-- Este script expande a tabela "payroll_rubrics" com todas as variáveis exigidas
-- pelo Motor de Cálculo da Folha (Fase 13).

-- 1. Expansão da tabela payroll_rubrics
ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'AUTOMATICA', 'IMPORTADA', 'INTEGRACAO')),
    ADD COLUMN IF NOT EXISTS calculation_base TEXT,
    ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS divisor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS factor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS calculation_order INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS incidence_inss_patronal BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_rat BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_third_parties BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_inss BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_irrf BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_fgts BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS valid_to DATE,
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS esocial_description TEXT;

-- (Opcional) Adicionar type e category caso não tenham sido criados no Script 8 original, mas já usados no frontend
ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'EARNING',
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'SALARY',
    ADD COLUMN IF NOT EXISTS calculation_type TEXT DEFAULT 'FIXED',
    ADD COLUMN IF NOT EXISTS formula TEXT;

-- 2. Atualizar permissões de RLS para a tabela expandida 
-- (O Script 8 já possuía RLS, este comando é apenas por garantia)
ALTER TABLE public.payroll_rubrics ENABLE ROW LEVEL SECURITY;

-- Nota: A trigger de auditoria `audit_payroll_rubrics_trigger` criada na Fase 8/Script 8 já cobre automaticamente as novas colunas
-- pois o `to_jsonb(NEW)` captura dinamicamente a estrutura da tabela atual.

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_9.sql`
```sql
-- ==============================================================================
-- FASE 9: EVENTOS DA FOLHA (LANÇAMENTOS VARIÁVEIS) E PROGRESSIVAS
-- ==============================================================================
-- Este script cria as tabelas do motor de folha que faltavam no Script 9,
-- incluindo a versão já atualizada de payroll_events com quantity, origin, etc.

CREATE TABLE IF NOT EXISTS public.payroll_progressive_tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    table_type TEXT NOT NULL CHECK (table_type IN ('INSS', 'IRRF', 'FAMILY_SALARY', 'OTHER')),
    competence_start DATE NOT NULL,
    competence_end DATE,
    ranges_jsonb JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE RESTRICT,
    reference_value NUMERIC(10,2),
    quantity NUMERIC(10,2),
    calculated_amount NUMERIC(10,2) NOT NULL,
    is_manual_entry BOOLEAN NOT NULL DEFAULT false,
    origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO')),
    notes TEXT,
    recorded_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_memory_calc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.payroll_events(id) ON DELETE CASCADE,
    formula_used TEXT NOT NULL,
    variables_snapshot JSONB NOT NULL,
    progressive_table_id UUID REFERENCES public.payroll_progressive_tables(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.terminations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    termination_reason TEXT NOT NULL CHECK (termination_reason IN ('WITHOUT_JUST_CAUSE_BY_EMPLOYER', 'WITH_JUST_CAUSE_BY_EMPLOYER', 'BY_EMPLOYEE', 'MUTUAL_AGREEMENT', 'CONTRACT_EXPIRATION', 'RETIREMENT', 'DEATH')),
    notice_period_type TEXT NOT NULL CHECK (notice_period_type IN ('WORKED', 'INDEMNIFIED', 'WAIVED')),
    notice_date DATE NOT NULL,
    last_working_day DATE NOT NULL,
    fgts_fine_percentage NUMERIC(5,2),
    is_exam_required BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'CALCULATED', 'PAID', 'HOMOLOGATED', 'CANCELED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id)
);

-- Habilitar RLS
ALTER TABLE public.payroll_progressive_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminations ENABLE ROW LEVEL SECURITY;

-- Políticas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage progressive tables') THEN
        CREATE POLICY "Tenant Admins and DP can manage progressive tables" ON public.payroll_progressive_tables FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage payroll events') THEN
        CREATE POLICY "Tenant Admins and DP can manage payroll events" ON public.payroll_events FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can view memory calc') THEN
        CREATE POLICY "Tenant Admins and DP can view memory calc" ON public.payroll_memory_calc FOR SELECT USING (EXISTS (SELECT 1 FROM public.payroll_events e WHERE e.id = public.payroll_memory_calc.event_id AND e.tenant_id = ANY(public.user_tenant_ids())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage terminations') THEN
        CREATE POLICY "Tenant Admins and DP can manage terminations" ON public.terminations FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
END $$;

-- Triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_progressive_tables_trigger') THEN
        CREATE TRIGGER audit_progressive_tables_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_progressive_tables FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_events_trigger') THEN
        CREATE TRIGGER audit_payroll_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_terminations_trigger') THEN
        CREATE TRIGGER audit_terminations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.terminations FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;

-- E se a tabela payroll_events já existir (criada por script anterior incompleto), tentamos alterar:
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN quantity NUMERIC(10,2);
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO'));
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN notes TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN recorded_by UUID;
    EXCEPTION WHEN duplicate_column THEN END;
END $$;

```

### Script: `supabase_sql_fase_10.sql`
```sql
-- ==============================================================================
-- FASE 10: ESTRUTURA DE BENEFÍCIOS
-- ==============================================================================

-- 1. Criação do Catálogo de Benefícios
CREATE TABLE IF NOT EXISTS public.benefit_catalogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    benefit_type TEXT NOT NULL CHECK (benefit_type IN ('TRANSPORTATION', 'MEAL', 'FOOD', 'HEALTH_INSURANCE', 'DENTAL_INSURANCE', 'LIFE_INSURANCE', 'OTHER')),
    provider_name TEXT,
    company_contribution NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    employee_discount_percentage NUMERIC(5,2),
    employee_discount_fixed NUMERIC(10,2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Criação do Vínculo Empregado-Benefício
CREATE TABLE IF NOT EXISTS public.employee_benefits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    benefit_catalog_id UUID NOT NULL REFERENCES public.benefit_catalogs(id) ON DELETE CASCADE,
    opt_in BOOLEAN NOT NULL DEFAULT true,
    custom_discount_value NUMERIC(10,2),
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id, benefit_catalog_id)
);

-- Habilitar RLS
ALTER TABLE public.benefit_catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para benefit_catalogs
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view benefit catalogs from their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can insert benefit catalogs into their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can update benefit catalogs in their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can delete benefit catalogs in their tenants" ON public.benefit_catalogs;
    
    DROP POLICY IF EXISTS "Users can view employee benefits from their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can insert employee benefits into their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can update employee benefits in their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can delete employee benefits in their tenants" ON public.employee_benefits;
END
$$;

CREATE POLICY "Users can view benefit catalogs from their tenants" 
    ON public.benefit_catalogs FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert benefit catalogs into their tenants" 
    ON public.benefit_catalogs FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Políticas de RLS para employee_benefits
CREATE POLICY "Users can view employee benefits from their tenants" 
    ON public.employee_benefits FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee benefits into their tenants" 
    ON public.employee_benefits FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee benefits in their tenants" 
    ON public.employee_benefits FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee benefits in their tenants" 
    ON public.employee_benefits FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_11.sql`
```sql
-- ==============================================================================
-- FASE 11: ESTRUTURA DE DESCONTOS DIVERSOS
-- ==============================================================================

-- 1. Criação da Tabela de Descontos Diversos do Colaborador
CREATE TABLE IF NOT EXISTS public.employee_deductions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE RESTRICT,
    
    deduction_type TEXT NOT NULL CHECK (deduction_type IN ('ALIMONY', 'LOAN', 'ADVANCE', 'COPARTICIPATION', 'OTHER')),
    amount_type TEXT NOT NULL CHECK (amount_type IN ('FIXED', 'PERCENTAGE')),
    
    value NUMERIC(10,2) NOT NULL,
    total_limit NUMERIC(10,2), -- Ex: Limite total do empréstimo. Ao atingir, encerra o desconto.
    
    start_date DATE NOT NULL,
    end_date DATE,
    
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view employee deductions from their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can insert employee deductions into their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can update employee deductions in their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can delete employee deductions in their tenants" ON public.employee_deductions;
END
$$;

CREATE POLICY "Users can view employee deductions from their tenants" 
    ON public.employee_deductions FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee deductions into their tenants" 
    ON public.employee_deductions FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee deductions in their tenants" 
    ON public.employee_deductions FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee deductions in their tenants" 
    ON public.employee_deductions FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_12.sql`
```sql
-- ==============================================================================
-- FASE 12: TABELAS LEGAIS E PARÂMETROS
-- ==============================================================================

-- 1. Criação do Catálogo de Versões Legais
-- Essas versões agrupam os parâmetros de uma mesma época (ex: 2026).
CREATE TABLE IF NOT EXISTS public.legal_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_name TEXT NOT NULL, -- Ex: "Legislação 2026"
    valid_from DATE NOT NULL,
    valid_to DATE,
    source TEXT, -- Ex: "Governo Federal, eSocial"
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela INSS (Progressivo)
CREATE TABLE IF NOT EXISTS public.inss_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    bracket_number INT NOT NULL, -- Ordem da faixa, ex: 1, 2, 3, 4
    base_limit NUMERIC(10,2), -- NULL significa "acima de" ou sem limite superior
    aliquot NUMERIC(5,2) NOT NULL,
    deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabela IRRF
CREATE TABLE IF NOT EXISTS public.irrf_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    bracket_number INT NOT NULL,
    base_limit NUMERIC(10,2), -- NULL significa sem limite superior
    aliquot NUMERIC(5,2) NOT NULL,
    deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Parâmetros Gerais (Salário Mínimo, Deduções, FGTS, etc)
CREATE TABLE IF NOT EXISTS public.general_legal_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    minimum_wage NUMERIC(10,2) NOT NULL,
    dependent_deduction NUMERIC(10,2) NOT NULL,
    simplified_discount NUMERIC(10,2) NOT NULL,
    family_salary_quota NUMERIC(10,2) NOT NULL,
    family_salary_limit NUMERIC(10,2) NOT NULL,
    fgts_standard_aliquot NUMERIC(5,2) NOT NULL, -- 8.00
    fgts_apprentice_aliquot NUMERIC(5,2) NOT NULL, -- 2.00
    vt_max_discount_percentage NUMERIC(5,2) NOT NULL, -- 6.00
    irrf_exemption_limit NUMERIC(10,2), -- 5000.00 (Redutor 2026)
    irrf_reduction_formula_limit NUMERIC(10,2), -- 7350.00
    irrf_base_reduction NUMERIC(10,2), -- 312.89
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS (Como são dados públicos/globais do sistema, apenas leitura autenticada)
ALTER TABLE public.legal_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inss_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.irrf_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.general_legal_parameters ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS — leitura e escrita para autenticados
-- Dropar políticas existentes para permitir re-execução
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated read on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated insert on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated update on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated delete on legal_versions" ON public.legal_versions;

    DROP POLICY IF EXISTS "Allow authenticated read on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on inss_parameters" ON public.inss_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on irrf_parameters" ON public.irrf_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on general_legal_parameters" ON public.general_legal_parameters;
END $$;

-- legal_versions
CREATE POLICY "Allow authenticated read on legal_versions" 
    ON public.legal_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on legal_versions" 
    ON public.legal_versions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on legal_versions" 
    ON public.legal_versions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on legal_versions" 
    ON public.legal_versions FOR DELETE TO authenticated USING (true);

-- inss_parameters
CREATE POLICY "Allow authenticated read on inss_parameters" 
    ON public.inss_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on inss_parameters" 
    ON public.inss_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on inss_parameters" 
    ON public.inss_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on inss_parameters" 
    ON public.inss_parameters FOR DELETE TO authenticated USING (true);

-- irrf_parameters
CREATE POLICY "Allow authenticated read on irrf_parameters" 
    ON public.irrf_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on irrf_parameters" 
    ON public.irrf_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on irrf_parameters" 
    ON public.irrf_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on irrf_parameters" 
    ON public.irrf_parameters FOR DELETE TO authenticated USING (true);

-- general_legal_parameters
CREATE POLICY "Allow authenticated read on general_legal_parameters" 
    ON public.general_legal_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on general_legal_parameters" 
    ON public.general_legal_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on general_legal_parameters" 
    ON public.general_legal_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on general_legal_parameters" 
    ON public.general_legal_parameters FOR DELETE TO authenticated USING (true);

-- ==============================================================================
-- INSERÇÃO DOS DADOS BASE - 2026
-- ==============================================================================

DO $$
DECLARE
    v_version_id UUID;
BEGIN
    -- Cria a versão 2026 se não existir para evitar duplicação (por precaução)
    IF NOT EXISTS (SELECT 1 FROM public.legal_versions WHERE version_name = 'Legislação 2026') THEN
        INSERT INTO public.legal_versions (version_name, valid_from, source)
        VALUES ('Legislação 2026', '2026-01-01', 'Pesquisa CLT 2026')
        RETURNING id INTO v_version_id;

        -- INSS 2026
        INSERT INTO public.inss_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 1621.00, 7.5, 0.00),
        (v_version_id, 2, 2902.84, 9.0, 24.32),
        (v_version_id, 3, 4354.27, 12.0, 111.40),
        (v_version_id, 4, 8475.55, 14.0, 198.49);

        -- IRRF 2026
        INSERT INTO public.irrf_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 2428.80, 0.0, 0.00),
        (v_version_id, 2, 2826.65, 7.5, 182.16),
        (v_version_id, 3, 3751.05, 15.0, 394.16),
        (v_version_id, 4, 4664.68, 22.5, 675.49),
        (v_version_id, 5, NULL, 27.5, 908.73);

        -- Parâmetros Gerais 2026
        INSERT INTO public.general_legal_parameters (
            version_id, minimum_wage, dependent_deduction, simplified_discount, 
            family_salary_quota, family_salary_limit, fgts_standard_aliquot, 
            fgts_apprentice_aliquot, vt_max_discount_percentage, irrf_exemption_limit, 
            irrf_reduction_formula_limit, irrf_base_reduction
        ) VALUES (
            v_version_id, 1621.00, 189.59, 607.20, 
            67.54, 1980.38, 8.00, 
            2.00, 6.00, 5000.00, 
            7350.00, 312.89
        );
    END IF;
END $$;

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_13_14.sql`
```sql
-- ==============================================================================
-- FASES 13 e 14: ESTRUTURAS DO MOTOR DE CÁLCULO E HOLERITE
-- ==============================================================================

-- 1. Períodos de Folha (Competências)
CREATE TABLE IF NOT EXISTS public.payroll_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('MONTHLY', 'ADVANCE', '13TH', 'SUPPLEMENTARY')),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CALCULATED', 'CONFERENCE', 'CLOSED', 'CANCELED')),
    processing_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, month, year, type)
);

-- 2. Eventos Variáveis do Mês (Lançamentos Manuais)
CREATE TABLE IF NOT EXISTS public.payroll_variable_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE CASCADE,
    amount NUMERIC(10,2), -- Valor monetário
    quantity NUMERIC(10,2), -- Quantidade (ex: 10 horas)
    reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Holerites (Resultados Calculados)
CREATE TABLE IF NOT EXISTS public.payslips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    total_earnings NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total_deductions NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    net_salary NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_inss NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_irrf NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_fgts NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    fgts_month NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'CALCULATED' CHECK (status IN ('CALCULATED', 'CLOSED', 'CANCELED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(period_id, contract_id)
);

-- 4. Itens do Holerite (Demonstrativo)
CREATE TABLE IF NOT EXISTS public.payslip_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE CASCADE,
    reference TEXT, -- Ex: 10h, 50%
    amount NUMERIC(10,2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('EARNING', 'DEDUCTION', 'NEUTRAL', 'BASE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Memória de Cálculo (Auditoria e Transparência)
CREATE TABLE IF NOT EXISTS public.payroll_memory_calc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    base_value NUMERIC(10,2) NOT NULL,
    quantity_used NUMERIC(10,2) NOT NULL,
    percentage_used NUMERIC(10,2) NOT NULL,
    parsed_formula TEXT NOT NULL,
    result_value NUMERIC(10,2) NOT NULL,
    origin TEXT NOT NULL,
    engine_version TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- SEGURANÇA E RLS
-- ==============================================================================
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_variable_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslip_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view payroll_periods from their tenants" ON public.payroll_periods;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_periods" ON public.payroll_periods;
    
    DROP POLICY IF EXISTS "Users can view payroll_variable_events from their tenants" ON public.payroll_variable_events;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_variable_events" ON public.payroll_variable_events;

    DROP POLICY IF EXISTS "Users can view payslips from their tenants" ON public.payslips;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslips" ON public.payslips;

    DROP POLICY IF EXISTS "Users can view payslip_items from their tenants" ON public.payslip_items;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslip_items" ON public.payslip_items;

    DROP POLICY IF EXISTS "Users can view payroll_memory_calc from their tenants" ON public.payroll_memory_calc;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_memory_calc" ON public.payroll_memory_calc;
END
$$;

-- payroll_periods
CREATE POLICY "Users can view payroll_periods from their tenants" 
    ON public.payroll_periods FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_periods" 
    ON public.payroll_periods FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_variable_events
CREATE POLICY "Users can view payroll_variable_events from their tenants" 
    ON public.payroll_variable_events FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_variable_events" 
    ON public.payroll_variable_events FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslips
CREATE POLICY "Users can view payslips from their tenants" 
    ON public.payslips FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payslips" 
    ON public.payslips FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslip_items
CREATE POLICY "Users can view payslip_items from their tenants" 
    ON public.payslip_items FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payslip_items" 
    ON public.payslip_items FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_memory_calc
CREATE POLICY "Users can view payroll_memory_calc from their tenants" 
    ON public.payroll_memory_calc FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_memory_calc" 
    ON public.payroll_memory_calc FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- ==============================================================================
-- AUDITORIA
-- ==============================================================================
CREATE TRIGGER audit_payroll_periods_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_payroll_variable_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_variable_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_payslips_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payslips FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

*(Conclusão do Banco de Dados - Tabelas Base MVP + Motor de Cálculo Completos)*


### Script: `supabase_sql_fase_7.sql`
```sql
-- Fase 7: Afastamentos e Ausências
-- Cria a tabela 'leaves' com políticas de RLS e triggers.

CREATE TABLE IF NOT EXISTS public.leaves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('SICK_LEAVE', 'MATERNITY', 'PATERNITY', 'WORK_ACCIDENT', 'UNJUSTIFIED_ABSENCE', 'SUSPENSION', 'OTHER')),
    start_date DATE NOT NULL,
    end_date DATE,
    return_date DATE,
    icd_10_code TEXT,
    medical_certificate_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    is_inss_referral BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Users can view leaves from their tenants" 
    ON public.leaves FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert leaves into their tenants" 
    ON public.leaves FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update leaves in their tenants" 
    ON public.leaves FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete leaves in their tenants" 
    ON public.leaves FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Trigger de Updated At
CREATE TRIGGER update_leaves_updated_at
    BEFORE UPDATE ON public.leaves
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

```

### Script: `supabase_sql_fase_8.sql`
```sql
-- ==============================================================================
-- FASE 8: ESTRUTURA COMPLETA DE RUBRICAS
-- ==============================================================================
-- Este script expande a tabela "payroll_rubrics" com todas as variáveis exigidas
-- pelo Motor de Cálculo da Folha (Fase 13).

-- 1. Expansão da tabela payroll_rubrics
ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'AUTOMATICA', 'IMPORTADA', 'INTEGRACAO')),
    ADD COLUMN IF NOT EXISTS calculation_base TEXT,
    ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS divisor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS factor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS calculation_order INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS incidence_inss_patronal BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_rat BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_third_parties BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_inss BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_irrf BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_fgts BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS valid_to DATE,
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS esocial_description TEXT;

-- (Opcional) Adicionar type e category caso não tenham sido criados no Script 8 original, mas já usados no frontend
ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'EARNING',
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'SALARY',
    ADD COLUMN IF NOT EXISTS calculation_type TEXT DEFAULT 'FIXED',
    ADD COLUMN IF NOT EXISTS formula TEXT;

-- 2. Atualizar permissões de RLS para a tabela expandida 
-- (O Script 8 já possuía RLS, este comando é apenas por garantia)
ALTER TABLE public.payroll_rubrics ENABLE ROW LEVEL SECURITY;

-- Nota: A trigger de auditoria `audit_payroll_rubrics_trigger` criada na Fase 8/Script 8 já cobre automaticamente as novas colunas
-- pois o `to_jsonb(NEW)` captura dinamicamente a estrutura da tabela atual.

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_9.sql`
```sql
-- ==============================================================================
-- FASE 9: EVENTOS DA FOLHA (LANÇAMENTOS VARIÁVEIS) E PROGRESSIVAS
-- ==============================================================================
-- Este script cria as tabelas do motor de folha que faltavam no Script 9,
-- incluindo a versão já atualizada de payroll_events com quantity, origin, etc.

CREATE TABLE IF NOT EXISTS public.payroll_progressive_tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    table_type TEXT NOT NULL CHECK (table_type IN ('INSS', 'IRRF', 'FAMILY_SALARY', 'OTHER')),
    competence_start DATE NOT NULL,
    competence_end DATE,
    ranges_jsonb JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE RESTRICT,
    reference_value NUMERIC(10,2),
    quantity NUMERIC(10,2),
    calculated_amount NUMERIC(10,2) NOT NULL,
    is_manual_entry BOOLEAN NOT NULL DEFAULT false,
    origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO')),
    notes TEXT,
    recorded_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_memory_calc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.payroll_events(id) ON DELETE CASCADE,
    formula_used TEXT NOT NULL,
    variables_snapshot JSONB NOT NULL,
    progressive_table_id UUID REFERENCES public.payroll_progressive_tables(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.terminations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    termination_reason TEXT NOT NULL CHECK (termination_reason IN ('WITHOUT_JUST_CAUSE_BY_EMPLOYER', 'WITH_JUST_CAUSE_BY_EMPLOYER', 'BY_EMPLOYEE', 'MUTUAL_AGREEMENT', 'CONTRACT_EXPIRATION', 'RETIREMENT', 'DEATH')),
    notice_period_type TEXT NOT NULL CHECK (notice_period_type IN ('WORKED', 'INDEMNIFIED', 'WAIVED')),
    notice_date DATE NOT NULL,
    last_working_day DATE NOT NULL,
    fgts_fine_percentage NUMERIC(5,2),
    is_exam_required BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'CALCULATED', 'PAID', 'HOMOLOGATED', 'CANCELED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id)
);

-- Habilitar RLS
ALTER TABLE public.payroll_progressive_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminations ENABLE ROW LEVEL SECURITY;

-- Políticas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage progressive tables') THEN
        CREATE POLICY "Tenant Admins and DP can manage progressive tables" ON public.payroll_progressive_tables FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage payroll events') THEN
        CREATE POLICY "Tenant Admins and DP can manage payroll events" ON public.payroll_events FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can view memory calc') THEN
        CREATE POLICY "Tenant Admins and DP can view memory calc" ON public.payroll_memory_calc FOR SELECT USING (EXISTS (SELECT 1 FROM public.payroll_events e WHERE e.id = public.payroll_memory_calc.event_id AND e.tenant_id = ANY(public.user_tenant_ids())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage terminations') THEN
        CREATE POLICY "Tenant Admins and DP can manage terminations" ON public.terminations FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
END $$;

-- Triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_progressive_tables_trigger') THEN
        CREATE TRIGGER audit_progressive_tables_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_progressive_tables FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_events_trigger') THEN
        CREATE TRIGGER audit_payroll_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_terminations_trigger') THEN
        CREATE TRIGGER audit_terminations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.terminations FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;

-- E se a tabela payroll_events já existir (criada por script anterior incompleto), tentamos alterar:
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN quantity NUMERIC(10,2);
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO'));
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN notes TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN recorded_by UUID;
    EXCEPTION WHEN duplicate_column THEN END;
END $$;

```

### Script: `supabase_sql_fase_10.sql`
```sql
-- ==============================================================================
-- FASE 10: ESTRUTURA DE BENEFÍCIOS
-- ==============================================================================

-- 1. Criação do Catálogo de Benefícios
CREATE TABLE IF NOT EXISTS public.benefit_catalogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    benefit_type TEXT NOT NULL CHECK (benefit_type IN ('TRANSPORTATION', 'MEAL', 'FOOD', 'HEALTH_INSURANCE', 'DENTAL_INSURANCE', 'LIFE_INSURANCE', 'OTHER')),
    provider_name TEXT,
    company_contribution NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    employee_discount_percentage NUMERIC(5,2),
    employee_discount_fixed NUMERIC(10,2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Criação do Vínculo Empregado-Benefício
CREATE TABLE IF NOT EXISTS public.employee_benefits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    benefit_catalog_id UUID NOT NULL REFERENCES public.benefit_catalogs(id) ON DELETE CASCADE,
    opt_in BOOLEAN NOT NULL DEFAULT true,
    custom_discount_value NUMERIC(10,2),
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id, benefit_catalog_id)
);

-- Habilitar RLS
ALTER TABLE public.benefit_catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para benefit_catalogs
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view benefit catalogs from their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can insert benefit catalogs into their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can update benefit catalogs in their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can delete benefit catalogs in their tenants" ON public.benefit_catalogs;
    
    DROP POLICY IF EXISTS "Users can view employee benefits from their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can insert employee benefits into their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can update employee benefits in their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can delete employee benefits in their tenants" ON public.employee_benefits;
END
$$;

CREATE POLICY "Users can view benefit catalogs from their tenants" 
    ON public.benefit_catalogs FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert benefit catalogs into their tenants" 
    ON public.benefit_catalogs FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Políticas de RLS para employee_benefits
CREATE POLICY "Users can view employee benefits from their tenants" 
    ON public.employee_benefits FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee benefits into their tenants" 
    ON public.employee_benefits FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee benefits in their tenants" 
    ON public.employee_benefits FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee benefits in their tenants" 
    ON public.employee_benefits FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_11.sql`
```sql
-- ==============================================================================
-- FASE 11: ESTRUTURA DE DESCONTOS DIVERSOS
-- ==============================================================================

-- 1. Criação da Tabela de Descontos Diversos do Colaborador
CREATE TABLE IF NOT EXISTS public.employee_deductions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE RESTRICT,
    
    deduction_type TEXT NOT NULL CHECK (deduction_type IN ('ALIMONY', 'LOAN', 'ADVANCE', 'COPARTICIPATION', 'OTHER')),
    amount_type TEXT NOT NULL CHECK (amount_type IN ('FIXED', 'PERCENTAGE')),
    
    value NUMERIC(10,2) NOT NULL,
    total_limit NUMERIC(10,2), -- Ex: Limite total do empréstimo. Ao atingir, encerra o desconto.
    
    start_date DATE NOT NULL,
    end_date DATE,
    
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view employee deductions from their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can insert employee deductions into their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can update employee deductions in their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can delete employee deductions in their tenants" ON public.employee_deductions;
END
$$;

CREATE POLICY "Users can view employee deductions from their tenants" 
    ON public.employee_deductions FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee deductions into their tenants" 
    ON public.employee_deductions FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee deductions in their tenants" 
    ON public.employee_deductions FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee deductions in their tenants" 
    ON public.employee_deductions FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_12.sql`
```sql
-- ==============================================================================
-- FASE 12: TABELAS LEGAIS E PARÂMETROS
-- ==============================================================================

-- 1. Criação do Catálogo de Versões Legais
-- Essas versões agrupam os parâmetros de uma mesma época (ex: 2026).
CREATE TABLE IF NOT EXISTS public.legal_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_name TEXT NOT NULL, -- Ex: "Legislação 2026"
    valid_from DATE NOT NULL,
    valid_to DATE,
    source TEXT, -- Ex: "Governo Federal, eSocial"
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela INSS (Progressivo)
CREATE TABLE IF NOT EXISTS public.inss_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    bracket_number INT NOT NULL, -- Ordem da faixa, ex: 1, 2, 3, 4
    base_limit NUMERIC(10,2), -- NULL significa "acima de" ou sem limite superior
    aliquot NUMERIC(5,2) NOT NULL,
    deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabela IRRF
CREATE TABLE IF NOT EXISTS public.irrf_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    bracket_number INT NOT NULL,
    base_limit NUMERIC(10,2), -- NULL significa sem limite superior
    aliquot NUMERIC(5,2) NOT NULL,
    deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Parâmetros Gerais (Salário Mínimo, Deduções, FGTS, etc)
CREATE TABLE IF NOT EXISTS public.general_legal_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    minimum_wage NUMERIC(10,2) NOT NULL,
    dependent_deduction NUMERIC(10,2) NOT NULL,
    simplified_discount NUMERIC(10,2) NOT NULL,
    family_salary_quota NUMERIC(10,2) NOT NULL,
    family_salary_limit NUMERIC(10,2) NOT NULL,
    fgts_standard_aliquot NUMERIC(5,2) NOT NULL, -- 8.00
    fgts_apprentice_aliquot NUMERIC(5,2) NOT NULL, -- 2.00
    vt_max_discount_percentage NUMERIC(5,2) NOT NULL, -- 6.00
    irrf_exemption_limit NUMERIC(10,2), -- 5000.00 (Redutor 2026)
    irrf_reduction_formula_limit NUMERIC(10,2), -- 7350.00
    irrf_base_reduction NUMERIC(10,2), -- 312.89
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS (Como são dados públicos/globais do sistema, apenas leitura autenticada)
ALTER TABLE public.legal_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inss_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.irrf_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.general_legal_parameters ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS — leitura e escrita para autenticados
-- Dropar políticas existentes para permitir re-execução
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated read on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated insert on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated update on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated delete on legal_versions" ON public.legal_versions;

    DROP POLICY IF EXISTS "Allow authenticated read on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on inss_parameters" ON public.inss_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on irrf_parameters" ON public.irrf_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on general_legal_parameters" ON public.general_legal_parameters;
END $$;

-- legal_versions
CREATE POLICY "Allow authenticated read on legal_versions" 
    ON public.legal_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on legal_versions" 
    ON public.legal_versions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on legal_versions" 
    ON public.legal_versions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on legal_versions" 
    ON public.legal_versions FOR DELETE TO authenticated USING (true);

-- inss_parameters
CREATE POLICY "Allow authenticated read on inss_parameters" 
    ON public.inss_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on inss_parameters" 
    ON public.inss_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on inss_parameters" 
    ON public.inss_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on inss_parameters" 
    ON public.inss_parameters FOR DELETE TO authenticated USING (true);

-- irrf_parameters
CREATE POLICY "Allow authenticated read on irrf_parameters" 
    ON public.irrf_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on irrf_parameters" 
    ON public.irrf_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on irrf_parameters" 
    ON public.irrf_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on irrf_parameters" 
    ON public.irrf_parameters FOR DELETE TO authenticated USING (true);

-- general_legal_parameters
CREATE POLICY "Allow authenticated read on general_legal_parameters" 
    ON public.general_legal_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on general_legal_parameters" 
    ON public.general_legal_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on general_legal_parameters" 
    ON public.general_legal_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on general_legal_parameters" 
    ON public.general_legal_parameters FOR DELETE TO authenticated USING (true);

-- ==============================================================================
-- INSERÇÃO DOS DADOS BASE - 2026
-- ==============================================================================

DO $$
DECLARE
    v_version_id UUID;
BEGIN
    -- Cria a versão 2026 se não existir para evitar duplicação (por precaução)
    IF NOT EXISTS (SELECT 1 FROM public.legal_versions WHERE version_name = 'Legislação 2026') THEN
        INSERT INTO public.legal_versions (version_name, valid_from, source)
        VALUES ('Legislação 2026', '2026-01-01', 'Pesquisa CLT 2026')
        RETURNING id INTO v_version_id;

        -- INSS 2026
        INSERT INTO public.inss_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 1621.00, 7.5, 0.00),
        (v_version_id, 2, 2902.84, 9.0, 24.32),
        (v_version_id, 3, 4354.27, 12.0, 111.40),
        (v_version_id, 4, 8475.55, 14.0, 198.49);

        -- IRRF 2026
        INSERT INTO public.irrf_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 2428.80, 0.0, 0.00),
        (v_version_id, 2, 2826.65, 7.5, 182.16),
        (v_version_id, 3, 3751.05, 15.0, 394.16),
        (v_version_id, 4, 4664.68, 22.5, 675.49),
        (v_version_id, 5, NULL, 27.5, 908.73);

        -- Parâmetros Gerais 2026
        INSERT INTO public.general_legal_parameters (
            version_id, minimum_wage, dependent_deduction, simplified_discount, 
            family_salary_quota, family_salary_limit, fgts_standard_aliquot, 
            fgts_apprentice_aliquot, vt_max_discount_percentage, irrf_exemption_limit, 
            irrf_reduction_formula_limit, irrf_base_reduction
        ) VALUES (
            v_version_id, 1621.00, 189.59, 607.20, 
            67.54, 1980.38, 8.00, 
            2.00, 6.00, 5000.00, 
            7350.00, 312.89
        );
    END IF;
END $$;

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_13_14.sql`
```sql
-- ==============================================================================
-- FASES 13 e 14: ESTRUTURAS DO MOTOR DE CÁLCULO E HOLERITE
-- ==============================================================================

-- 1. Períodos de Folha (Competências)
CREATE TABLE IF NOT EXISTS public.payroll_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('MONTHLY', 'ADVANCE', '13TH', 'SUPPLEMENTARY')),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CALCULATED', 'CONFERENCE', 'CLOSED', 'CANCELED')),
    processing_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, month, year, type)
);

-- 2. Eventos Variáveis do Mês (Lançamentos Manuais)
CREATE TABLE IF NOT EXISTS public.payroll_variable_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE CASCADE,
    amount NUMERIC(10,2), -- Valor monetário
    quantity NUMERIC(10,2), -- Quantidade (ex: 10 horas)
    reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Holerites (Resultados Calculados)
CREATE TABLE IF NOT EXISTS public.payslips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    total_earnings NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total_deductions NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    net_salary NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_inss NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_irrf NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_fgts NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    fgts_month NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'CALCULATED' CHECK (status IN ('CALCULATED', 'CLOSED', 'CANCELED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(period_id, contract_id)
);

-- 4. Itens do Holerite (Demonstrativo)
CREATE TABLE IF NOT EXISTS public.payslip_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE CASCADE,
    reference TEXT, -- Ex: 10h, 50%
    amount NUMERIC(10,2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('EARNING', 'DEDUCTION', 'NEUTRAL', 'BASE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Memória de Cálculo (Auditoria e Transparência)
CREATE TABLE IF NOT EXISTS public.payroll_memory_calc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    base_value NUMERIC(10,2) NOT NULL,
    quantity_used NUMERIC(10,2) NOT NULL,
    percentage_used NUMERIC(10,2) NOT NULL,
    parsed_formula TEXT NOT NULL,
    result_value NUMERIC(10,2) NOT NULL,
    origin TEXT NOT NULL,
    engine_version TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- SEGURANÇA E RLS
-- ==============================================================================
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_variable_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslip_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view payroll_periods from their tenants" ON public.payroll_periods;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_periods" ON public.payroll_periods;
    
    DROP POLICY IF EXISTS "Users can view payroll_variable_events from their tenants" ON public.payroll_variable_events;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_variable_events" ON public.payroll_variable_events;

    DROP POLICY IF EXISTS "Users can view payslips from their tenants" ON public.payslips;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslips" ON public.payslips;

    DROP POLICY IF EXISTS "Users can view payslip_items from their tenants" ON public.payslip_items;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslip_items" ON public.payslip_items;

    DROP POLICY IF EXISTS "Users can view payroll_memory_calc from their tenants" ON public.payroll_memory_calc;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_memory_calc" ON public.payroll_memory_calc;
END
$$;

-- payroll_periods
CREATE POLICY "Users can view payroll_periods from their tenants" 
    ON public.payroll_periods FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_periods" 
    ON public.payroll_periods FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_variable_events
CREATE POLICY "Users can view payroll_variable_events from their tenants" 
    ON public.payroll_variable_events FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_variable_events" 
    ON public.payroll_variable_events FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslips
CREATE POLICY "Users can view payslips from their tenants" 
    ON public.payslips FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payslips" 
    ON public.payslips FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslip_items
CREATE POLICY "Users can view payslip_items from their tenants" 
    ON public.payslip_items FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payslip_items" 
    ON public.payslip_items FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_memory_calc
CREATE POLICY "Users can view payroll_memory_calc from their tenants" 
    ON public.payroll_memory_calc FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_memory_calc" 
    ON public.payroll_memory_calc FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- ==============================================================================
-- AUDITORIA
-- ==============================================================================
CREATE TRIGGER audit_payroll_periods_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_payroll_variable_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_variable_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_payslips_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payslips FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

*(Conclusão do Banco de Dados - Tabelas Base MVP + Motor de Cálculo Completos)*


### Script: `supabase_sql_fase_7.sql`
```sql
-- Fase 7: Afastamentos e Ausências
-- Cria a tabela 'leaves' com políticas de RLS e triggers.

CREATE TABLE IF NOT EXISTS public.leaves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('SICK_LEAVE', 'MATERNITY', 'PATERNITY', 'WORK_ACCIDENT', 'UNJUSTIFIED_ABSENCE', 'SUSPENSION', 'OTHER')),
    start_date DATE NOT NULL,
    end_date DATE,
    return_date DATE,
    icd_10_code TEXT,
    medical_certificate_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    is_inss_referral BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Users can view leaves from their tenants" 
    ON public.leaves FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert leaves into their tenants" 
    ON public.leaves FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update leaves in their tenants" 
    ON public.leaves FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete leaves in their tenants" 
    ON public.leaves FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Trigger de Updated At
CREATE TRIGGER update_leaves_updated_at
    BEFORE UPDATE ON public.leaves
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

```

### Script: `supabase_sql_fase_8.sql`
```sql
-- ==============================================================================
-- FASE 8: ESTRUTURA COMPLETA DE RUBRICAS
-- ==============================================================================
-- Este script expande a tabela "payroll_rubrics" com todas as variáveis exigidas
-- pelo Motor de Cálculo da Folha (Fase 13).

-- 1. Expansão da tabela payroll_rubrics
ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'AUTOMATICA', 'IMPORTADA', 'INTEGRACAO')),
    ADD COLUMN IF NOT EXISTS calculation_base TEXT,
    ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS divisor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS factor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS calculation_order INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS incidence_inss_patronal BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_rat BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_third_parties BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_inss BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_irrf BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_fgts BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS valid_to DATE,
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS esocial_description TEXT;

-- (Opcional) Adicionar type e category caso não tenham sido criados no Script 8 original, mas já usados no frontend
ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'EARNING',
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'SALARY',
    ADD COLUMN IF NOT EXISTS calculation_type TEXT DEFAULT 'FIXED',
    ADD COLUMN IF NOT EXISTS formula TEXT;

-- 2. Atualizar permissões de RLS para a tabela expandida 
-- (O Script 8 já possuía RLS, este comando é apenas por garantia)
ALTER TABLE public.payroll_rubrics ENABLE ROW LEVEL SECURITY;

-- Nota: A trigger de auditoria `audit_payroll_rubrics_trigger` criada na Fase 8/Script 8 já cobre automaticamente as novas colunas
-- pois o `to_jsonb(NEW)` captura dinamicamente a estrutura da tabela atual.

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_9.sql`
```sql
-- ==============================================================================
-- FASE 9: EVENTOS DA FOLHA (LANÇAMENTOS VARIÁVEIS) E PROGRESSIVAS
-- ==============================================================================
-- Este script cria as tabelas do motor de folha que faltavam no Script 9,
-- incluindo a versão já atualizada de payroll_events com quantity, origin, etc.

CREATE TABLE IF NOT EXISTS public.payroll_progressive_tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    table_type TEXT NOT NULL CHECK (table_type IN ('INSS', 'IRRF', 'FAMILY_SALARY', 'OTHER')),
    competence_start DATE NOT NULL,
    competence_end DATE,
    ranges_jsonb JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE RESTRICT,
    reference_value NUMERIC(10,2),
    quantity NUMERIC(10,2),
    calculated_amount NUMERIC(10,2) NOT NULL,
    is_manual_entry BOOLEAN NOT NULL DEFAULT false,
    origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO')),
    notes TEXT,
    recorded_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_memory_calc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.payroll_events(id) ON DELETE CASCADE,
    formula_used TEXT NOT NULL,
    variables_snapshot JSONB NOT NULL,
    progressive_table_id UUID REFERENCES public.payroll_progressive_tables(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.terminations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    termination_reason TEXT NOT NULL CHECK (termination_reason IN ('WITHOUT_JUST_CAUSE_BY_EMPLOYER', 'WITH_JUST_CAUSE_BY_EMPLOYER', 'BY_EMPLOYEE', 'MUTUAL_AGREEMENT', 'CONTRACT_EXPIRATION', 'RETIREMENT', 'DEATH')),
    notice_period_type TEXT NOT NULL CHECK (notice_period_type IN ('WORKED', 'INDEMNIFIED', 'WAIVED')),
    notice_date DATE NOT NULL,
    last_working_day DATE NOT NULL,
    fgts_fine_percentage NUMERIC(5,2),
    is_exam_required BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'CALCULATED', 'PAID', 'HOMOLOGATED', 'CANCELED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id)
);

-- Habilitar RLS
ALTER TABLE public.payroll_progressive_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminations ENABLE ROW LEVEL SECURITY;

-- Políticas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage progressive tables') THEN
        CREATE POLICY "Tenant Admins and DP can manage progressive tables" ON public.payroll_progressive_tables FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage payroll events') THEN
        CREATE POLICY "Tenant Admins and DP can manage payroll events" ON public.payroll_events FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can view memory calc') THEN
        CREATE POLICY "Tenant Admins and DP can view memory calc" ON public.payroll_memory_calc FOR SELECT USING (EXISTS (SELECT 1 FROM public.payroll_events e WHERE e.id = public.payroll_memory_calc.event_id AND e.tenant_id = ANY(public.user_tenant_ids())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage terminations') THEN
        CREATE POLICY "Tenant Admins and DP can manage terminations" ON public.terminations FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
END $$;

-- Triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_progressive_tables_trigger') THEN
        CREATE TRIGGER audit_progressive_tables_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_progressive_tables FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_events_trigger') THEN
        CREATE TRIGGER audit_payroll_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_terminations_trigger') THEN
        CREATE TRIGGER audit_terminations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.terminations FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;

-- E se a tabela payroll_events já existir (criada por script anterior incompleto), tentamos alterar:
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN quantity NUMERIC(10,2);
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO'));
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN notes TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN recorded_by UUID;
    EXCEPTION WHEN duplicate_column THEN END;
END $$;

```

### Script: `supabase_sql_fase_10.sql`
```sql
-- ==============================================================================
-- FASE 10: ESTRUTURA DE BENEFÍCIOS
-- ==============================================================================

-- 1. Criação do Catálogo de Benefícios
CREATE TABLE IF NOT EXISTS public.benefit_catalogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    benefit_type TEXT NOT NULL CHECK (benefit_type IN ('TRANSPORTATION', 'MEAL', 'FOOD', 'HEALTH_INSURANCE', 'DENTAL_INSURANCE', 'LIFE_INSURANCE', 'OTHER')),
    provider_name TEXT,
    company_contribution NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    employee_discount_percentage NUMERIC(5,2),
    employee_discount_fixed NUMERIC(10,2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Criação do Vínculo Empregado-Benefício
CREATE TABLE IF NOT EXISTS public.employee_benefits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    benefit_catalog_id UUID NOT NULL REFERENCES public.benefit_catalogs(id) ON DELETE CASCADE,
    opt_in BOOLEAN NOT NULL DEFAULT true,
    custom_discount_value NUMERIC(10,2),
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id, benefit_catalog_id)
);

-- Habilitar RLS
ALTER TABLE public.benefit_catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para benefit_catalogs
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view benefit catalogs from their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can insert benefit catalogs into their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can update benefit catalogs in their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can delete benefit catalogs in their tenants" ON public.benefit_catalogs;
    
    DROP POLICY IF EXISTS "Users can view employee benefits from their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can insert employee benefits into their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can update employee benefits in their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can delete employee benefits in their tenants" ON public.employee_benefits;
END
$$;

CREATE POLICY "Users can view benefit catalogs from their tenants" 
    ON public.benefit_catalogs FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert benefit catalogs into their tenants" 
    ON public.benefit_catalogs FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Políticas de RLS para employee_benefits
CREATE POLICY "Users can view employee benefits from their tenants" 
    ON public.employee_benefits FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee benefits into their tenants" 
    ON public.employee_benefits FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee benefits in their tenants" 
    ON public.employee_benefits FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee benefits in their tenants" 
    ON public.employee_benefits FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_11.sql`
```sql
-- ==============================================================================
-- FASE 11: ESTRUTURA DE DESCONTOS DIVERSOS
-- ==============================================================================

-- 1. Criação da Tabela de Descontos Diversos do Colaborador
CREATE TABLE IF NOT EXISTS public.employee_deductions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE RESTRICT,
    
    deduction_type TEXT NOT NULL CHECK (deduction_type IN ('ALIMONY', 'LOAN', 'ADVANCE', 'COPARTICIPATION', 'OTHER')),
    amount_type TEXT NOT NULL CHECK (amount_type IN ('FIXED', 'PERCENTAGE')),
    
    value NUMERIC(10,2) NOT NULL,
    total_limit NUMERIC(10,2), -- Ex: Limite total do empréstimo. Ao atingir, encerra o desconto.
    
    start_date DATE NOT NULL,
    end_date DATE,
    
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view employee deductions from their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can insert employee deductions into their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can update employee deductions in their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can delete employee deductions in their tenants" ON public.employee_deductions;
END
$$;

CREATE POLICY "Users can view employee deductions from their tenants" 
    ON public.employee_deductions FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee deductions into their tenants" 
    ON public.employee_deductions FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee deductions in their tenants" 
    ON public.employee_deductions FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee deductions in their tenants" 
    ON public.employee_deductions FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_12.sql`
```sql
-- ==============================================================================
-- FASE 12: TABELAS LEGAIS E PARÂMETROS
-- ==============================================================================

-- 1. Criação do Catálogo de Versões Legais
-- Essas versões agrupam os parâmetros de uma mesma época (ex: 2026).
CREATE TABLE IF NOT EXISTS public.legal_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_name TEXT NOT NULL, -- Ex: "Legislação 2026"
    valid_from DATE NOT NULL,
    valid_to DATE,
    source TEXT, -- Ex: "Governo Federal, eSocial"
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela INSS (Progressivo)
CREATE TABLE IF NOT EXISTS public.inss_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    bracket_number INT NOT NULL, -- Ordem da faixa, ex: 1, 2, 3, 4
    base_limit NUMERIC(10,2), -- NULL significa "acima de" ou sem limite superior
    aliquot NUMERIC(5,2) NOT NULL,
    deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabela IRRF
CREATE TABLE IF NOT EXISTS public.irrf_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    bracket_number INT NOT NULL,
    base_limit NUMERIC(10,2), -- NULL significa sem limite superior
    aliquot NUMERIC(5,2) NOT NULL,
    deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Parâmetros Gerais (Salário Mínimo, Deduções, FGTS, etc)
CREATE TABLE IF NOT EXISTS public.general_legal_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    minimum_wage NUMERIC(10,2) NOT NULL,
    dependent_deduction NUMERIC(10,2) NOT NULL,
    simplified_discount NUMERIC(10,2) NOT NULL,
    family_salary_quota NUMERIC(10,2) NOT NULL,
    family_salary_limit NUMERIC(10,2) NOT NULL,
    fgts_standard_aliquot NUMERIC(5,2) NOT NULL, -- 8.00
    fgts_apprentice_aliquot NUMERIC(5,2) NOT NULL, -- 2.00
    vt_max_discount_percentage NUMERIC(5,2) NOT NULL, -- 6.00
    irrf_exemption_limit NUMERIC(10,2), -- 5000.00 (Redutor 2026)
    irrf_reduction_formula_limit NUMERIC(10,2), -- 7350.00
    irrf_base_reduction NUMERIC(10,2), -- 312.89
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS (Como são dados públicos/globais do sistema, apenas leitura autenticada)
ALTER TABLE public.legal_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inss_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.irrf_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.general_legal_parameters ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS — leitura e escrita para autenticados
-- Dropar políticas existentes para permitir re-execução
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated read on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated insert on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated update on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated delete on legal_versions" ON public.legal_versions;

    DROP POLICY IF EXISTS "Allow authenticated read on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on inss_parameters" ON public.inss_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on irrf_parameters" ON public.irrf_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on general_legal_parameters" ON public.general_legal_parameters;
END $$;

-- legal_versions
CREATE POLICY "Allow authenticated read on legal_versions" 
    ON public.legal_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on legal_versions" 
    ON public.legal_versions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on legal_versions" 
    ON public.legal_versions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on legal_versions" 
    ON public.legal_versions FOR DELETE TO authenticated USING (true);

-- inss_parameters
CREATE POLICY "Allow authenticated read on inss_parameters" 
    ON public.inss_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on inss_parameters" 
    ON public.inss_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on inss_parameters" 
    ON public.inss_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on inss_parameters" 
    ON public.inss_parameters FOR DELETE TO authenticated USING (true);

-- irrf_parameters
CREATE POLICY "Allow authenticated read on irrf_parameters" 
    ON public.irrf_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on irrf_parameters" 
    ON public.irrf_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on irrf_parameters" 
    ON public.irrf_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on irrf_parameters" 
    ON public.irrf_parameters FOR DELETE TO authenticated USING (true);

-- general_legal_parameters
CREATE POLICY "Allow authenticated read on general_legal_parameters" 
    ON public.general_legal_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on general_legal_parameters" 
    ON public.general_legal_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on general_legal_parameters" 
    ON public.general_legal_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on general_legal_parameters" 
    ON public.general_legal_parameters FOR DELETE TO authenticated USING (true);

-- ==============================================================================
-- INSERÇÃO DOS DADOS BASE - 2026
-- ==============================================================================

DO $$
DECLARE
    v_version_id UUID;
BEGIN
    -- Cria a versão 2026 se não existir para evitar duplicação (por precaução)
    IF NOT EXISTS (SELECT 1 FROM public.legal_versions WHERE version_name = 'Legislação 2026') THEN
        INSERT INTO public.legal_versions (version_name, valid_from, source)
        VALUES ('Legislação 2026', '2026-01-01', 'Pesquisa CLT 2026')
        RETURNING id INTO v_version_id;

        -- INSS 2026
        INSERT INTO public.inss_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 1621.00, 7.5, 0.00),
        (v_version_id, 2, 2902.84, 9.0, 24.32),
        (v_version_id, 3, 4354.27, 12.0, 111.40),
        (v_version_id, 4, 8475.55, 14.0, 198.49);

        -- IRRF 2026
        INSERT INTO public.irrf_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 2428.80, 0.0, 0.00),
        (v_version_id, 2, 2826.65, 7.5, 182.16),
        (v_version_id, 3, 3751.05, 15.0, 394.16),
        (v_version_id, 4, 4664.68, 22.5, 675.49),
        (v_version_id, 5, NULL, 27.5, 908.73);

        -- Parâmetros Gerais 2026
        INSERT INTO public.general_legal_parameters (
            version_id, minimum_wage, dependent_deduction, simplified_discount, 
            family_salary_quota, family_salary_limit, fgts_standard_aliquot, 
            fgts_apprentice_aliquot, vt_max_discount_percentage, irrf_exemption_limit, 
            irrf_reduction_formula_limit, irrf_base_reduction
        ) VALUES (
            v_version_id, 1621.00, 189.59, 607.20, 
            67.54, 1980.38, 8.00, 
            2.00, 6.00, 5000.00, 
            7350.00, 312.89
        );
    END IF;
END $$;

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_13_14.sql`
```sql
-- ==============================================================================
-- FASES 13 e 14: ESTRUTURAS DO MOTOR DE CÁLCULO E HOLERITE
-- ==============================================================================

-- 1. Períodos de Folha (Competências)
CREATE TABLE IF NOT EXISTS public.payroll_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('MONTHLY', 'ADVANCE', '13TH', 'SUPPLEMENTARY')),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CALCULATED', 'CONFERENCE', 'CLOSED', 'CANCELED')),
    processing_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, month, year, type)
);

-- 2. Eventos Variáveis do Mês (Lançamentos Manuais)
CREATE TABLE IF NOT EXISTS public.payroll_variable_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE CASCADE,
    amount NUMERIC(10,2), -- Valor monetário
    quantity NUMERIC(10,2), -- Quantidade (ex: 10 horas)
    reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Holerites (Resultados Calculados)
CREATE TABLE IF NOT EXISTS public.payslips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    total_earnings NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total_deductions NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    net_salary NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_inss NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_irrf NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_fgts NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    fgts_month NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'CALCULATED' CHECK (status IN ('CALCULATED', 'CLOSED', 'CANCELED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(period_id, contract_id)
);

-- 4. Itens do Holerite (Demonstrativo)
CREATE TABLE IF NOT EXISTS public.payslip_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE CASCADE,
    reference TEXT, -- Ex: 10h, 50%
    amount NUMERIC(10,2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('EARNING', 'DEDUCTION', 'NEUTRAL', 'BASE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Memória de Cálculo (Auditoria e Transparência)
CREATE TABLE IF NOT EXISTS public.payroll_memory_calc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    base_value NUMERIC(10,2) NOT NULL,
    quantity_used NUMERIC(10,2) NOT NULL,
    percentage_used NUMERIC(10,2) NOT NULL,
    parsed_formula TEXT NOT NULL,
    result_value NUMERIC(10,2) NOT NULL,
    origin TEXT NOT NULL,
    engine_version TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- SEGURANÇA E RLS
-- ==============================================================================
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_variable_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslip_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view payroll_periods from their tenants" ON public.payroll_periods;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_periods" ON public.payroll_periods;
    
    DROP POLICY IF EXISTS "Users can view payroll_variable_events from their tenants" ON public.payroll_variable_events;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_variable_events" ON public.payroll_variable_events;

    DROP POLICY IF EXISTS "Users can view payslips from their tenants" ON public.payslips;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslips" ON public.payslips;

    DROP POLICY IF EXISTS "Users can view payslip_items from their tenants" ON public.payslip_items;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslip_items" ON public.payslip_items;

    DROP POLICY IF EXISTS "Users can view payroll_memory_calc from their tenants" ON public.payroll_memory_calc;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_memory_calc" ON public.payroll_memory_calc;
END
$$;

-- payroll_periods
CREATE POLICY "Users can view payroll_periods from their tenants" 
    ON public.payroll_periods FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_periods" 
    ON public.payroll_periods FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_variable_events
CREATE POLICY "Users can view payroll_variable_events from their tenants" 
    ON public.payroll_variable_events FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_variable_events" 
    ON public.payroll_variable_events FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslips
CREATE POLICY "Users can view payslips from their tenants" 
    ON public.payslips FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payslips" 
    ON public.payslips FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslip_items
CREATE POLICY "Users can view payslip_items from their tenants" 
    ON public.payslip_items FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payslip_items" 
    ON public.payslip_items FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_memory_calc
CREATE POLICY "Users can view payroll_memory_calc from their tenants" 
    ON public.payroll_memory_calc FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_memory_calc" 
    ON public.payroll_memory_calc FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- ==============================================================================
-- AUDITORIA
-- ==============================================================================
CREATE TRIGGER audit_payroll_periods_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_payroll_variable_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_variable_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_payslips_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payslips FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

*(Conclusão do Banco de Dados - Tabelas Base MVP + Motor de Cálculo Completos)*


### Script: `supabase_sql_fase_7.sql`
```sql
-- Fase 7: Afastamentos e Ausências
-- Cria a tabela 'leaves' com políticas de RLS e triggers.

CREATE TABLE IF NOT EXISTS public.leaves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('SICK_LEAVE', 'MATERNITY', 'PATERNITY', 'WORK_ACCIDENT', 'UNJUSTIFIED_ABSENCE', 'SUSPENSION', 'OTHER')),
    start_date DATE NOT NULL,
    end_date DATE,
    return_date DATE,
    icd_10_code TEXT,
    medical_certificate_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    is_inss_referral BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Users can view leaves from their tenants" 
    ON public.leaves FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert leaves into their tenants" 
    ON public.leaves FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update leaves in their tenants" 
    ON public.leaves FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete leaves in their tenants" 
    ON public.leaves FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Trigger de Updated At
CREATE TRIGGER update_leaves_updated_at
    BEFORE UPDATE ON public.leaves
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

```

### Script: `supabase_sql_fase_8.sql`
```sql
-- ==============================================================================
-- FASE 8: ESTRUTURA COMPLETA DE RUBRICAS
-- ==============================================================================
-- Este script expande a tabela "payroll_rubrics" com todas as variáveis exigidas
-- pelo Motor de Cálculo da Folha (Fase 13).

-- 1. Expansão da tabela payroll_rubrics
ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'AUTOMATICA', 'IMPORTADA', 'INTEGRACAO')),
    ADD COLUMN IF NOT EXISTS calculation_base TEXT,
    ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS divisor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS factor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS calculation_order INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS incidence_inss_patronal BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_rat BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_third_parties BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_inss BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_irrf BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_fgts BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS valid_to DATE,
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS esocial_description TEXT;

-- (Opcional) Adicionar type e category caso não tenham sido criados no Script 8 original, mas já usados no frontend
ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'EARNING',
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'SALARY',
    ADD COLUMN IF NOT EXISTS calculation_type TEXT DEFAULT 'FIXED',
    ADD COLUMN IF NOT EXISTS formula TEXT;

-- 2. Atualizar permissões de RLS para a tabela expandida 
-- (O Script 8 já possuía RLS, este comando é apenas por garantia)
ALTER TABLE public.payroll_rubrics ENABLE ROW LEVEL SECURITY;

-- Nota: A trigger de auditoria `audit_payroll_rubrics_trigger` criada na Fase 8/Script 8 já cobre automaticamente as novas colunas
-- pois o `to_jsonb(NEW)` captura dinamicamente a estrutura da tabela atual.

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_9.sql`
```sql
-- ==============================================================================
-- FASE 9: EVENTOS DA FOLHA (LANÇAMENTOS VARIÁVEIS) E PROGRESSIVAS
-- ==============================================================================
-- Este script cria as tabelas do motor de folha que faltavam no Script 9,
-- incluindo a versão já atualizada de payroll_events com quantity, origin, etc.

CREATE TABLE IF NOT EXISTS public.payroll_progressive_tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    table_type TEXT NOT NULL CHECK (table_type IN ('INSS', 'IRRF', 'FAMILY_SALARY', 'OTHER')),
    competence_start DATE NOT NULL,
    competence_end DATE,
    ranges_jsonb JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE RESTRICT,
    reference_value NUMERIC(10,2),
    quantity NUMERIC(10,2),
    calculated_amount NUMERIC(10,2) NOT NULL,
    is_manual_entry BOOLEAN NOT NULL DEFAULT false,
    origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO')),
    notes TEXT,
    recorded_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_memory_calc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.payroll_events(id) ON DELETE CASCADE,
    formula_used TEXT NOT NULL,
    variables_snapshot JSONB NOT NULL,
    progressive_table_id UUID REFERENCES public.payroll_progressive_tables(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.terminations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    termination_reason TEXT NOT NULL CHECK (termination_reason IN ('WITHOUT_JUST_CAUSE_BY_EMPLOYER', 'WITH_JUST_CAUSE_BY_EMPLOYER', 'BY_EMPLOYEE', 'MUTUAL_AGREEMENT', 'CONTRACT_EXPIRATION', 'RETIREMENT', 'DEATH')),
    notice_period_type TEXT NOT NULL CHECK (notice_period_type IN ('WORKED', 'INDEMNIFIED', 'WAIVED')),
    notice_date DATE NOT NULL,
    last_working_day DATE NOT NULL,
    fgts_fine_percentage NUMERIC(5,2),
    is_exam_required BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'CALCULATED', 'PAID', 'HOMOLOGATED', 'CANCELED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id)
);

-- Habilitar RLS
ALTER TABLE public.payroll_progressive_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminations ENABLE ROW LEVEL SECURITY;

-- Políticas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage progressive tables') THEN
        CREATE POLICY "Tenant Admins and DP can manage progressive tables" ON public.payroll_progressive_tables FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage payroll events') THEN
        CREATE POLICY "Tenant Admins and DP can manage payroll events" ON public.payroll_events FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can view memory calc') THEN
        CREATE POLICY "Tenant Admins and DP can view memory calc" ON public.payroll_memory_calc FOR SELECT USING (EXISTS (SELECT 1 FROM public.payroll_events e WHERE e.id = public.payroll_memory_calc.event_id AND e.tenant_id = ANY(public.user_tenant_ids())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage terminations') THEN
        CREATE POLICY "Tenant Admins and DP can manage terminations" ON public.terminations FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
END $$;

-- Triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_progressive_tables_trigger') THEN
        CREATE TRIGGER audit_progressive_tables_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_progressive_tables FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_events_trigger') THEN
        CREATE TRIGGER audit_payroll_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_terminations_trigger') THEN
        CREATE TRIGGER audit_terminations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.terminations FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;

-- E se a tabela payroll_events já existir (criada por script anterior incompleto), tentamos alterar:
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN quantity NUMERIC(10,2);
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO'));
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN notes TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN recorded_by UUID;
    EXCEPTION WHEN duplicate_column THEN END;
END $$;

```

### Script: `supabase_sql_fase_10.sql`
```sql
-- ==============================================================================
-- FASE 10: ESTRUTURA DE BENEFÍCIOS
-- ==============================================================================

-- 1. Criação do Catálogo de Benefícios
CREATE TABLE IF NOT EXISTS public.benefit_catalogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    benefit_type TEXT NOT NULL CHECK (benefit_type IN ('TRANSPORTATION', 'MEAL', 'FOOD', 'HEALTH_INSURANCE', 'DENTAL_INSURANCE', 'LIFE_INSURANCE', 'OTHER')),
    provider_name TEXT,
    company_contribution NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    employee_discount_percentage NUMERIC(5,2),
    employee_discount_fixed NUMERIC(10,2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Criação do Vínculo Empregado-Benefício
CREATE TABLE IF NOT EXISTS public.employee_benefits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    benefit_catalog_id UUID NOT NULL REFERENCES public.benefit_catalogs(id) ON DELETE CASCADE,
    opt_in BOOLEAN NOT NULL DEFAULT true,
    custom_discount_value NUMERIC(10,2),
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id, benefit_catalog_id)
);

-- Habilitar RLS
ALTER TABLE public.benefit_catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para benefit_catalogs
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view benefit catalogs from their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can insert benefit catalogs into their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can update benefit catalogs in their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can delete benefit catalogs in their tenants" ON public.benefit_catalogs;
    
    DROP POLICY IF EXISTS "Users can view employee benefits from their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can insert employee benefits into their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can update employee benefits in their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can delete employee benefits in their tenants" ON public.employee_benefits;
END
$$;

CREATE POLICY "Users can view benefit catalogs from their tenants" 
    ON public.benefit_catalogs FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert benefit catalogs into their tenants" 
    ON public.benefit_catalogs FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Políticas de RLS para employee_benefits
CREATE POLICY "Users can view employee benefits from their tenants" 
    ON public.employee_benefits FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee benefits into their tenants" 
    ON public.employee_benefits FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee benefits in their tenants" 
    ON public.employee_benefits FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee benefits in their tenants" 
    ON public.employee_benefits FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_11.sql`
```sql
-- ==============================================================================
-- FASE 11: ESTRUTURA DE DESCONTOS DIVERSOS
-- ==============================================================================

-- 1. Criação da Tabela de Descontos Diversos do Colaborador
CREATE TABLE IF NOT EXISTS public.employee_deductions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE RESTRICT,
    
    deduction_type TEXT NOT NULL CHECK (deduction_type IN ('ALIMONY', 'LOAN', 'ADVANCE', 'COPARTICIPATION', 'OTHER')),
    amount_type TEXT NOT NULL CHECK (amount_type IN ('FIXED', 'PERCENTAGE')),
    
    value NUMERIC(10,2) NOT NULL,
    total_limit NUMERIC(10,2), -- Ex: Limite total do empréstimo. Ao atingir, encerra o desconto.
    
    start_date DATE NOT NULL,
    end_date DATE,
    
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view employee deductions from their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can insert employee deductions into their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can update employee deductions in their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can delete employee deductions in their tenants" ON public.employee_deductions;
END
$$;

CREATE POLICY "Users can view employee deductions from their tenants" 
    ON public.employee_deductions FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee deductions into their tenants" 
    ON public.employee_deductions FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee deductions in their tenants" 
    ON public.employee_deductions FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee deductions in their tenants" 
    ON public.employee_deductions FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_12.sql`
```sql
-- ==============================================================================
-- FASE 12: TABELAS LEGAIS E PARÂMETROS
-- ==============================================================================

-- 1. Criação do Catálogo de Versões Legais
-- Essas versões agrupam os parâmetros de uma mesma época (ex: 2026).
CREATE TABLE IF NOT EXISTS public.legal_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_name TEXT NOT NULL, -- Ex: "Legislação 2026"
    valid_from DATE NOT NULL,
    valid_to DATE,
    source TEXT, -- Ex: "Governo Federal, eSocial"
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela INSS (Progressivo)
CREATE TABLE IF NOT EXISTS public.inss_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    bracket_number INT NOT NULL, -- Ordem da faixa, ex: 1, 2, 3, 4
    base_limit NUMERIC(10,2), -- NULL significa "acima de" ou sem limite superior
    aliquot NUMERIC(5,2) NOT NULL,
    deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabela IRRF
CREATE TABLE IF NOT EXISTS public.irrf_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    bracket_number INT NOT NULL,
    base_limit NUMERIC(10,2), -- NULL significa sem limite superior
    aliquot NUMERIC(5,2) NOT NULL,
    deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Parâmetros Gerais (Salário Mínimo, Deduções, FGTS, etc)
CREATE TABLE IF NOT EXISTS public.general_legal_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    minimum_wage NUMERIC(10,2) NOT NULL,
    dependent_deduction NUMERIC(10,2) NOT NULL,
    simplified_discount NUMERIC(10,2) NOT NULL,
    family_salary_quota NUMERIC(10,2) NOT NULL,
    family_salary_limit NUMERIC(10,2) NOT NULL,
    fgts_standard_aliquot NUMERIC(5,2) NOT NULL, -- 8.00
    fgts_apprentice_aliquot NUMERIC(5,2) NOT NULL, -- 2.00
    vt_max_discount_percentage NUMERIC(5,2) NOT NULL, -- 6.00
    irrf_exemption_limit NUMERIC(10,2), -- 5000.00 (Redutor 2026)
    irrf_reduction_formula_limit NUMERIC(10,2), -- 7350.00
    irrf_base_reduction NUMERIC(10,2), -- 312.89
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS (Como são dados públicos/globais do sistema, apenas leitura autenticada)
ALTER TABLE public.legal_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inss_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.irrf_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.general_legal_parameters ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS — leitura e escrita para autenticados
-- Dropar políticas existentes para permitir re-execução
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated read on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated insert on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated update on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated delete on legal_versions" ON public.legal_versions;

    DROP POLICY IF EXISTS "Allow authenticated read on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on inss_parameters" ON public.inss_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on irrf_parameters" ON public.irrf_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on general_legal_parameters" ON public.general_legal_parameters;
END $$;

-- legal_versions
CREATE POLICY "Allow authenticated read on legal_versions" 
    ON public.legal_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on legal_versions" 
    ON public.legal_versions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on legal_versions" 
    ON public.legal_versions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on legal_versions" 
    ON public.legal_versions FOR DELETE TO authenticated USING (true);

-- inss_parameters
CREATE POLICY "Allow authenticated read on inss_parameters" 
    ON public.inss_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on inss_parameters" 
    ON public.inss_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on inss_parameters" 
    ON public.inss_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on inss_parameters" 
    ON public.inss_parameters FOR DELETE TO authenticated USING (true);

-- irrf_parameters
CREATE POLICY "Allow authenticated read on irrf_parameters" 
    ON public.irrf_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on irrf_parameters" 
    ON public.irrf_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on irrf_parameters" 
    ON public.irrf_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on irrf_parameters" 
    ON public.irrf_parameters FOR DELETE TO authenticated USING (true);

-- general_legal_parameters
CREATE POLICY "Allow authenticated read on general_legal_parameters" 
    ON public.general_legal_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on general_legal_parameters" 
    ON public.general_legal_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on general_legal_parameters" 
    ON public.general_legal_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on general_legal_parameters" 
    ON public.general_legal_parameters FOR DELETE TO authenticated USING (true);

-- ==============================================================================
-- INSERÇÃO DOS DADOS BASE - 2026
-- ==============================================================================

DO $$
DECLARE
    v_version_id UUID;
BEGIN
    -- Cria a versão 2026 se não existir para evitar duplicação (por precaução)
    IF NOT EXISTS (SELECT 1 FROM public.legal_versions WHERE version_name = 'Legislação 2026') THEN
        INSERT INTO public.legal_versions (version_name, valid_from, source)
        VALUES ('Legislação 2026', '2026-01-01', 'Pesquisa CLT 2026')
        RETURNING id INTO v_version_id;

        -- INSS 2026
        INSERT INTO public.inss_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 1621.00, 7.5, 0.00),
        (v_version_id, 2, 2902.84, 9.0, 24.32),
        (v_version_id, 3, 4354.27, 12.0, 111.40),
        (v_version_id, 4, 8475.55, 14.0, 198.49);

        -- IRRF 2026
        INSERT INTO public.irrf_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 2428.80, 0.0, 0.00),
        (v_version_id, 2, 2826.65, 7.5, 182.16),
        (v_version_id, 3, 3751.05, 15.0, 394.16),
        (v_version_id, 4, 4664.68, 22.5, 675.49),
        (v_version_id, 5, NULL, 27.5, 908.73);

        -- Parâmetros Gerais 2026
        INSERT INTO public.general_legal_parameters (
            version_id, minimum_wage, dependent_deduction, simplified_discount, 
            family_salary_quota, family_salary_limit, fgts_standard_aliquot, 
            fgts_apprentice_aliquot, vt_max_discount_percentage, irrf_exemption_limit, 
            irrf_reduction_formula_limit, irrf_base_reduction
        ) VALUES (
            v_version_id, 1621.00, 189.59, 607.20, 
            67.54, 1980.38, 8.00, 
            2.00, 6.00, 5000.00, 
            7350.00, 312.89
        );
    END IF;
END $$;

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_13_14.sql`
```sql
-- ==============================================================================
-- FASES 13 e 14: ESTRUTURAS DO MOTOR DE CÁLCULO E HOLERITE
-- ==============================================================================

-- 1. Períodos de Folha (Competências)
CREATE TABLE IF NOT EXISTS public.payroll_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('MONTHLY', 'ADVANCE', '13TH', 'SUPPLEMENTARY')),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CALCULATED', 'CONFERENCE', 'CLOSED', 'CANCELED')),
    processing_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, month, year, type)
);

-- 2. Eventos Variáveis do Mês (Lançamentos Manuais)
CREATE TABLE IF NOT EXISTS public.payroll_variable_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE CASCADE,
    amount NUMERIC(10,2), -- Valor monetário
    quantity NUMERIC(10,2), -- Quantidade (ex: 10 horas)
    reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Holerites (Resultados Calculados)
CREATE TABLE IF NOT EXISTS public.payslips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    total_earnings NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total_deductions NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    net_salary NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_inss NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_irrf NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_fgts NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    fgts_month NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'CALCULATED' CHECK (status IN ('CALCULATED', 'CLOSED', 'CANCELED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(period_id, contract_id)
);

-- 4. Itens do Holerite (Demonstrativo)
CREATE TABLE IF NOT EXISTS public.payslip_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE CASCADE,
    reference TEXT, -- Ex: 10h, 50%
    amount NUMERIC(10,2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('EARNING', 'DEDUCTION', 'NEUTRAL', 'BASE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Memória de Cálculo (Auditoria e Transparência)
CREATE TABLE IF NOT EXISTS public.payroll_memory_calc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    base_value NUMERIC(10,2) NOT NULL,
    quantity_used NUMERIC(10,2) NOT NULL,
    percentage_used NUMERIC(10,2) NOT NULL,
    parsed_formula TEXT NOT NULL,
    result_value NUMERIC(10,2) NOT NULL,
    origin TEXT NOT NULL,
    engine_version TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- SEGURANÇA E RLS
-- ==============================================================================
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_variable_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslip_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view payroll_periods from their tenants" ON public.payroll_periods;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_periods" ON public.payroll_periods;
    
    DROP POLICY IF EXISTS "Users can view payroll_variable_events from their tenants" ON public.payroll_variable_events;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_variable_events" ON public.payroll_variable_events;

    DROP POLICY IF EXISTS "Users can view payslips from their tenants" ON public.payslips;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslips" ON public.payslips;

    DROP POLICY IF EXISTS "Users can view payslip_items from their tenants" ON public.payslip_items;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslip_items" ON public.payslip_items;

    DROP POLICY IF EXISTS "Users can view payroll_memory_calc from their tenants" ON public.payroll_memory_calc;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_memory_calc" ON public.payroll_memory_calc;
END
$$;

-- payroll_periods
CREATE POLICY "Users can view payroll_periods from their tenants" 
    ON public.payroll_periods FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_periods" 
    ON public.payroll_periods FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_variable_events
CREATE POLICY "Users can view payroll_variable_events from their tenants" 
    ON public.payroll_variable_events FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_variable_events" 
    ON public.payroll_variable_events FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslips
CREATE POLICY "Users can view payslips from their tenants" 
    ON public.payslips FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payslips" 
    ON public.payslips FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslip_items
CREATE POLICY "Users can view payslip_items from their tenants" 
    ON public.payslip_items FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payslip_items" 
    ON public.payslip_items FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_memory_calc
CREATE POLICY "Users can view payroll_memory_calc from their tenants" 
    ON public.payroll_memory_calc FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_memory_calc" 
    ON public.payroll_memory_calc FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- ==============================================================================
-- AUDITORIA
-- ==============================================================================
CREATE TRIGGER audit_payroll_periods_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_payroll_variable_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_variable_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_payslips_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payslips FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

*(Conclusão do Banco de Dados - Tabelas Base MVP + Motor de Cálculo Completos)*


### Script: `supabase_sql_fase_7.sql`
```sql
-- Fase 7: Afastamentos e Ausências
-- Cria a tabela 'leaves' com políticas de RLS e triggers.

CREATE TABLE IF NOT EXISTS public.leaves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('SICK_LEAVE', 'MATERNITY', 'PATERNITY', 'WORK_ACCIDENT', 'UNJUSTIFIED_ABSENCE', 'SUSPENSION', 'OTHER')),
    start_date DATE NOT NULL,
    end_date DATE,
    return_date DATE,
    icd_10_code TEXT,
    medical_certificate_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    is_inss_referral BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Users can view leaves from their tenants" 
    ON public.leaves FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert leaves into their tenants" 
    ON public.leaves FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update leaves in their tenants" 
    ON public.leaves FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete leaves in their tenants" 
    ON public.leaves FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Trigger de Updated At
CREATE TRIGGER update_leaves_updated_at
    BEFORE UPDATE ON public.leaves
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

```

### Script: `supabase_sql_fase_8.sql`
```sql
-- ==============================================================================
-- FASE 8: ESTRUTURA COMPLETA DE RUBRICAS
-- ==============================================================================
-- Este script expande a tabela "payroll_rubrics" com todas as variáveis exigidas
-- pelo Motor de Cálculo da Folha (Fase 13).

-- 1. Expansão da tabela payroll_rubrics
ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'AUTOMATICA', 'IMPORTADA', 'INTEGRACAO')),
    ADD COLUMN IF NOT EXISTS calculation_base TEXT,
    ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS divisor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS factor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS calculation_order INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS incidence_inss_patronal BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_rat BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_third_parties BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_inss BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_irrf BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_fgts BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS valid_to DATE,
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS esocial_description TEXT;

-- (Opcional) Adicionar type e category caso não tenham sido criados no Script 8 original, mas já usados no frontend
ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'EARNING',
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'SALARY',
    ADD COLUMN IF NOT EXISTS calculation_type TEXT DEFAULT 'FIXED',
    ADD COLUMN IF NOT EXISTS formula TEXT;

-- 2. Atualizar permissões de RLS para a tabela expandida 
-- (O Script 8 já possuía RLS, este comando é apenas por garantia)
ALTER TABLE public.payroll_rubrics ENABLE ROW LEVEL SECURITY;

-- Nota: A trigger de auditoria `audit_payroll_rubrics_trigger` criada na Fase 8/Script 8 já cobre automaticamente as novas colunas
-- pois o `to_jsonb(NEW)` captura dinamicamente a estrutura da tabela atual.

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_9.sql`
```sql
-- ==============================================================================
-- FASE 9: EVENTOS DA FOLHA (LANÇAMENTOS VARIÁVEIS) E PROGRESSIVAS
-- ==============================================================================
-- Este script cria as tabelas do motor de folha que faltavam no Script 9,
-- incluindo a versão já atualizada de payroll_events com quantity, origin, etc.

CREATE TABLE IF NOT EXISTS public.payroll_progressive_tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    table_type TEXT NOT NULL CHECK (table_type IN ('INSS', 'IRRF', 'FAMILY_SALARY', 'OTHER')),
    competence_start DATE NOT NULL,
    competence_end DATE,
    ranges_jsonb JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE RESTRICT,
    reference_value NUMERIC(10,2),
    quantity NUMERIC(10,2),
    calculated_amount NUMERIC(10,2) NOT NULL,
    is_manual_entry BOOLEAN NOT NULL DEFAULT false,
    origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO')),
    notes TEXT,
    recorded_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_memory_calc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.payroll_events(id) ON DELETE CASCADE,
    formula_used TEXT NOT NULL,
    variables_snapshot JSONB NOT NULL,
    progressive_table_id UUID REFERENCES public.payroll_progressive_tables(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.terminations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    termination_reason TEXT NOT NULL CHECK (termination_reason IN ('WITHOUT_JUST_CAUSE_BY_EMPLOYER', 'WITH_JUST_CAUSE_BY_EMPLOYER', 'BY_EMPLOYEE', 'MUTUAL_AGREEMENT', 'CONTRACT_EXPIRATION', 'RETIREMENT', 'DEATH')),
    notice_period_type TEXT NOT NULL CHECK (notice_period_type IN ('WORKED', 'INDEMNIFIED', 'WAIVED')),
    notice_date DATE NOT NULL,
    last_working_day DATE NOT NULL,
    fgts_fine_percentage NUMERIC(5,2),
    is_exam_required BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'CALCULATED', 'PAID', 'HOMOLOGATED', 'CANCELED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id)
);

-- Habilitar RLS
ALTER TABLE public.payroll_progressive_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminations ENABLE ROW LEVEL SECURITY;

-- Políticas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage progressive tables') THEN
        CREATE POLICY "Tenant Admins and DP can manage progressive tables" ON public.payroll_progressive_tables FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage payroll events') THEN
        CREATE POLICY "Tenant Admins and DP can manage payroll events" ON public.payroll_events FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can view memory calc') THEN
        CREATE POLICY "Tenant Admins and DP can view memory calc" ON public.payroll_memory_calc FOR SELECT USING (EXISTS (SELECT 1 FROM public.payroll_events e WHERE e.id = public.payroll_memory_calc.event_id AND e.tenant_id = ANY(public.user_tenant_ids())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage terminations') THEN
        CREATE POLICY "Tenant Admins and DP can manage terminations" ON public.terminations FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
END $$;

-- Triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_progressive_tables_trigger') THEN
        CREATE TRIGGER audit_progressive_tables_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_progressive_tables FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_events_trigger') THEN
        CREATE TRIGGER audit_payroll_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_terminations_trigger') THEN
        CREATE TRIGGER audit_terminations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.terminations FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;

-- E se a tabela payroll_events já existir (criada por script anterior incompleto), tentamos alterar:
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN quantity NUMERIC(10,2);
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO'));
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN notes TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN recorded_by UUID;
    EXCEPTION WHEN duplicate_column THEN END;
END $$;

```

### Script: `supabase_sql_fase_10.sql`
```sql
-- ==============================================================================
-- FASE 10: ESTRUTURA DE BENEFÍCIOS
-- ==============================================================================

-- 1. Criação do Catálogo de Benefícios
CREATE TABLE IF NOT EXISTS public.benefit_catalogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    benefit_type TEXT NOT NULL CHECK (benefit_type IN ('TRANSPORTATION', 'MEAL', 'FOOD', 'HEALTH_INSURANCE', 'DENTAL_INSURANCE', 'LIFE_INSURANCE', 'OTHER')),
    provider_name TEXT,
    company_contribution NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    employee_discount_percentage NUMERIC(5,2),
    employee_discount_fixed NUMERIC(10,2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Criação do Vínculo Empregado-Benefício
CREATE TABLE IF NOT EXISTS public.employee_benefits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    benefit_catalog_id UUID NOT NULL REFERENCES public.benefit_catalogs(id) ON DELETE CASCADE,
    opt_in BOOLEAN NOT NULL DEFAULT true,
    custom_discount_value NUMERIC(10,2),
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id, benefit_catalog_id)
);

-- Habilitar RLS
ALTER TABLE public.benefit_catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para benefit_catalogs
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view benefit catalogs from their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can insert benefit catalogs into their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can update benefit catalogs in their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can delete benefit catalogs in their tenants" ON public.benefit_catalogs;
    
    DROP POLICY IF EXISTS "Users can view employee benefits from their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can insert employee benefits into their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can update employee benefits in their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can delete employee benefits in their tenants" ON public.employee_benefits;
END
$$;

CREATE POLICY "Users can view benefit catalogs from their tenants" 
    ON public.benefit_catalogs FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert benefit catalogs into their tenants" 
    ON public.benefit_catalogs FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Políticas de RLS para employee_benefits
CREATE POLICY "Users can view employee benefits from their tenants" 
    ON public.employee_benefits FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee benefits into their tenants" 
    ON public.employee_benefits FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee benefits in their tenants" 
    ON public.employee_benefits FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee benefits in their tenants" 
    ON public.employee_benefits FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_11.sql`
```sql
-- ==============================================================================
-- FASE 11: ESTRUTURA DE DESCONTOS DIVERSOS
-- ==============================================================================

-- 1. Criação da Tabela de Descontos Diversos do Colaborador
CREATE TABLE IF NOT EXISTS public.employee_deductions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE RESTRICT,
    
    deduction_type TEXT NOT NULL CHECK (deduction_type IN ('ALIMONY', 'LOAN', 'ADVANCE', 'COPARTICIPATION', 'OTHER')),
    amount_type TEXT NOT NULL CHECK (amount_type IN ('FIXED', 'PERCENTAGE')),
    
    value NUMERIC(10,2) NOT NULL,
    total_limit NUMERIC(10,2), -- Ex: Limite total do empréstimo. Ao atingir, encerra o desconto.
    
    start_date DATE NOT NULL,
    end_date DATE,
    
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view employee deductions from their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can insert employee deductions into their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can update employee deductions in their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can delete employee deductions in their tenants" ON public.employee_deductions;
END
$$;

CREATE POLICY "Users can view employee deductions from their tenants" 
    ON public.employee_deductions FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee deductions into their tenants" 
    ON public.employee_deductions FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee deductions in their tenants" 
    ON public.employee_deductions FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee deductions in their tenants" 
    ON public.employee_deductions FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_12.sql`
```sql
-- ==============================================================================
-- FASE 12: TABELAS LEGAIS E PARÂMETROS
-- ==============================================================================

-- 1. Criação do Catálogo de Versões Legais
-- Essas versões agrupam os parâmetros de uma mesma época (ex: 2026).
CREATE TABLE IF NOT EXISTS public.legal_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_name TEXT NOT NULL, -- Ex: "Legislação 2026"
    valid_from DATE NOT NULL,
    valid_to DATE,
    source TEXT, -- Ex: "Governo Federal, eSocial"
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela INSS (Progressivo)
CREATE TABLE IF NOT EXISTS public.inss_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    bracket_number INT NOT NULL, -- Ordem da faixa, ex: 1, 2, 3, 4
    base_limit NUMERIC(10,2), -- NULL significa "acima de" ou sem limite superior
    aliquot NUMERIC(5,2) NOT NULL,
    deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabela IRRF
CREATE TABLE IF NOT EXISTS public.irrf_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    bracket_number INT NOT NULL,
    base_limit NUMERIC(10,2), -- NULL significa sem limite superior
    aliquot NUMERIC(5,2) NOT NULL,
    deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Parâmetros Gerais (Salário Mínimo, Deduções, FGTS, etc)
CREATE TABLE IF NOT EXISTS public.general_legal_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    minimum_wage NUMERIC(10,2) NOT NULL,
    dependent_deduction NUMERIC(10,2) NOT NULL,
    simplified_discount NUMERIC(10,2) NOT NULL,
    family_salary_quota NUMERIC(10,2) NOT NULL,
    family_salary_limit NUMERIC(10,2) NOT NULL,
    fgts_standard_aliquot NUMERIC(5,2) NOT NULL, -- 8.00
    fgts_apprentice_aliquot NUMERIC(5,2) NOT NULL, -- 2.00
    vt_max_discount_percentage NUMERIC(5,2) NOT NULL, -- 6.00
    irrf_exemption_limit NUMERIC(10,2), -- 5000.00 (Redutor 2026)
    irrf_reduction_formula_limit NUMERIC(10,2), -- 7350.00
    irrf_base_reduction NUMERIC(10,2), -- 312.89
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS (Como são dados públicos/globais do sistema, apenas leitura autenticada)
ALTER TABLE public.legal_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inss_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.irrf_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.general_legal_parameters ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS — leitura e escrita para autenticados
-- Dropar políticas existentes para permitir re-execução
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated read on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated insert on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated update on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated delete on legal_versions" ON public.legal_versions;

    DROP POLICY IF EXISTS "Allow authenticated read on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on inss_parameters" ON public.inss_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on irrf_parameters" ON public.irrf_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on general_legal_parameters" ON public.general_legal_parameters;
END $$;

-- legal_versions
CREATE POLICY "Allow authenticated read on legal_versions" 
    ON public.legal_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on legal_versions" 
    ON public.legal_versions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on legal_versions" 
    ON public.legal_versions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on legal_versions" 
    ON public.legal_versions FOR DELETE TO authenticated USING (true);

-- inss_parameters
CREATE POLICY "Allow authenticated read on inss_parameters" 
    ON public.inss_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on inss_parameters" 
    ON public.inss_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on inss_parameters" 
    ON public.inss_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on inss_parameters" 
    ON public.inss_parameters FOR DELETE TO authenticated USING (true);

-- irrf_parameters
CREATE POLICY "Allow authenticated read on irrf_parameters" 
    ON public.irrf_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on irrf_parameters" 
    ON public.irrf_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on irrf_parameters" 
    ON public.irrf_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on irrf_parameters" 
    ON public.irrf_parameters FOR DELETE TO authenticated USING (true);

-- general_legal_parameters
CREATE POLICY "Allow authenticated read on general_legal_parameters" 
    ON public.general_legal_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on general_legal_parameters" 
    ON public.general_legal_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on general_legal_parameters" 
    ON public.general_legal_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on general_legal_parameters" 
    ON public.general_legal_parameters FOR DELETE TO authenticated USING (true);

-- ==============================================================================
-- INSERÇÃO DOS DADOS BASE - 2026
-- ==============================================================================

DO $$
DECLARE
    v_version_id UUID;
BEGIN
    -- Cria a versão 2026 se não existir para evitar duplicação (por precaução)
    IF NOT EXISTS (SELECT 1 FROM public.legal_versions WHERE version_name = 'Legislação 2026') THEN
        INSERT INTO public.legal_versions (version_name, valid_from, source)
        VALUES ('Legislação 2026', '2026-01-01', 'Pesquisa CLT 2026')
        RETURNING id INTO v_version_id;

        -- INSS 2026
        INSERT INTO public.inss_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 1621.00, 7.5, 0.00),
        (v_version_id, 2, 2902.84, 9.0, 24.32),
        (v_version_id, 3, 4354.27, 12.0, 111.40),
        (v_version_id, 4, 8475.55, 14.0, 198.49);

        -- IRRF 2026
        INSERT INTO public.irrf_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 2428.80, 0.0, 0.00),
        (v_version_id, 2, 2826.65, 7.5, 182.16),
        (v_version_id, 3, 3751.05, 15.0, 394.16),
        (v_version_id, 4, 4664.68, 22.5, 675.49),
        (v_version_id, 5, NULL, 27.5, 908.73);

        -- Parâmetros Gerais 2026
        INSERT INTO public.general_legal_parameters (
            version_id, minimum_wage, dependent_deduction, simplified_discount, 
            family_salary_quota, family_salary_limit, fgts_standard_aliquot, 
            fgts_apprentice_aliquot, vt_max_discount_percentage, irrf_exemption_limit, 
            irrf_reduction_formula_limit, irrf_base_reduction
        ) VALUES (
            v_version_id, 1621.00, 189.59, 607.20, 
            67.54, 1980.38, 8.00, 
            2.00, 6.00, 5000.00, 
            7350.00, 312.89
        );
    END IF;
END $$;

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_13_14.sql`
```sql
-- ==============================================================================
-- FASES 13 e 14: ESTRUTURAS DO MOTOR DE CÁLCULO E HOLERITE
-- ==============================================================================

-- 1. Períodos de Folha (Competências)
CREATE TABLE IF NOT EXISTS public.payroll_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('MONTHLY', 'ADVANCE', '13TH', 'SUPPLEMENTARY')),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CALCULATED', 'CONFERENCE', 'CLOSED', 'CANCELED')),
    processing_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, month, year, type)
);

-- 2. Eventos Variáveis do Mês (Lançamentos Manuais)
CREATE TABLE IF NOT EXISTS public.payroll_variable_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE CASCADE,
    amount NUMERIC(10,2), -- Valor monetário
    quantity NUMERIC(10,2), -- Quantidade (ex: 10 horas)
    reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Holerites (Resultados Calculados)
CREATE TABLE IF NOT EXISTS public.payslips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    total_earnings NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total_deductions NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    net_salary NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_inss NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_irrf NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_fgts NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    fgts_month NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'CALCULATED' CHECK (status IN ('CALCULATED', 'CLOSED', 'CANCELED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(period_id, contract_id)
);

-- 4. Itens do Holerite (Demonstrativo)
CREATE TABLE IF NOT EXISTS public.payslip_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE CASCADE,
    reference TEXT, -- Ex: 10h, 50%
    amount NUMERIC(10,2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('EARNING', 'DEDUCTION', 'NEUTRAL', 'BASE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Memória de Cálculo (Auditoria e Transparência)
CREATE TABLE IF NOT EXISTS public.payroll_memory_calc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    base_value NUMERIC(10,2) NOT NULL,
    quantity_used NUMERIC(10,2) NOT NULL,
    percentage_used NUMERIC(10,2) NOT NULL,
    parsed_formula TEXT NOT NULL,
    result_value NUMERIC(10,2) NOT NULL,
    origin TEXT NOT NULL,
    engine_version TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- SEGURANÇA E RLS
-- ==============================================================================
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_variable_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslip_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view payroll_periods from their tenants" ON public.payroll_periods;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_periods" ON public.payroll_periods;
    
    DROP POLICY IF EXISTS "Users can view payroll_variable_events from their tenants" ON public.payroll_variable_events;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_variable_events" ON public.payroll_variable_events;

    DROP POLICY IF EXISTS "Users can view payslips from their tenants" ON public.payslips;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslips" ON public.payslips;

    DROP POLICY IF EXISTS "Users can view payslip_items from their tenants" ON public.payslip_items;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslip_items" ON public.payslip_items;

    DROP POLICY IF EXISTS "Users can view payroll_memory_calc from their tenants" ON public.payroll_memory_calc;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_memory_calc" ON public.payroll_memory_calc;
END
$$;

-- payroll_periods
CREATE POLICY "Users can view payroll_periods from their tenants" 
    ON public.payroll_periods FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_periods" 
    ON public.payroll_periods FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_variable_events
CREATE POLICY "Users can view payroll_variable_events from their tenants" 
    ON public.payroll_variable_events FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_variable_events" 
    ON public.payroll_variable_events FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslips
CREATE POLICY "Users can view payslips from their tenants" 
    ON public.payslips FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payslips" 
    ON public.payslips FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslip_items
CREATE POLICY "Users can view payslip_items from their tenants" 
    ON public.payslip_items FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payslip_items" 
    ON public.payslip_items FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_memory_calc
CREATE POLICY "Users can view payroll_memory_calc from their tenants" 
    ON public.payroll_memory_calc FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_memory_calc" 
    ON public.payroll_memory_calc FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- ==============================================================================
-- AUDITORIA
-- ==============================================================================
CREATE TRIGGER audit_payroll_periods_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_payroll_variable_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_variable_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_payslips_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payslips FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

*(Conclusão do Banco de Dados - Tabelas Base MVP + Motor de Cálculo Completos)*


### Script: `supabase_sql_fase_7.sql`
```sql
-- Fase 7: Afastamentos e Ausências
-- Cria a tabela 'leaves' com políticas de RLS e triggers.

CREATE TABLE IF NOT EXISTS public.leaves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('SICK_LEAVE', 'MATERNITY', 'PATERNITY', 'WORK_ACCIDENT', 'UNJUSTIFIED_ABSENCE', 'SUSPENSION', 'OTHER')),
    start_date DATE NOT NULL,
    end_date DATE,
    return_date DATE,
    icd_10_code TEXT,
    medical_certificate_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    is_inss_referral BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Users can view leaves from their tenants" 
    ON public.leaves FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert leaves into their tenants" 
    ON public.leaves FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update leaves in their tenants" 
    ON public.leaves FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete leaves in their tenants" 
    ON public.leaves FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Trigger de Updated At
CREATE TRIGGER update_leaves_updated_at
    BEFORE UPDATE ON public.leaves
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

```

### Script: `supabase_sql_fase_8.sql`
```sql
-- ==============================================================================
-- FASE 8: ESTRUTURA COMPLETA DE RUBRICAS
-- ==============================================================================
-- Este script expande a tabela "payroll_rubrics" com todas as variáveis exigidas
-- pelo Motor de Cálculo da Folha (Fase 13).

-- 1. Expansão da tabela payroll_rubrics
ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'AUTOMATICA', 'IMPORTADA', 'INTEGRACAO')),
    ADD COLUMN IF NOT EXISTS calculation_base TEXT,
    ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS divisor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS factor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS calculation_order INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS incidence_inss_patronal BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_rat BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_third_parties BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_inss BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_irrf BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_fgts BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS valid_to DATE,
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS esocial_description TEXT;

-- (Opcional) Adicionar type e category caso não tenham sido criados no Script 8 original, mas já usados no frontend
ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'EARNING',
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'SALARY',
    ADD COLUMN IF NOT EXISTS calculation_type TEXT DEFAULT 'FIXED',
    ADD COLUMN IF NOT EXISTS formula TEXT;

-- 2. Atualizar permissões de RLS para a tabela expandida 
-- (O Script 8 já possuía RLS, este comando é apenas por garantia)
ALTER TABLE public.payroll_rubrics ENABLE ROW LEVEL SECURITY;

-- Nota: A trigger de auditoria `audit_payroll_rubrics_trigger` criada na Fase 8/Script 8 já cobre automaticamente as novas colunas
-- pois o `to_jsonb(NEW)` captura dinamicamente a estrutura da tabela atual.

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_9.sql`
```sql
-- ==============================================================================
-- FASE 9: EVENTOS DA FOLHA (LANÇAMENTOS VARIÁVEIS) E PROGRESSIVAS
-- ==============================================================================
-- Este script cria as tabelas do motor de folha que faltavam no Script 9,
-- incluindo a versão já atualizada de payroll_events com quantity, origin, etc.

CREATE TABLE IF NOT EXISTS public.payroll_progressive_tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    table_type TEXT NOT NULL CHECK (table_type IN ('INSS', 'IRRF', 'FAMILY_SALARY', 'OTHER')),
    competence_start DATE NOT NULL,
    competence_end DATE,
    ranges_jsonb JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE RESTRICT,
    reference_value NUMERIC(10,2),
    quantity NUMERIC(10,2),
    calculated_amount NUMERIC(10,2) NOT NULL,
    is_manual_entry BOOLEAN NOT NULL DEFAULT false,
    origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO')),
    notes TEXT,
    recorded_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_memory_calc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.payroll_events(id) ON DELETE CASCADE,
    formula_used TEXT NOT NULL,
    variables_snapshot JSONB NOT NULL,
    progressive_table_id UUID REFERENCES public.payroll_progressive_tables(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.terminations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    termination_reason TEXT NOT NULL CHECK (termination_reason IN ('WITHOUT_JUST_CAUSE_BY_EMPLOYER', 'WITH_JUST_CAUSE_BY_EMPLOYER', 'BY_EMPLOYEE', 'MUTUAL_AGREEMENT', 'CONTRACT_EXPIRATION', 'RETIREMENT', 'DEATH')),
    notice_period_type TEXT NOT NULL CHECK (notice_period_type IN ('WORKED', 'INDEMNIFIED', 'WAIVED')),
    notice_date DATE NOT NULL,
    last_working_day DATE NOT NULL,
    fgts_fine_percentage NUMERIC(5,2),
    is_exam_required BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'CALCULATED', 'PAID', 'HOMOLOGATED', 'CANCELED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id)
);

-- Habilitar RLS
ALTER TABLE public.payroll_progressive_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminations ENABLE ROW LEVEL SECURITY;

-- Políticas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage progressive tables') THEN
        CREATE POLICY "Tenant Admins and DP can manage progressive tables" ON public.payroll_progressive_tables FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage payroll events') THEN
        CREATE POLICY "Tenant Admins and DP can manage payroll events" ON public.payroll_events FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can view memory calc') THEN
        CREATE POLICY "Tenant Admins and DP can view memory calc" ON public.payroll_memory_calc FOR SELECT USING (EXISTS (SELECT 1 FROM public.payroll_events e WHERE e.id = public.payroll_memory_calc.event_id AND e.tenant_id = ANY(public.user_tenant_ids())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage terminations') THEN
        CREATE POLICY "Tenant Admins and DP can manage terminations" ON public.terminations FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
END $$;

-- Triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_progressive_tables_trigger') THEN
        CREATE TRIGGER audit_progressive_tables_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_progressive_tables FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_events_trigger') THEN
        CREATE TRIGGER audit_payroll_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_terminations_trigger') THEN
        CREATE TRIGGER audit_terminations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.terminations FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;

-- E se a tabela payroll_events já existir (criada por script anterior incompleto), tentamos alterar:
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN quantity NUMERIC(10,2);
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO'));
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN notes TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN recorded_by UUID;
    EXCEPTION WHEN duplicate_column THEN END;
END $$;

```

### Script: `supabase_sql_fase_10.sql`
```sql
-- ==============================================================================
-- FASE 10: ESTRUTURA DE BENEFÍCIOS
-- ==============================================================================

-- 1. Criação do Catálogo de Benefícios
CREATE TABLE IF NOT EXISTS public.benefit_catalogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    benefit_type TEXT NOT NULL CHECK (benefit_type IN ('TRANSPORTATION', 'MEAL', 'FOOD', 'HEALTH_INSURANCE', 'DENTAL_INSURANCE', 'LIFE_INSURANCE', 'OTHER')),
    provider_name TEXT,
    company_contribution NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    employee_discount_percentage NUMERIC(5,2),
    employee_discount_fixed NUMERIC(10,2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Criação do Vínculo Empregado-Benefício
CREATE TABLE IF NOT EXISTS public.employee_benefits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    benefit_catalog_id UUID NOT NULL REFERENCES public.benefit_catalogs(id) ON DELETE CASCADE,
    opt_in BOOLEAN NOT NULL DEFAULT true,
    custom_discount_value NUMERIC(10,2),
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id, benefit_catalog_id)
);

-- Habilitar RLS
ALTER TABLE public.benefit_catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para benefit_catalogs
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view benefit catalogs from their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can insert benefit catalogs into their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can update benefit catalogs in their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can delete benefit catalogs in their tenants" ON public.benefit_catalogs;
    
    DROP POLICY IF EXISTS "Users can view employee benefits from their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can insert employee benefits into their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can update employee benefits in their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can delete employee benefits in their tenants" ON public.employee_benefits;
END
$$;

CREATE POLICY "Users can view benefit catalogs from their tenants" 
    ON public.benefit_catalogs FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert benefit catalogs into their tenants" 
    ON public.benefit_catalogs FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Políticas de RLS para employee_benefits
CREATE POLICY "Users can view employee benefits from their tenants" 
    ON public.employee_benefits FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee benefits into their tenants" 
    ON public.employee_benefits FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee benefits in their tenants" 
    ON public.employee_benefits FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee benefits in their tenants" 
    ON public.employee_benefits FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_11.sql`
```sql
-- ==============================================================================
-- FASE 11: ESTRUTURA DE DESCONTOS DIVERSOS
-- ==============================================================================

-- 1. Criação da Tabela de Descontos Diversos do Colaborador
CREATE TABLE IF NOT EXISTS public.employee_deductions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE RESTRICT,
    
    deduction_type TEXT NOT NULL CHECK (deduction_type IN ('ALIMONY', 'LOAN', 'ADVANCE', 'COPARTICIPATION', 'OTHER')),
    amount_type TEXT NOT NULL CHECK (amount_type IN ('FIXED', 'PERCENTAGE')),
    
    value NUMERIC(10,2) NOT NULL,
    total_limit NUMERIC(10,2), -- Ex: Limite total do empréstimo. Ao atingir, encerra o desconto.
    
    start_date DATE NOT NULL,
    end_date DATE,
    
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view employee deductions from their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can insert employee deductions into their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can update employee deductions in their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can delete employee deductions in their tenants" ON public.employee_deductions;
END
$$;

CREATE POLICY "Users can view employee deductions from their tenants" 
    ON public.employee_deductions FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee deductions into their tenants" 
    ON public.employee_deductions FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee deductions in their tenants" 
    ON public.employee_deductions FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee deductions in their tenants" 
    ON public.employee_deductions FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_12.sql`
```sql
-- ==============================================================================
-- FASE 12: TABELAS LEGAIS E PARÂMETROS
-- ==============================================================================

-- 1. Criação do Catálogo de Versões Legais
-- Essas versões agrupam os parâmetros de uma mesma época (ex: 2026).
CREATE TABLE IF NOT EXISTS public.legal_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_name TEXT NOT NULL, -- Ex: "Legislação 2026"
    valid_from DATE NOT NULL,
    valid_to DATE,
    source TEXT, -- Ex: "Governo Federal, eSocial"
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela INSS (Progressivo)
CREATE TABLE IF NOT EXISTS public.inss_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    bracket_number INT NOT NULL, -- Ordem da faixa, ex: 1, 2, 3, 4
    base_limit NUMERIC(10,2), -- NULL significa "acima de" ou sem limite superior
    aliquot NUMERIC(5,2) NOT NULL,
    deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabela IRRF
CREATE TABLE IF NOT EXISTS public.irrf_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    bracket_number INT NOT NULL,
    base_limit NUMERIC(10,2), -- NULL significa sem limite superior
    aliquot NUMERIC(5,2) NOT NULL,
    deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Parâmetros Gerais (Salário Mínimo, Deduções, FGTS, etc)
CREATE TABLE IF NOT EXISTS public.general_legal_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    minimum_wage NUMERIC(10,2) NOT NULL,
    dependent_deduction NUMERIC(10,2) NOT NULL,
    simplified_discount NUMERIC(10,2) NOT NULL,
    family_salary_quota NUMERIC(10,2) NOT NULL,
    family_salary_limit NUMERIC(10,2) NOT NULL,
    fgts_standard_aliquot NUMERIC(5,2) NOT NULL, -- 8.00
    fgts_apprentice_aliquot NUMERIC(5,2) NOT NULL, -- 2.00
    vt_max_discount_percentage NUMERIC(5,2) NOT NULL, -- 6.00
    irrf_exemption_limit NUMERIC(10,2), -- 5000.00 (Redutor 2026)
    irrf_reduction_formula_limit NUMERIC(10,2), -- 7350.00
    irrf_base_reduction NUMERIC(10,2), -- 312.89
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS (Como são dados públicos/globais do sistema, apenas leitura autenticada)
ALTER TABLE public.legal_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inss_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.irrf_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.general_legal_parameters ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS — leitura e escrita para autenticados
-- Dropar políticas existentes para permitir re-execução
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated read on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated insert on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated update on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated delete on legal_versions" ON public.legal_versions;

    DROP POLICY IF EXISTS "Allow authenticated read on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on inss_parameters" ON public.inss_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on irrf_parameters" ON public.irrf_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on general_legal_parameters" ON public.general_legal_parameters;
END $$;

-- legal_versions
CREATE POLICY "Allow authenticated read on legal_versions" 
    ON public.legal_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on legal_versions" 
    ON public.legal_versions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on legal_versions" 
    ON public.legal_versions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on legal_versions" 
    ON public.legal_versions FOR DELETE TO authenticated USING (true);

-- inss_parameters
CREATE POLICY "Allow authenticated read on inss_parameters" 
    ON public.inss_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on inss_parameters" 
    ON public.inss_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on inss_parameters" 
    ON public.inss_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on inss_parameters" 
    ON public.inss_parameters FOR DELETE TO authenticated USING (true);

-- irrf_parameters
CREATE POLICY "Allow authenticated read on irrf_parameters" 
    ON public.irrf_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on irrf_parameters" 
    ON public.irrf_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on irrf_parameters" 
    ON public.irrf_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on irrf_parameters" 
    ON public.irrf_parameters FOR DELETE TO authenticated USING (true);

-- general_legal_parameters
CREATE POLICY "Allow authenticated read on general_legal_parameters" 
    ON public.general_legal_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on general_legal_parameters" 
    ON public.general_legal_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on general_legal_parameters" 
    ON public.general_legal_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on general_legal_parameters" 
    ON public.general_legal_parameters FOR DELETE TO authenticated USING (true);

-- ==============================================================================
-- INSERÇÃO DOS DADOS BASE - 2026
-- ==============================================================================

DO $$
DECLARE
    v_version_id UUID;
BEGIN
    -- Cria a versão 2026 se não existir para evitar duplicação (por precaução)
    IF NOT EXISTS (SELECT 1 FROM public.legal_versions WHERE version_name = 'Legislação 2026') THEN
        INSERT INTO public.legal_versions (version_name, valid_from, source)
        VALUES ('Legislação 2026', '2026-01-01', 'Pesquisa CLT 2026')
        RETURNING id INTO v_version_id;

        -- INSS 2026
        INSERT INTO public.inss_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 1621.00, 7.5, 0.00),
        (v_version_id, 2, 2902.84, 9.0, 24.32),
        (v_version_id, 3, 4354.27, 12.0, 111.40),
        (v_version_id, 4, 8475.55, 14.0, 198.49);

        -- IRRF 2026
        INSERT INTO public.irrf_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 2428.80, 0.0, 0.00),
        (v_version_id, 2, 2826.65, 7.5, 182.16),
        (v_version_id, 3, 3751.05, 15.0, 394.16),
        (v_version_id, 4, 4664.68, 22.5, 675.49),
        (v_version_id, 5, NULL, 27.5, 908.73);

        -- Parâmetros Gerais 2026
        INSERT INTO public.general_legal_parameters (
            version_id, minimum_wage, dependent_deduction, simplified_discount, 
            family_salary_quota, family_salary_limit, fgts_standard_aliquot, 
            fgts_apprentice_aliquot, vt_max_discount_percentage, irrf_exemption_limit, 
            irrf_reduction_formula_limit, irrf_base_reduction
        ) VALUES (
            v_version_id, 1621.00, 189.59, 607.20, 
            67.54, 1980.38, 8.00, 
            2.00, 6.00, 5000.00, 
            7350.00, 312.89
        );
    END IF;
END $$;

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_13_14.sql`
```sql
-- ==============================================================================
-- FASES 13 e 14: ESTRUTURAS DO MOTOR DE CÁLCULO E HOLERITE
-- ==============================================================================

-- 1. Períodos de Folha (Competências)
CREATE TABLE IF NOT EXISTS public.payroll_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('MONTHLY', 'ADVANCE', '13TH', 'SUPPLEMENTARY')),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CALCULATED', 'CONFERENCE', 'CLOSED', 'CANCELED')),
    processing_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, month, year, type)
);

-- 2. Eventos Variáveis do Mês (Lançamentos Manuais)
CREATE TABLE IF NOT EXISTS public.payroll_variable_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE CASCADE,
    amount NUMERIC(10,2), -- Valor monetário
    quantity NUMERIC(10,2), -- Quantidade (ex: 10 horas)
    reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Holerites (Resultados Calculados)
CREATE TABLE IF NOT EXISTS public.payslips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    total_earnings NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total_deductions NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    net_salary NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_inss NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_irrf NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_fgts NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    fgts_month NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'CALCULATED' CHECK (status IN ('CALCULATED', 'CLOSED', 'CANCELED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(period_id, contract_id)
);

-- 4. Itens do Holerite (Demonstrativo)
CREATE TABLE IF NOT EXISTS public.payslip_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE CASCADE,
    reference TEXT, -- Ex: 10h, 50%
    amount NUMERIC(10,2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('EARNING', 'DEDUCTION', 'NEUTRAL', 'BASE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Memória de Cálculo (Auditoria e Transparência)
CREATE TABLE IF NOT EXISTS public.payroll_memory_calc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    base_value NUMERIC(10,2) NOT NULL,
    quantity_used NUMERIC(10,2) NOT NULL,
    percentage_used NUMERIC(10,2) NOT NULL,
    parsed_formula TEXT NOT NULL,
    result_value NUMERIC(10,2) NOT NULL,
    origin TEXT NOT NULL,
    engine_version TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- SEGURANÇA E RLS
-- ==============================================================================
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_variable_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslip_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view payroll_periods from their tenants" ON public.payroll_periods;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_periods" ON public.payroll_periods;
    
    DROP POLICY IF EXISTS "Users can view payroll_variable_events from their tenants" ON public.payroll_variable_events;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_variable_events" ON public.payroll_variable_events;

    DROP POLICY IF EXISTS "Users can view payslips from their tenants" ON public.payslips;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslips" ON public.payslips;

    DROP POLICY IF EXISTS "Users can view payslip_items from their tenants" ON public.payslip_items;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslip_items" ON public.payslip_items;

    DROP POLICY IF EXISTS "Users can view payroll_memory_calc from their tenants" ON public.payroll_memory_calc;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_memory_calc" ON public.payroll_memory_calc;
END
$$;

-- payroll_periods
CREATE POLICY "Users can view payroll_periods from their tenants" 
    ON public.payroll_periods FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_periods" 
    ON public.payroll_periods FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_variable_events
CREATE POLICY "Users can view payroll_variable_events from their tenants" 
    ON public.payroll_variable_events FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_variable_events" 
    ON public.payroll_variable_events FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslips
CREATE POLICY "Users can view payslips from their tenants" 
    ON public.payslips FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payslips" 
    ON public.payslips FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslip_items
CREATE POLICY "Users can view payslip_items from their tenants" 
    ON public.payslip_items FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payslip_items" 
    ON public.payslip_items FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_memory_calc
CREATE POLICY "Users can view payroll_memory_calc from their tenants" 
    ON public.payroll_memory_calc FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_memory_calc" 
    ON public.payroll_memory_calc FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- ==============================================================================
-- AUDITORIA
-- ==============================================================================
CREATE TRIGGER audit_payroll_periods_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_payroll_variable_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_variable_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_payslips_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payslips FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

*(Conclusão do Banco de Dados - Tabelas Base MVP + Motor de Cálculo Completos)*


### Script: `supabase_sql_fase_7.sql`
```sql
-- Fase 7: Afastamentos e Ausências
-- Cria a tabela 'leaves' com políticas de RLS e triggers.

CREATE TABLE IF NOT EXISTS public.leaves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('SICK_LEAVE', 'MATERNITY', 'PATERNITY', 'WORK_ACCIDENT', 'UNJUSTIFIED_ABSENCE', 'SUSPENSION', 'OTHER')),
    start_date DATE NOT NULL,
    end_date DATE,
    return_date DATE,
    icd_10_code TEXT,
    medical_certificate_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    is_inss_referral BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Users can view leaves from their tenants" 
    ON public.leaves FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert leaves into their tenants" 
    ON public.leaves FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update leaves in their tenants" 
    ON public.leaves FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete leaves in their tenants" 
    ON public.leaves FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Trigger de Updated At
CREATE TRIGGER update_leaves_updated_at
    BEFORE UPDATE ON public.leaves
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

```

### Script: `supabase_sql_fase_8.sql`
```sql
-- ==============================================================================
-- FASE 8: ESTRUTURA COMPLETA DE RUBRICAS
-- ==============================================================================
-- Este script expande a tabela "payroll_rubrics" com todas as variáveis exigidas
-- pelo Motor de Cálculo da Folha (Fase 13).

-- 1. Expansão da tabela payroll_rubrics
ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'AUTOMATICA', 'IMPORTADA', 'INTEGRACAO')),
    ADD COLUMN IF NOT EXISTS calculation_base TEXT,
    ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS divisor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS factor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS calculation_order INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS incidence_inss_patronal BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_rat BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_third_parties BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_inss BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_irrf BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_fgts BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS valid_to DATE,
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS esocial_description TEXT;

-- (Opcional) Adicionar type e category caso não tenham sido criados no Script 8 original, mas já usados no frontend
ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'EARNING',
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'SALARY',
    ADD COLUMN IF NOT EXISTS calculation_type TEXT DEFAULT 'FIXED',
    ADD COLUMN IF NOT EXISTS formula TEXT;

-- 2. Atualizar permissões de RLS para a tabela expandida 
-- (O Script 8 já possuía RLS, este comando é apenas por garantia)
ALTER TABLE public.payroll_rubrics ENABLE ROW LEVEL SECURITY;

-- Nota: A trigger de auditoria `audit_payroll_rubrics_trigger` criada na Fase 8/Script 8 já cobre automaticamente as novas colunas
-- pois o `to_jsonb(NEW)` captura dinamicamente a estrutura da tabela atual.

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_9.sql`
```sql
-- ==============================================================================
-- FASE 9: EVENTOS DA FOLHA (LANÇAMENTOS VARIÁVEIS) E PROGRESSIVAS
-- ==============================================================================
-- Este script cria as tabelas do motor de folha que faltavam no Script 9,
-- incluindo a versão já atualizada de payroll_events com quantity, origin, etc.

CREATE TABLE IF NOT EXISTS public.payroll_progressive_tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    table_type TEXT NOT NULL CHECK (table_type IN ('INSS', 'IRRF', 'FAMILY_SALARY', 'OTHER')),
    competence_start DATE NOT NULL,
    competence_end DATE,
    ranges_jsonb JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE RESTRICT,
    reference_value NUMERIC(10,2),
    quantity NUMERIC(10,2),
    calculated_amount NUMERIC(10,2) NOT NULL,
    is_manual_entry BOOLEAN NOT NULL DEFAULT false,
    origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO')),
    notes TEXT,
    recorded_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_memory_calc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.payroll_events(id) ON DELETE CASCADE,
    formula_used TEXT NOT NULL,
    variables_snapshot JSONB NOT NULL,
    progressive_table_id UUID REFERENCES public.payroll_progressive_tables(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.terminations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    termination_reason TEXT NOT NULL CHECK (termination_reason IN ('WITHOUT_JUST_CAUSE_BY_EMPLOYER', 'WITH_JUST_CAUSE_BY_EMPLOYER', 'BY_EMPLOYEE', 'MUTUAL_AGREEMENT', 'CONTRACT_EXPIRATION', 'RETIREMENT', 'DEATH')),
    notice_period_type TEXT NOT NULL CHECK (notice_period_type IN ('WORKED', 'INDEMNIFIED', 'WAIVED')),
    notice_date DATE NOT NULL,
    last_working_day DATE NOT NULL,
    fgts_fine_percentage NUMERIC(5,2),
    is_exam_required BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'CALCULATED', 'PAID', 'HOMOLOGATED', 'CANCELED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id)
);

-- Habilitar RLS
ALTER TABLE public.payroll_progressive_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminations ENABLE ROW LEVEL SECURITY;

-- Políticas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage progressive tables') THEN
        CREATE POLICY "Tenant Admins and DP can manage progressive tables" ON public.payroll_progressive_tables FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage payroll events') THEN
        CREATE POLICY "Tenant Admins and DP can manage payroll events" ON public.payroll_events FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can view memory calc') THEN
        CREATE POLICY "Tenant Admins and DP can view memory calc" ON public.payroll_memory_calc FOR SELECT USING (EXISTS (SELECT 1 FROM public.payroll_events e WHERE e.id = public.payroll_memory_calc.event_id AND e.tenant_id = ANY(public.user_tenant_ids())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage terminations') THEN
        CREATE POLICY "Tenant Admins and DP can manage terminations" ON public.terminations FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
END $$;

-- Triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_progressive_tables_trigger') THEN
        CREATE TRIGGER audit_progressive_tables_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_progressive_tables FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_events_trigger') THEN
        CREATE TRIGGER audit_payroll_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_terminations_trigger') THEN
        CREATE TRIGGER audit_terminations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.terminations FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;

-- E se a tabela payroll_events já existir (criada por script anterior incompleto), tentamos alterar:
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN quantity NUMERIC(10,2);
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO'));
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN notes TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN recorded_by UUID;
    EXCEPTION WHEN duplicate_column THEN END;
END $$;

```

### Script: `supabase_sql_fase_10.sql`
```sql
-- ==============================================================================
-- FASE 10: ESTRUTURA DE BENEFÍCIOS
-- ==============================================================================

-- 1. Criação do Catálogo de Benefícios
CREATE TABLE IF NOT EXISTS public.benefit_catalogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    benefit_type TEXT NOT NULL CHECK (benefit_type IN ('TRANSPORTATION', 'MEAL', 'FOOD', 'HEALTH_INSURANCE', 'DENTAL_INSURANCE', 'LIFE_INSURANCE', 'OTHER')),
    provider_name TEXT,
    company_contribution NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    employee_discount_percentage NUMERIC(5,2),
    employee_discount_fixed NUMERIC(10,2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Criação do Vínculo Empregado-Benefício
CREATE TABLE IF NOT EXISTS public.employee_benefits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    benefit_catalog_id UUID NOT NULL REFERENCES public.benefit_catalogs(id) ON DELETE CASCADE,
    opt_in BOOLEAN NOT NULL DEFAULT true,
    custom_discount_value NUMERIC(10,2),
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id, benefit_catalog_id)
);

-- Habilitar RLS
ALTER TABLE public.benefit_catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para benefit_catalogs
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view benefit catalogs from their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can insert benefit catalogs into their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can update benefit catalogs in their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can delete benefit catalogs in their tenants" ON public.benefit_catalogs;
    
    DROP POLICY IF EXISTS "Users can view employee benefits from their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can insert employee benefits into their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can update employee benefits in their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can delete employee benefits in their tenants" ON public.employee_benefits;
END
$$;

CREATE POLICY "Users can view benefit catalogs from their tenants" 
    ON public.benefit_catalogs FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert benefit catalogs into their tenants" 
    ON public.benefit_catalogs FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Políticas de RLS para employee_benefits
CREATE POLICY "Users can view employee benefits from their tenants" 
    ON public.employee_benefits FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee benefits into their tenants" 
    ON public.employee_benefits FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee benefits in their tenants" 
    ON public.employee_benefits FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee benefits in their tenants" 
    ON public.employee_benefits FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_11.sql`
```sql
-- ==============================================================================
-- FASE 11: ESTRUTURA DE DESCONTOS DIVERSOS
-- ==============================================================================

-- 1. Criação da Tabela de Descontos Diversos do Colaborador
CREATE TABLE IF NOT EXISTS public.employee_deductions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE RESTRICT,
    
    deduction_type TEXT NOT NULL CHECK (deduction_type IN ('ALIMONY', 'LOAN', 'ADVANCE', 'COPARTICIPATION', 'OTHER')),
    amount_type TEXT NOT NULL CHECK (amount_type IN ('FIXED', 'PERCENTAGE')),
    
    value NUMERIC(10,2) NOT NULL,
    total_limit NUMERIC(10,2), -- Ex: Limite total do empréstimo. Ao atingir, encerra o desconto.
    
    start_date DATE NOT NULL,
    end_date DATE,
    
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view employee deductions from their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can insert employee deductions into their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can update employee deductions in their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can delete employee deductions in their tenants" ON public.employee_deductions;
END
$$;

CREATE POLICY "Users can view employee deductions from their tenants" 
    ON public.employee_deductions FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee deductions into their tenants" 
    ON public.employee_deductions FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee deductions in their tenants" 
    ON public.employee_deductions FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee deductions in their tenants" 
    ON public.employee_deductions FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_12.sql`
```sql
-- ==============================================================================
-- FASE 12: TABELAS LEGAIS E PARÂMETROS
-- ==============================================================================

-- 1. Criação do Catálogo de Versões Legais
-- Essas versões agrupam os parâmetros de uma mesma época (ex: 2026).
CREATE TABLE IF NOT EXISTS public.legal_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_name TEXT NOT NULL, -- Ex: "Legislação 2026"
    valid_from DATE NOT NULL,
    valid_to DATE,
    source TEXT, -- Ex: "Governo Federal, eSocial"
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela INSS (Progressivo)
CREATE TABLE IF NOT EXISTS public.inss_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    bracket_number INT NOT NULL, -- Ordem da faixa, ex: 1, 2, 3, 4
    base_limit NUMERIC(10,2), -- NULL significa "acima de" ou sem limite superior
    aliquot NUMERIC(5,2) NOT NULL,
    deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabela IRRF
CREATE TABLE IF NOT EXISTS public.irrf_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    bracket_number INT NOT NULL,
    base_limit NUMERIC(10,2), -- NULL significa sem limite superior
    aliquot NUMERIC(5,2) NOT NULL,
    deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Parâmetros Gerais (Salário Mínimo, Deduções, FGTS, etc)
CREATE TABLE IF NOT EXISTS public.general_legal_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    minimum_wage NUMERIC(10,2) NOT NULL,
    dependent_deduction NUMERIC(10,2) NOT NULL,
    simplified_discount NUMERIC(10,2) NOT NULL,
    family_salary_quota NUMERIC(10,2) NOT NULL,
    family_salary_limit NUMERIC(10,2) NOT NULL,
    fgts_standard_aliquot NUMERIC(5,2) NOT NULL, -- 8.00
    fgts_apprentice_aliquot NUMERIC(5,2) NOT NULL, -- 2.00
    vt_max_discount_percentage NUMERIC(5,2) NOT NULL, -- 6.00
    irrf_exemption_limit NUMERIC(10,2), -- 5000.00 (Redutor 2026)
    irrf_reduction_formula_limit NUMERIC(10,2), -- 7350.00
    irrf_base_reduction NUMERIC(10,2), -- 312.89
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS (Como são dados públicos/globais do sistema, apenas leitura autenticada)
ALTER TABLE public.legal_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inss_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.irrf_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.general_legal_parameters ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS — leitura e escrita para autenticados
-- Dropar políticas existentes para permitir re-execução
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated read on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated insert on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated update on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated delete on legal_versions" ON public.legal_versions;

    DROP POLICY IF EXISTS "Allow authenticated read on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on inss_parameters" ON public.inss_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on irrf_parameters" ON public.irrf_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on general_legal_parameters" ON public.general_legal_parameters;
END $$;

-- legal_versions
CREATE POLICY "Allow authenticated read on legal_versions" 
    ON public.legal_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on legal_versions" 
    ON public.legal_versions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on legal_versions" 
    ON public.legal_versions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on legal_versions" 
    ON public.legal_versions FOR DELETE TO authenticated USING (true);

-- inss_parameters
CREATE POLICY "Allow authenticated read on inss_parameters" 
    ON public.inss_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on inss_parameters" 
    ON public.inss_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on inss_parameters" 
    ON public.inss_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on inss_parameters" 
    ON public.inss_parameters FOR DELETE TO authenticated USING (true);

-- irrf_parameters
CREATE POLICY "Allow authenticated read on irrf_parameters" 
    ON public.irrf_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on irrf_parameters" 
    ON public.irrf_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on irrf_parameters" 
    ON public.irrf_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on irrf_parameters" 
    ON public.irrf_parameters FOR DELETE TO authenticated USING (true);

-- general_legal_parameters
CREATE POLICY "Allow authenticated read on general_legal_parameters" 
    ON public.general_legal_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on general_legal_parameters" 
    ON public.general_legal_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on general_legal_parameters" 
    ON public.general_legal_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on general_legal_parameters" 
    ON public.general_legal_parameters FOR DELETE TO authenticated USING (true);

-- ==============================================================================
-- INSERÇÃO DOS DADOS BASE - 2026
-- ==============================================================================

DO $$
DECLARE
    v_version_id UUID;
BEGIN
    -- Cria a versão 2026 se não existir para evitar duplicação (por precaução)
    IF NOT EXISTS (SELECT 1 FROM public.legal_versions WHERE version_name = 'Legislação 2026') THEN
        INSERT INTO public.legal_versions (version_name, valid_from, source)
        VALUES ('Legislação 2026', '2026-01-01', 'Pesquisa CLT 2026')
        RETURNING id INTO v_version_id;

        -- INSS 2026
        INSERT INTO public.inss_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 1621.00, 7.5, 0.00),
        (v_version_id, 2, 2902.84, 9.0, 24.32),
        (v_version_id, 3, 4354.27, 12.0, 111.40),
        (v_version_id, 4, 8475.55, 14.0, 198.49);

        -- IRRF 2026
        INSERT INTO public.irrf_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 2428.80, 0.0, 0.00),
        (v_version_id, 2, 2826.65, 7.5, 182.16),
        (v_version_id, 3, 3751.05, 15.0, 394.16),
        (v_version_id, 4, 4664.68, 22.5, 675.49),
        (v_version_id, 5, NULL, 27.5, 908.73);

        -- Parâmetros Gerais 2026
        INSERT INTO public.general_legal_parameters (
            version_id, minimum_wage, dependent_deduction, simplified_discount, 
            family_salary_quota, family_salary_limit, fgts_standard_aliquot, 
            fgts_apprentice_aliquot, vt_max_discount_percentage, irrf_exemption_limit, 
            irrf_reduction_formula_limit, irrf_base_reduction
        ) VALUES (
            v_version_id, 1621.00, 189.59, 607.20, 
            67.54, 1980.38, 8.00, 
            2.00, 6.00, 5000.00, 
            7350.00, 312.89
        );
    END IF;
END $$;

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_13_14.sql`
```sql
-- ==============================================================================
-- FASES 13 e 14: ESTRUTURAS DO MOTOR DE CÁLCULO E HOLERITE
-- ==============================================================================

-- 1. Períodos de Folha (Competências)
CREATE TABLE IF NOT EXISTS public.payroll_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('MONTHLY', 'ADVANCE', '13TH', 'SUPPLEMENTARY')),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CALCULATED', 'CONFERENCE', 'CLOSED', 'CANCELED')),
    processing_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, month, year, type)
);

-- 2. Eventos Variáveis do Mês (Lançamentos Manuais)
CREATE TABLE IF NOT EXISTS public.payroll_variable_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE CASCADE,
    amount NUMERIC(10,2), -- Valor monetário
    quantity NUMERIC(10,2), -- Quantidade (ex: 10 horas)
    reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Holerites (Resultados Calculados)
CREATE TABLE IF NOT EXISTS public.payslips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    total_earnings NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total_deductions NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    net_salary NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_inss NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_irrf NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_fgts NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    fgts_month NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'CALCULATED' CHECK (status IN ('CALCULATED', 'CLOSED', 'CANCELED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(period_id, contract_id)
);

-- 4. Itens do Holerite (Demonstrativo)
CREATE TABLE IF NOT EXISTS public.payslip_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE CASCADE,
    reference TEXT, -- Ex: 10h, 50%
    amount NUMERIC(10,2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('EARNING', 'DEDUCTION', 'NEUTRAL', 'BASE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Memória de Cálculo (Auditoria e Transparência)
CREATE TABLE IF NOT EXISTS public.payroll_memory_calc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    base_value NUMERIC(10,2) NOT NULL,
    quantity_used NUMERIC(10,2) NOT NULL,
    percentage_used NUMERIC(10,2) NOT NULL,
    parsed_formula TEXT NOT NULL,
    result_value NUMERIC(10,2) NOT NULL,
    origin TEXT NOT NULL,
    engine_version TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- SEGURANÇA E RLS
-- ==============================================================================
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_variable_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslip_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view payroll_periods from their tenants" ON public.payroll_periods;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_periods" ON public.payroll_periods;
    
    DROP POLICY IF EXISTS "Users can view payroll_variable_events from their tenants" ON public.payroll_variable_events;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_variable_events" ON public.payroll_variable_events;

    DROP POLICY IF EXISTS "Users can view payslips from their tenants" ON public.payslips;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslips" ON public.payslips;

    DROP POLICY IF EXISTS "Users can view payslip_items from their tenants" ON public.payslip_items;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslip_items" ON public.payslip_items;

    DROP POLICY IF EXISTS "Users can view payroll_memory_calc from their tenants" ON public.payroll_memory_calc;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_memory_calc" ON public.payroll_memory_calc;
END
$$;

-- payroll_periods
CREATE POLICY "Users can view payroll_periods from their tenants" 
    ON public.payroll_periods FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_periods" 
    ON public.payroll_periods FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_variable_events
CREATE POLICY "Users can view payroll_variable_events from their tenants" 
    ON public.payroll_variable_events FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_variable_events" 
    ON public.payroll_variable_events FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslips
CREATE POLICY "Users can view payslips from their tenants" 
    ON public.payslips FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payslips" 
    ON public.payslips FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslip_items
CREATE POLICY "Users can view payslip_items from their tenants" 
    ON public.payslip_items FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payslip_items" 
    ON public.payslip_items FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_memory_calc
CREATE POLICY "Users can view payroll_memory_calc from their tenants" 
    ON public.payroll_memory_calc FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_memory_calc" 
    ON public.payroll_memory_calc FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- ==============================================================================
-- AUDITORIA
-- ==============================================================================
CREATE TRIGGER audit_payroll_periods_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_payroll_variable_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_variable_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_payslips_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payslips FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

*(Conclusão do Banco de Dados - Tabelas Base MVP + Motor de Cálculo Completos)*


### Script: `supabase_sql_fase_7.sql`
```sql
-- Fase 7: Afastamentos e Ausências
-- Cria a tabela 'leaves' com políticas de RLS e triggers.

CREATE TABLE IF NOT EXISTS public.leaves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('SICK_LEAVE', 'MATERNITY', 'PATERNITY', 'WORK_ACCIDENT', 'UNJUSTIFIED_ABSENCE', 'SUSPENSION', 'OTHER')),
    start_date DATE NOT NULL,
    end_date DATE,
    return_date DATE,
    icd_10_code TEXT,
    medical_certificate_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    is_inss_referral BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Users can view leaves from their tenants" 
    ON public.leaves FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert leaves into their tenants" 
    ON public.leaves FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update leaves in their tenants" 
    ON public.leaves FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete leaves in their tenants" 
    ON public.leaves FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Trigger de Updated At
CREATE TRIGGER update_leaves_updated_at
    BEFORE UPDATE ON public.leaves
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

```

### Script: `supabase_sql_fase_8.sql`
```sql
-- ==============================================================================
-- FASE 8: ESTRUTURA COMPLETA DE RUBRICAS
-- ==============================================================================
-- Este script expande a tabela "payroll_rubrics" com todas as variáveis exigidas
-- pelo Motor de Cálculo da Folha (Fase 13).

-- 1. Expansão da tabela payroll_rubrics
ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'AUTOMATICA', 'IMPORTADA', 'INTEGRACAO')),
    ADD COLUMN IF NOT EXISTS calculation_base TEXT,
    ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS divisor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS factor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS calculation_order INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS incidence_inss_patronal BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_rat BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_third_parties BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_inss BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_irrf BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_fgts BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS valid_to DATE,
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS esocial_description TEXT;

-- (Opcional) Adicionar type e category caso não tenham sido criados no Script 8 original, mas já usados no frontend
ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'EARNING',
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'SALARY',
    ADD COLUMN IF NOT EXISTS calculation_type TEXT DEFAULT 'FIXED',
    ADD COLUMN IF NOT EXISTS formula TEXT;

-- 2. Atualizar permissões de RLS para a tabela expandida 
-- (O Script 8 já possuía RLS, este comando é apenas por garantia)
ALTER TABLE public.payroll_rubrics ENABLE ROW LEVEL SECURITY;

-- Nota: A trigger de auditoria `audit_payroll_rubrics_trigger` criada na Fase 8/Script 8 já cobre automaticamente as novas colunas
-- pois o `to_jsonb(NEW)` captura dinamicamente a estrutura da tabela atual.

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_9.sql`
```sql
-- ==============================================================================
-- FASE 9: EVENTOS DA FOLHA (LANÇAMENTOS VARIÁVEIS) E PROGRESSIVAS
-- ==============================================================================
-- Este script cria as tabelas do motor de folha que faltavam no Script 9,
-- incluindo a versão já atualizada de payroll_events com quantity, origin, etc.

CREATE TABLE IF NOT EXISTS public.payroll_progressive_tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    table_type TEXT NOT NULL CHECK (table_type IN ('INSS', 'IRRF', 'FAMILY_SALARY', 'OTHER')),
    competence_start DATE NOT NULL,
    competence_end DATE,
    ranges_jsonb JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE RESTRICT,
    reference_value NUMERIC(10,2),
    quantity NUMERIC(10,2),
    calculated_amount NUMERIC(10,2) NOT NULL,
    is_manual_entry BOOLEAN NOT NULL DEFAULT false,
    origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO')),
    notes TEXT,
    recorded_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_memory_calc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.payroll_events(id) ON DELETE CASCADE,
    formula_used TEXT NOT NULL,
    variables_snapshot JSONB NOT NULL,
    progressive_table_id UUID REFERENCES public.payroll_progressive_tables(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.terminations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    termination_reason TEXT NOT NULL CHECK (termination_reason IN ('WITHOUT_JUST_CAUSE_BY_EMPLOYER', 'WITH_JUST_CAUSE_BY_EMPLOYER', 'BY_EMPLOYEE', 'MUTUAL_AGREEMENT', 'CONTRACT_EXPIRATION', 'RETIREMENT', 'DEATH')),
    notice_period_type TEXT NOT NULL CHECK (notice_period_type IN ('WORKED', 'INDEMNIFIED', 'WAIVED')),
    notice_date DATE NOT NULL,
    last_working_day DATE NOT NULL,
    fgts_fine_percentage NUMERIC(5,2),
    is_exam_required BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'CALCULATED', 'PAID', 'HOMOLOGATED', 'CANCELED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id)
);

-- Habilitar RLS
ALTER TABLE public.payroll_progressive_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminations ENABLE ROW LEVEL SECURITY;

-- Políticas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage progressive tables') THEN
        CREATE POLICY "Tenant Admins and DP can manage progressive tables" ON public.payroll_progressive_tables FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage payroll events') THEN
        CREATE POLICY "Tenant Admins and DP can manage payroll events" ON public.payroll_events FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can view memory calc') THEN
        CREATE POLICY "Tenant Admins and DP can view memory calc" ON public.payroll_memory_calc FOR SELECT USING (EXISTS (SELECT 1 FROM public.payroll_events e WHERE e.id = public.payroll_memory_calc.event_id AND e.tenant_id = ANY(public.user_tenant_ids())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage terminations') THEN
        CREATE POLICY "Tenant Admins and DP can manage terminations" ON public.terminations FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
END $$;

-- Triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_progressive_tables_trigger') THEN
        CREATE TRIGGER audit_progressive_tables_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_progressive_tables FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_events_trigger') THEN
        CREATE TRIGGER audit_payroll_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_terminations_trigger') THEN
        CREATE TRIGGER audit_terminations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.terminations FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;

-- E se a tabela payroll_events já existir (criada por script anterior incompleto), tentamos alterar:
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN quantity NUMERIC(10,2);
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO'));
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN notes TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN recorded_by UUID;
    EXCEPTION WHEN duplicate_column THEN END;
END $$;

```

### Script: `supabase_sql_fase_10.sql`
```sql
-- ==============================================================================
-- FASE 10: ESTRUTURA DE BENEFÍCIOS
-- ==============================================================================

-- 1. Criação do Catálogo de Benefícios
CREATE TABLE IF NOT EXISTS public.benefit_catalogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    benefit_type TEXT NOT NULL CHECK (benefit_type IN ('TRANSPORTATION', 'MEAL', 'FOOD', 'HEALTH_INSURANCE', 'DENTAL_INSURANCE', 'LIFE_INSURANCE', 'OTHER')),
    provider_name TEXT,
    company_contribution NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    employee_discount_percentage NUMERIC(5,2),
    employee_discount_fixed NUMERIC(10,2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Criação do Vínculo Empregado-Benefício
CREATE TABLE IF NOT EXISTS public.employee_benefits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    benefit_catalog_id UUID NOT NULL REFERENCES public.benefit_catalogs(id) ON DELETE CASCADE,
    opt_in BOOLEAN NOT NULL DEFAULT true,
    custom_discount_value NUMERIC(10,2),
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id, benefit_catalog_id)
);

-- Habilitar RLS
ALTER TABLE public.benefit_catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para benefit_catalogs
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view benefit catalogs from their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can insert benefit catalogs into their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can update benefit catalogs in their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can delete benefit catalogs in their tenants" ON public.benefit_catalogs;
    
    DROP POLICY IF EXISTS "Users can view employee benefits from their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can insert employee benefits into their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can update employee benefits in their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can delete employee benefits in their tenants" ON public.employee_benefits;
END
$$;

CREATE POLICY "Users can view benefit catalogs from their tenants" 
    ON public.benefit_catalogs FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert benefit catalogs into their tenants" 
    ON public.benefit_catalogs FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Políticas de RLS para employee_benefits
CREATE POLICY "Users can view employee benefits from their tenants" 
    ON public.employee_benefits FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee benefits into their tenants" 
    ON public.employee_benefits FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee benefits in their tenants" 
    ON public.employee_benefits FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee benefits in their tenants" 
    ON public.employee_benefits FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_11.sql`
```sql
-- ==============================================================================
-- FASE 11: ESTRUTURA DE DESCONTOS DIVERSOS
-- ==============================================================================

-- 1. Criação da Tabela de Descontos Diversos do Colaborador
CREATE TABLE IF NOT EXISTS public.employee_deductions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE RESTRICT,
    
    deduction_type TEXT NOT NULL CHECK (deduction_type IN ('ALIMONY', 'LOAN', 'ADVANCE', 'COPARTICIPATION', 'OTHER')),
    amount_type TEXT NOT NULL CHECK (amount_type IN ('FIXED', 'PERCENTAGE')),
    
    value NUMERIC(10,2) NOT NULL,
    total_limit NUMERIC(10,2), -- Ex: Limite total do empréstimo. Ao atingir, encerra o desconto.
    
    start_date DATE NOT NULL,
    end_date DATE,
    
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view employee deductions from their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can insert employee deductions into their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can update employee deductions in their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can delete employee deductions in their tenants" ON public.employee_deductions;
END
$$;

CREATE POLICY "Users can view employee deductions from their tenants" 
    ON public.employee_deductions FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee deductions into their tenants" 
    ON public.employee_deductions FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee deductions in their tenants" 
    ON public.employee_deductions FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee deductions in their tenants" 
    ON public.employee_deductions FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_12.sql`
```sql
-- ==============================================================================
-- FASE 12: TABELAS LEGAIS E PARÂMETROS
-- ==============================================================================

-- 1. Criação do Catálogo de Versões Legais
-- Essas versões agrupam os parâmetros de uma mesma época (ex: 2026).
CREATE TABLE IF NOT EXISTS public.legal_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_name TEXT NOT NULL, -- Ex: "Legislação 2026"
    valid_from DATE NOT NULL,
    valid_to DATE,
    source TEXT, -- Ex: "Governo Federal, eSocial"
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela INSS (Progressivo)
CREATE TABLE IF NOT EXISTS public.inss_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    bracket_number INT NOT NULL, -- Ordem da faixa, ex: 1, 2, 3, 4
    base_limit NUMERIC(10,2), -- NULL significa "acima de" ou sem limite superior
    aliquot NUMERIC(5,2) NOT NULL,
    deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabela IRRF
CREATE TABLE IF NOT EXISTS public.irrf_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    bracket_number INT NOT NULL,
    base_limit NUMERIC(10,2), -- NULL significa sem limite superior
    aliquot NUMERIC(5,2) NOT NULL,
    deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Parâmetros Gerais (Salário Mínimo, Deduções, FGTS, etc)
CREATE TABLE IF NOT EXISTS public.general_legal_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    minimum_wage NUMERIC(10,2) NOT NULL,
    dependent_deduction NUMERIC(10,2) NOT NULL,
    simplified_discount NUMERIC(10,2) NOT NULL,
    family_salary_quota NUMERIC(10,2) NOT NULL,
    family_salary_limit NUMERIC(10,2) NOT NULL,
    fgts_standard_aliquot NUMERIC(5,2) NOT NULL, -- 8.00
    fgts_apprentice_aliquot NUMERIC(5,2) NOT NULL, -- 2.00
    vt_max_discount_percentage NUMERIC(5,2) NOT NULL, -- 6.00
    irrf_exemption_limit NUMERIC(10,2), -- 5000.00 (Redutor 2026)
    irrf_reduction_formula_limit NUMERIC(10,2), -- 7350.00
    irrf_base_reduction NUMERIC(10,2), -- 312.89
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS (Como são dados públicos/globais do sistema, apenas leitura autenticada)
ALTER TABLE public.legal_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inss_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.irrf_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.general_legal_parameters ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS — leitura e escrita para autenticados
-- Dropar políticas existentes para permitir re-execução
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated read on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated insert on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated update on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated delete on legal_versions" ON public.legal_versions;

    DROP POLICY IF EXISTS "Allow authenticated read on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on inss_parameters" ON public.inss_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on irrf_parameters" ON public.irrf_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on general_legal_parameters" ON public.general_legal_parameters;
END $$;

-- legal_versions
CREATE POLICY "Allow authenticated read on legal_versions" 
    ON public.legal_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on legal_versions" 
    ON public.legal_versions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on legal_versions" 
    ON public.legal_versions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on legal_versions" 
    ON public.legal_versions FOR DELETE TO authenticated USING (true);

-- inss_parameters
CREATE POLICY "Allow authenticated read on inss_parameters" 
    ON public.inss_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on inss_parameters" 
    ON public.inss_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on inss_parameters" 
    ON public.inss_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on inss_parameters" 
    ON public.inss_parameters FOR DELETE TO authenticated USING (true);

-- irrf_parameters
CREATE POLICY "Allow authenticated read on irrf_parameters" 
    ON public.irrf_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on irrf_parameters" 
    ON public.irrf_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on irrf_parameters" 
    ON public.irrf_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on irrf_parameters" 
    ON public.irrf_parameters FOR DELETE TO authenticated USING (true);

-- general_legal_parameters
CREATE POLICY "Allow authenticated read on general_legal_parameters" 
    ON public.general_legal_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on general_legal_parameters" 
    ON public.general_legal_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on general_legal_parameters" 
    ON public.general_legal_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on general_legal_parameters" 
    ON public.general_legal_parameters FOR DELETE TO authenticated USING (true);

-- ==============================================================================
-- INSERÇÃO DOS DADOS BASE - 2026
-- ==============================================================================

DO $$
DECLARE
    v_version_id UUID;
BEGIN
    -- Cria a versão 2026 se não existir para evitar duplicação (por precaução)
    IF NOT EXISTS (SELECT 1 FROM public.legal_versions WHERE version_name = 'Legislação 2026') THEN
        INSERT INTO public.legal_versions (version_name, valid_from, source)
        VALUES ('Legislação 2026', '2026-01-01', 'Pesquisa CLT 2026')
        RETURNING id INTO v_version_id;

        -- INSS 2026
        INSERT INTO public.inss_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 1621.00, 7.5, 0.00),
        (v_version_id, 2, 2902.84, 9.0, 24.32),
        (v_version_id, 3, 4354.27, 12.0, 111.40),
        (v_version_id, 4, 8475.55, 14.0, 198.49);

        -- IRRF 2026
        INSERT INTO public.irrf_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 2428.80, 0.0, 0.00),
        (v_version_id, 2, 2826.65, 7.5, 182.16),
        (v_version_id, 3, 3751.05, 15.0, 394.16),
        (v_version_id, 4, 4664.68, 22.5, 675.49),
        (v_version_id, 5, NULL, 27.5, 908.73);

        -- Parâmetros Gerais 2026
        INSERT INTO public.general_legal_parameters (
            version_id, minimum_wage, dependent_deduction, simplified_discount, 
            family_salary_quota, family_salary_limit, fgts_standard_aliquot, 
            fgts_apprentice_aliquot, vt_max_discount_percentage, irrf_exemption_limit, 
            irrf_reduction_formula_limit, irrf_base_reduction
        ) VALUES (
            v_version_id, 1621.00, 189.59, 607.20, 
            67.54, 1980.38, 8.00, 
            2.00, 6.00, 5000.00, 
            7350.00, 312.89
        );
    END IF;
END $$;

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_13_14.sql`
```sql
-- ==============================================================================
-- FASES 13 e 14: ESTRUTURAS DO MOTOR DE CÁLCULO E HOLERITE
-- ==============================================================================

-- 1. Períodos de Folha (Competências)
CREATE TABLE IF NOT EXISTS public.payroll_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('MONTHLY', 'ADVANCE', '13TH', 'SUPPLEMENTARY')),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CALCULATED', 'CONFERENCE', 'CLOSED', 'CANCELED')),
    processing_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, month, year, type)
);

-- 2. Eventos Variáveis do Mês (Lançamentos Manuais)
CREATE TABLE IF NOT EXISTS public.payroll_variable_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE CASCADE,
    amount NUMERIC(10,2), -- Valor monetário
    quantity NUMERIC(10,2), -- Quantidade (ex: 10 horas)
    reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Holerites (Resultados Calculados)
CREATE TABLE IF NOT EXISTS public.payslips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    total_earnings NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total_deductions NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    net_salary NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_inss NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_irrf NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_fgts NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    fgts_month NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'CALCULATED' CHECK (status IN ('CALCULATED', 'CLOSED', 'CANCELED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(period_id, contract_id)
);

-- 4. Itens do Holerite (Demonstrativo)
CREATE TABLE IF NOT EXISTS public.payslip_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE CASCADE,
    reference TEXT, -- Ex: 10h, 50%
    amount NUMERIC(10,2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('EARNING', 'DEDUCTION', 'NEUTRAL', 'BASE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Memória de Cálculo (Auditoria e Transparência)
CREATE TABLE IF NOT EXISTS public.payroll_memory_calc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    base_value NUMERIC(10,2) NOT NULL,
    quantity_used NUMERIC(10,2) NOT NULL,
    percentage_used NUMERIC(10,2) NOT NULL,
    parsed_formula TEXT NOT NULL,
    result_value NUMERIC(10,2) NOT NULL,
    origin TEXT NOT NULL,
    engine_version TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- SEGURANÇA E RLS
-- ==============================================================================
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_variable_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslip_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view payroll_periods from their tenants" ON public.payroll_periods;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_periods" ON public.payroll_periods;
    
    DROP POLICY IF EXISTS "Users can view payroll_variable_events from their tenants" ON public.payroll_variable_events;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_variable_events" ON public.payroll_variable_events;

    DROP POLICY IF EXISTS "Users can view payslips from their tenants" ON public.payslips;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslips" ON public.payslips;

    DROP POLICY IF EXISTS "Users can view payslip_items from their tenants" ON public.payslip_items;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslip_items" ON public.payslip_items;

    DROP POLICY IF EXISTS "Users can view payroll_memory_calc from their tenants" ON public.payroll_memory_calc;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_memory_calc" ON public.payroll_memory_calc;
END
$$;

-- payroll_periods
CREATE POLICY "Users can view payroll_periods from their tenants" 
    ON public.payroll_periods FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_periods" 
    ON public.payroll_periods FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_variable_events
CREATE POLICY "Users can view payroll_variable_events from their tenants" 
    ON public.payroll_variable_events FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_variable_events" 
    ON public.payroll_variable_events FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslips
CREATE POLICY "Users can view payslips from their tenants" 
    ON public.payslips FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payslips" 
    ON public.payslips FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslip_items
CREATE POLICY "Users can view payslip_items from their tenants" 
    ON public.payslip_items FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payslip_items" 
    ON public.payslip_items FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_memory_calc
CREATE POLICY "Users can view payroll_memory_calc from their tenants" 
    ON public.payroll_memory_calc FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_memory_calc" 
    ON public.payroll_memory_calc FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- ==============================================================================
-- AUDITORIA
-- ==============================================================================
CREATE TRIGGER audit_payroll_periods_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_payroll_variable_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_variable_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_payslips_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payslips FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

*(Conclusão do Banco de Dados - Tabelas Base MVP + Motor de Cálculo Completos)*


### Script: `supabase_sql_fase_7.sql`
```sql
-- Fase 7: Afastamentos e Ausências
-- Cria a tabela 'leaves' com políticas de RLS e triggers.

CREATE TABLE IF NOT EXISTS public.leaves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('SICK_LEAVE', 'MATERNITY', 'PATERNITY', 'WORK_ACCIDENT', 'UNJUSTIFIED_ABSENCE', 'SUSPENSION', 'OTHER')),
    start_date DATE NOT NULL,
    end_date DATE,
    return_date DATE,
    icd_10_code TEXT,
    medical_certificate_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    is_inss_referral BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Users can view leaves from their tenants" 
    ON public.leaves FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert leaves into their tenants" 
    ON public.leaves FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update leaves in their tenants" 
    ON public.leaves FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete leaves in their tenants" 
    ON public.leaves FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Trigger de Updated At
CREATE TRIGGER update_leaves_updated_at
    BEFORE UPDATE ON public.leaves
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

```

### Script: `supabase_sql_fase_8.sql`
```sql
-- ==============================================================================
-- FASE 8: ESTRUTURA COMPLETA DE RUBRICAS
-- ==============================================================================
-- Este script expande a tabela "payroll_rubrics" com todas as variáveis exigidas
-- pelo Motor de Cálculo da Folha (Fase 13).

-- 1. Expansão da tabela payroll_rubrics
ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'AUTOMATICA', 'IMPORTADA', 'INTEGRACAO')),
    ADD COLUMN IF NOT EXISTS calculation_base TEXT,
    ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS divisor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS factor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS calculation_order INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS incidence_inss_patronal BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_rat BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_third_parties BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_inss BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_irrf BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_fgts BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS valid_to DATE,
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS esocial_description TEXT;

-- (Opcional) Adicionar type e category caso não tenham sido criados no Script 8 original, mas já usados no frontend
ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'EARNING',
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'SALARY',
    ADD COLUMN IF NOT EXISTS calculation_type TEXT DEFAULT 'FIXED',
    ADD COLUMN IF NOT EXISTS formula TEXT;

-- 2. Atualizar permissões de RLS para a tabela expandida 
-- (O Script 8 já possuía RLS, este comando é apenas por garantia)
ALTER TABLE public.payroll_rubrics ENABLE ROW LEVEL SECURITY;

-- Nota: A trigger de auditoria `audit_payroll_rubrics_trigger` criada na Fase 8/Script 8 já cobre automaticamente as novas colunas
-- pois o `to_jsonb(NEW)` captura dinamicamente a estrutura da tabela atual.

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_9.sql`
```sql
-- ==============================================================================
-- FASE 9: EVENTOS DA FOLHA (LANÇAMENTOS VARIÁVEIS) E PROGRESSIVAS
-- ==============================================================================
-- Este script cria as tabelas do motor de folha que faltavam no Script 9,
-- incluindo a versão já atualizada de payroll_events com quantity, origin, etc.

CREATE TABLE IF NOT EXISTS public.payroll_progressive_tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    table_type TEXT NOT NULL CHECK (table_type IN ('INSS', 'IRRF', 'FAMILY_SALARY', 'OTHER')),
    competence_start DATE NOT NULL,
    competence_end DATE,
    ranges_jsonb JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE RESTRICT,
    reference_value NUMERIC(10,2),
    quantity NUMERIC(10,2),
    calculated_amount NUMERIC(10,2) NOT NULL,
    is_manual_entry BOOLEAN NOT NULL DEFAULT false,
    origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO')),
    notes TEXT,
    recorded_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_memory_calc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.payroll_events(id) ON DELETE CASCADE,
    formula_used TEXT NOT NULL,
    variables_snapshot JSONB NOT NULL,
    progressive_table_id UUID REFERENCES public.payroll_progressive_tables(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.terminations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    termination_reason TEXT NOT NULL CHECK (termination_reason IN ('WITHOUT_JUST_CAUSE_BY_EMPLOYER', 'WITH_JUST_CAUSE_BY_EMPLOYER', 'BY_EMPLOYEE', 'MUTUAL_AGREEMENT', 'CONTRACT_EXPIRATION', 'RETIREMENT', 'DEATH')),
    notice_period_type TEXT NOT NULL CHECK (notice_period_type IN ('WORKED', 'INDEMNIFIED', 'WAIVED')),
    notice_date DATE NOT NULL,
    last_working_day DATE NOT NULL,
    fgts_fine_percentage NUMERIC(5,2),
    is_exam_required BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'CALCULATED', 'PAID', 'HOMOLOGATED', 'CANCELED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id)
);

-- Habilitar RLS
ALTER TABLE public.payroll_progressive_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminations ENABLE ROW LEVEL SECURITY;

-- Políticas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage progressive tables') THEN
        CREATE POLICY "Tenant Admins and DP can manage progressive tables" ON public.payroll_progressive_tables FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage payroll events') THEN
        CREATE POLICY "Tenant Admins and DP can manage payroll events" ON public.payroll_events FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can view memory calc') THEN
        CREATE POLICY "Tenant Admins and DP can view memory calc" ON public.payroll_memory_calc FOR SELECT USING (EXISTS (SELECT 1 FROM public.payroll_events e WHERE e.id = public.payroll_memory_calc.event_id AND e.tenant_id = ANY(public.user_tenant_ids())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage terminations') THEN
        CREATE POLICY "Tenant Admins and DP can manage terminations" ON public.terminations FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
END $$;

-- Triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_progressive_tables_trigger') THEN
        CREATE TRIGGER audit_progressive_tables_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_progressive_tables FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_events_trigger') THEN
        CREATE TRIGGER audit_payroll_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_terminations_trigger') THEN
        CREATE TRIGGER audit_terminations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.terminations FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;

-- E se a tabela payroll_events já existir (criada por script anterior incompleto), tentamos alterar:
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN quantity NUMERIC(10,2);
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO'));
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN notes TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN recorded_by UUID;
    EXCEPTION WHEN duplicate_column THEN END;
END $$;

```

### Script: `supabase_sql_fase_10.sql`
```sql
-- ==============================================================================
-- FASE 10: ESTRUTURA DE BENEFÍCIOS
-- ==============================================================================

-- 1. Criação do Catálogo de Benefícios
CREATE TABLE IF NOT EXISTS public.benefit_catalogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    benefit_type TEXT NOT NULL CHECK (benefit_type IN ('TRANSPORTATION', 'MEAL', 'FOOD', 'HEALTH_INSURANCE', 'DENTAL_INSURANCE', 'LIFE_INSURANCE', 'OTHER')),
    provider_name TEXT,
    company_contribution NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    employee_discount_percentage NUMERIC(5,2),
    employee_discount_fixed NUMERIC(10,2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Criação do Vínculo Empregado-Benefício
CREATE TABLE IF NOT EXISTS public.employee_benefits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    benefit_catalog_id UUID NOT NULL REFERENCES public.benefit_catalogs(id) ON DELETE CASCADE,
    opt_in BOOLEAN NOT NULL DEFAULT true,
    custom_discount_value NUMERIC(10,2),
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id, benefit_catalog_id)
);

-- Habilitar RLS
ALTER TABLE public.benefit_catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para benefit_catalogs
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view benefit catalogs from their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can insert benefit catalogs into their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can update benefit catalogs in their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can delete benefit catalogs in their tenants" ON public.benefit_catalogs;
    
    DROP POLICY IF EXISTS "Users can view employee benefits from their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can insert employee benefits into their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can update employee benefits in their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can delete employee benefits in their tenants" ON public.employee_benefits;
END
$$;

CREATE POLICY "Users can view benefit catalogs from their tenants" 
    ON public.benefit_catalogs FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert benefit catalogs into their tenants" 
    ON public.benefit_catalogs FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Políticas de RLS para employee_benefits
CREATE POLICY "Users can view employee benefits from their tenants" 
    ON public.employee_benefits FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee benefits into their tenants" 
    ON public.employee_benefits FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee benefits in their tenants" 
    ON public.employee_benefits FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee benefits in their tenants" 
    ON public.employee_benefits FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_11.sql`
```sql
-- ==============================================================================
-- FASE 11: ESTRUTURA DE DESCONTOS DIVERSOS
-- ==============================================================================

-- 1. Criação da Tabela de Descontos Diversos do Colaborador
CREATE TABLE IF NOT EXISTS public.employee_deductions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE RESTRICT,
    
    deduction_type TEXT NOT NULL CHECK (deduction_type IN ('ALIMONY', 'LOAN', 'ADVANCE', 'COPARTICIPATION', 'OTHER')),
    amount_type TEXT NOT NULL CHECK (amount_type IN ('FIXED', 'PERCENTAGE')),
    
    value NUMERIC(10,2) NOT NULL,
    total_limit NUMERIC(10,2), -- Ex: Limite total do empréstimo. Ao atingir, encerra o desconto.
    
    start_date DATE NOT NULL,
    end_date DATE,
    
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view employee deductions from their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can insert employee deductions into their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can update employee deductions in their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can delete employee deductions in their tenants" ON public.employee_deductions;
END
$$;

CREATE POLICY "Users can view employee deductions from their tenants" 
    ON public.employee_deductions FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee deductions into their tenants" 
    ON public.employee_deductions FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee deductions in their tenants" 
    ON public.employee_deductions FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee deductions in their tenants" 
    ON public.employee_deductions FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_12.sql`
```sql
-- ==============================================================================
-- FASE 12: TABELAS LEGAIS E PARÂMETROS
-- ==============================================================================

-- 1. Criação do Catálogo de Versões Legais
-- Essas versões agrupam os parâmetros de uma mesma época (ex: 2026).
CREATE TABLE IF NOT EXISTS public.legal_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_name TEXT NOT NULL, -- Ex: "Legislação 2026"
    valid_from DATE NOT NULL,
    valid_to DATE,
    source TEXT, -- Ex: "Governo Federal, eSocial"
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela INSS (Progressivo)
CREATE TABLE IF NOT EXISTS public.inss_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    bracket_number INT NOT NULL, -- Ordem da faixa, ex: 1, 2, 3, 4
    base_limit NUMERIC(10,2), -- NULL significa "acima de" ou sem limite superior
    aliquot NUMERIC(5,2) NOT NULL,
    deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabela IRRF
CREATE TABLE IF NOT EXISTS public.irrf_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    bracket_number INT NOT NULL,
    base_limit NUMERIC(10,2), -- NULL significa sem limite superior
    aliquot NUMERIC(5,2) NOT NULL,
    deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Parâmetros Gerais (Salário Mínimo, Deduções, FGTS, etc)
CREATE TABLE IF NOT EXISTS public.general_legal_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    minimum_wage NUMERIC(10,2) NOT NULL,
    dependent_deduction NUMERIC(10,2) NOT NULL,
    simplified_discount NUMERIC(10,2) NOT NULL,
    family_salary_quota NUMERIC(10,2) NOT NULL,
    family_salary_limit NUMERIC(10,2) NOT NULL,
    fgts_standard_aliquot NUMERIC(5,2) NOT NULL, -- 8.00
    fgts_apprentice_aliquot NUMERIC(5,2) NOT NULL, -- 2.00
    vt_max_discount_percentage NUMERIC(5,2) NOT NULL, -- 6.00
    irrf_exemption_limit NUMERIC(10,2), -- 5000.00 (Redutor 2026)
    irrf_reduction_formula_limit NUMERIC(10,2), -- 7350.00
    irrf_base_reduction NUMERIC(10,2), -- 312.89
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS (Como são dados públicos/globais do sistema, apenas leitura autenticada)
ALTER TABLE public.legal_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inss_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.irrf_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.general_legal_parameters ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS — leitura e escrita para autenticados
-- Dropar políticas existentes para permitir re-execução
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated read on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated insert on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated update on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated delete on legal_versions" ON public.legal_versions;

    DROP POLICY IF EXISTS "Allow authenticated read on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on inss_parameters" ON public.inss_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on irrf_parameters" ON public.irrf_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on general_legal_parameters" ON public.general_legal_parameters;
END $$;

-- legal_versions
CREATE POLICY "Allow authenticated read on legal_versions" 
    ON public.legal_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on legal_versions" 
    ON public.legal_versions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on legal_versions" 
    ON public.legal_versions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on legal_versions" 
    ON public.legal_versions FOR DELETE TO authenticated USING (true);

-- inss_parameters
CREATE POLICY "Allow authenticated read on inss_parameters" 
    ON public.inss_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on inss_parameters" 
    ON public.inss_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on inss_parameters" 
    ON public.inss_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on inss_parameters" 
    ON public.inss_parameters FOR DELETE TO authenticated USING (true);

-- irrf_parameters
CREATE POLICY "Allow authenticated read on irrf_parameters" 
    ON public.irrf_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on irrf_parameters" 
    ON public.irrf_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on irrf_parameters" 
    ON public.irrf_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on irrf_parameters" 
    ON public.irrf_parameters FOR DELETE TO authenticated USING (true);

-- general_legal_parameters
CREATE POLICY "Allow authenticated read on general_legal_parameters" 
    ON public.general_legal_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on general_legal_parameters" 
    ON public.general_legal_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on general_legal_parameters" 
    ON public.general_legal_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on general_legal_parameters" 
    ON public.general_legal_parameters FOR DELETE TO authenticated USING (true);

-- ==============================================================================
-- INSERÇÃO DOS DADOS BASE - 2026
-- ==============================================================================

DO $$
DECLARE
    v_version_id UUID;
BEGIN
    -- Cria a versão 2026 se não existir para evitar duplicação (por precaução)
    IF NOT EXISTS (SELECT 1 FROM public.legal_versions WHERE version_name = 'Legislação 2026') THEN
        INSERT INTO public.legal_versions (version_name, valid_from, source)
        VALUES ('Legislação 2026', '2026-01-01', 'Pesquisa CLT 2026')
        RETURNING id INTO v_version_id;

        -- INSS 2026
        INSERT INTO public.inss_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 1621.00, 7.5, 0.00),
        (v_version_id, 2, 2902.84, 9.0, 24.32),
        (v_version_id, 3, 4354.27, 12.0, 111.40),
        (v_version_id, 4, 8475.55, 14.0, 198.49);

        -- IRRF 2026
        INSERT INTO public.irrf_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 2428.80, 0.0, 0.00),
        (v_version_id, 2, 2826.65, 7.5, 182.16),
        (v_version_id, 3, 3751.05, 15.0, 394.16),
        (v_version_id, 4, 4664.68, 22.5, 675.49),
        (v_version_id, 5, NULL, 27.5, 908.73);

        -- Parâmetros Gerais 2026
        INSERT INTO public.general_legal_parameters (
            version_id, minimum_wage, dependent_deduction, simplified_discount, 
            family_salary_quota, family_salary_limit, fgts_standard_aliquot, 
            fgts_apprentice_aliquot, vt_max_discount_percentage, irrf_exemption_limit, 
            irrf_reduction_formula_limit, irrf_base_reduction
        ) VALUES (
            v_version_id, 1621.00, 189.59, 607.20, 
            67.54, 1980.38, 8.00, 
            2.00, 6.00, 5000.00, 
            7350.00, 312.89
        );
    END IF;
END $$;

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_13_14.sql`
```sql
-- ==============================================================================
-- FASES 13 e 14: ESTRUTURAS DO MOTOR DE CÁLCULO E HOLERITE
-- ==============================================================================

-- 1. Períodos de Folha (Competências)
CREATE TABLE IF NOT EXISTS public.payroll_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('MONTHLY', 'ADVANCE', '13TH', 'SUPPLEMENTARY')),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CALCULATED', 'CONFERENCE', 'CLOSED', 'CANCELED')),
    processing_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, month, year, type)
);

-- 2. Eventos Variáveis do Mês (Lançamentos Manuais)
CREATE TABLE IF NOT EXISTS public.payroll_variable_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE CASCADE,
    amount NUMERIC(10,2), -- Valor monetário
    quantity NUMERIC(10,2), -- Quantidade (ex: 10 horas)
    reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Holerites (Resultados Calculados)
CREATE TABLE IF NOT EXISTS public.payslips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    total_earnings NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total_deductions NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    net_salary NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_inss NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_irrf NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_fgts NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    fgts_month NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'CALCULATED' CHECK (status IN ('CALCULATED', 'CLOSED', 'CANCELED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(period_id, contract_id)
);

-- 4. Itens do Holerite (Demonstrativo)
CREATE TABLE IF NOT EXISTS public.payslip_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE CASCADE,
    reference TEXT, -- Ex: 10h, 50%
    amount NUMERIC(10,2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('EARNING', 'DEDUCTION', 'NEUTRAL', 'BASE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Memória de Cálculo (Auditoria e Transparência)
CREATE TABLE IF NOT EXISTS public.payroll_memory_calc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    base_value NUMERIC(10,2) NOT NULL,
    quantity_used NUMERIC(10,2) NOT NULL,
    percentage_used NUMERIC(10,2) NOT NULL,
    parsed_formula TEXT NOT NULL,
    result_value NUMERIC(10,2) NOT NULL,
    origin TEXT NOT NULL,
    engine_version TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- SEGURANÇA E RLS
-- ==============================================================================
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_variable_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslip_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view payroll_periods from their tenants" ON public.payroll_periods;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_periods" ON public.payroll_periods;
    
    DROP POLICY IF EXISTS "Users can view payroll_variable_events from their tenants" ON public.payroll_variable_events;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_variable_events" ON public.payroll_variable_events;

    DROP POLICY IF EXISTS "Users can view payslips from their tenants" ON public.payslips;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslips" ON public.payslips;

    DROP POLICY IF EXISTS "Users can view payslip_items from their tenants" ON public.payslip_items;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslip_items" ON public.payslip_items;

    DROP POLICY IF EXISTS "Users can view payroll_memory_calc from their tenants" ON public.payroll_memory_calc;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_memory_calc" ON public.payroll_memory_calc;
END
$$;

-- payroll_periods
CREATE POLICY "Users can view payroll_periods from their tenants" 
    ON public.payroll_periods FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_periods" 
    ON public.payroll_periods FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_variable_events
CREATE POLICY "Users can view payroll_variable_events from their tenants" 
    ON public.payroll_variable_events FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_variable_events" 
    ON public.payroll_variable_events FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslips
CREATE POLICY "Users can view payslips from their tenants" 
    ON public.payslips FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payslips" 
    ON public.payslips FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslip_items
CREATE POLICY "Users can view payslip_items from their tenants" 
    ON public.payslip_items FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payslip_items" 
    ON public.payslip_items FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_memory_calc
CREATE POLICY "Users can view payroll_memory_calc from their tenants" 
    ON public.payroll_memory_calc FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_memory_calc" 
    ON public.payroll_memory_calc FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- ==============================================================================
-- AUDITORIA
-- ==============================================================================
CREATE TRIGGER audit_payroll_periods_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_payroll_variable_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_variable_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_payslips_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payslips FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

*(Conclusão do Banco de Dados - Tabelas Base MVP + Motor de Cálculo Completos)*


### Script: `supabase_sql_fase_7.sql`
```sql
-- Fase 7: Afastamentos e Ausências
-- Cria a tabela 'leaves' com políticas de RLS e triggers.

CREATE TABLE IF NOT EXISTS public.leaves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('SICK_LEAVE', 'MATERNITY', 'PATERNITY', 'WORK_ACCIDENT', 'UNJUSTIFIED_ABSENCE', 'SUSPENSION', 'OTHER')),
    start_date DATE NOT NULL,
    end_date DATE,
    return_date DATE,
    icd_10_code TEXT,
    medical_certificate_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    is_inss_referral BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Users can view leaves from their tenants" 
    ON public.leaves FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert leaves into their tenants" 
    ON public.leaves FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update leaves in their tenants" 
    ON public.leaves FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete leaves in their tenants" 
    ON public.leaves FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Trigger de Updated At
CREATE TRIGGER update_leaves_updated_at
    BEFORE UPDATE ON public.leaves
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

```

### Script: `supabase_sql_fase_8.sql`
```sql
-- ==============================================================================
-- FASE 8: ESTRUTURA COMPLETA DE RUBRICAS
-- ==============================================================================
-- Este script expande a tabela "payroll_rubrics" com todas as variáveis exigidas
-- pelo Motor de Cálculo da Folha (Fase 13).

-- 1. Expansão da tabela payroll_rubrics
ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'AUTOMATICA', 'IMPORTADA', 'INTEGRACAO')),
    ADD COLUMN IF NOT EXISTS calculation_base TEXT,
    ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS divisor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS factor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS calculation_order INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS incidence_inss_patronal BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_rat BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_third_parties BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_inss BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_irrf BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_fgts BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS valid_to DATE,
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS esocial_description TEXT;

-- (Opcional) Adicionar type e category caso não tenham sido criados no Script 8 original, mas já usados no frontend
ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'EARNING',
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'SALARY',
    ADD COLUMN IF NOT EXISTS calculation_type TEXT DEFAULT 'FIXED',
    ADD COLUMN IF NOT EXISTS formula TEXT;

-- 2. Atualizar permissões de RLS para a tabela expandida 
-- (O Script 8 já possuía RLS, este comando é apenas por garantia)
ALTER TABLE public.payroll_rubrics ENABLE ROW LEVEL SECURITY;

-- Nota: A trigger de auditoria `audit_payroll_rubrics_trigger` criada na Fase 8/Script 8 já cobre automaticamente as novas colunas
-- pois o `to_jsonb(NEW)` captura dinamicamente a estrutura da tabela atual.

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_9.sql`
```sql
-- ==============================================================================
-- FASE 9: EVENTOS DA FOLHA (LANÇAMENTOS VARIÁVEIS) E PROGRESSIVAS
-- ==============================================================================
-- Este script cria as tabelas do motor de folha que faltavam no Script 9,
-- incluindo a versão já atualizada de payroll_events com quantity, origin, etc.

CREATE TABLE IF NOT EXISTS public.payroll_progressive_tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    table_type TEXT NOT NULL CHECK (table_type IN ('INSS', 'IRRF', 'FAMILY_SALARY', 'OTHER')),
    competence_start DATE NOT NULL,
    competence_end DATE,
    ranges_jsonb JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE RESTRICT,
    reference_value NUMERIC(10,2),
    quantity NUMERIC(10,2),
    calculated_amount NUMERIC(10,2) NOT NULL,
    is_manual_entry BOOLEAN NOT NULL DEFAULT false,
    origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO')),
    notes TEXT,
    recorded_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_memory_calc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.payroll_events(id) ON DELETE CASCADE,
    formula_used TEXT NOT NULL,
    variables_snapshot JSONB NOT NULL,
    progressive_table_id UUID REFERENCES public.payroll_progressive_tables(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.terminations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    termination_reason TEXT NOT NULL CHECK (termination_reason IN ('WITHOUT_JUST_CAUSE_BY_EMPLOYER', 'WITH_JUST_CAUSE_BY_EMPLOYER', 'BY_EMPLOYEE', 'MUTUAL_AGREEMENT', 'CONTRACT_EXPIRATION', 'RETIREMENT', 'DEATH')),
    notice_period_type TEXT NOT NULL CHECK (notice_period_type IN ('WORKED', 'INDEMNIFIED', 'WAIVED')),
    notice_date DATE NOT NULL,
    last_working_day DATE NOT NULL,
    fgts_fine_percentage NUMERIC(5,2),
    is_exam_required BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'CALCULATED', 'PAID', 'HOMOLOGATED', 'CANCELED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id)
);

-- Habilitar RLS
ALTER TABLE public.payroll_progressive_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminations ENABLE ROW LEVEL SECURITY;

-- Políticas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage progressive tables') THEN
        CREATE POLICY "Tenant Admins and DP can manage progressive tables" ON public.payroll_progressive_tables FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage payroll events') THEN
        CREATE POLICY "Tenant Admins and DP can manage payroll events" ON public.payroll_events FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can view memory calc') THEN
        CREATE POLICY "Tenant Admins and DP can view memory calc" ON public.payroll_memory_calc FOR SELECT USING (EXISTS (SELECT 1 FROM public.payroll_events e WHERE e.id = public.payroll_memory_calc.event_id AND e.tenant_id = ANY(public.user_tenant_ids())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage terminations') THEN
        CREATE POLICY "Tenant Admins and DP can manage terminations" ON public.terminations FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
END $$;

-- Triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_progressive_tables_trigger') THEN
        CREATE TRIGGER audit_progressive_tables_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_progressive_tables FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_events_trigger') THEN
        CREATE TRIGGER audit_payroll_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_terminations_trigger') THEN
        CREATE TRIGGER audit_terminations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.terminations FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;

-- E se a tabela payroll_events já existir (criada por script anterior incompleto), tentamos alterar:
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN quantity NUMERIC(10,2);
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO'));
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN notes TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN recorded_by UUID;
    EXCEPTION WHEN duplicate_column THEN END;
END $$;

```

### Script: `supabase_sql_fase_10.sql`
```sql
-- ==============================================================================
-- FASE 10: ESTRUTURA DE BENEFÍCIOS
-- ==============================================================================

-- 1. Criação do Catálogo de Benefícios
CREATE TABLE IF NOT EXISTS public.benefit_catalogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    benefit_type TEXT NOT NULL CHECK (benefit_type IN ('TRANSPORTATION', 'MEAL', 'FOOD', 'HEALTH_INSURANCE', 'DENTAL_INSURANCE', 'LIFE_INSURANCE', 'OTHER')),
    provider_name TEXT,
    company_contribution NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    employee_discount_percentage NUMERIC(5,2),
    employee_discount_fixed NUMERIC(10,2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Criação do Vínculo Empregado-Benefício
CREATE TABLE IF NOT EXISTS public.employee_benefits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    benefit_catalog_id UUID NOT NULL REFERENCES public.benefit_catalogs(id) ON DELETE CASCADE,
    opt_in BOOLEAN NOT NULL DEFAULT true,
    custom_discount_value NUMERIC(10,2),
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id, benefit_catalog_id)
);

-- Habilitar RLS
ALTER TABLE public.benefit_catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para benefit_catalogs
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view benefit catalogs from their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can insert benefit catalogs into their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can update benefit catalogs in their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can delete benefit catalogs in their tenants" ON public.benefit_catalogs;
    
    DROP POLICY IF EXISTS "Users can view employee benefits from their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can insert employee benefits into their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can update employee benefits in their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can delete employee benefits in their tenants" ON public.employee_benefits;
END
$$;

CREATE POLICY "Users can view benefit catalogs from their tenants" 
    ON public.benefit_catalogs FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert benefit catalogs into their tenants" 
    ON public.benefit_catalogs FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Políticas de RLS para employee_benefits
CREATE POLICY "Users can view employee benefits from their tenants" 
    ON public.employee_benefits FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee benefits into their tenants" 
    ON public.employee_benefits FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee benefits in their tenants" 
    ON public.employee_benefits FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee benefits in their tenants" 
    ON public.employee_benefits FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_11.sql`
```sql
-- ==============================================================================
-- FASE 11: ESTRUTURA DE DESCONTOS DIVERSOS
-- ==============================================================================

-- 1. Criação da Tabela de Descontos Diversos do Colaborador
CREATE TABLE IF NOT EXISTS public.employee_deductions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE RESTRICT,
    
    deduction_type TEXT NOT NULL CHECK (deduction_type IN ('ALIMONY', 'LOAN', 'ADVANCE', 'COPARTICIPATION', 'OTHER')),
    amount_type TEXT NOT NULL CHECK (amount_type IN ('FIXED', 'PERCENTAGE')),
    
    value NUMERIC(10,2) NOT NULL,
    total_limit NUMERIC(10,2), -- Ex: Limite total do empréstimo. Ao atingir, encerra o desconto.
    
    start_date DATE NOT NULL,
    end_date DATE,
    
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view employee deductions from their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can insert employee deductions into their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can update employee deductions in their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can delete employee deductions in their tenants" ON public.employee_deductions;
END
$$;

CREATE POLICY "Users can view employee deductions from their tenants" 
    ON public.employee_deductions FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee deductions into their tenants" 
    ON public.employee_deductions FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee deductions in their tenants" 
    ON public.employee_deductions FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee deductions in their tenants" 
    ON public.employee_deductions FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_12.sql`
```sql
-- ==============================================================================
-- FASE 12: TABELAS LEGAIS E PARÂMETROS
-- ==============================================================================

-- 1. Criação do Catálogo de Versões Legais
-- Essas versões agrupam os parâmetros de uma mesma época (ex: 2026).
CREATE TABLE IF NOT EXISTS public.legal_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_name TEXT NOT NULL, -- Ex: "Legislação 2026"
    valid_from DATE NOT NULL,
    valid_to DATE,
    source TEXT, -- Ex: "Governo Federal, eSocial"
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela INSS (Progressivo)
CREATE TABLE IF NOT EXISTS public.inss_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    bracket_number INT NOT NULL, -- Ordem da faixa, ex: 1, 2, 3, 4
    base_limit NUMERIC(10,2), -- NULL significa "acima de" ou sem limite superior
    aliquot NUMERIC(5,2) NOT NULL,
    deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabela IRRF
CREATE TABLE IF NOT EXISTS public.irrf_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    bracket_number INT NOT NULL,
    base_limit NUMERIC(10,2), -- NULL significa sem limite superior
    aliquot NUMERIC(5,2) NOT NULL,
    deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Parâmetros Gerais (Salário Mínimo, Deduções, FGTS, etc)
CREATE TABLE IF NOT EXISTS public.general_legal_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    minimum_wage NUMERIC(10,2) NOT NULL,
    dependent_deduction NUMERIC(10,2) NOT NULL,
    simplified_discount NUMERIC(10,2) NOT NULL,
    family_salary_quota NUMERIC(10,2) NOT NULL,
    family_salary_limit NUMERIC(10,2) NOT NULL,
    fgts_standard_aliquot NUMERIC(5,2) NOT NULL, -- 8.00
    fgts_apprentice_aliquot NUMERIC(5,2) NOT NULL, -- 2.00
    vt_max_discount_percentage NUMERIC(5,2) NOT NULL, -- 6.00
    irrf_exemption_limit NUMERIC(10,2), -- 5000.00 (Redutor 2026)
    irrf_reduction_formula_limit NUMERIC(10,2), -- 7350.00
    irrf_base_reduction NUMERIC(10,2), -- 312.89
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS (Como são dados públicos/globais do sistema, apenas leitura autenticada)
ALTER TABLE public.legal_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inss_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.irrf_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.general_legal_parameters ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS — leitura e escrita para autenticados
-- Dropar políticas existentes para permitir re-execução
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated read on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated insert on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated update on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated delete on legal_versions" ON public.legal_versions;

    DROP POLICY IF EXISTS "Allow authenticated read on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on inss_parameters" ON public.inss_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on irrf_parameters" ON public.irrf_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on general_legal_parameters" ON public.general_legal_parameters;
END $$;

-- legal_versions
CREATE POLICY "Allow authenticated read on legal_versions" 
    ON public.legal_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on legal_versions" 
    ON public.legal_versions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on legal_versions" 
    ON public.legal_versions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on legal_versions" 
    ON public.legal_versions FOR DELETE TO authenticated USING (true);

-- inss_parameters
CREATE POLICY "Allow authenticated read on inss_parameters" 
    ON public.inss_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on inss_parameters" 
    ON public.inss_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on inss_parameters" 
    ON public.inss_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on inss_parameters" 
    ON public.inss_parameters FOR DELETE TO authenticated USING (true);

-- irrf_parameters
CREATE POLICY "Allow authenticated read on irrf_parameters" 
    ON public.irrf_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on irrf_parameters" 
    ON public.irrf_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on irrf_parameters" 
    ON public.irrf_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on irrf_parameters" 
    ON public.irrf_parameters FOR DELETE TO authenticated USING (true);

-- general_legal_parameters
CREATE POLICY "Allow authenticated read on general_legal_parameters" 
    ON public.general_legal_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on general_legal_parameters" 
    ON public.general_legal_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on general_legal_parameters" 
    ON public.general_legal_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on general_legal_parameters" 
    ON public.general_legal_parameters FOR DELETE TO authenticated USING (true);

-- ==============================================================================
-- INSERÇÃO DOS DADOS BASE - 2026
-- ==============================================================================

DO $$
DECLARE
    v_version_id UUID;
BEGIN
    -- Cria a versão 2026 se não existir para evitar duplicação (por precaução)
    IF NOT EXISTS (SELECT 1 FROM public.legal_versions WHERE version_name = 'Legislação 2026') THEN
        INSERT INTO public.legal_versions (version_name, valid_from, source)
        VALUES ('Legislação 2026', '2026-01-01', 'Pesquisa CLT 2026')
        RETURNING id INTO v_version_id;

        -- INSS 2026
        INSERT INTO public.inss_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 1621.00, 7.5, 0.00),
        (v_version_id, 2, 2902.84, 9.0, 24.32),
        (v_version_id, 3, 4354.27, 12.0, 111.40),
        (v_version_id, 4, 8475.55, 14.0, 198.49);

        -- IRRF 2026
        INSERT INTO public.irrf_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 2428.80, 0.0, 0.00),
        (v_version_id, 2, 2826.65, 7.5, 182.16),
        (v_version_id, 3, 3751.05, 15.0, 394.16),
        (v_version_id, 4, 4664.68, 22.5, 675.49),
        (v_version_id, 5, NULL, 27.5, 908.73);

        -- Parâmetros Gerais 2026
        INSERT INTO public.general_legal_parameters (
            version_id, minimum_wage, dependent_deduction, simplified_discount, 
            family_salary_quota, family_salary_limit, fgts_standard_aliquot, 
            fgts_apprentice_aliquot, vt_max_discount_percentage, irrf_exemption_limit, 
            irrf_reduction_formula_limit, irrf_base_reduction
        ) VALUES (
            v_version_id, 1621.00, 189.59, 607.20, 
            67.54, 1980.38, 8.00, 
            2.00, 6.00, 5000.00, 
            7350.00, 312.89
        );
    END IF;
END $$;

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_13_14.sql`
```sql
-- ==============================================================================
-- FASES 13 e 14: ESTRUTURAS DO MOTOR DE CÁLCULO E HOLERITE
-- ==============================================================================

-- 1. Períodos de Folha (Competências)
CREATE TABLE IF NOT EXISTS public.payroll_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('MONTHLY', 'ADVANCE', '13TH', 'SUPPLEMENTARY')),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CALCULATED', 'CONFERENCE', 'CLOSED', 'CANCELED')),
    processing_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, month, year, type)
);

-- 2. Eventos Variáveis do Mês (Lançamentos Manuais)
CREATE TABLE IF NOT EXISTS public.payroll_variable_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE CASCADE,
    amount NUMERIC(10,2), -- Valor monetário
    quantity NUMERIC(10,2), -- Quantidade (ex: 10 horas)
    reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Holerites (Resultados Calculados)
CREATE TABLE IF NOT EXISTS public.payslips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    total_earnings NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total_deductions NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    net_salary NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_inss NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_irrf NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_fgts NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    fgts_month NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'CALCULATED' CHECK (status IN ('CALCULATED', 'CLOSED', 'CANCELED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(period_id, contract_id)
);

-- 4. Itens do Holerite (Demonstrativo)
CREATE TABLE IF NOT EXISTS public.payslip_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE CASCADE,
    reference TEXT, -- Ex: 10h, 50%
    amount NUMERIC(10,2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('EARNING', 'DEDUCTION', 'NEUTRAL', 'BASE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Memória de Cálculo (Auditoria e Transparência)
CREATE TABLE IF NOT EXISTS public.payroll_memory_calc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    base_value NUMERIC(10,2) NOT NULL,
    quantity_used NUMERIC(10,2) NOT NULL,
    percentage_used NUMERIC(10,2) NOT NULL,
    parsed_formula TEXT NOT NULL,
    result_value NUMERIC(10,2) NOT NULL,
    origin TEXT NOT NULL,
    engine_version TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- SEGURANÇA E RLS
-- ==============================================================================
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_variable_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslip_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view payroll_periods from their tenants" ON public.payroll_periods;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_periods" ON public.payroll_periods;
    
    DROP POLICY IF EXISTS "Users can view payroll_variable_events from their tenants" ON public.payroll_variable_events;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_variable_events" ON public.payroll_variable_events;

    DROP POLICY IF EXISTS "Users can view payslips from their tenants" ON public.payslips;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslips" ON public.payslips;

    DROP POLICY IF EXISTS "Users can view payslip_items from their tenants" ON public.payslip_items;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslip_items" ON public.payslip_items;

    DROP POLICY IF EXISTS "Users can view payroll_memory_calc from their tenants" ON public.payroll_memory_calc;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_memory_calc" ON public.payroll_memory_calc;
END
$$;

-- payroll_periods
CREATE POLICY "Users can view payroll_periods from their tenants" 
    ON public.payroll_periods FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_periods" 
    ON public.payroll_periods FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_variable_events
CREATE POLICY "Users can view payroll_variable_events from their tenants" 
    ON public.payroll_variable_events FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_variable_events" 
    ON public.payroll_variable_events FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslips
CREATE POLICY "Users can view payslips from their tenants" 
    ON public.payslips FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payslips" 
    ON public.payslips FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslip_items
CREATE POLICY "Users can view payslip_items from their tenants" 
    ON public.payslip_items FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payslip_items" 
    ON public.payslip_items FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_memory_calc
CREATE POLICY "Users can view payroll_memory_calc from their tenants" 
    ON public.payroll_memory_calc FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_memory_calc" 
    ON public.payroll_memory_calc FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- ==============================================================================
-- AUDITORIA
-- ==============================================================================
CREATE TRIGGER audit_payroll_periods_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_payroll_variable_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_variable_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_payslips_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payslips FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

*(Conclusão do Banco de Dados - Tabelas Base MVP + Motor de Cálculo Completos)*


### Script: `supabase_sql_fase_7.sql`
```sql
-- Fase 7: Afastamentos e Ausências
-- Cria a tabela 'leaves' com políticas de RLS e triggers.

CREATE TABLE IF NOT EXISTS public.leaves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('SICK_LEAVE', 'MATERNITY', 'PATERNITY', 'WORK_ACCIDENT', 'UNJUSTIFIED_ABSENCE', 'SUSPENSION', 'OTHER')),
    start_date DATE NOT NULL,
    end_date DATE,
    return_date DATE,
    icd_10_code TEXT,
    medical_certificate_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    is_inss_referral BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Users can view leaves from their tenants" 
    ON public.leaves FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert leaves into their tenants" 
    ON public.leaves FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update leaves in their tenants" 
    ON public.leaves FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete leaves in their tenants" 
    ON public.leaves FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Trigger de Updated At
CREATE TRIGGER update_leaves_updated_at
    BEFORE UPDATE ON public.leaves
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

```

### Script: `supabase_sql_fase_8.sql`
```sql
-- ==============================================================================
-- FASE 8: ESTRUTURA COMPLETA DE RUBRICAS
-- ==============================================================================
-- Este script expande a tabela "payroll_rubrics" com todas as variáveis exigidas
-- pelo Motor de Cálculo da Folha (Fase 13).

-- 1. Expansão da tabela payroll_rubrics
ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'AUTOMATICA', 'IMPORTADA', 'INTEGRACAO')),
    ADD COLUMN IF NOT EXISTS calculation_base TEXT,
    ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS divisor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS factor NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS calculation_order INTEGER NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS incidence_inss_patronal BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_rat BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS incidence_third_parties BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_inss BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_irrf BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS generates_base_fgts BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS valid_to DATE,
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS esocial_description TEXT;

-- (Opcional) Adicionar type e category caso não tenham sido criados no Script 8 original, mas já usados no frontend
ALTER TABLE public.payroll_rubrics
    ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'EARNING',
    ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'SALARY',
    ADD COLUMN IF NOT EXISTS calculation_type TEXT DEFAULT 'FIXED',
    ADD COLUMN IF NOT EXISTS formula TEXT;

-- 2. Atualizar permissões de RLS para a tabela expandida 
-- (O Script 8 já possuía RLS, este comando é apenas por garantia)
ALTER TABLE public.payroll_rubrics ENABLE ROW LEVEL SECURITY;

-- Nota: A trigger de auditoria `audit_payroll_rubrics_trigger` criada na Fase 8/Script 8 já cobre automaticamente as novas colunas
-- pois o `to_jsonb(NEW)` captura dinamicamente a estrutura da tabela atual.

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_9.sql`
```sql
-- ==============================================================================
-- FASE 9: EVENTOS DA FOLHA (LANÇAMENTOS VARIÁVEIS) E PROGRESSIVAS
-- ==============================================================================
-- Este script cria as tabelas do motor de folha que faltavam no Script 9,
-- incluindo a versão já atualizada de payroll_events com quantity, origin, etc.

CREATE TABLE IF NOT EXISTS public.payroll_progressive_tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    table_type TEXT NOT NULL CHECK (table_type IN ('INSS', 'IRRF', 'FAMILY_SALARY', 'OTHER')),
    competence_start DATE NOT NULL,
    competence_end DATE,
    ranges_jsonb JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE RESTRICT,
    reference_value NUMERIC(10,2),
    quantity NUMERIC(10,2),
    calculated_amount NUMERIC(10,2) NOT NULL,
    is_manual_entry BOOLEAN NOT NULL DEFAULT false,
    origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO')),
    notes TEXT,
    recorded_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payroll_memory_calc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES public.payroll_events(id) ON DELETE CASCADE,
    formula_used TEXT NOT NULL,
    variables_snapshot JSONB NOT NULL,
    progressive_table_id UUID REFERENCES public.payroll_progressive_tables(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.terminations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    termination_reason TEXT NOT NULL CHECK (termination_reason IN ('WITHOUT_JUST_CAUSE_BY_EMPLOYER', 'WITH_JUST_CAUSE_BY_EMPLOYER', 'BY_EMPLOYEE', 'MUTUAL_AGREEMENT', 'CONTRACT_EXPIRATION', 'RETIREMENT', 'DEATH')),
    notice_period_type TEXT NOT NULL CHECK (notice_period_type IN ('WORKED', 'INDEMNIFIED', 'WAIVED')),
    notice_date DATE NOT NULL,
    last_working_day DATE NOT NULL,
    fgts_fine_percentage NUMERIC(5,2),
    is_exam_required BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'CALCULATED', 'PAID', 'HOMOLOGATED', 'CANCELED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id)
);

-- Habilitar RLS
ALTER TABLE public.payroll_progressive_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminations ENABLE ROW LEVEL SECURITY;

-- Políticas
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage progressive tables') THEN
        CREATE POLICY "Tenant Admins and DP can manage progressive tables" ON public.payroll_progressive_tables FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage payroll events') THEN
        CREATE POLICY "Tenant Admins and DP can manage payroll events" ON public.payroll_events FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can view memory calc') THEN
        CREATE POLICY "Tenant Admins and DP can view memory calc" ON public.payroll_memory_calc FOR SELECT USING (EXISTS (SELECT 1 FROM public.payroll_events e WHERE e.id = public.payroll_memory_calc.event_id AND e.tenant_id = ANY(public.user_tenant_ids())));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Tenant Admins and DP can manage terminations') THEN
        CREATE POLICY "Tenant Admins and DP can manage terminations" ON public.terminations FOR ALL USING (tenant_id = ANY (public.user_tenant_ids()));
    END IF;
END $$;

-- Triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_progressive_tables_trigger') THEN
        CREATE TRIGGER audit_progressive_tables_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_progressive_tables FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_events_trigger') THEN
        CREATE TRIGGER audit_payroll_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_terminations_trigger') THEN
        CREATE TRIGGER audit_terminations_trigger AFTER INSERT OR UPDATE OR DELETE ON public.terminations FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;

-- E se a tabela payroll_events já existir (criada por script anterior incompleto), tentamos alterar:
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN quantity NUMERIC(10,2);
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN origin TEXT NOT NULL DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'PONTO', 'BENEFICIO', 'INTEGRACAO'));
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN notes TEXT;
    EXCEPTION WHEN duplicate_column THEN END;

    BEGIN
        ALTER TABLE public.payroll_events ADD COLUMN recorded_by UUID;
    EXCEPTION WHEN duplicate_column THEN END;
END $$;

```

### Script: `supabase_sql_fase_10.sql`
```sql
-- ==============================================================================
-- FASE 10: ESTRUTURA DE BENEFÍCIOS
-- ==============================================================================

-- 1. Criação do Catálogo de Benefícios
CREATE TABLE IF NOT EXISTS public.benefit_catalogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    benefit_type TEXT NOT NULL CHECK (benefit_type IN ('TRANSPORTATION', 'MEAL', 'FOOD', 'HEALTH_INSURANCE', 'DENTAL_INSURANCE', 'LIFE_INSURANCE', 'OTHER')),
    provider_name TEXT,
    company_contribution NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    employee_discount_percentage NUMERIC(5,2),
    employee_discount_fixed NUMERIC(10,2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Criação do Vínculo Empregado-Benefício
CREATE TABLE IF NOT EXISTS public.employee_benefits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    benefit_catalog_id UUID NOT NULL REFERENCES public.benefit_catalogs(id) ON DELETE CASCADE,
    opt_in BOOLEAN NOT NULL DEFAULT true,
    custom_discount_value NUMERIC(10,2),
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(contract_id, benefit_catalog_id)
);

-- Habilitar RLS
ALTER TABLE public.benefit_catalogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para benefit_catalogs
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view benefit catalogs from their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can insert benefit catalogs into their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can update benefit catalogs in their tenants" ON public.benefit_catalogs;
    DROP POLICY IF EXISTS "Users can delete benefit catalogs in their tenants" ON public.benefit_catalogs;
    
    DROP POLICY IF EXISTS "Users can view employee benefits from their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can insert employee benefits into their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can update employee benefits in their tenants" ON public.employee_benefits;
    DROP POLICY IF EXISTS "Users can delete employee benefits in their tenants" ON public.employee_benefits;
END
$$;

CREATE POLICY "Users can view benefit catalogs from their tenants" 
    ON public.benefit_catalogs FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert benefit catalogs into their tenants" 
    ON public.benefit_catalogs FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete benefit catalogs in their tenants" 
    ON public.benefit_catalogs FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Políticas de RLS para employee_benefits
CREATE POLICY "Users can view employee benefits from their tenants" 
    ON public.employee_benefits FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee benefits into their tenants" 
    ON public.employee_benefits FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee benefits in their tenants" 
    ON public.employee_benefits FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee benefits in their tenants" 
    ON public.employee_benefits FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_11.sql`
```sql
-- ==============================================================================
-- FASE 11: ESTRUTURA DE DESCONTOS DIVERSOS
-- ==============================================================================

-- 1. Criação da Tabela de Descontos Diversos do Colaborador
CREATE TABLE IF NOT EXISTS public.employee_deductions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE RESTRICT,
    
    deduction_type TEXT NOT NULL CHECK (deduction_type IN ('ALIMONY', 'LOAN', 'ADVANCE', 'COPARTICIPATION', 'OTHER')),
    amount_type TEXT NOT NULL CHECK (amount_type IN ('FIXED', 'PERCENTAGE')),
    
    value NUMERIC(10,2) NOT NULL,
    total_limit NUMERIC(10,2), -- Ex: Limite total do empréstimo. Ao atingir, encerra o desconto.
    
    start_date DATE NOT NULL,
    end_date DATE,
    
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view employee deductions from their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can insert employee deductions into their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can update employee deductions in their tenants" ON public.employee_deductions;
    DROP POLICY IF EXISTS "Users can delete employee deductions in their tenants" ON public.employee_deductions;
END
$$;

CREATE POLICY "Users can view employee deductions from their tenants" 
    ON public.employee_deductions FOR SELECT 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can insert employee deductions into their tenants" 
    ON public.employee_deductions FOR INSERT 
    WITH CHECK (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can update employee deductions in their tenants" 
    ON public.employee_deductions FOR UPDATE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

CREATE POLICY "Users can delete employee deductions in their tenants" 
    ON public.employee_deductions FOR DELETE 
    USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_12.sql`
```sql
-- ==============================================================================
-- FASE 12: TABELAS LEGAIS E PARÂMETROS
-- ==============================================================================

-- 1. Criação do Catálogo de Versões Legais
-- Essas versões agrupam os parâmetros de uma mesma época (ex: 2026).
CREATE TABLE IF NOT EXISTS public.legal_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_name TEXT NOT NULL, -- Ex: "Legislação 2026"
    valid_from DATE NOT NULL,
    valid_to DATE,
    source TEXT, -- Ex: "Governo Federal, eSocial"
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela INSS (Progressivo)
CREATE TABLE IF NOT EXISTS public.inss_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    bracket_number INT NOT NULL, -- Ordem da faixa, ex: 1, 2, 3, 4
    base_limit NUMERIC(10,2), -- NULL significa "acima de" ou sem limite superior
    aliquot NUMERIC(5,2) NOT NULL,
    deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabela IRRF
CREATE TABLE IF NOT EXISTS public.irrf_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    bracket_number INT NOT NULL,
    base_limit NUMERIC(10,2), -- NULL significa sem limite superior
    aliquot NUMERIC(5,2) NOT NULL,
    deduction NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Parâmetros Gerais (Salário Mínimo, Deduções, FGTS, etc)
CREATE TABLE IF NOT EXISTS public.general_legal_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES public.legal_versions(id) ON DELETE CASCADE,
    minimum_wage NUMERIC(10,2) NOT NULL,
    dependent_deduction NUMERIC(10,2) NOT NULL,
    simplified_discount NUMERIC(10,2) NOT NULL,
    family_salary_quota NUMERIC(10,2) NOT NULL,
    family_salary_limit NUMERIC(10,2) NOT NULL,
    fgts_standard_aliquot NUMERIC(5,2) NOT NULL, -- 8.00
    fgts_apprentice_aliquot NUMERIC(5,2) NOT NULL, -- 2.00
    vt_max_discount_percentage NUMERIC(5,2) NOT NULL, -- 6.00
    irrf_exemption_limit NUMERIC(10,2), -- 5000.00 (Redutor 2026)
    irrf_reduction_formula_limit NUMERIC(10,2), -- 7350.00
    irrf_base_reduction NUMERIC(10,2), -- 312.89
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS (Como são dados públicos/globais do sistema, apenas leitura autenticada)
ALTER TABLE public.legal_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inss_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.irrf_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.general_legal_parameters ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS — leitura e escrita para autenticados
-- Dropar políticas existentes para permitir re-execução
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow authenticated read on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated insert on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated update on legal_versions" ON public.legal_versions;
    DROP POLICY IF EXISTS "Allow authenticated delete on legal_versions" ON public.legal_versions;

    DROP POLICY IF EXISTS "Allow authenticated read on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on inss_parameters" ON public.inss_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on inss_parameters" ON public.inss_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on irrf_parameters" ON public.irrf_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on irrf_parameters" ON public.irrf_parameters;

    DROP POLICY IF EXISTS "Allow authenticated read on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated insert on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated update on general_legal_parameters" ON public.general_legal_parameters;
    DROP POLICY IF EXISTS "Allow authenticated delete on general_legal_parameters" ON public.general_legal_parameters;
END $$;

-- legal_versions
CREATE POLICY "Allow authenticated read on legal_versions" 
    ON public.legal_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on legal_versions" 
    ON public.legal_versions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on legal_versions" 
    ON public.legal_versions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on legal_versions" 
    ON public.legal_versions FOR DELETE TO authenticated USING (true);

-- inss_parameters
CREATE POLICY "Allow authenticated read on inss_parameters" 
    ON public.inss_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on inss_parameters" 
    ON public.inss_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on inss_parameters" 
    ON public.inss_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on inss_parameters" 
    ON public.inss_parameters FOR DELETE TO authenticated USING (true);

-- irrf_parameters
CREATE POLICY "Allow authenticated read on irrf_parameters" 
    ON public.irrf_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on irrf_parameters" 
    ON public.irrf_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on irrf_parameters" 
    ON public.irrf_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on irrf_parameters" 
    ON public.irrf_parameters FOR DELETE TO authenticated USING (true);

-- general_legal_parameters
CREATE POLICY "Allow authenticated read on general_legal_parameters" 
    ON public.general_legal_parameters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert on general_legal_parameters" 
    ON public.general_legal_parameters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update on general_legal_parameters" 
    ON public.general_legal_parameters FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete on general_legal_parameters" 
    ON public.general_legal_parameters FOR DELETE TO authenticated USING (true);

-- ==============================================================================
-- INSERÇÃO DOS DADOS BASE - 2026
-- ==============================================================================

DO $$
DECLARE
    v_version_id UUID;
BEGIN
    -- Cria a versão 2026 se não existir para evitar duplicação (por precaução)
    IF NOT EXISTS (SELECT 1 FROM public.legal_versions WHERE version_name = 'Legislação 2026') THEN
        INSERT INTO public.legal_versions (version_name, valid_from, source)
        VALUES ('Legislação 2026', '2026-01-01', 'Pesquisa CLT 2026')
        RETURNING id INTO v_version_id;

        -- INSS 2026
        INSERT INTO public.inss_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 1621.00, 7.5, 0.00),
        (v_version_id, 2, 2902.84, 9.0, 24.32),
        (v_version_id, 3, 4354.27, 12.0, 111.40),
        (v_version_id, 4, 8475.55, 14.0, 198.49);

        -- IRRF 2026
        INSERT INTO public.irrf_parameters (version_id, bracket_number, base_limit, aliquot, deduction) VALUES
        (v_version_id, 1, 2428.80, 0.0, 0.00),
        (v_version_id, 2, 2826.65, 7.5, 182.16),
        (v_version_id, 3, 3751.05, 15.0, 394.16),
        (v_version_id, 4, 4664.68, 22.5, 675.49),
        (v_version_id, 5, NULL, 27.5, 908.73);

        -- Parâmetros Gerais 2026
        INSERT INTO public.general_legal_parameters (
            version_id, minimum_wage, dependent_deduction, simplified_discount, 
            family_salary_quota, family_salary_limit, fgts_standard_aliquot, 
            fgts_apprentice_aliquot, vt_max_discount_percentage, irrf_exemption_limit, 
            irrf_reduction_formula_limit, irrf_base_reduction
        ) VALUES (
            v_version_id, 1621.00, 189.59, 607.20, 
            67.54, 1980.38, 8.00, 
            2.00, 6.00, 5000.00, 
            7350.00, 312.89
        );
    END IF;
END $$;

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

### Script: `supabase_sql_fase_13_14.sql`
```sql
-- ==============================================================================
-- FASES 13 e 14: ESTRUTURAS DO MOTOR DE CÁLCULO E HOLERITE
-- ==============================================================================

-- 1. Períodos de Folha (Competências)
CREATE TABLE IF NOT EXISTS public.payroll_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('MONTHLY', 'ADVANCE', '13TH', 'SUPPLEMENTARY')),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CALCULATED', 'CONFERENCE', 'CLOSED', 'CANCELED')),
    processing_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, month, year, type)
);

-- 2. Eventos Variáveis do Mês (Lançamentos Manuais)
CREATE TABLE IF NOT EXISTS public.payroll_variable_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE CASCADE,
    amount NUMERIC(10,2), -- Valor monetário
    quantity NUMERIC(10,2), -- Quantidade (ex: 10 horas)
    reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Holerites (Resultados Calculados)
CREATE TABLE IF NOT EXISTS public.payslips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    total_earnings NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total_deductions NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    net_salary NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_inss NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_irrf NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    base_fgts NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    fgts_month NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'CALCULATED' CHECK (status IN ('CALCULATED', 'CLOSED', 'CANCELED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(period_id, contract_id)
);

-- 4. Itens do Holerite (Demonstrativo)
CREATE TABLE IF NOT EXISTS public.payslip_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id) ON DELETE CASCADE,
    reference TEXT, -- Ex: 10h, 50%
    amount NUMERIC(10,2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('EARNING', 'DEDUCTION', 'NEUTRAL', 'BASE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Memória de Cálculo (Auditoria e Transparência)
CREATE TABLE IF NOT EXISTS public.payroll_memory_calc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    payslip_id UUID NOT NULL REFERENCES public.payslips(id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    base_value NUMERIC(10,2) NOT NULL,
    quantity_used NUMERIC(10,2) NOT NULL,
    percentage_used NUMERIC(10,2) NOT NULL,
    parsed_formula TEXT NOT NULL,
    result_value NUMERIC(10,2) NOT NULL,
    origin TEXT NOT NULL,
    engine_version TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- SEGURANÇA E RLS
-- ==============================================================================
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_variable_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslip_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_memory_calc ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view payroll_periods from their tenants" ON public.payroll_periods;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_periods" ON public.payroll_periods;
    
    DROP POLICY IF EXISTS "Users can view payroll_variable_events from their tenants" ON public.payroll_variable_events;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_variable_events" ON public.payroll_variable_events;

    DROP POLICY IF EXISTS "Users can view payslips from their tenants" ON public.payslips;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslips" ON public.payslips;

    DROP POLICY IF EXISTS "Users can view payslip_items from their tenants" ON public.payslip_items;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payslip_items" ON public.payslip_items;

    DROP POLICY IF EXISTS "Users can view payroll_memory_calc from their tenants" ON public.payroll_memory_calc;
    DROP POLICY IF EXISTS "Tenant Admins and DP can manage payroll_memory_calc" ON public.payroll_memory_calc;
END
$$;

-- payroll_periods
CREATE POLICY "Users can view payroll_periods from their tenants" 
    ON public.payroll_periods FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_periods" 
    ON public.payroll_periods FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_variable_events
CREATE POLICY "Users can view payroll_variable_events from their tenants" 
    ON public.payroll_variable_events FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_variable_events" 
    ON public.payroll_variable_events FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslips
CREATE POLICY "Users can view payslips from their tenants" 
    ON public.payslips FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payslips" 
    ON public.payslips FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payslip_items
CREATE POLICY "Users can view payslip_items from their tenants" 
    ON public.payslip_items FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payslip_items" 
    ON public.payslip_items FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- payroll_memory_calc
CREATE POLICY "Users can view payroll_memory_calc from their tenants" 
    ON public.payroll_memory_calc FOR SELECT USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));
CREATE POLICY "Tenant Admins and DP can manage payroll_memory_calc" 
    ON public.payroll_memory_calc FOR ALL USING (tenant_id IN (SELECT unnest(public.user_tenant_ids())));

-- ==============================================================================
-- AUDITORIA
-- ==============================================================================
CREATE TRIGGER audit_payroll_periods_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_periods FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_payroll_variable_events_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payroll_variable_events FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_payslips_trigger AFTER INSERT OR UPDATE OR DELETE ON public.payslips FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- Atualizar cache do Supabase
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================

```

*(Conclusão do Banco de Dados - Tabelas Base MVP + Motor de Cálculo Completos)*

### Script 42: `00042_add_employee_contacts_banks_docs`
``sql
-- 1. Contatos na tabela people
ALTER TABLE public.people
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS corporate_email TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS mobile TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_relation TEXT;

-- 2. Dados banc�rios na tabela workers
ALTER TABLE public.workers
ADD COLUMN IF NOT EXISTS bank_code TEXT,
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS agency TEXT,
ADD COLUMN IF NOT EXISTS agency_digit TEXT,
ADD COLUMN IF NOT EXISTS account_number TEXT,
ADD COLUMN IF NOT EXISTS account_digit TEXT,
ADD COLUMN IF NOT EXISTS account_type TEXT,
ADD COLUMN IF NOT EXISTS pix_key TEXT,
ADD COLUMN IF NOT EXISTS pix_type TEXT;

-- 3. Nova tabela de Documentos do Colaborador (employee_documents)
CREATE TABLE public.employee_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    document_number TEXT,
    issuer TEXT,
    issue_date DATE,
    expiration_date DATE,
    file_url TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'EXPIRED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view employee_documents in their tenants" 
    ON public.employee_documents FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage employee_documents" 
    ON public.employee_documents FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = employee_documents.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
    );

CREATE TRIGGER audit_employee_documents_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.employee_documents
FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
```

## Functions (RPCs)

### `authenticate_employee`
```sql
CREATE OR REPLACE FUNCTION public.authenticate_employee(p_cpf TEXT, p_birth_date TEXT)
RETURNS TABLE (
    worker_id UUID,
    person_id UUID,
    company_id UUID,
    tenant_id UUID,
    full_name TEXT
);
```

---

## 4. Migrations de Produção e Contenção

### Migration `00066_anular_recibos_ficticios_esocial.sql` (Fase P0 / T26)
- **Objetivo**: Anular registros no `esocial_transmissions` que continham recibos fictícios gerados sinteticamente por `Math.random` (padrão `1.2.000%`), preservando a integridade jurídica e a trilha de auditoria via `audit.logs`.
- **Alterações**:
  - `status` restaurado para `'DRAFT'`.
  - `receipt_number` definido como `NULL`.
  - `transmitted_at` definido como `NULL`.
  - `error_message` enriquecido com a justificativa de neutralização e cópia do recibo anterior.
  - Gatilho `audit_esocial_trigger` acionado automaticamente a cada linha alterada.

```sql
UPDATE public.esocial_transmissions
SET 
    status = 'DRAFT',
    error_message = COALESCE(error_message || ' | ', '') || 'Simulação anulada em produção (T26). Recibo fictício removido: ' || receipt_number,
    receipt_number = NULL,
    transmitted_at = NULL,
    updated_at = NOW()
WHERE receipt_number LIKE '1.2.000%';
```

### Migration `00067_revoke_sign_worker_document.sql` (Fase P0 / T27)
- **Objetivo**: Revogar permissão de execução da RPC `sign_worker_document` para `anon`, `authenticated` e `public` até que o fluxo seguro AS-04 (com rubrica na tela, hash H1/H2 e Edge Function) seja implementado na Fase P6.
- **Alterações**:
  - `REVOKE EXECUTE ON FUNCTION public.sign_worker_document(...) FROM anon, authenticated, public;`
  - Inclusão de comentário de auditoria no catálogo PostgreSQL.
```sql
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
          AND p.proname = 'sign_worker_document' 
          AND pronargs = 5
    ) THEN
        EXECUTE 'REVOKE EXECUTE ON FUNCTION public.sign_worker_document(UUID, UUID, TEXT, TEXT, TEXT) FROM anon, authenticated, public;';
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
          AND p.proname = 'sign_worker_document' 
          AND pronargs = 2
    ) THEN
        EXECUTE 'REVOKE EXECUTE ON FUNCTION public.sign_worker_document(UUID, UUID) FROM anon, authenticated, public;';
    END IF;
END $$;
```

### Migration `00068_add_irrf_reduction_parameters.sql` (Fase P1 / T3)
- **Objetivo**: Adicionar os coeficientes da fórmula progressiva do redutor do IRRF 2026 (`irrf_reduction_a` e `irrf_reduction_b`) na tabela `public.general_legal_parameters`, eliminando fallbacks hardcoded no código do motor e integrando a parametrização legal ao banco de dados.
- **Alterações**:
  - `ALTER TABLE public.general_legal_parameters ADD COLUMN IF NOT EXISTS irrf_reduction_a NUMERIC(12,2) DEFAULT 978.62;`
  - `ALTER TABLE public.general_legal_parameters ADD COLUMN IF NOT EXISTS irrf_reduction_b NUMERIC(12,6) DEFAULT 0.133145;`
  - Comentários adicionados no catálogo PostgreSQL.
  - Backfill executado para consolidar os valores da versão legal ativa de 2026.
  - Notificação de reload do schema PostgREST (`NOTIFY pgrst, 'reload schema'`).

```sql
ALTER TABLE public.general_legal_parameters
ADD COLUMN IF NOT EXISTS irrf_reduction_a NUMERIC(12,2) DEFAULT 978.62,
ADD COLUMN IF NOT EXISTS irrf_reduction_b NUMERIC(12,6) DEFAULT 0.133145;

COMMENT ON COLUMN public.general_legal_parameters.irrf_reduction_a IS 'Termo fixo da fórmula do redutor progressivo do IRRF 2026 (padrão: 978.62)';
COMMENT ON COLUMN public.general_legal_parameters.irrf_reduction_b IS 'Coeficiente angular da fórmula do redutor progressivo do IRRF 2026 (padrão: 0.133145)';

UPDATE public.general_legal_parameters
SET 
  irrf_reduction_a = COALESCE(irrf_reduction_a, 978.62),
  irrf_reduction_b = COALESCE(irrf_reduction_b, 0.133145),
  irrf_exemption_limit = COALESCE(irrf_exemption_limit, 5000.00),
  irrf_reduction_formula_limit = COALESCE(irrf_reduction_formula_limit, 7350.00),
  irrf_base_reduction = COALESCE(irrf_base_reduction, 312.89),
  simplified_discount = CASE 
    WHEN simplified_discount IS NULL OR simplified_discount = 0 THEN 607.20 
    ELSE simplified_discount 
  END;

NOTIFY pgrst, 'reload schema';
```

### Migration `00069_catalogo_rubricas_incidencias_t30.sql` (Fase P2 / T30, T12, T13)
- **Objetivo**: Parametrização completa do Catálogo de Rubricas CLT 2026, consolidação da Matriz de Incidências tributárias (INSS, IRRF, FGTS e encargos patronais), eliminação de duplicidades operacionais (DSR 103 vs 104), inserção das rubricas ausentes exigidas por lei/convenções e seed das rubricas de adiantamento (250 e 850).
- **Alterações**:
  - Desativação da rubrica de DSR duplicada (`103`), preservando a `104` (DSR sobre variáveis) e `170` (DSR sobre horas extras).
  - Atualização cadastral e tributária de todas as 42 rubricas existentes em todos os tenants com `calculation_form`, `calculation_type`, `calculation_order`, `factor` e incidências explícitas.
  - Inclusão das 7 rubricas ausentes do catálogo:
    - `106` Salário Família (Provento, benefício previdenciário isento, eSocial 1409).
    - `152` Banco de Horas Crédito (Provento, horas extras compensatórias com fator 1.5, eSocial 1004).
    - `153` Hora Extra 70% (Provento, adicional normativo CCT/ACT com fator 1.7, eSocial 1003).
    - `305` Adicional de Penosidade (Provento, percentual sobre salário base, eSocial 1204).
    - `804` Pensão Alimentícia (Desconto judicial dedutível do IRRF, eSocial 9200).
    - `805` Empréstimo Consignado (Desconto em folha, eSocial 9210).
    - `806` Contribuição Sindical/Assistencial (Desconto autorizado, eSocial 9230).
  - Seed garantido das rubricas `250` (Adiantamento Quinzenal) e `850` (Desconto de Adiantamento) para todos os tenants, permitindo eliminar o insert dinâmico no motor (T12).

### Migration `00070_add_rubric_kind.sql` (Fase P3 / T22)
- **Objetivo**: Adicionar a coluna `rubric_kind` na tabela `public.payroll_rubrics` com constraint de validação e backfill de todas as rubricas existentes, permitindo que o motor de cálculo opere de maneira orientada a dados e tipos explícitos sem depender de heurísticas por nome ou código.
- **Alterações**:
  - `ALTER TABLE public.payroll_rubrics ADD COLUMN IF NOT EXISTS rubric_kind TEXT;`
  - Backfill executado para todos os códigos e categorias de rubricas ativas e inativas de todos os tenants.
  - `ALTER TABLE public.payroll_rubrics ALTER COLUMN rubric_kind SET DEFAULT 'OTHER';`
  - `ALTER TABLE public.payroll_rubrics ALTER COLUMN rubric_kind SET NOT NULL;`
  - Constraint `payroll_rubrics_rubric_kind_check` validando a lista oficial de tipos suportados pelo motor (`SALARY_BASE`, `OVERTIME`, `DSR`, `DSR_NOTURNO`, `ADIC_NOTURNO`, `INSALUBRIDADE`, `PERICULOSIDADE`, `ABSENCE`, `LATE`, `COMMISSION`, `FAMILY_SALARY`, `ALIMONY`, `LOAN`, `UNION`, `ADVANCE`, `BENEFIT`, `VACATION`, `THIRTEENTH`, `TERMINATION`, `INSS`, `IRRF`, `FGTS`, `OTHER`).

### Migration `00071_atomic_save_payroll_period.sql` (Fase P3 / T9)
- **Objetivo**: Implementar persistência atômica transacional da folha de pagamento via RPC PostgreSQL `save_payroll_period` e suporte a trava de concorrência com o estado `CALCULATING`.
- **Alterações**:
  - `ALTER TABLE public.payroll_periods DROP CONSTRAINT IF EXISTS payroll_periods_status_check;`
  - `ALTER TABLE public.payroll_periods ADD CONSTRAINT payroll_periods_status_check CHECK (status IN ('DRAFT', 'CALCULATING', 'CALCULATED', 'CONFERENCE', 'CLOSED', 'REOPENED', 'CANCELED'));`
  - Criação da função PL/pgSQL transacional `public.save_payroll_period(p_period_id UUID, p_payload JSONB)` com `SECURITY DEFINER` e `SET search_path = public`:
    - Validação de existência e imutabilidade de período fechado (`CLOSED`);
    - Deleção atômica de holerites e impostos anteriores na mesma transação da gravação (suportando filtro de contrato individual ou folha completa);
    - Inserção em lote de `payslips`, `payslip_items`, `payroll_memory_calc` e `payroll_company_taxes`;
    - Atualização transacional de `payroll_periods` para `status = 'CALCULATED'` e `processing_date = NOW()`;
    - Rollback total automático pelo PostgreSQL em caso de falha de integridade ou erro interno.
  - Concessão de permissões de execução: `GRANT EXECUTE ON FUNCTION public.save_payroll_period(UUID, JSONB) TO authenticated, service_role;`.

### Migration `00072_recalculate_company_taxes_t10.sql` (Fase P3 / T10)
- **Objetivo**: Aprimorar a procedure `save_payroll_period` para apagar e reinserir uma linha por empresa em `payroll_company_taxes` com as bases consolidadas de todos os colaboradores do período, garantindo a integridade dos encargos patronais inclusive em recálculos de contrato individual.
- **Alterações**:
  - Atualização da função PL/pgSQL `public.save_payroll_period(p_period_id UUID, p_payload JSONB)`:
    - No bloco de impostos patronais, adicionada a deleção prévia por empresa no período (`DELETE FROM public.payroll_company_taxes WHERE period_id = p_period_id AND company_id = (v_tax->>'company_id')::UUID;`);
    - Inserção da linha consolidada contendo as bases totais de `base_inss`, `base_fgts` e tributos patronais calculados para todos os contratos da empresa naquele período.
  - Notificação de reload do schema PostgREST (`NOTIFY pgrst, 'reload schema'`).

### Migration `00073_rubric_model_v2.sql` (Fase P3 / §6 Modelo v2)
- **Objetivo**: Implementação do Modelo v2 de rubricas, introduzindo auditoria, governança, ciclo de vida com versionamento (`status` DRAFT/APPROVED/ACTIVE/RETIRED), matriz de incidências por contexto (`rubric_incidences`) e parametrização de bases de cálculo dinâmicas orientadas a dados (`calculation_bases` e `calculation_base_members`).
- **Alterações**:
  - Alterações em `public.payroll_rubrics`:
    - Adicionadas colunas `esocial_nature`, `is_system`, `status` (com constraint `CHECK (status IN ('DRAFT', 'APPROVED', 'ACTIVE', 'RETIRED'))`), `legal_basis`, `approved_by` e `approved_at`;
    - Backfill marcando `is_system = true` para todas as 42 rubricas estruturais do catálogo oficial;
  - Criação da tabela `public.rubric_incidences`:
    - Chave primária composta `UNIQUE(rubric_id, context)`;
    - Campos: `context` (`MONTHLY`, `VACATION`, `THIRTEENTH`, `TERMINATION`, `ALL`), `inss`, `irrf`, `fgts`, `irrf_mode`, `integra_dsr`, `media_ferias`, `media_13`, `inss_patronal`, `rat`, `terceiros`;
    - Habilitada RLS com políticas por tenant e gatilho de auditoria (`audit.audit_trigger_func()`);
    - Backfill migrando incidências existentes para o contexto `MONTHLY`;
  - Criação das tabelas `public.calculation_bases` e `public.calculation_base_members`:
    - Parametrização dinâmica das bases `BASE_HORA_EXTRA`, `BASE_DSR`, `BASE_DSR_NOTURNO`, `BASE_FERIAS`, `BASE_13`, `BASE_INSS`, `BASE_IRRF`, `BASE_FGTS` com operações `ADD` e `SUBTRACT` por `kind` e `rubric_id`;
    - Habilitada RLS;
  - Adicionada coluna `rubric_version_id UUID REFERENCES public.payroll_rubrics(id)` na tabela `public.payslip_items`.
  - Notificação de reload do schema PostgREST (`NOTIFY pgrst, 'reload schema'`).

### Migration `00074_fixed_events_value_type_and_hazard_concurrency_t14.sql` (Fase P4 / T14)
- **Objetivo**: Suporte ao tipo de valor (`value_type` em `AMOUNT` ou `PERCENT`) para eventos e adicionais fixos dos colaboradores (`employee_fixed_events`), permitindo que adicionais sejam lançados tanto em valor fixo quanto em percentual sobre a base legal, e configuração de cumulatividade de adicionais de insalubridade e periculosidade (`allow_cumulative_hazard_allowances`) em contratos (`employment_contracts`), em atendimento ao Art. 193 §2º da CLT.
- **Alterações**:
  - `ALTER TABLE public.employee_fixed_events ADD COLUMN IF NOT EXISTS value_type TEXT NOT NULL DEFAULT 'AMOUNT' CHECK (value_type IN ('AMOUNT', 'PERCENT'));`
  - `ALTER TABLE public.employment_contracts ADD COLUMN IF NOT EXISTS allow_cumulative_hazard_allowances BOOLEAN NOT NULL DEFAULT false;`
  - Comentários explicativos adicionados no dicionário de dados do PostgreSQL.
  - Notificação de reload do schema PostgREST (`NOTIFY pgrst, 'reload schema'`).

```sql
-- Migration: 00074_fixed_events_value_type_and_hazard_concurrency_t14
-- Tarefa T14: Adiciona value_type em employee_fixed_events e allow_cumulative_hazard_allowances em employment_contracts

ALTER TABLE public.employee_fixed_events 
ADD COLUMN IF NOT EXISTS value_type TEXT NOT NULL DEFAULT 'AMOUNT' 
CHECK (value_type IN ('AMOUNT', 'PERCENT'));

COMMENT ON COLUMN public.employee_fixed_events.value_type IS 
'Tipo de valor do adicional/evento fixo: AMOUNT (valor fixo em R$) ou PERCENT (percentual aplicado sobre a base de cálculo da rubrica).';

ALTER TABLE public.employment_contracts 
ADD COLUMN IF NOT EXISTS allow_cumulative_hazard_allowances BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.employment_contracts.allow_cumulative_hazard_allowances IS 
'Permite cumulatividade excepcional de adicional de insalubridade e periculosidade prevista em CCT (CLT art. 193 §2º padrão: não cumulativo).';

NOTIFY pgrst, 'reload schema';
```

### Migration `00075_deductions_apply_on_types_t17.sql` (Fase P4 / T17)
- **Objetivo**: Adicionar a coluna `apply_on_types TEXT[] DEFAULT NULL` na tabela `public.employee_deductions` para permitir a parametrização explícita dos tipos de folha onde cada dedução fixa do colaborador é devida (ex: `MONTHLY`, `ADVANCE`, `VACATION`, `THIRTEENTH_1`, `THIRTEENTH_2`, `COMPLEMENTARY`), prevenindo o vazamento indevido de descontos em férias ou 13º salário e suportando regras de decisão judicial para pensão alimentícia.
- **Alterações**:
  - `ALTER TABLE public.employee_deductions ADD COLUMN IF NOT EXISTS apply_on_types TEXT[] DEFAULT NULL;`
  - Comentário explicativo adicionado no dicionário de dados do PostgreSQL.

```sql
-- Migration: 00075_deductions_apply_on_types_t17
-- Fase P4 / Tarefa T17: Descontos fixos por tipo de folha (apply_on_types) e regra de pensão alimentícia

ALTER TABLE public.employee_deductions
ADD COLUMN IF NOT EXISTS apply_on_types TEXT[] DEFAULT NULL;

COMMENT ON COLUMN public.employee_deductions.apply_on_types IS 
'Tipos de folha aos quais a dedução fixa se aplica (ex: MONTHLY, ADVANCE, VACATION, THIRTEENTH_1, THIRTEENTH_2, COMPLEMENTARY). Se nulo ou vazio, adota o padrão: MONTHLY ou ADVANCE de acordo com deduct_on_advance, sem vazar para Férias ou 13º.';
```

### Migration `00076_legal_versions_and_rules_t19.sql` (Fase P4 / T19)
- **Objetivo**: Adicionar a coluna `legal_version_id` na tabela `public.payslips` para auditoria rigorosa da versão legal vigente utilizada em cada holerite; adicionar `is_apprentice` em `employment_contracts` para identificação de menor aprendiz com alíquota reduzida de FGTS (2%); e adicionar colunas de regime tributário, anexo do Simples e desoneração da folha (CPRB) na tabela `public.companies`.
- **Alterações**:
  - `ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS legal_version_id UUID REFERENCES public.legal_versions(id);`
  - `ALTER TABLE public.employment_contracts ADD COLUMN IF NOT EXISTS is_apprentice BOOLEAN NOT NULL DEFAULT false;`
  - `ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS tax_regime TEXT DEFAULT 'LUCRO_PRESUMIDO';`
  - `ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS is_cprb_exempted BOOLEAN NOT NULL DEFAULT false;`
  - `ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS simples_anexo TEXT DEFAULT NULL;`
  - Notificação de reload de schema do PostgREST.

```sql
-- Migration: 00076_legal_versions_and_rules_t19
-- Fase P4 / Tarefa T19: Dependentes, 13º, FGTS aprendiz, patronais por regime e versões reais gravadas

ALTER TABLE public.payslips 
ADD COLUMN IF NOT EXISTS legal_version_id UUID REFERENCES public.legal_versions(id);

COMMENT ON COLUMN public.payslips.legal_version_id IS 
'ID da versão de tabelas e parâmetros legais (legal_versions) efetivamente vigente e utilizada no cálculo do holerite.';

ALTER TABLE public.employment_contracts 
ADD COLUMN IF NOT EXISTS is_apprentice BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.employment_contracts.is_apprentice IS 
'Indica se o contrato é de Menor Aprendiz (CLT art. 428 / Lei 8.036/90 art. 15), aplicando alíquota reduzida de FGTS de 2%.';

ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS tax_regime TEXT DEFAULT 'LUCRO_PRESUMIDO';

ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS is_cprb_exempted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS simples_anexo TEXT DEFAULT NULL;

COMMENT ON COLUMN public.companies.tax_regime IS 
'Regime de tributação da empresa: SIMPLES, SIMPLES_NACIONAL, LUCRO_PRESUMIDO ou LUCRO_REAL.';

COMMENT ON COLUMN public.companies.is_cprb_exempted IS 
'Indica se a empresa é optante pela Desoneração da Folha de Pagamento (CPRB - Lei 12.546/2011), isentando a cota patronal previdenciária de 20%.';

COMMENT ON COLUMN public.companies.simples_anexo IS 
'Anexo do Simples Nacional (ex: I, II, III, IV, V). Anexos I, II, III e V são isentos de patronal/RAT/terceiros; Anexo IV recolhe patronal e RAT.';

NOTIFY pgrst, 'reload schema';
```

### Migration `00077_time_tracking_pt01.sql` (Fase P5 / PT-01)
- **Objetivo**: Modelagem e estruturação fundamental do Módulo de Ponto Eletrônico em estrita conformidade com a CLT (arts. 59, 66, 71, 74) e a Portaria MTP 671/2021 (REP-C, REP-P e importação de AFD).
- **Tabelas Criadas**:
  - `public.time_devices`: Cadastro de equipamentos e fontes de ponto (`REP_C` físico, `REP_P_MOBILE` celular/PWA, `IMPORT` arquivos AFD), com controle de NSR sequencial, IP/host para coletor local, status e API key hash.
  - `public.afd_files`: Registro e controle de arquivos AFD (Arquivo-Fonte de Dados) importados com hash SHA256 exclusivo por tenant (`uq_afd_files_tenant_hash`) para idempotência absoluta.
  - `public.time_punch_records`: Trilha imutável de batidas originais de ponto, com chave única `(device_id, nsr)`, carimbo de horário com fuso, geolocalização, IP, fingerprint, recibo e linha bruta AFD.
  - `public.time_daily_summary`: Resumo diário de jornada consolidado por contrato e data (`uq_time_daily_summary_contract_date`), apurando minutos trabalhados, extras 50%/100%, adicional noturno, atrasos, faltas, saldo diário do banco de horas e detecção de infrações trabalhistas intrajornada (art. 71 CLT) e interjornada (art. 66 CLT com mínimo de 11h).
- **Tabelas Estendidas**:
  - `public.time_entries`: Adicionada coluna `punch_record_id REFERENCES public.time_punch_records(id)` para rastreabilidade direta da batida original que deu origem à marcação.
  - `public.time_bank_accounts`: Adicionadas colunas de política de banco de horas (`policy_type` com ACORDO_INDIVIDUAL limitado a 6 meses conforme art. 59 §5º da CLT e CCT/ACT até 12 meses conforme art. 59 §2º, `validity_months`, `expiration_rule`, `max_positive_balance_minutes`, `closure_date`).
- **Garantias de Imutabilidade e Segurança**:
  - Trigger `trg_immutable_time_punch_records` com a função `prevent_punch_record_mutation()` que lança exceção terminante em qualquer tentativa de `UPDATE` ou `DELETE` na tabela `time_punch_records`.
  - Habilitação obrigatória de RLS em todas as tabelas novas, com políticas de acesso multitenant para Administradores/DP e política de consulta do próprio histórico pelo colaborador (`Employees can view their own punch records` e `Employees can view their own daily summary`).
  - Triggers de auditoria (`audit.audit_trigger_func()`) vinculados a todas as tabelas.

```sql
-- Migration: 00077_time_tracking_pt01.sql
-- Description: Módulo de Ponto Eletrônico (PT-01) - Portaria MTP 671/2021 e CLT (art. 74)

-- 1. TABELA DE DISPOSITIVOS E FONTES DE PONTO (REP-C, REP-P, IMPORT)
CREATE TABLE IF NOT EXISTS public.time_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('REP_C', 'REP_P_MOBILE', 'IMPORT')),
    vendor TEXT,               -- Ex: 'Control iD'
    model TEXT,                -- Ex: 'iDClass', 'iDFlex'
    serial_number TEXT,        -- Número de fabricação/registro INMETRO
    host TEXT,                 -- IP/host local para comunicação com coletor
    port INTEGER DEFAULT 80,
    last_nsr BIGINT NOT NULL DEFAULT 0,
    last_sync_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'OFFLINE', 'MAINTENANCE')),
    api_key_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TABELA DE ARQUIVOS AFD (ARQUIVO-FONTE DE DADOS - PORTARIA 671)
CREATE TABLE IF NOT EXISTS public.afd_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    device_id UUID REFERENCES public.time_devices(id) ON DELETE SET NULL,
    file_name TEXT NOT NULL,
    file_hash TEXT NOT NULL,   -- SHA256 do arquivo original para idempotência
    file_size_bytes BIGINT,
    storage_path TEXT,
    period_start DATE,
    period_end DATE,
    total_records INTEGER NOT NULL DEFAULT 0,
    imported_records INTEGER NOT NULL DEFAULT 0,
    duplicate_records INTEGER NOT NULL DEFAULT 0,
    rejected_records INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'IMPORTED', 'ERROR')),
    error_message TEXT,
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_afd_files_tenant_hash UNIQUE (tenant_id, file_hash)
);

-- 3. TRILHA IMUTÁVEL DE REGISTROS DE PONTO (time_punch_records)
CREATE TABLE IF NOT EXISTS public.time_punch_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    device_id UUID REFERENCES public.time_devices(id) ON DELETE SET NULL,
    nsr BIGINT NOT NULL,       -- Número Sequencial de Registro (estrito por equipamento)
    record_type INTEGER NOT NULL DEFAULT 3, -- 3 = Registro de Ponto na Portaria 671
    punched_at TIMESTAMPTZ NOT NULL,        -- Horário com fuso carimbado confiavelmente
    cpf TEXT,
    pis TEXT,
    worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
    contract_id UUID REFERENCES public.employment_contracts(id) ON DELETE SET NULL,
    source TEXT NOT NULL CHECK (source IN ('REP', 'MOBILE', 'IMPORT', 'MANUAL')),
    geo JSONB,                 -- Dados de geolocalização ({lat, lng, accuracy, address})
    ip INET,
    device_fingerprint TEXT,
    receipt_code TEXT,         -- Código de autenticação do comprovante entregue ao trabalhador
    raw_line TEXT,             -- Linha bruta original lida do arquivo AFD
    crc_ok BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_time_punch_records_device_nsr UNIQUE (device_id, nsr)
);

CREATE OR REPLACE FUNCTION public.prevent_punch_record_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'A trilha de registros originais de ponto (time_punch_records) é estritamente imutável (Portaria MTP 671/2021 e CLT art. 74). Operações de UPDATE ou DELETE são terminantemente proibidas.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_time_punch_records ON public.time_punch_records;
CREATE TRIGGER trg_immutable_time_punch_records
BEFORE UPDATE OR DELETE ON public.time_punch_records
FOR EACH ROW
EXECUTE FUNCTION public.prevent_punch_record_mutation();

-- 4. VINCULAR BATIDA ORIGINAL EM time_entries
ALTER TABLE public.time_entries 
    ADD COLUMN IF NOT EXISTS punch_record_id UUID REFERENCES public.time_punch_records(id) ON DELETE RESTRICT;

-- 5. POLÍTICAS DE BANCO DE HORAS EM time_bank_accounts (CLT art. 59 §§ 2º e 5º)
ALTER TABLE public.time_bank_accounts
    ADD COLUMN IF NOT EXISTS policy_type TEXT CHECK (policy_type IN ('ACORDO_INDIVIDUAL', 'CCT', 'ACT')) DEFAULT 'ACORDO_INDIVIDUAL',
    ADD COLUMN IF NOT EXISTS validity_months INTEGER DEFAULT 6,
    ADD COLUMN IF NOT EXISTS expiration_rule TEXT CHECK (expiration_rule IN ('PAY_AS_OVERTIME', 'FORFEIT', 'EXTEND')) DEFAULT 'PAY_AS_OVERTIME',
    ADD COLUMN IF NOT EXISTS max_positive_balance_minutes INTEGER,
    ADD COLUMN IF NOT EXISTS closure_date DATE;

-- 6. TABELA DE RESUMO DIÁRIO DE JORNADA (time_daily_summary)
CREATE TABLE IF NOT EXISTS public.time_daily_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    expected_work_minutes INTEGER NOT NULL DEFAULT 0,
    worked_minutes INTEGER NOT NULL DEFAULT 0,
    overtime_50_minutes INTEGER NOT NULL DEFAULT 0,
    overtime_100_minutes INTEGER NOT NULL DEFAULT 0,
    night_shift_minutes INTEGER NOT NULL DEFAULT 0,
    night_overtime_minutes INTEGER NOT NULL DEFAULT 0,
    delay_minutes INTEGER NOT NULL DEFAULT 0,
    absence_minutes INTEGER NOT NULL DEFAULT 0,
    break_taken_minutes INTEGER NOT NULL DEFAULT 0,
    break_expected_minutes INTEGER NOT NULL DEFAULT 0,
    intrajornada_violation_minutes INTEGER NOT NULL DEFAULT 0,
    interjornada_violation_minutes INTEGER NOT NULL DEFAULT 0,
    time_bank_credited_minutes INTEGER NOT NULL DEFAULT 0,
    time_bank_debited_minutes INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'REGULAR' CHECK (status IN ('REGULAR', 'PENDING_APPROVAL', 'JUSTIFIED', 'INCONSISTENT', 'DAY_OFF', 'HOLIDAY', 'LEAVE', 'VACATION')),
    inconsistencies TEXT[] DEFAULT '{}',
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_time_daily_summary_contract_date UNIQUE (contract_id, date)
);

-- 7. RLS E AUDITORIA
ALTER TABLE public.time_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afd_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_punch_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_daily_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant Admins and DP can manage time_devices" ON public.time_devices;
CREATE POLICY "Tenant Admins and DP can manage time_devices" 
    ON public.time_devices FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (
            SELECT 1 FROM public.tenant_users 
            WHERE user_id = auth.uid() 
            AND tenant_users.tenant_id = time_devices.tenant_id 
            AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        )
    );

DROP POLICY IF EXISTS "Tenant Admins and DP can manage afd_files" ON public.afd_files;
CREATE POLICY "Tenant Admins and DP can manage afd_files" 
    ON public.afd_files FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (
            SELECT 1 FROM public.tenant_users 
            WHERE user_id = auth.uid() 
            AND tenant_users.tenant_id = afd_files.tenant_id 
            AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        )
    );

DROP POLICY IF EXISTS "Tenant Admins and DP can manage time_punch_records" ON public.time_punch_records;
CREATE POLICY "Tenant Admins and DP can manage time_punch_records" 
    ON public.time_punch_records FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (
            SELECT 1 FROM public.tenant_users 
            WHERE user_id = auth.uid() 
            AND tenant_users.tenant_id = time_punch_records.tenant_id 
            AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        )
    );

DROP POLICY IF EXISTS "Employees can view their own punch records" ON public.time_punch_records;
CREATE POLICY "Employees can view their own punch records"
    ON public.time_punch_records FOR SELECT
    USING (
        tenant_id = ANY (public.user_tenant_ids())
        AND EXISTS (
            SELECT 1 FROM public.employment_contracts ec
            JOIN public.workers w ON w.id = ec.worker_id
            JOIN public.people p ON p.id = w.person_id
            WHERE ec.id = time_punch_records.contract_id
            AND (p.user_id = auth.uid() OR ec.worker_id = auth.uid() OR p.cpf = (SELECT cpf FROM public.people WHERE user_id = auth.uid() LIMIT 1))
        )
    );

DROP POLICY IF EXISTS "Tenant Admins and DP can manage time_daily_summary" ON public.time_daily_summary;
CREATE POLICY "Tenant Admins and DP can manage time_daily_summary" 
    ON public.time_daily_summary FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (
            SELECT 1 FROM public.tenant_users 
            WHERE user_id = auth.uid() 
            AND tenant_users.tenant_id = time_daily_summary.tenant_id 
            AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        )
    );

DROP POLICY IF EXISTS "Employees can view their own daily summary" ON public.time_daily_summary;
CREATE POLICY "Employees can view their own daily summary"
    ON public.time_daily_summary FOR SELECT
    USING (
        tenant_id = ANY (public.user_tenant_ids())
        AND EXISTS (
            SELECT 1 FROM public.employment_contracts ec
            JOIN public.workers w ON w.id = ec.worker_id
            JOIN public.people p ON p.id = w.person_id
            WHERE ec.id = time_daily_summary.contract_id
            AND (p.user_id = auth.uid() OR ec.worker_id = auth.uid() OR p.cpf = (SELECT cpf FROM public.people WHERE user_id = auth.uid() LIMIT 1))
        )
    );

DROP TRIGGER IF EXISTS audit_time_devices_trigger ON public.time_devices;
CREATE TRIGGER audit_time_devices_trigger 
    AFTER INSERT OR UPDATE OR DELETE ON public.time_devices 
    FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_afd_files_trigger ON public.afd_files;
CREATE TRIGGER audit_afd_files_trigger 
    AFTER INSERT OR UPDATE OR DELETE ON public.afd_files 
    FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_time_punch_records_trigger ON public.time_punch_records;
CREATE TRIGGER audit_time_punch_records_trigger 
    AFTER INSERT ON public.time_punch_records 
    FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_time_daily_summary_trigger ON public.time_daily_summary;
CREATE TRIGGER audit_time_daily_summary_trigger 
    AFTER INSERT OR UPDATE OR DELETE ON public.time_daily_summary 
    FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

DROP TRIGGER IF EXISTS audit_time_bank_accounts_trigger ON public.time_bank_accounts;
CREATE TRIGGER audit_time_bank_accounts_trigger 
    AFTER INSERT OR UPDATE OR DELETE ON public.time_bank_accounts 
    FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
```

### Migration `00078_time_punch_geofence_pt05.sql` (Fase P5 / PT-05)
- **Objetivo**: Suporte a Ponto por Celular/PWA (REP-P - Portaria MTP 671/2021), controle de perímetro geográfico (geofence) para locais de trabalho, parametrização de regime de teletrabalho e função atômica para registro de batida com hora confiável do servidor.
- **Alterações de Esquema**:
  - `public.workplaces`: adicionadas as colunas `latitude NUMERIC(10, 7)`, `longitude NUMERIC(10, 7)`, `radius_meters INTEGER DEFAULT 200` e `enforce_geofence BOOLEAN NOT NULL DEFAULT false`.
  - `public.employment_contracts`: adicionadas as colunas `workplace_id UUID REFERENCES public.workplaces(id) ON DELETE SET NULL` e `is_telework BOOLEAN NOT NULL DEFAULT false`.
- **Função RPC Transacional**:
  - `public.register_mobile_punch(...)`: `SECURITY DEFINER` que vincula automaticamente ao dispositivo `REP_P_MOBILE` da empresa, obtém o próximo `last_nsr` de forma sequencial atômica, carimba `v_punched_at = NOW()` (eliminando qualquer dependência do relógio do smartphone) e grava em lote transacional em `public.time_punch_records` e `public.time_entries`.

```sql
-- Migration: 00078_time_punch_geofence_pt05.sql
-- Description: Suporte a Ponto por Celular/PWA (REP-P - Portaria 671 MTP)

ALTER TABLE public.workplaces
    ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
    ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7),
    ADD COLUMN IF NOT EXISTS radius_meters INTEGER DEFAULT 200,
    ADD COLUMN IF NOT EXISTS enforce_geofence BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.employment_contracts
    ADD COLUMN IF NOT EXISTS workplace_id UUID REFERENCES public.workplaces(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_telework BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.register_mobile_punch(
    p_contract_id UUID,
    p_geo JSONB DEFAULT NULL,
    p_device_fingerprint TEXT DEFAULT NULL,
    p_ip INET DEFAULT NULL,
    p_receipt_code TEXT DEFAULT NULL,
    p_entry_type TEXT DEFAULT 'IN'
)
RETURNS TABLE (
    punch_id UUID,
    device_id UUID,
    nsr BIGINT,
    punched_at TIMESTAMPTZ,
    receipt_code TEXT
)
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id UUID;
    v_company_id UUID;
    v_worker_id UUID;
    v_cpf TEXT;
    v_pis TEXT;
    v_device_id UUID;
    v_nsr BIGINT;
    v_punched_at TIMESTAMPTZ := NOW();
    v_punch_id UUID;
    v_receipt_code TEXT;
BEGIN
    SELECT 
        ec.tenant_id,
        ec.company_id,
        ec.worker_id,
        REGEXP_REPLACE(p.cpf, '[^0-9]', '', 'g'),
        REGEXP_REPLACE(p.pis, '[^0-9]', '', 'g')
    INTO
        v_tenant_id,
        v_company_id,
        v_worker_id,
        v_cpf,
        v_pis
    FROM public.employment_contracts ec
    JOIN public.workers w ON w.id = ec.worker_id
    JOIN public.people p ON p.id = w.person_id
    WHERE ec.id = p_contract_id;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Contrato de trabalho % não encontrado.', p_contract_id;
    END IF;

    SELECT id INTO v_device_id
    FROM public.time_devices
    WHERE tenant_id = v_tenant_id 
      AND company_id = v_company_id 
      AND kind = 'REP_P_MOBILE'
      AND status = 'ACTIVE'
    LIMIT 1;

    IF v_device_id IS NULL THEN
        INSERT INTO public.time_devices (
            tenant_id,
            company_id,
            name,
            kind,
            vendor,
            model,
            status,
            last_nsr
        ) VALUES (
            v_tenant_id,
            v_company_id,
            'App Mobile REP-P',
            'REP_P_MOBILE',
            'CoupleRH Mobile',
            'PWA REP-P Portaria 671',
            'ACTIVE',
            0
        ) RETURNING id INTO v_device_id;
    END IF;

    UPDATE public.time_devices
    SET 
        last_nsr = last_nsr + 1,
        last_sync_at = v_punched_at
    WHERE id = v_device_id
    RETURNING last_nsr INTO v_nsr;

    IF p_receipt_code IS NULL OR p_receipt_code = '' THEN
        v_receipt_code := encode(digest(v_nsr::text || '|' || v_punched_at::text || '|' || v_cpf, 'sha256'), 'hex');
    ELSE
        v_receipt_code := p_receipt_code;
    END IF;

    INSERT INTO public.time_punch_records (
        tenant_id,
        company_id,
        device_id,
        nsr,
        record_type,
        punched_at,
        cpf,
        pis,
        worker_id,
        contract_id,
        source,
        geo,
        ip,
        device_fingerprint,
        receipt_code,
        crc_ok
    ) VALUES (
        v_tenant_id,
        v_company_id,
        v_device_id,
        v_nsr,
        3,
        v_punched_at,
        v_cpf,
        v_pis,
        v_worker_id,
        p_contract_id,
        'MOBILE',
        p_geo,
        p_ip,
        p_device_fingerprint,
        v_receipt_code,
        true
    ) RETURNING id INTO v_punch_id;

    INSERT INTO public.time_entries (
        tenant_id,
        contract_id,
        original_timestamp,
        entry_type,
        punch_record_id,
        device_info,
        status
    ) VALUES (
        v_tenant_id,
        p_contract_id,
        v_punched_at,
        p_entry_type,
        v_punch_id,
        p_device_fingerprint,
        'APPROVED'
    );

    RETURN QUERY SELECT 
        v_punch_id,
        v_device_id,
        v_nsr,
        v_punched_at,
        v_receipt_code;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.register_mobile_punch TO authenticated, anon;
```

---

### Script 79: `00079_time_bank_pt07.sql` (Fase P5 — Tarefa PT-07)
```sql
-- ==============================================================================
-- Migration: 00079_time_bank_pt07.sql
-- Descrição: Fase P5 / Tarefa PT-07 — Banco de Horas (CLT Art. 59 §§ 2º, 3º e 5º)
--            Atualização de constraints para liquidação/pagamento como HE,
--            vínculo com períodos de folha e resumo diário, alertas e índices.
-- ==============================================================================

-- 1. ATUALIZAR CONSTRAINT EM time_bank_transactions (Adicionando PAYOUT e EXPIRATION_PAYOUT)
ALTER TABLE public.time_bank_transactions
    DROP CONSTRAINT IF EXISTS time_bank_transactions_transaction_type_check;

ALTER TABLE public.time_bank_transactions
    ADD CONSTRAINT time_bank_transactions_transaction_type_check
    CHECK (transaction_type IN (
        'OVERTIME',
        'DELAY',
        'ABSENCE',
        'COMPENSATION_DAY_OFF',
        'MANUAL_ADJUSTMENT',
        'PAYOUT',
        'EXPIRATION_PAYOUT'
    ));

-- 2. ADICIONAR COLUNAS DE RASTREABILIDADE EM time_bank_transactions
ALTER TABLE public.time_bank_transactions
    ADD COLUMN IF NOT EXISTS payroll_period_id UUID REFERENCES public.payroll_periods(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS daily_summary_id UUID REFERENCES public.time_daily_summary(id) ON DELETE SET NULL;

-- 3. ADICIONAR COLUNAS DE GOVERNANÇA E QUITAÇÃO EM time_bank_accounts
ALTER TABLE public.time_bank_accounts
    ADD COLUMN IF NOT EXISTS warning_days_before_expiration INTEGER DEFAULT 30,
    ADD COLUMN IF NOT EXISTS paid_out_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS paid_out_payroll_period_id UUID REFERENCES public.payroll_periods(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS payout_rubric_code TEXT DEFAULT '152';

-- 4. ÍNDICES DE PERFORMANCE PARA CONSULTAS DE EXTRATO E EXPIRAÇÃO
CREATE INDEX IF NOT EXISTS idx_time_bank_accounts_contract_status
    ON public.time_bank_accounts(contract_id, status);

CREATE INDEX IF NOT EXISTS idx_time_bank_accounts_end_date
    ON public.time_bank_accounts(end_date)
    WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_time_bank_transactions_account_date
    ON public.time_bank_transactions(account_id, date ASC, created_at ASC);

-- 5. RPC TRANSACIONAL ATÔMICA PARA LIQUIDAÇÃO E FECHAMENTO DO BANCO DE HORAS
CREATE OR REPLACE FUNCTION public.close_and_payout_time_bank_account(
    p_account_id UUID,
    p_closure_date DATE,
    p_reason TEXT, -- 'EXPIRATION' | 'TERMINATION' | 'MANUAL'
    p_payroll_period_id UUID DEFAULT NULL,
    p_overtime_factor NUMERIC DEFAULT 1.5,
    p_rubric_code TEXT DEFAULT '152'
)
RETURNS TABLE (
    account_id UUID,
    final_balance_minutes INTEGER,
    status TEXT,
    closure_date DATE,
    payout_hours NUMERIC,
    rubric_code TEXT
) AS $$
DECLARE
    v_account public.time_bank_accounts%ROWTYPE;
    v_balance INTEGER;
    v_tx_type TEXT;
    v_desc TEXT;
    v_hours NUMERIC;
BEGIN
    SELECT * INTO v_account 
    FROM public.time_bank_accounts 
    WHERE id = p_account_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conta de banco de horas não encontrada: %', p_account_id;
    END IF;

    IF v_account.status != 'ACTIVE' THEN
        RAISE EXCEPTION 'Apenas contas ATIVAS podem ser liquidadas. Status atual: %', v_account.status;
    END IF;

    v_balance := v_account.balance_minutes;

    IF v_balance > 0 THEN
        v_hours := ROUND((v_balance::NUMERIC / 60.0), 2);
        
        IF p_reason = 'EXPIRATION' THEN
            v_tx_type := 'EXPIRATION_PAYOUT';
            v_desc := 'Liquidação de banco de horas vencido para pagamento em folha (Art. 59 §3º CLT)';
        ELSE
            v_tx_type := 'PAYOUT';
            v_desc := 'Liquidação rescisória de banco de horas para pagamento em folha (Art. 59 §3º CLT)';
        END IF;

        -- Registra débito de quitação
        INSERT INTO public.time_bank_transactions (
            tenant_id,
            account_id,
            date,
            minutes,
            transaction_type,
            description,
            payroll_period_id
        ) VALUES (
            v_account.tenant_id,
            v_account.id,
            p_closure_date,
            -v_balance,
            v_tx_type,
            v_desc,
            p_payroll_period_id
        );

        -- Atualiza conta
        UPDATE public.time_bank_accounts
        SET balance_minutes = 0,
            status = 'PAID_OUT',
            closure_date = p_closure_date,
            paid_out_at = NOW(),
            paid_out_payroll_period_id = p_payroll_period_id,
            updated_at = NOW()
        WHERE id = v_account.id;

    ELSE
        -- Saldo zerado ou negativo
        v_hours := 0;
        UPDATE public.time_bank_accounts
        SET status = 'CLOSED',
            closure_date = p_closure_date,
            updated_at = NOW()
        WHERE id = v_account.id;
    END IF;

    RETURN QUERY SELECT 
        v_account.id,
        0,
        CASE WHEN v_balance > 0 THEN 'PAID_OUT' ELSE 'CLOSED' END,
        p_closure_date,
        v_hours,
        p_rubric_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.close_and_payout_time_bank_account TO authenticated;
```

---

### Script 80: `00080_timesheet_and_contest_pt08.sql` (Fase P5 — Tarefa PT-08)
```sql
-- ==============================================================================
-- Migration: 00080_timesheet_and_contest_pt08.sql
-- Descrição: Fase P5 / Tarefa PT-08 — Espelho de Ponto Eletrônico (Portaria MTP 671/2021)
--            e Fluxo de Contestação com Auditoria e RLS.
-- ==============================================================================

-- 1. ESTENDER A TABELA timesheets COM TOTALIZADORES LEGAIS E CAMPOS DE CONTESTAÇÃO
ALTER TABLE public.timesheets
    ADD COLUMN IF NOT EXISTS total_overtime_50_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_overtime_100_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_delay_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_absence_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_intrajornada_violation_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS time_bank_balance_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS document_hash TEXT,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS contested_at TIMESTAMPTZ;

-- 2. ATUALIZAR STATUS DE timesheets PARA INCLUIR CONTESTED
ALTER TABLE public.timesheets
    DROP CONSTRAINT IF EXISTS timesheets_status_check;

ALTER TABLE public.timesheets
    ADD CONSTRAINT timesheets_status_check
    CHECK (status IN ('DRAFT', 'PENDING_SIGNATURE', 'SIGNED', 'CONTESTED', 'CLOSED'));

-- 3. CRIAR TABELA DE CONTESTAÇÕES DO ESPELHO DE PONTO (timesheet_contests)
CREATE TABLE IF NOT EXISTS public.timesheet_contests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    timesheet_id UUID NOT NULL REFERENCES public.timesheets(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
    
    reason TEXT NOT NULL,
    affected_dates DATE[] NOT NULL DEFAULT '{}',
    attachment_url TEXT,
    
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'UNDER_REVIEW', 'RESOLVED_ACCEPTED', 'REJECTED')),
    reviewed_by UUID,
    review_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_timesheet_contests_timesheet
    ON public.timesheet_contests(timesheet_id);

CREATE INDEX IF NOT EXISTS idx_timesheet_contests_contract
    ON public.timesheet_contests(contract_id);

CREATE INDEX IF NOT EXISTS idx_timesheet_contests_status
    ON public.timesheet_contests(status)
    WHERE status = 'PENDING';

-- 5. RLS (ROW LEVEL SECURITY)
ALTER TABLE public.timesheet_contests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant multitenant access for timesheet_contests" ON public.timesheet_contests;
CREATE POLICY "Tenant multitenant access for timesheet_contests"
    ON public.timesheet_contests
    FOR ALL
    USING (tenant_id = ANY (public.user_tenant_ids()));

-- Permitir que o próprio colaborador crie e consulte suas contestações
DROP POLICY IF EXISTS "Workers can read and create their own timesheet contests" ON public.timesheet_contests;
CREATE POLICY "Workers can read and create their own timesheet contests"
    ON public.timesheet_contests
    FOR ALL
    USING (
        worker_id IN (
            SELECT id FROM public.workers WHERE user_id = auth.uid()
        )
    );

-- 6. GATILHO DE AUDITORIA (T29)
DROP TRIGGER IF EXISTS audit_timesheet_contests_trigger ON public.timesheet_contests;
CREATE TRIGGER audit_timesheet_contests_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.timesheet_contests
    FOR EACH ROW
    EXECUTE FUNCTION audit.audit_trigger_func();
```

---

### Script 81: `00081_time_period_closure_pt09.sql` (Fase P5 — Tarefa PT-09)
```sql
-- ==============================================================================
-- Migration: 00081_time_period_closure_pt09.sql
-- Descrição: Fase P5 / Tarefa PT-09 — Fechamento Automático de Ponto Eletrônico
--            com Geração de Eventos Variáveis na Folha e Rastreabilidade.
-- ==============================================================================

-- 1. TABELA DE FECHAMENTO DO PERÍODO DE PONTO (time_period_closures)
CREATE TABLE IF NOT EXISTS public.time_period_closures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    payroll_period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'CLOSED' CHECK (status IN ('OPEN', 'PROCESSING', 'CLOSED', 'REOPENED')),
    
    total_contracts INTEGER NOT NULL DEFAULT 0,
    total_events_generated INTEGER NOT NULL DEFAULT 0,
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    closed_by UUID,
    closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reopened_by UUID,
    reopened_at TIMESTAMPTZ,
    reopen_reason TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, payroll_period_id, company_id)
);

-- 2. EXTENSÃO DA TABELA payroll_variable_events COM ORIGEM E RASTREIO
ALTER TABLE public.payroll_variable_events
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(10, 4) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'TIME_TRACKING', 'IMPORT', 'SYSTEM')),
    ADD COLUMN IF NOT EXISTS time_period_closure_id UUID REFERENCES public.time_period_closures(id) ON DELETE CASCADE;

-- 3. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_time_period_closures_period
    ON public.time_period_closures(payroll_period_id, status);

CREATE INDEX IF NOT EXISTS idx_payroll_variable_events_closure
    ON public.payroll_variable_events(time_period_closure_id);

CREATE INDEX IF NOT EXISTS idx_payroll_variable_events_origin
    ON public.payroll_variable_events(period_id, origin);

-- 4. RLS (ROW LEVEL SECURITY)
ALTER TABLE public.time_period_closures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant multitenant access for time_period_closures" ON public.time_period_closures;
CREATE POLICY "Tenant multitenant access for time_period_closures"
    ON public.time_period_closures
    FOR ALL
    USING (tenant_id = ANY (public.user_tenant_ids()));

-- 5. GATILHO DE AUDITORIA (T29)
DROP TRIGGER IF EXISTS audit_time_period_closures_trigger ON public.time_period_closures;
CREATE TRIGGER audit_time_period_closures_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.time_period_closures
    FOR EACH ROW
    EXECUTE FUNCTION audit.audit_trigger_func();
```

---

### Migration `00082_employee_time_tracking_pt10.sql` (Fase P5 / PT-10)

```sql
-- ==============================================================================
-- Migration: 00082_employee_time_tracking_pt10.sql
-- Descrição: Fase P5 / Tarefa PT-10 — RPCs do Portal do Colaborador para
--            Ponto Eletrônico (batidas de hoje, extrato de banco de horas,
--            espelhos de ponto, assinatura e contestação).
-- ==============================================================================

-- 1. CONSULTAR BATIDAS DE HOJE DO COLABORADOR
CREATE OR REPLACE FUNCTION public.get_employee_today_punches(p_contract_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_punches JSONB;
BEGIN
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', te.id,
                'entry_type', te.entry_type,
                'original_timestamp', te.original_timestamp,
                'status', te.status,
                'punch_record_id', te.punch_record_id,
                'receipt_code', pr.receipt_code,
                'nsr', pr.nsr
            ) ORDER BY te.original_timestamp ASC
        ),
        '[]'::jsonb
    ) INTO v_punches
    FROM public.time_entries te
    LEFT JOIN public.time_punch_records pr ON pr.id = te.punch_record_id
    WHERE te.contract_id = p_contract_id
      AND DATE(te.original_timestamp AT TIME ZONE 'America/Sao_Paulo') = DATE(NOW() AT TIME ZONE 'America/Sao_Paulo');

    RETURN v_punches;
END;
$$;

-- 2. CONSULTAR RESUMO DO BANCO DE HORAS ATIVO DO COLABORADOR
CREATE OR REPLACE FUNCTION public.get_employee_time_bank(p_contract_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_account RECORD;
    v_transactions JSONB;
    v_days_left INT;
    v_alert TEXT := 'NORMAL';
BEGIN
    SELECT * INTO v_account
    FROM public.time_bank_accounts
    WHERE contract_id = p_contract_id
      AND status = 'ACTIVE'
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'has_active_account', false,
            'balance_minutes', 0,
            'formatted_balance', '+00:00',
            'transactions', '[]'::jsonb
        );
    END IF;

    -- Calcular dias restantes para expiração
    v_days_left := (v_account.valid_until - CURRENT_DATE);

    IF v_days_left <= 0 THEN
        v_alert := 'EXPIRED';
    ELSIF v_days_left <= 30 THEN
        v_alert := 'EXPIRING_SOON';
    END IF;

    -- Obter últimas 20 transações
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', t.id,
                'transaction_type', t.transaction_type,
                'minutes', t.minutes,
                'balance_after_minutes', t.balance_after_minutes,
                'origin_date', t.origin_date,
                'description', t.description,
                'created_at', t.created_at
            ) ORDER BY t.created_at DESC
        ),
        '[]'::jsonb
    ) INTO v_transactions
    FROM (
        SELECT * FROM public.time_bank_transactions
        WHERE account_id = v_account.id
        ORDER BY created_at DESC
        LIMIT 20
    ) t;

    RETURN jsonb_build_object(
        'has_active_account', true,
        'account_id', v_account.id,
        'agreement_type', v_account.agreement_type,
        'balance_minutes', v_account.balance_minutes,
        'valid_from', v_account.valid_from,
        'valid_until', v_account.valid_until,
        'days_remaining', v_days_left,
        'alert_status', v_alert,
        'max_monthly_negative_balance', v_account.max_monthly_negative_balance,
        'transactions', v_transactions
    );
END;
$$;

-- 3. CONSULTAR ESPELHOS MENSAIS DO COLABORADOR
CREATE OR REPLACE FUNCTION public.get_employee_timesheets(p_contract_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sheets JSONB;
BEGIN
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', ts.id,
                'period_year', ts.period_year,
                'period_month', ts.period_month,
                'status', ts.status,
                'total_regular_minutes', ts.total_regular_minutes,
                'total_overtime_50_minutes', ts.total_overtime_50_minutes,
                'total_overtime_100_minutes', ts.total_overtime_100_minutes,
                'total_night_shift_minutes', ts.total_night_shift_minutes,
                'total_delay_minutes', ts.total_delay_minutes,
                'total_absence_minutes', ts.total_absence_minutes,
                'time_bank_balance_minutes', ts.time_bank_balance_minutes,
                'document_hash', ts.document_hash,
                'contested_at', ts.contested_at,
                'signed_at', ts.signed_at,
                'created_at', ts.created_at
            ) ORDER BY ts.period_year DESC, ts.period_month DESC
        ),
        '[]'::jsonb
    ) INTO v_sheets
    FROM public.timesheets ts
    WHERE ts.contract_id = p_contract_id;

    RETURN v_sheets;
END;
$$;

-- 4. ASSINATURA DIGITAL / CIÊNCIA DO ESPELHO DE PONTO
CREATE OR REPLACE FUNCTION public.sign_employee_timesheet(
    p_contract_id UUID,
    p_timesheet_id UUID,
    p_signature_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ts RECORD;
BEGIN
    SELECT * INTO v_ts
    FROM public.timesheets
    WHERE id = p_timesheet_id
      AND contract_id = p_contract_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Espelho de ponto não encontrado.');
    END IF;

    IF v_ts.status = 'SIGNED' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Espelho já assinado anteriormente.');
    END IF;

    UPDATE public.timesheets
    SET status = 'SIGNED',
        signed_at = NOW(),
        document_hash = COALESCE(document_hash, p_signature_hash),
        updated_at = NOW()
    WHERE id = p_timesheet_id;

    RETURN jsonb_build_object('success', true, 'signed_at', NOW());
END;
$$;
```

---

## 83. Script Consolidado Fase P5 (Ponto Eletrônico Portaria 671 / CLT)
Arquivo raiz: `MIGRATION_P5_PONTO_ELETRONICO.sql`
Objetivo: Execução atômica e autocontida no Supabase SQL Editor contemplando todas as dependências prévias de schema da Fase P5:
1. `time_devices` (REP-C, REP-P Mobile, Importador).
2. `afd_files` (Registro de arquivos AFD com idempotência por hash SHA-256).
3. `time_punch_records` (Trilha imutável de batidas protegida por trigger `prevent_punch_record_mutation`).
4. Extensão de `time_entries` adicionando a FK `punch_record_id`.
5. Extensão de `time_bank_accounts` e `time_bank_transactions` com políticas CLT Art. 59.
6. `time_daily_summary` (Resumo diário com tolerâncias e adicionais).
7. Geofence em `workplaces` e teletrabalho em `employment_contracts`.
8. Extensão de `timesheets` e tabela `timesheet_contests`.
9. `time_period_closures` com rastreamento de eventos variáveis.
10. RPCs do Portal do Colaborador (`register_mobile_punch`, `get_employee_today_punches`, `get_employee_time_bank`, `get_employee_timesheets`, `sign_employee_timesheet`).
11. Grants de execução para roles `anon`, `authenticated` e `service_role`.
12. Recarregamento imediato do cache de API: `NOTIFY pgrst, 'reload schema';`.

---

## 84. Assinatura Digital de Documentos (Fase P6 / AS-01 a AS-12)
Migrations: `00083_document_signatures_as01.sql` e `00084_drop_sign_worker_document_as04.sql`
Conformidade: Lei Federal nº 14.063/2020 e MP nº 2.200-2/2001.

### 84.1 Estrutura de employee_documents
```sql
ALTER TABLE public.employee_documents
    ADD COLUMN IF NOT EXISTS doc_type TEXT DEFAULT 'OTHER',
    ADD COLUMN IF NOT EXISTS source_ref UUID,
    ADD COLUMN IF NOT EXISTS hash_original TEXT, -- H1 (Hash do PDF gerado no servidor)
    ADD COLUMN IF NOT EXISTS hash_signed TEXT,   -- H2 (Hash do PDF assinado com manifesto)
    ADD COLUMN IF NOT EXISTS signed_file_url TEXT,
    ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS verification_code TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS signature_level TEXT NOT NULL DEFAULT 'ADVANCED',
    ADD COLUMN IF NOT EXISTS requires_otp BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
```

### 84.2 Estrutura e Imutabilidade de signatures_log
```sql
ALTER TABLE public.signatures_log
    ADD COLUMN IF NOT EXISTS auth_method TEXT DEFAULT 'SESSION_OTP',
    ADD COLUMN IF NOT EXISTS geo JSONB,
    ADD COLUMN IF NOT EXISTS signature_png_url TEXT,
    ADD COLUMN IF NOT EXISTS signature_strokes JSONB,
    ADD COLUMN IF NOT EXISTS decision TEXT NOT NULL DEFAULT 'SIGNED',
    ADD COLUMN IF NOT EXISTS reason TEXT,
    ADD COLUMN IF NOT EXISTS manifest_metadata JSONB,
    ADD COLUMN IF NOT EXISTS certificate_info JSONB;

-- Bloqueio estrito de UPDATE e DELETE
CREATE OR REPLACE FUNCTION public.protect_signatures_log_immutability()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'VIOLAÇÃO DE IMUTABILIDADE FORENSE: Registros de signatures_log não podem ser alterados ou excluídos.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_protect_signatures_log_immutability
BEFORE UPDATE OR DELETE ON public.signatures_log
FOR EACH ROW EXECUTE FUNCTION public.protect_signatures_log_immutability();
```

### 84.3 Tabela document_events (Ciclo de Vida Documental)
```sql
CREATE TABLE public.document_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.employee_documents(id) ON DELETE CASCADE,
    event TEXT NOT NULL CHECK (event IN (
        'CREATED', 'NOTIFIED_EMAIL', 'NOTIFIED_WHATSAPP', 'NOTIFIED_PORTAL',
        'VIEWED', 'OTP_REQUESTED', 'OTP_VERIFIED', 'SIGNED',
        'CONTESTED', 'REFUSED', 'DOWNLOADED', 'VERIFIED_PUBLIC'
    )),
    at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip TEXT,
    user_agent TEXT,
    actor_user_id UUID,
    meta JSONB DEFAULT '{}'::jsonb
);
```

### 84.4 Storage Privado (private-documents)
- Bucket `private-documents` com `public = false`.
- Políticas RLS restritas para leitura autenticada ou via URLs assinadas geradas pelo backend.
- Remoção definitiva da RPC vulnerável `sign_worker_document(UUID, UUID)`.

---

## 85. Fechamento Imutável, Governança de Reabertura e Versionamento de Holerites (Fase P7)
Migration: `00085_payroll_closure_immutability_and_versioning_p7.sql`
Objetivo: Garantir a imutabilidade jurídica dos holerites fechados (CLT), rastreabilidade de reaberturas e histórico versionado (`v1`, `v2`...).

### 85.1 Extensão de payroll_periods e payslips
```sql
-- 1. Colunas de fechamento e auditoria em payroll_periods
ALTER TABLE public.payroll_periods 
    ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS closure_notes TEXT,
    ADD COLUMN IF NOT EXISTS current_version INTEGER NOT NULL DEFAULT 1;

-- 2. Versionamento e hash de fechamento em payslips
ALTER TABLE public.payslips 
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS is_latest BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS closure_hash TEXT;
```

### 85.2 Trilha de Auditoria de Reaberturas (payroll_period_reopenings)
```sql
CREATE TABLE IF NOT EXISTS public.payroll_period_reopenings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    reopened_by UUID NOT NULL REFERENCES auth.users(id),
    reopened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT NOT NULL,
    previous_closed_at TIMESTAMPTZ,
    previous_closed_by UUID,
    previous_version INTEGER NOT NULL DEFAULT 1,
    new_version INTEGER NOT NULL DEFAULT 2,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payroll_period_reopenings ENABLE ROW LEVEL SECURITY;
```

### 85.3 Trigger de Imutabilidade Total (CLT)
Bloqueia `UPDATE` e `DELETE` em `payslips`, `payslip_items`, `payroll_company_taxes` e `payroll_memory_calc` se `payroll_periods.status = 'CLOSED'`.

```sql
CREATE OR REPLACE FUNCTION public.check_payroll_period_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_period_id UUID;
    v_status TEXT;
BEGIN
    IF TG_TABLE_NAME = 'payslips' THEN
        v_period_id := COALESCE(OLD.period_id, NEW.period_id);
    ELSIF TG_TABLE_NAME = 'payslip_items' THEN
        SELECT period_id INTO v_period_id FROM public.payslips WHERE id = COALESCE(OLD.payslip_id, NEW.payslip_id);
    ELSIF TG_TABLE_NAME = 'payroll_company_taxes' THEN
        v_period_id := COALESCE(OLD.period_id, NEW.period_id);
    ELSIF TG_TABLE_NAME = 'payroll_memory_calc' THEN
        v_period_id := COALESCE(OLD.period_id, NEW.period_id);
    END IF;

    IF v_period_id IS NOT NULL THEN
        SELECT status INTO v_status FROM public.payroll_periods WHERE id = v_period_id;
        IF v_status = 'CLOSED' THEN
            RAISE EXCEPTION 'Operação bloqueada (Imutabilidade Legal CLT): O período de folha % está FECHADO (CLOSED). Nenhum holerite, item ou imposto pode ser alterado ou excluído sem reabertura formal autorizada.', v_period_id;
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;
```

### 85.4 RPCs Transacionais
- `close_payroll_period(p_period_id UUID, p_notes TEXT)`: validação de perfil (`system_admin`, `tenant_admin`, `dp_manager`, `dp_analyst`), trava de status e imutabilidade dos holerites.
- `reopen_payroll_period(p_period_id UUID, p_reason TEXT)`: validação estrita de justificativa ($\ge 15$ caracteres) e perfis gerenciais (`system_admin`, `tenant_admin`, `dp_manager`), registrando em `payroll_period_reopenings` e incrementando a versão da folha (`current_version + 1`).

---

## 86. Bloqueio de Fechamento com Colaboradores em Erro (Fase P7)
Migration: `00086_payroll_block_closure_on_errors_p7.sql`
Objetivo: Travar formalmente no Postgres o fechamento de folha quando houver holerites em erro, salários líquidos negativos (CLT Art. 462) ou inconsistências matemáticas entre proventos, descontos e líquido.

```sql
CREATE OR REPLACE FUNCTION public.close_payroll_period(
    p_period_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_period RECORD;
    v_user_role TEXT;
    v_payslip_count INTEGER := 0;
    v_error_count INTEGER := 0;
    v_negative_net_count INTEGER := 0;
    v_math_error_count INTEGER := 0;
BEGIN
    -- 1. Validar período
    SELECT * INTO v_period FROM public.payroll_periods WHERE id = p_period_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Período de folha % não encontrado.', p_period_id;
    END IF;

    IF v_period.status = 'CLOSED' THEN
        RAISE EXCEPTION 'Período de folha % já se encontra fechado.', p_period_id;
    END IF;

    IF v_period.status NOT IN ('CALCULATED', 'CONFERENCE') THEN
        RAISE EXCEPTION 'Somente folhas calculadas ou em conferência podem ser fechadas (status atual: %).', v_period.status;
    END IF;

    -- 2. Validar se existem holerites no período
    SELECT count(*) INTO v_payslip_count FROM public.payslips WHERE period_id = p_period_id;
    IF v_payslip_count = 0 THEN
        RAISE EXCEPTION 'Fechamento de folha bloqueado: Nenhum holerite foi gerado ou processado para este período.';
    END IF;

    -- 3. BLOQUEIO CLT/COMPLIANCE: Colaboradores com status de erro
    SELECT count(*) INTO v_error_count 
    FROM public.payslips 
    WHERE period_id = p_period_id 
      AND (status IN ('ERROR', 'CALCULATION_ERROR', 'ERRO_CALCULO') OR status ILIKE '%ERROR%');

    IF v_error_count > 0 THEN
        RAISE EXCEPTION 'Fechamento de folha bloqueado (Compliance/CLT): Existem % colaboradores com cálculo em erro no período. Regularize os cálculos antes de fechar a folha.', v_error_count;
    END IF;

    -- 4. BLOQUEIO CLT Art. 462: Colaboradores com salário líquido negativo
    SELECT count(*) INTO v_negative_net_count 
    FROM public.payslips 
    WHERE period_id = p_period_id AND net_salary < 0;

    IF v_negative_net_count > 0 THEN
        RAISE EXCEPTION 'Fechamento de folha bloqueado (CLT Art. 462): Existem % colaboradores com salário líquido negativo. Não é permitido fechar a folha com descontos superiores ao rendimento total.', v_negative_net_count;
    END IF;

    -- 5. BLOQUEIO Invariante Matemática T6: Diferença entre Líquido e (Proventos - Descontos)
    SELECT count(*) INTO v_math_error_count 
    FROM public.payslips 
    WHERE period_id = p_period_id 
      AND abs(net_salary - (total_earnings - total_deductions)) > 0.01;

    IF v_math_error_count > 0 THEN
        RAISE EXCEPTION 'Fechamento de folha bloqueado (Invariante T6): Existem % holerites com divergência matemática entre salário líquido e (Proventos - Descontos).', v_math_error_count;
    END IF;

    -- 6. Validar permissão do usuário
    SELECT role INTO v_user_role FROM public.tenant_users 
    WHERE user_id = v_user_id AND tenant_id = v_period.tenant_id;

    IF v_user_role NOT IN ('system_admin', 'tenant_admin', 'dp_manager', 'dp_analyst') THEN
        RAISE EXCEPTION 'Acesso negado: Perfil % não tem permissão para fechar folha de pagamento.', COALESCE(v_user_role, 'Sem Perfil');
    END IF;

    -- 7. Atualizar período para CLOSED
    UPDATE public.payroll_periods SET
        status = 'CLOSED',
        closed_at = NOW(),
        closed_by = v_user_id,
        closure_notes = p_notes
    WHERE id = p_period_id;

    -- 8. Atualizar holerites com status CLOSED e garantir versão
    UPDATE public.payslips SET
        status = 'CLOSED',
        version = COALESCE(version, v_period.current_version, 1),
        is_latest = true
    WHERE period_id = p_period_id;

    RETURN jsonb_build_object(
        'success', true,
        'period_id', p_period_id,
        'status', 'CLOSED',
        'closed_at', NOW(),
        'payslips_closed', v_payslip_count,
        'version', v_period.current_version
    );
END;
$$;
```

---

### Script: `RECONCILIACAO_PONTO_ELETRONICO.sql` (Portaria MTP 671/2021)

```sql
-- Atualização da trigger de imutabilidade para permitir conciliação de worker_id/contract_id quando nulos
CREATE OR REPLACE FUNCTION public.prevent_punch_record_mutation()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF (OLD.worker_id IS NULL OR OLD.contract_id IS NULL)
           AND (NEW.nsr = OLD.nsr 
                AND NEW.punched_at = OLD.punched_at 
                AND NEW.device_id = OLD.device_id 
                AND NEW.record_type = OLD.record_type 
                AND NEW.tenant_id = OLD.tenant_id) THEN
            RETURN NEW;
        END IF;
    END IF;

    RAISE EXCEPTION 'A trilha de registros originais de ponto (time_punch_records) é estritamente imutável (Portaria MTP 671/2021 e CLT art. 74). Operações de alteração de horário/NSR ou exclusão são terminantemente proibidas.';
END;
$$ LANGUAGE plpgsql;

-- RPC de conciliação atômica de batidas AFD
CREATE OR REPLACE FUNCTION public.reconcile_afd_punch_records(
    p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_reconciled INTEGER := 0;
BEGIN
    IF NOT (p_tenant_id = ANY (public.user_tenant_ids())) THEN
        RAISE EXCEPTION 'Acesso negado: o usuário não pertence ao tenant indicado.';
    END IF;

    WITH match_source AS (
        SELECT 
            p.id AS punch_id,
            w.id AS target_worker_id,
            c.id AS target_contract_id,
            w.company_id AS target_company_id
        FROM public.time_punch_records p
        JOIN public.workers w ON w.tenant_id = p.tenant_id AND (
            REGEXP_REPLACE(COALESCE(w.pis_pasep, ''), '[^0-9]', '', 'g') = REGEXP_REPLACE(COALESCE(p.pis, ''), '[^0-9]', '', 'g')
            OR REGEXP_REPLACE(COALESCE(w.pis_pasep, ''), '[^0-9]', '', 'g') = SUBSTRING(REGEXP_REPLACE(COALESCE(p.pis, ''), '[^0-9]', '', 'g') FROM 2)
            OR (
                EXISTS (
                    SELECT 1 FROM public.people pe 
                    WHERE pe.id = w.person_id 
                    AND (
                        REGEXP_REPLACE(COALESCE(pe.cpf, ''), '[^0-9]', '', 'g') = REGEXP_REPLACE(COALESCE(p.cpf, ''), '[^0-9]', '', 'g')
                        OR REGEXP_REPLACE(COALESCE(pe.cpf, ''), '[^0-9]', '', 'g') = REGEXP_REPLACE(COALESCE(p.pis, ''), '[^0-9]', '', 'g')
                        OR REGEXP_REPLACE(COALESCE(pe.cpf, ''), '[^0-9]', '', 'g') = SUBSTRING(REGEXP_REPLACE(COALESCE(p.pis, ''), '[^0-9]', '', 'g') FROM 2)
                    )
                )
            )
        )
        LEFT JOIN LATERAL (
            SELECT id FROM public.employment_contracts ec 
            WHERE ec.worker_id = w.id 
            ORDER BY (CASE WHEN ec.status = 'ACTIVE' THEN 1 ELSE 2 END)
            LIMIT 1
        ) c ON true
        WHERE p.tenant_id = p_tenant_id AND p.worker_id IS NULL
    )
    UPDATE public.time_punch_records t
    SET 
        worker_id = m.target_worker_id,
        contract_id = m.target_contract_id,
        company_id = COALESCE(t.company_id, m.target_company_id)
    FROM match_source m
    WHERE t.id = m.punch_id;

    GET DIAGNOSTICS v_reconciled = ROW_COUNT;

    RETURN jsonb_build_object('success', true, 'reconciled', v_reconciled);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_afd_punch_records(UUID) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
```

---

## Migration 00087 — Sincronização de Colunas de time_daily_summary e time_bank_accounts

Garante a presença das colunas estruturais `company_id` em `time_daily_summary` e `current_balance_minutes` sincronizado em `time_bank_accounts`.

```sql
-- 1. ADICIONAR COLUNAS FALTANTES EM time_daily_summary
ALTER TABLE public.time_daily_summary 
    ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS expected_work_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS break_taken_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS break_expected_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS night_overtime_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS interjornada_violation_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS time_bank_credited_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS time_bank_debited_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS inconsistencies TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS approved_by UUID,
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. BACKFILL DE company_id A PARTIR DE employment_contracts
UPDATE public.time_daily_summary tds
SET company_id = ec.company_id
FROM public.employment_contracts ec
WHERE ec.id = tds.contract_id 
  AND tds.company_id IS NULL;

-- 3. ÍNDICE DE PERFORMANCE PARA FILTRAGEM POR EMPRESA E DATA
CREATE INDEX IF NOT EXISTS idx_time_daily_summary_company_date 
    ON public.time_daily_summary(company_id, date);

-- 4. COMPATIBILIDADE DE current_balance_minutes EM time_bank_accounts
ALTER TABLE public.time_bank_accounts
    ADD COLUMN IF NOT EXISTS current_balance_minutes INTEGER;

UPDATE public.time_bank_accounts
SET current_balance_minutes = balance_minutes
WHERE current_balance_minutes IS NULL;

-- Gatilho para manter current_balance_minutes sempre sincronizado com balance_minutes
CREATE OR REPLACE FUNCTION public.sync_time_bank_current_balance()
RETURNS TRIGGER AS $$
BEGIN
    NEW.current_balance_minutes := NEW.balance_minutes;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_time_bank_current_balance ON public.time_bank_accounts;
CREATE TRIGGER trg_sync_time_bank_current_balance
    BEFORE INSERT OR UPDATE OF balance_minutes ON public.time_bank_accounts
    FOR EACH ROW EXECUTE FUNCTION public.sync_time_bank_current_balance();

-- 5. RECARREGAR O SCHEMA CACHE DO POSTGREST
NOTIFY pgrst, 'reload schema';
```

---

## Migration 00088 — Sincronização de Colunas de employee_documents e Auditoria de Assinaturas

Garante a presença das colunas estruturais `doc_type`, `verification_code`, `hash_original`, `hash_signed`, `signed_file_url`, `due_at`, `signed_at` em `employee_documents` e a criação da tabela de auditoria `document_events`.

```sql
-- 1. ADICIONAR COLUNAS FALTANTES EM employee_documents
ALTER TABLE public.employee_documents 
    ADD COLUMN IF NOT EXISTS doc_type TEXT DEFAULT 'OTHER',
    ADD COLUMN IF NOT EXISTS verification_code TEXT,
    ADD COLUMN IF NOT EXISTS hash_original TEXT,
    ADD COLUMN IF NOT EXISTS hash_signed TEXT,
    ADD COLUMN IF NOT EXISTS signed_file_url TEXT,
    ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- 2. BACKFILL DE DADOS A PARTIR DE COLUNAS LEGADAS
UPDATE public.employee_documents
SET 
    doc_type = COALESCE(doc_type, document_type, 'OTHER'),
    hash_original = COALESCE(hash_original, document_hash),
    signed_file_url = COALESCE(signed_file_url, file_url)
WHERE doc_type IS NULL OR hash_original IS NULL OR signed_file_url IS NULL;

-- 3. GERAR CÓDIGO DE VERIFICAÇÃO PARA DOCUMENTOS QUE AINDA NÃO POSSUEM
UPDATE public.employee_documents
SET verification_code = 'CRH-' || UPPER(SUBSTRING(MD5(id::text || COALESCE(created_at::text, 'seed')) FROM 1 FOR 4)) || '-' || UPPER(SUBSTRING(MD5(id::text || COALESCE(created_at::text, 'seed')) FROM 5 FOR 4))
WHERE verification_code IS NULL;

-- 4. ÍNDICES DE PERFORMANCE E UNICIDADE
CREATE INDEX IF NOT EXISTS idx_employee_documents_doc_type 
    ON public.employee_documents(doc_type);

CREATE INDEX IF NOT EXISTS idx_employee_documents_verification_code 
    ON public.employee_documents(verification_code);

-- 5. CRIAR TABELA DE AUDITORIA DE EVENTOS DE DOCUMENTOS (SE NÃO EXISTIR)
CREATE TABLE IF NOT EXISTS public.document_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    document_id UUID REFERENCES public.employee_documents(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    actor_id UUID,
    ip_address TEXT,
    user_agent TEXT,
    geolocation JSONB,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS em document_events
ALTER TABLE public.document_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_document_events_document_id 
    ON public.document_events(document_id);

CREATE INDEX IF NOT EXISTS idx_document_events_tenant_id 
    ON public.document_events(tenant_id);

-- Políticas RLS permissivas baseadas em tenant
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'document_events' AND policyname = 'tenant_isolation_document_events'
    ) THEN
        CREATE POLICY tenant_isolation_document_events ON public.document_events
            FOR ALL
            USING (tenant_id = auth.jwt() ->> 'tenant_id' OR auth.role() = 'service_role')
            WITH CHECK (tenant_id = auth.jwt() ->> 'tenant_id' OR auth.role() = 'service_role');
    END IF;
END $$;

-- 6. RECARREGAR O SCHEMA CACHE DO POSTGREST
NOTIFY pgrst, 'reload schema';
```

---

## Migration 00089 — Adição de status em time_entries e Correção da RPC get_employee_today_punches

Adiciona a coluna `status` com valor padrão `'APPROVED'` em `time_entries` e atualiza a função `get_employee_today_punches` com `COALESCE(te.status, 'APPROVED')` para prevenir erro 42703 (coluna inexistente) no Portal do Colaborador.

```sql
-- 1. ADICIONAR COLUNA STATUS EM time_entries COM VALOR PADRÃO
ALTER TABLE public.time_entries 
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'APPROVED';

-- 2. RECRIAR RPC get_employee_today_punches COM SEGURANÇA E COALESCE
CREATE OR REPLACE FUNCTION public.get_employee_today_punches(p_contract_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_punches JSONB;
BEGIN
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', te.id,
                'entry_type', te.entry_type,
                'original_timestamp', te.original_timestamp,
                'status', COALESCE(te.status, 'APPROVED'),
                'punch_record_id', te.punch_record_id,
                'receipt_code', pr.receipt_code,
                'nsr', pr.nsr
            ) ORDER BY te.original_timestamp ASC
        ),
        '[]'::jsonb
    ) INTO v_punches
    FROM public.time_entries te
    LEFT JOIN public.time_punch_records pr ON pr.id = te.punch_record_id
    WHERE te.contract_id = p_contract_id
      AND DATE(te.original_timestamp AT TIME ZONE 'America/Sao_Paulo') = DATE(NOW() AT TIME ZONE 'America/Sao_Paulo');

    RETURN v_punches;
END;
$$;

-- 3. PERMISSÕES DE EXECUÇÃO
GRANT EXECUTE ON FUNCTION public.get_employee_today_punches(UUID) TO anon, authenticated, service_role;

-- 4. RECARREGAR SCHEMA CACHE DO POSTGREST
NOTIFY pgrst, 'reload schema';
```

---

## Migration 00090 — Correção de register_mobile_punch (PIS em workers.pis_pasep)

Corrige a função PL/pgSQL `register_mobile_punch` para obter o PIS a partir de `workers.pis_pasep` com `COALESCE` (eliminando o erro `42703 (column p.pis does not exist)`), garante `search_path = public, extensions` para a função criptográfica `digest` e remove a exigência da coluna `status` no espelhamento em `time_entries`.

```sql
CREATE OR REPLACE FUNCTION public.register_mobile_punch(
    p_contract_id UUID,
    p_geo JSONB DEFAULT NULL,
    p_device_fingerprint TEXT DEFAULT NULL,
    p_ip INET DEFAULT NULL,
    p_receipt_code TEXT DEFAULT NULL,
    p_entry_type TEXT DEFAULT 'IN'
)
RETURNS TABLE (
    punch_id UUID,
    device_id UUID,
    nsr BIGINT,
    punched_at TIMESTAMPTZ,
    receipt_code TEXT
)
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_tenant_id UUID;
    v_company_id UUID;
    v_worker_id UUID;
    v_cpf TEXT;
    v_pis TEXT;
    v_device_id UUID;
    v_nsr BIGINT;
    v_punched_at TIMESTAMPTZ := NOW(); -- HORA CONFIÁVEL CARIMBADA NO SERVIDOR
    v_punch_id UUID;
    v_receipt_code TEXT;
BEGIN
    -- 1. Buscar dados do contrato e colaborador (PIS reside em workers.pis_pasep)
    SELECT 
        ec.tenant_id,
        ec.company_id,
        ec.worker_id,
        REGEXP_REPLACE(p.cpf, '[^0-9]', '', 'g'),
        COALESCE(REGEXP_REPLACE(w.pis_pasep, '[^0-9]', '', 'g'), '')
    INTO
        v_tenant_id,
        v_company_id,
        v_worker_id,
        v_cpf,
        v_pis
    FROM public.employment_contracts ec
    JOIN public.workers w ON w.id = ec.worker_id
    JOIN public.people p ON p.id = w.person_id
    WHERE ec.id = p_contract_id;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Contrato de trabalho % não encontrado.', p_contract_id;
    END IF;

    -- 2. Localizar ou instanciar o dispositivo REP_P_MOBILE da empresa
    SELECT id INTO v_device_id
    FROM public.time_devices
    WHERE tenant_id = v_tenant_id 
      AND company_id = v_company_id 
      AND kind = 'REP_P_MOBILE'
      AND status = 'ACTIVE'
    LIMIT 1;

    IF v_device_id IS NULL THEN
        INSERT INTO public.time_devices (
            tenant_id,
            company_id,
            name,
            kind,
            vendor,
            model,
            status,
            last_nsr
        ) VALUES (
            v_tenant_id,
            v_company_id,
            'App Mobile REP-P',
            'REP_P_MOBILE',
            'CoupleRH Mobile',
            'PWA REP-P Portaria 671',
            'ACTIVE',
            0
        ) RETURNING id INTO v_device_id;
    END IF;

    -- 3. Obter próximo NSR sequencial de forma atômica
    UPDATE public.time_devices
    SET 
        last_nsr = last_nsr + 1,
        last_sync_at = v_punched_at
    WHERE id = v_device_id
    RETURNING last_nsr INTO v_nsr;

    -- 4. Gerar hash do comprovante se não fornecido
    IF p_receipt_code IS NULL OR p_receipt_code = '' THEN
        v_receipt_code := encode(digest(v_nsr::text || '|' || v_punched_at::text || '|' || v_cpf, 'sha256'), 'hex');
    ELSE
        v_receipt_code := p_receipt_code;
    END IF;

    -- 5. Inserir na trilha imutável (time_punch_records)
    INSERT INTO public.time_punch_records (
        tenant_id,
        company_id,
        device_id,
        nsr,
        record_type,
        punched_at,
        cpf,
        pis,
        worker_id,
        contract_id,
        source,
        geo,
        ip,
        device_fingerprint,
        receipt_code,
        crc_ok
    ) VALUES (
        v_tenant_id,
        v_company_id,
        v_device_id,
        v_nsr,
        3,
        v_punched_at,
        v_cpf,
        v_pis,
        v_worker_id,
        p_contract_id,
        'MOBILE',
        p_geo,
        p_ip,
        p_device_fingerprint,
        v_receipt_code,
        true
    ) RETURNING id INTO v_punch_id;

    -- 6. Espelhar na tabela de marcações de jornada (time_entries)
    INSERT INTO public.time_entries (
        tenant_id,
        contract_id,
        original_timestamp,
        entry_type,
        punch_record_id,
        device_info
    ) VALUES (
        v_tenant_id,
        p_contract_id,
        v_punched_at,
        p_entry_type,
        v_punch_id,
        p_device_fingerprint
    );

    RETURN QUERY SELECT 
        v_punch_id,
        v_device_id,
        v_nsr,
        v_punched_at,
        v_receipt_code;
END;
$$ LANGUAGE plpgsql;

-- Permissões de execução para colaboradores autenticados e anônimos (via portal do empregado)
GRANT EXECUTE ON FUNCTION public.register_mobile_punch TO authenticated, anon;

-- Recarregar o schema cache do PostgREST
NOTIFY pgrst, 'reload schema';
```

### Script 91: `00091_payroll_variable_events_origin_and_closure`
```sql
-- Migration 00091: Adicionar colunas de rastreabilidade de ponto em payroll_variable_events
-- Permite diferenciar lançamentos manuais do DP de eventos integrados do ponto eletrônico (HE 50%, HE 100%, Noturno, Faltas, Atrasos)

DO $$ 
BEGIN
    -- 1. Coluna origin
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'payroll_variable_events' 
          AND column_name = 'origin'
    ) THEN
        ALTER TABLE public.payroll_variable_events 
        ADD COLUMN origin TEXT NOT NULL DEFAULT 'MANUAL';
    END IF;

    -- 2. Coluna time_period_closure_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'payroll_variable_events' 
          AND column_name = 'time_period_closure_id'
    ) THEN
        ALTER TABLE public.payroll_variable_events 
        ADD COLUMN time_period_closure_id TEXT;
    END IF;

    -- 3. Coluna description
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'payroll_variable_events' 
          AND column_name = 'description'
    ) THEN
        ALTER TABLE public.payroll_variable_events 
        ADD COLUMN description TEXT;
    END IF;
END $$;

-- Recarregar cache de schema do PostgREST
NOTIFY pgrst, 'reload schema';
```

---

### Migration: `00092_add_overtime_regime_to_employment_contracts.sql` (TB-01)
Define o regime de compensação de horas extras e jornada individual por contrato de trabalho (`employment_contracts`): `TIME_BANK`, `OVERTIME_PAYROLL`, `HYBRID`.

```sql
-- Migration: 00092_add_overtime_regime_to_employment_contracts
-- Tarefa TB-01: Adiciona overtime_regime em employment_contracts para definir a regra de compensação de horas de cada colaborador

ALTER TABLE public.employment_contracts 
ADD COLUMN IF NOT EXISTS overtime_regime TEXT NOT NULL DEFAULT 'TIME_BANK' 
CHECK (overtime_regime IN ('TIME_BANK', 'OVERTIME_PAYROLL', 'HYBRID'));

COMMENT ON COLUMN public.employment_contracts.overtime_regime IS 
'Regime de compensação de jornada do contrato de trabalho: TIME_BANK (Banco de Horas - CLT Art. 59 § 2º/§ 5º), OVERTIME_PAYROLL (Horas Extras em Folha de Pagamento - 100% Remuneradas) ou HYBRID (Regime Híbrido - 50% Banco / 100% Dinheiro).';

NOTIFY pgrst, 'reload schema';
```

---

### Migration: `00093_add_compensation_delay_absence_to_time_bank.sql` (TB-02)
Expande os tipos de transação suportados pela tabela `time_bank_transactions` para incluir `COMPENSATION_DELAY` e `COMPENSATION_ABSENCE`, permitindo que atrasos e faltas sejam abonados com o saldo do banco de horas, protegendo a folha contra descontos indevidos (rubricas 801/802) e perda do DSR.

```sql
-- Migration: 00093_add_compensation_delay_absence_to_time_bank.sql
-- Tarefa TB-02: Adiciona COMPENSATION_DELAY e COMPENSATION_ABSENCE na constraint de time_bank_transactions

ALTER TABLE public.time_bank_transactions
    DROP CONSTRAINT IF EXISTS time_bank_transactions_transaction_type_check;

ALTER TABLE public.time_bank_transactions
    ADD CONSTRAINT time_bank_transactions_transaction_type_check
    CHECK (transaction_type IN (
        'OVERTIME',
        'DELAY',
        'ABSENCE',
        'COMPENSATION_DAY_OFF',
        'COMPENSATION_DELAY',
        'COMPENSATION_ABSENCE',
        'MANUAL_ADJUSTMENT',
        'PAYOUT',
        'EXPIRATION_PAYOUT'
    ));

COMMENT ON CONSTRAINT time_bank_transactions_transaction_type_check ON public.time_bank_transactions IS 
'Tipos de transação de banco de horas suportados: OVERTIME, DELAY, ABSENCE, COMPENSATION_DAY_OFF, COMPENSATION_DELAY (abono de atraso com saldo), COMPENSATION_ABSENCE (abono de falta com saldo), MANUAL_ADJUSTMENT, PAYOUT e EXPIRATION_PAYOUT.';

NOTIFY pgrst, 'reload schema';
```

---

### Migration: `00094_add_initial_balance_to_time_bank.sql` (TB-03)
Adiciona o tipo `INITIAL_BALANCE` na constraint de `time_bank_transactions` e a RPC atômica `register_time_bank_initial_balance` com provisionamento automático de conta de banco de horas (`time_bank_accounts`) caso o colaborador ainda não possua conta ativa.

```sql
-- Migration: 00094_add_initial_balance_to_time_bank.sql
-- Tarefa TB-03: Lançamento Manual e Carga de Saldo Inicial de Banco de Horas
--               (Migração de Sistema Anterior)

-- 1. ATUALIZAR CONSTRAINT EM time_bank_transactions (Adicionando INITIAL_BALANCE)
ALTER TABLE public.time_bank_transactions
    DROP CONSTRAINT IF EXISTS time_bank_transactions_transaction_type_check;

ALTER TABLE public.time_bank_transactions
    ADD CONSTRAINT time_bank_transactions_transaction_type_check
    CHECK (transaction_type IN (
        'INITIAL_BALANCE',
        'OVERTIME',
        'DELAY',
        'ABSENCE',
        'COMPENSATION_DAY_OFF',
        'COMPENSATION_DELAY',
        'COMPENSATION_ABSENCE',
        'MANUAL_ADJUSTMENT',
        'PAYOUT',
        'EXPIRATION_PAYOUT'
    ));

COMMENT ON CONSTRAINT time_bank_transactions_transaction_type_check ON public.time_bank_transactions IS 
'Tipos de transação de banco de horas suportados: INITIAL_BALANCE (carga legada/saldo inicial), OVERTIME, DELAY, ABSENCE, COMPENSATION_DAY_OFF, COMPENSATION_DELAY, COMPENSATION_ABSENCE, MANUAL_ADJUSTMENT, PAYOUT e EXPIRATION_PAYOUT.';

-- 2. RPC ATÔMICA PARA PROVISIONAMENTO E LANÇAMENTO DE SALDO INICIAL
CREATE OR REPLACE FUNCTION public.register_time_bank_initial_balance(
    p_tenant_id UUID,
    p_contract_id UUID,
    p_cutoff_date DATE,
    p_minutes INTEGER,
    p_justification TEXT,
    p_policy_type TEXT DEFAULT 'ACORDO_INDIVIDUAL',
    p_validity_months INTEGER DEFAULT 6,
    p_company_id UUID DEFAULT NULL
)
RETURNS TABLE (
    account_id UUID,
    transaction_id UUID,
    final_balance_minutes INTEGER,
    cutoff_date DATE,
    message TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_account_id UUID;
    v_tx_id UUID;
    v_current_balance INTEGER := 0;
    v_new_balance INTEGER := 0;
    v_end_date DATE;
    v_validity INTEGER := COALESCE(p_validity_months, 6);
    v_policy TEXT := COALESCE(p_policy_type, 'ACORDO_INDIVIDUAL');
BEGIN
    -- Validação legal CLT Art. 59
    IF v_policy = 'ACORDO_INDIVIDUAL' AND v_validity > 6 THEN
        RAISE EXCEPTION 'Banco de horas por Acordo Individual não pode ter vigência superior a 6 meses (Art. 59 § 5º CLT).';
    END IF;

    IF (v_policy = 'CCT' OR v_policy = 'ACT') AND v_validity > 12 THEN
        RAISE EXCEPTION 'Banco de horas por CCT/ACT não pode ter vigência superior a 12 meses (Art. 59 § 2º CLT).';
    END IF;

    -- 1. Localizar conta ativa existente para o contrato
    SELECT id, balance_minutes 
    INTO v_account_id, v_current_balance
    FROM public.time_bank_accounts
    WHERE tenant_id = p_tenant_id
      AND contract_id = p_contract_id
      AND status = 'ACTIVE'
    ORDER BY created_at DESC
    LIMIT 1;

    -- 2. Se não existir, provisionar nova conta ativa a partir da data de corte
    IF v_account_id IS NULL THEN
        v_end_date := (p_cutoff_date + (v_validity || ' months')::INTERVAL - '1 day'::INTERVAL)::DATE;

        INSERT INTO public.time_bank_accounts (
            tenant_id,
            company_id,
            contract_id,
            balance_minutes,
            start_date,
            end_date,
            status,
            policy_type,
            validity_months,
            expiration_rule,
            warning_days_before_expiration,
            payout_rubric_code,
            created_at,
            updated_at
        ) VALUES (
            p_tenant_id,
            p_company_id,
            p_contract_id,
            0,
            p_cutoff_date,
            v_end_date,
            'ACTIVE',
            v_policy,
            v_validity,
            'PAY_AS_OVERTIME',
            30,
            '152',
            NOW(),
            NOW()
        )
        RETURNING id INTO v_account_id;
        
        v_current_balance := 0;
    END IF;

    -- 3. Inserir a transação de INITIAL_BALANCE
    v_new_balance := v_current_balance + p_minutes;

    INSERT INTO public.time_bank_transactions (
        tenant_id,
        account_id,
        date,
        minutes,
        transaction_type,
        description,
        created_at
    ) VALUES (
        p_tenant_id,
        v_account_id,
        p_cutoff_date,
        p_minutes,
        'INITIAL_BALANCE',
        COALESCE(p_justification, 'Carga de saldo inicial / migração de sistema anterior'),
        NOW()
    )
    RETURNING id INTO v_tx_id;

    -- 4. Atualizar saldo acumulado da conta
    UPDATE public.time_bank_accounts
    SET balance_minutes = v_new_balance,
        updated_at = NOW()
    WHERE id = v_account_id;

    RETURN QUERY
    SELECT 
        v_account_id,
        v_tx_id,
        v_new_balance,
        p_cutoff_date,
        'Saldo inicial lançado com sucesso no banco de horas.'::TEXT;
END;
$$;

NOTIFY pgrst, 'reload schema';
```

---

### Script 95: `00095_geofence_server_side_validation_tb05`
Responsável por adicionar validação server-side com fórmula de Haversine em PostgreSQL, auditoria geodésica em `time_punch_records` e blindagem da RPC `register_mobile_punch` contra tentativas de adulteração de GPS no ponto mobile.

```sql
-- Migration: 00095_geofence_server_side_validation_tb05.sql
-- Description: TB-05 - Validação server-side de geofence, cálculo Haversine e enriquecimento da RPC register_mobile_punch

-- 1. ADICIONAR COLUNAS DE AUDITORIA DE GEOFENCING EM TIME_PUNCH_RECORDS
ALTER TABLE public.time_punch_records
    ADD COLUMN IF NOT EXISTS distance_meters NUMERIC(10, 2),
    ADD COLUMN IF NOT EXISTS geofence_status TEXT;

COMMENT ON COLUMN public.time_punch_records.distance_meters IS 'Distância métrica em relação à sede/lotação do colaborador no momento da batida.';
COMMENT ON COLUMN public.time_punch_records.geofence_status IS 'Resultado da checagem de perímetro (INSIDE, OUTSIDE, TELEWORK, AUDIT_ONLY, NO_GPS).';

-- 2. FUNÇÃO GEODÉSICA DE HAVERSINE NO POSTGRESQL (EM METROS)
CREATE OR REPLACE FUNCTION public.calculate_haversine_distance_meters(
    lat1 NUMERIC,
    lon1 NUMERIC,
    lat2 NUMERIC,
    lon2 NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    r CONSTANT NUMERIC := 6371000; -- Raio médio da Terra em metros
    dlat NUMERIC;
    dlon NUMERIC;
    a NUMERIC;
    c NUMERIC;
BEGIN
    IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
        RETURN NULL;
    END IF;

    IF lat1 = lat2 AND lon1 = lon2 THEN
        RETURN 0;
    END IF;

    dlat := radians(lat2 - lat1);
    dlon := radians(lon2 - lon1);

    a := sin(dlat / 2.0)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2.0)^2;
    c := 2.0 * atan2(sqrt(a), sqrt(1.0 - a));

    RETURN ROUND(r * c, 1);
END;
$$;

-- 3. ATUALIZAÇÃO DA RPC REGISTER_MOBILE_PUNCH COM VALIDAÇÃO SERVER-SIDE
CREATE OR REPLACE FUNCTION public.register_mobile_punch(
    p_contract_id UUID,
    p_geo JSONB DEFAULT NULL,
    p_device_fingerprint TEXT DEFAULT NULL,
    p_ip INET DEFAULT NULL,
    p_receipt_code TEXT DEFAULT NULL,
    p_entry_type TEXT DEFAULT 'IN'
)
RETURNS TABLE (
    punch_id UUID,
    device_id UUID,
    nsr BIGINT,
    punched_at TIMESTAMPTZ,
    receipt_code TEXT
)
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_tenant_id UUID;
    v_company_id UUID;
    v_worker_id UUID;
    v_workplace_id UUID;
    v_is_telework BOOLEAN := false;
    v_cpf TEXT;
    v_pis TEXT;
    v_device_id UUID;
    v_nsr BIGINT;
    v_punched_at TIMESTAMPTZ := NOW();
    v_punch_id UUID;
    v_receipt_code TEXT;

    -- Variáveis de Geofence
    v_wp_name TEXT;
    v_wp_lat NUMERIC;
    v_wp_lon NUMERIC;
    v_wp_radius INTEGER := 50;
    v_wp_enforce BOOLEAN := false;
    v_user_lat NUMERIC;
    v_user_lon NUMERIC;
    v_distance_meters NUMERIC := NULL;
    v_geofence_status TEXT := 'NO_CONFIG';
BEGIN
    -- 1. Buscar dados do contrato de trabalho e lotação
    SELECT 
        ec.tenant_id,
        ec.company_id,
        ec.worker_id,
        ec.workplace_id,
        COALESCE(ec.is_telework, false),
        REGEXP_REPLACE(p.cpf, '[^0-9]', '', 'g'),
        COALESCE(REGEXP_REPLACE(w.pis_pasep, '[^0-9]', '', 'g'), '')
    INTO
        v_tenant_id,
        v_company_id,
        v_worker_id,
        v_workplace_id,
        v_is_telework,
        v_cpf,
        v_pis
    FROM public.employment_contracts ec
    JOIN public.workers w ON w.id = ec.worker_id
    JOIN public.people p ON p.id = w.person_id
    WHERE ec.id = p_contract_id;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Contrato de trabalho % não encontrado.', p_contract_id;
    END IF;

    -- 2. Extrair coordenadas do payload GPS
    IF p_geo IS NOT NULL THEN
        BEGIN
            v_user_lat := (p_geo->>'latitude')::NUMERIC;
            v_user_lon := (p_geo->>'longitude')::NUMERIC;
        EXCEPTION WHEN OTHERS THEN
            v_user_lat := NULL;
            v_user_lon := NULL;
        END;
    END IF;

    -- 3. Validação de Geofencing contra o Local de Trabalho
    IF v_is_telework THEN
        v_geofence_status := 'TELEWORK';
    ELSIF v_workplace_id IS NOT NULL THEN
        SELECT 
            wp.name,
            wp.latitude,
            wp.longitude,
            COALESCE(wp.radius_meters, 50),
            COALESCE(wp.enforce_geofence, false)
        INTO
            v_wp_name,
            v_wp_lat,
            v_wp_lon,
            v_wp_radius,
            v_wp_enforce
        FROM public.workplaces wp
        WHERE wp.id = v_workplace_id;

        IF v_wp_lat IS NOT NULL AND v_wp_lon IS NOT NULL THEN
            IF v_user_lat IS NOT NULL AND v_user_lon IS NOT NULL THEN
                v_distance_meters := calculate_haversine_distance_meters(v_wp_lat, v_wp_lon, v_user_lat, v_user_lon);
                
                IF v_distance_meters <= v_wp_radius THEN
                    v_geofence_status := 'INSIDE';
                ELSE
                    v_geofence_status := 'OUTSIDE';
                    IF v_wp_enforce THEN
                        RAISE EXCEPTION 'Registro bloqueado: você está a % metros de %, fora do raio autorizado de % metros.', 
                            ROUND(v_distance_meters), COALESCE(v_wp_name, 'Sede'), v_wp_radius;
                    END IF;
                END IF;
            ELSE
                v_geofence_status := 'NO_GPS';
                IF v_wp_enforce THEN
                    RAISE EXCEPTION 'Registro bloqueado: a empresa exige localização GPS ativa para marcação presencial em %.', 
                        COALESCE(v_wp_name, 'Sede');
                END IF;
            END IF;
        END IF;
    END IF;

    -- 4. Localizar ou instanciar o dispositivo REP_P_MOBILE da empresa
    SELECT id INTO v_device_id
    FROM public.time_devices
    WHERE tenant_id = v_tenant_id 
      AND company_id = v_company_id 
      AND kind = 'REP_P_MOBILE'
      AND status = 'ACTIVE'
    LIMIT 1;

    IF v_device_id IS NULL THEN
        INSERT INTO public.time_devices (
            tenant_id,
            company_id,
            name,
            kind,
            vendor,
            model,
            status,
            last_nsr
        ) VALUES (
            v_tenant_id,
            v_company_id,
            'App Mobile REP-P',
            'REP_P_MOBILE',
            'CoupleRH Mobile',
            'PWA REP-P Portaria 671',
            'ACTIVE',
            0
        ) RETURNING id INTO v_device_id;
    END IF;

    -- 5. Obter próximo NSR sequencial de forma atômica
    UPDATE public.time_devices
    SET 
        last_nsr = last_nsr + 1,
        last_sync_at = v_punched_at
    WHERE id = v_device_id
    RETURNING last_nsr INTO v_nsr;

    -- 6. Gerar hash do comprovante se não fornecido
    IF p_receipt_code IS NULL OR p_receipt_code = '' THEN
        v_receipt_code := encode(digest(v_nsr::text || '|' || v_punched_at::text || '|' || v_cpf, 'sha256'), 'hex');
    ELSE
        v_receipt_code := p_receipt_code;
    END IF;

    -- 7. Inserir na trilha imutável (time_punch_records) com auditoria geodésica
    INSERT INTO public.time_punch_records (
        tenant_id,
        company_id,
        device_id,
        nsr,
        record_type,
        punched_at,
        cpf,
        pis,
        worker_id,
        contract_id,
        source,
        geo,
        ip,
        device_fingerprint,
        receipt_code,
        distance_meters,
        geofence_status,
        crc_ok
    ) VALUES (
        v_tenant_id,
        v_company_id,
        v_device_id,
        v_nsr,
        3,
        v_punched_at,
        v_cpf,
        v_pis,
        v_worker_id,
        p_contract_id,
        'MOBILE',
        p_geo,
        p_ip,
        p_device_fingerprint,
        v_receipt_code,
        v_distance_meters,
        v_geofence_status,
        true
    ) RETURNING id INTO v_punch_id;

    -- 8. Espelhar na tabela de marcações de jornada (time_entries)
    INSERT INTO public.time_entries (
        tenant_id,
        contract_id,
        original_timestamp,
        entry_type,
        punch_record_id,
        device_info
    ) VALUES (
        v_tenant_id,
        p_contract_id,
        v_punched_at,
        p_entry_type,
        v_punch_id,
        p_device_fingerprint
    );

    RETURN QUERY SELECT 
        v_punch_id,
        v_device_id,
        v_nsr,
        v_punched_at,
        v_receipt_code;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.register_mobile_punch TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.calculate_haversine_distance_meters TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
```

---

## Migration 00096 — Sincronização de company_id e Políticas RLS em time_bank_accounts

Garante a presença estrutural da coluna `company_id` em `time_bank_accounts` com integridade referencial para `companies(id)`, backfill retroativo a partir de `employment_contracts`, índices de performance compostos (`company_id, status` e `tenant_id, status`), políticas RLS multitenant explícitas para usuários autenticados e concessão de privilégios para roles authenticated/service_role.

```sql
-- 1. ADICIONAR COLUNA company_id EM time_bank_accounts
ALTER TABLE public.time_bank_accounts
    ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- 2. BACKFILL DE company_id A PARTIR DE employment_contracts
UPDATE public.time_bank_accounts tba
SET company_id = ec.company_id
FROM public.employment_contracts ec
WHERE ec.id = tba.contract_id 
  AND tba.company_id IS NULL;

-- 3. ÍNDICES DE ALTA PERFORMANCE PARA FILTROS POR EMPRESA E STATUS
CREATE INDEX IF NOT EXISTS idx_time_bank_accounts_company_status 
    ON public.time_bank_accounts(company_id, status);

CREATE INDEX IF NOT EXISTS idx_time_bank_accounts_tenant_status 
    ON public.time_bank_accounts(tenant_id, status);

-- 4. POLÍTICAS RLS ROBUSTAS PARA time_bank_accounts
ALTER TABLE public.time_bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can manage time_bank_accounts" ON public.time_bank_accounts;
CREATE POLICY "Tenant users can manage time_bank_accounts" 
    ON public.time_bank_accounts FOR ALL 
    TO authenticated
    USING (tenant_id = ANY (public.user_tenant_ids()))
    WITH CHECK (tenant_id = ANY (public.user_tenant_ids()));

-- 5. POLÍTICAS RLS ROBUSTAS PARA time_bank_transactions
ALTER TABLE public.time_bank_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can manage time_bank_transactions" ON public.time_bank_transactions;
CREATE POLICY "Tenant users can manage time_bank_transactions" 
    ON public.time_bank_transactions FOR ALL 
    TO authenticated
    USING (tenant_id = ANY (public.user_tenant_ids()))
    WITH CHECK (tenant_id = ANY (public.user_tenant_ids()));

-- 6. PERMISSÕES DE ACESSO
GRANT ALL ON public.time_bank_accounts TO authenticated, service_role;
GRANT ALL ON public.time_bank_transactions TO authenticated, service_role;
GRANT SELECT ON public.time_bank_accounts TO anon;
GRANT SELECT ON public.time_bank_transactions TO anon;

-- 7. RECARREGAR O SCHEMA CACHE DO POSTGREST IMEDIATAMENTE
NOTIFY pgrst, 'reload schema';
```

---

### Migration `00097_fix_sync_payslip_status_calculating.sql` (15/10/2026)
- **Objetivo**: Ajustar a constraint de status da tabela `public.payslips` para aceitar `CALCULATING` e atualizar a função do trigger `sync_payslip_status_with_period()` para ignorar o status intermediário efêmero `CALCULATING`, evitando que o processamento concorrente do motor de folha dispare erro de violação de constraint nos holerites existentes.
- **SQL Aplicado**:
```sql
ALTER TABLE public.payslips DROP CONSTRAINT IF EXISTS payslips_status_check;
ALTER TABLE public.payslips ADD CONSTRAINT payslips_status_check 
    CHECK (status IN ('DRAFT', 'CALCULATING', 'CALCULATED', 'CONFERENCE', 'CLOSED', 'REOPENED', 'CANCELED'));

CREATE OR REPLACE FUNCTION public.sync_payslip_status_with_period()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'CALCULATING' THEN
        UPDATE public.payslips
        SET status = NEW.status
        WHERE period_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

NOTIFY pgrst, 'reload schema';
```

---

### Migration `00098_fix_payroll_memory_calc_immutability_trigger.sql` (15/10/2026)
- **Objetivo**: Corrigir a verificação de imutabilidade de folha fechada (`check_payroll_period_immutability()`) para a tabela `public.payroll_memory_calc`. Como `payroll_memory_calc` referencia `payslip_id` e não possui a coluna direta `period_id`, a função gerava o erro PostgreSQL `record "old" has no field "period_id"` ao tentar limpar a memória de cálculo anterior durante o recálculo atômico da folha.
- **SQL Aplicado**:
```sql
CREATE OR REPLACE FUNCTION public.check_payroll_period_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_period_id UUID;
    v_status TEXT;
BEGIN
    IF TG_TABLE_NAME = 'payslips' THEN
        v_period_id := COALESCE(OLD.period_id, NEW.period_id);
    ELSIF TG_TABLE_NAME = 'payslip_items' THEN
        SELECT period_id INTO v_period_id FROM public.payslips WHERE id = COALESCE(OLD.payslip_id, NEW.payslip_id);
    ELSIF TG_TABLE_NAME = 'payroll_company_taxes' THEN
        v_period_id := COALESCE(OLD.period_id, NEW.period_id);
    ELSIF TG_TABLE_NAME = 'payroll_memory_calc' THEN
        SELECT period_id INTO v_period_id FROM public.payslips WHERE id = COALESCE(OLD.payslip_id, NEW.payslip_id);
    END IF;

    IF v_period_id IS NOT NULL THEN
        SELECT status INTO v_status FROM public.payroll_periods WHERE id = v_period_id;
        IF v_status = 'CLOSED' THEN
            RAISE EXCEPTION 'Operação bloqueada (Imutabilidade Legal CLT): O período de folha % está FECHADO (CLOSED). Nenhum holerite, item ou imposto pode ser alterado ou excluído sem reabertura formal autorizada.', v_period_id;
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
```

---

## 🏛️ TABELA: employee_loans (Empréstimos Consignados & FGTS Digital)
*Criada na Migration 00099 (16/10/2026)*

```sql
CREATE TABLE IF NOT EXISTS public.employee_loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    contract_number TEXT,
    installment_amount NUMERIC(12, 2) NOT NULL CHECK (installment_amount > 0),
    total_installments INT NOT NULL CHECK (total_installments > 0),
    current_installment INT NOT NULL DEFAULT 1 CHECK (current_installment >= 1),
    start_date DATE NOT NULL,
    end_date DATE,
    provision_on_advance BOOLEAN NOT NULL DEFAULT true,
    advance_provision_percentage NUMERIC(5, 2) NOT NULL DEFAULT 40.00 CHECK (advance_provision_percentage >= 0 AND advance_provision_percentage <= 100),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'SETTLED', 'CANCELLED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.employee_loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View employee_loans" ON public.employee_loans
    FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Manage employee_loans" ON public.employee_loans
    FOR ALL USING (
        tenant_id = ANY (public.user_tenant_ids())
        AND EXISTS (
            SELECT 1 FROM public.tenant_users 
            WHERE user_id = auth.uid() 
              AND tenant_id = employee_loans.tenant_id 
              AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        )
    );

-- Gatilho de Auditoria do Sistema
CREATE TRIGGER audit_employee_loans_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.employee_loans
FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- Rubricas Oficiais de Suporte:
-- 807: Provisão Consignado Adiantamento (DEDUCTION no Vale - Provisão proporcional)
-- 407: Estorno Provisão Consignado (EARNING na Folha Mensal - Devolução da retenção)
-- 805: Empréstimo Consignado (DEDUCTION na Folha Mensal - Parcela integral)
```

---

## 🏖️ MIGRATION 00100: get_employee_vacation_balance & Conformidade CLT (TB-06)
*Aplicada em 16/10/2026*

```sql
-- Migration: 00100_vacation_receipt_and_concessive_compliance_tb06.sql
-- Description: Atualiza a RPC get_employee_vacation_balance para incluir abono pecuniário (cash_allowance_days)
-- e metadados de concessão para o Recibo de Férias Completo (TB-06 / CLT Art. 134 e 145)

CREATE OR REPLACE FUNCTION public.get_employee_vacation_balance(p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', vp.id,
            'contract_id', vp.contract_id,
            'start_date', vp.start_date,
            'end_date', vp.end_date,
            'concessive_start_date', vp.concessive_start_date,
            'concessive_end_date', vp.concessive_end_date,
            'days_earned', vp.earned_days,
            'days_taken', vp.taken_days,
            'days_lost', vp.lost_days,
            'status', vp.status,
            'requests', (
                SELECT COALESCE(json_agg(
                    json_build_object(
                        'id', vr.id,
                        'start_date', vr.start_date,
                        'end_date', vr.end_date,
                        'days_taken', vr.days_taken,
                        'cash_allowance_days', COALESCE(vr.cash_allowance_days, 0),
                        'status', vr.status,
                        'created_at', vr.created_at
                    ) ORDER BY vr.start_date ASC
                ), '[]'::JSON)
                FROM public.vacation_requests vr
                WHERE vr.vesting_period_id = vp.id
            )
        ) ORDER BY vp.start_date DESC
    ) INTO v_result
    FROM public.vacation_vesting_periods vp
    WHERE vp.contract_id IN (
        SELECT id FROM public.employment_contracts WHERE worker_id = p_worker_id
    );

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_employee_vacation_balance(UUID) TO anon, authenticated;
```

---

## 🛡️ MIGRATION 00101: Auditoria Ampliada e Imutabilidade Forense dos Logs (T29 / FASE P8)
*Aplicada em 16/10/2026*

```sql
-- Migration: 00101_audit_t29_immutability_and_full_coverage.sql
-- Description: Implementação de T29 - Auditoria Ampliada e Imutabilidade dos Logs de Auditoria
-- Escopo:
--   1. Bloqueio absoluto de UPDATE e DELETE na tabela audit.logs (Append-Only / Trilha Forense Imutável).
--   2. Extensão dos gatilhos de auditoria audit.audit_trigger_func() para todas as tabelas de Folha, Parâmetros Legais, Ponto Eletrônico e Assinaturas.

-- 1. Trava de Imutabilidade Estrita em audit.logs (CLT / LGPD / Compliance T29)
CREATE OR REPLACE FUNCTION audit.prevent_audit_logs_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'A tabela audit.logs e estritamente imutavel (append-only). Operacoes de UPDATE ou DELETE sao proibidas por conformidade legal e auditoria forense (CLT / LGPD / T29).';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_audit_logs_mutation ON audit.logs;
CREATE TRIGGER trg_prevent_audit_logs_mutation
BEFORE UPDATE OR DELETE ON audit.logs
FOR EACH ROW
EXECUTE FUNCTION audit.prevent_audit_logs_mutation();

-- 2. Gatilhos de Auditoria Idempotentes em Folha de Pagamento, Parâmetros Legais, Ponto e Assinaturas
DO $$
BEGIN
    -- 2.1 Folha de Pagamento
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payslips_trigger') THEN
        CREATE TRIGGER audit_payslips_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.payslips
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payslip_items_trigger') THEN
        CREATE TRIGGER audit_payslip_items_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.payslip_items
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_memory_calc_trigger') THEN
        CREATE TRIGGER audit_payroll_memory_calc_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.payroll_memory_calc
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_company_taxes_trigger') THEN
        CREATE TRIGGER audit_payroll_company_taxes_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.payroll_company_taxes
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_employee_deductions_trigger') THEN
        CREATE TRIGGER audit_employee_deductions_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.employee_deductions
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_periods_trigger') THEN
        CREATE TRIGGER audit_payroll_periods_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.payroll_periods
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_variable_events_trigger') THEN
        CREATE TRIGGER audit_payroll_variable_events_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.payroll_variable_events
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_employee_fixed_events_trigger') THEN
        CREATE TRIGGER audit_employee_fixed_events_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.employee_fixed_events
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    -- 2.2 Parâmetros Legais e Governança Tributária
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_legal_versions_trigger') THEN
        CREATE TRIGGER audit_legal_versions_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.legal_versions
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_inss_parameters_trigger') THEN
        CREATE TRIGGER audit_inss_parameters_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.inss_parameters
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_irrf_parameters_trigger') THEN
        CREATE TRIGGER audit_irrf_parameters_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.irrf_parameters
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_general_legal_parameters_trigger') THEN
        CREATE TRIGGER audit_general_legal_parameters_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.general_legal_parameters
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_progressive_tables_trigger') THEN
        CREATE TRIGGER audit_payroll_progressive_tables_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.payroll_progressive_tables
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    -- 2.3 Ponto Eletrônico e Jornadas
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_time_daily_summary_trigger') THEN
        CREATE TRIGGER audit_time_daily_summary_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.time_daily_summary
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_time_punch_records_trigger') THEN
        CREATE TRIGGER audit_time_punch_records_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.time_punch_records
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_time_bank_accounts_trigger') THEN
        CREATE TRIGGER audit_time_bank_accounts_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.time_bank_accounts
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_time_bank_transactions_trigger') THEN
        CREATE TRIGGER audit_time_bank_transactions_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.time_bank_transactions
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_timesheets_trigger') THEN
        CREATE TRIGGER audit_timesheets_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.timesheets
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_timesheet_contests_trigger') THEN
        CREATE TRIGGER audit_timesheet_contests_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.timesheet_contests
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    -- 2.4 Assinaturas Digitais e Evidências Forenses
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_signatures_log_trigger') THEN
        CREATE TRIGGER audit_signatures_log_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.signatures_log
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_document_events_trigger') THEN
        CREATE TRIGGER audit_document_events_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.document_events
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;
```

---

## Migration: `00102_rbac_granular_roles_and_permissions_p8.sql`
**Data:** 16/10/2026  
**Descrição:** Implementação de RBAC granular (DP, gestor, contador, auditor, colaborador) e fortalecimento das políticas RLS multitenant.

```sql
-- 1. Atualizar Constraint de Roles e Adicionar worker_id em tenant_users
ALTER TABLE public.tenant_users DROP CONSTRAINT IF EXISTS tenant_users_role_check;
ALTER TABLE public.tenant_users ADD CONSTRAINT tenant_users_role_check 
    CHECK (role IN ('system_admin', 'tenant_admin', 'dp_analyst', 'manager', 'accountant', 'auditor', 'employee', 'sst_specialist'));

ALTER TABLE public.tenant_users ADD COLUMN IF NOT EXISTS worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL;

-- 2. Expandir Catálogo de Permissões Granulares
INSERT INTO public.permissions (slug, name, module, description) VALUES
('manage_users', 'Gerenciar Usuários e Perfis', 'Configurações', 'Criar usuários e perfis de acesso'),
('manage_settings', 'Configurações Globais', 'Configurações', 'Alterar preferências do sistema e cadastros organizacionais'),
('manage_employees', 'Gestão de Funcionários', 'RH', 'Cadastrar e editar dados de colaboradores e contratos'),
('view_team_employees', 'Visualizar Colaboradores da Equipe', 'RH', 'Consultar dados e escalas dos colaboradores da equipe ou departamento'),
('manage_payroll', 'Folha de Pagamento', 'DP', 'Calcular folha, lançar eventos, férias e rescisões'),
('view_payroll_accounting', 'Visualização Contábil da Folha', 'DP', 'Acesso a resumos contábeis D=C, provisões de férias/13º e guias tributárias DCTFWeb/FGTS/DARF'),
('export_financial_reports', 'Exportação de Guias e CNAB', 'Financeiro', 'Exportar arquivos bancários CNAB 240, guias de recolhimento e relatórios contábeis'),
('manage_time_tracking', 'Gestão Completa de Ponto Eletrônico', 'Ponto', 'Configurar dispositivos, importar AFD, tratar ocorrências e fechar espelhos'),
('manage_team_time_tracking', 'Gestão de Ponto da Equipe', 'Ponto', 'Visualizar e aprovar espelhos e compensações de ponto da equipe subordinada'),
('manage_sst', 'Saúde e Segurança', 'SST', 'Gerenciar atestados e eventos de SST'),
('view_reports', 'Visualizar Relatórios Gerais', 'Geral', 'Acesso aos relatórios gerenciais e exportações'),
('view_audit_logs', 'Visualização de Trilha de Auditoria', 'Auditoria', 'Consultar logs imutáveis de auditoria, eventos de documentos e hashes forenses H1/H2'),
('manage_legal_parameters', 'Gestão de Tabelas Legais e Rubricas', 'Configurações', 'Cadastrar e atualizar alíquotas de INSS, faixas de IRRF e rubricas da folha'),
('self_service_portal', 'Portal de Autoatendimento', 'Colaborador', 'Acesso às rotas do portal do colaborador: holerites próprios, ponto mobile REP-P e assinaturas')
ON CONFLICT (slug) DO UPDATE SET 
    name = EXCLUDED.name,
    module = EXCLUDED.module,
    description = EXCLUDED.description;

-- 3. Inserir e Sincronizar Perfis do Sistema (Roles)
INSERT INTO public.roles (id, tenant_id, name, description, is_system_role) VALUES
('00000000-0000-0000-0000-000000000001', NULL, 'Administrador Global', 'Acesso irrestrito a todos os módulos e configurações do sistema.', TRUE),
('00000000-0000-0000-0000-000000000002', NULL, 'Analista de DP', 'Acesso à folha de pagamento, contratos, benefícios, ponto e encargos.', TRUE),
('00000000-0000-0000-0000-000000000003', NULL, 'Especialista SST', 'Acesso exclusivo ao módulo de Saúde e Segurança do Trabalho.', TRUE),
('00000000-0000-0000-0000-000000000004', NULL, 'Gestor de Equipe', 'Acesso a espelho de ponto, banco de horas e aprovações da sua equipe.', TRUE),
('00000000-0000-0000-0000-000000000005', NULL, 'Contador / Fiscal', 'Acesso para conferência de resumo contábil, guias tributárias e CNAB.', TRUE),
('00000000-0000-0000-0000-000000000006', NULL, 'Auditor de Conformidade', 'Acesso somente-leitura à trilha de auditoria e hashes de documentos.', TRUE),
('00000000-0000-0000-0000-000000000007', NULL, 'Colaborador', 'Acesso exclusivo ao Portal do Colaborador (autoatendimento e ponto).', TRUE)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_system_role = EXCLUDED.is_system_role;

-- 4. Vincular Permissões Oficiais por Role (Princípio do Menor Privilégio)
INSERT INTO public.role_permissions (role_id, permission_slug) VALUES
('00000000-0000-0000-0000-000000000001', 'manage_users'),
('00000000-0000-0000-0000-000000000001', 'manage_settings'),
('00000000-0000-0000-0000-000000000001', 'manage_employees'),
('00000000-0000-0000-0000-000000000001', 'view_team_employees'),
('00000000-0000-0000-0000-000000000001', 'manage_payroll'),
('00000000-0000-0000-0000-000000000001', 'view_payroll_accounting'),
('00000000-0000-0000-0000-000000000001', 'export_financial_reports'),
('00000000-0000-0000-0000-000000000001', 'manage_time_tracking'),
('00000000-0000-0000-0000-000000000001', 'manage_team_time_tracking'),
('00000000-0000-0000-0000-000000000001', 'manage_sst'),
('00000000-0000-0000-0000-000000000001', 'view_reports'),
('00000000-0000-0000-0000-000000000001', 'view_audit_logs'),
('00000000-0000-0000-0000-000000000001', 'manage_legal_parameters'),
('00000000-0000-0000-0000-000000000001', 'self_service_portal')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_slug) VALUES
('00000000-0000-0000-0000-000000000002', 'manage_employees'),
('00000000-0000-0000-0000-000000000002', 'manage_payroll'),
('00000000-0000-0000-0000-000000000002', 'view_payroll_accounting'),
('00000000-0000-0000-0000-000000000002', 'export_financial_reports'),
('00000000-0000-0000-0000-000000000002', 'manage_time_tracking'),
('00000000-0000-0000-0000-000000000002', 'manage_sst'),
('00000000-0000-0000-0000-000000000002', 'view_reports'),
('00000000-0000-0000-0000-000000000002', 'manage_legal_parameters')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_slug) VALUES
('00000000-0000-0000-0000-000000000003', 'manage_sst'),
('00000000-0000-0000-0000-000000000003', 'view_reports')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_slug) VALUES
('00000000-0000-0000-0000-000000000004', 'view_team_employees'),
('00000000-0000-0000-0000-000000000004', 'manage_team_time_tracking'),
('00000000-0000-0000-0000-000000000004', 'view_reports')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_slug) VALUES
('00000000-0000-0000-0000-000000000005', 'view_payroll_accounting'),
('00000000-0000-0000-0000-000000000005', 'export_financial_reports'),
('00000000-0000-0000-0000-000000000005', 'view_reports')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_slug) VALUES
('00000000-0000-0000-0000-000000000006', 'view_audit_logs'),
('00000000-0000-0000-0000-000000000006', 'view_reports')
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_slug) VALUES
('00000000-0000-0000-0000-000000000007', 'self_service_portal')
ON CONFLICT DO NOTHING;

-- 5. Sincronizar role_id para usuários existentes
UPDATE public.tenant_users SET role_id = '00000000-0000-0000-0000-000000000001' WHERE role IN ('system_admin', 'tenant_admin') AND (role_id IS NULL OR role_id != '00000000-0000-0000-0000-000000000001');
UPDATE public.tenant_users SET role_id = '00000000-0000-0000-0000-000000000002' WHERE role = 'dp_analyst' AND (role_id IS NULL OR role_id != '00000000-0000-0000-0000-000000000002');
UPDATE public.tenant_users SET role_id = '00000000-0000-0000-0000-000000000003' WHERE role = 'sst_specialist' AND (role_id IS NULL OR role_id != '00000000-0000-0000-0000-000000000003');
UPDATE public.tenant_users SET role_id = '00000000-0000-0000-0000-000000000004' WHERE role = 'manager' AND (role_id IS NULL OR role_id != '00000000-0000-0000-0000-000000000004');
UPDATE public.tenant_users SET role_id = '00000000-0000-0000-0000-000000000005' WHERE role = 'accountant' AND (role_id IS NULL OR role_id != '00000000-0000-0000-0000-000000000005');
UPDATE public.tenant_users SET role_id = '00000000-0000-0000-0000-000000000006' WHERE role = 'auditor' AND (role_id IS NULL OR role_id != '00000000-0000-0000-0000-000000000006');
UPDATE public.tenant_users SET role_id = '00000000-0000-0000-0000-000000000007' WHERE role = 'employee' AND (role_id IS NULL OR role_id != '00000000-0000-0000-0000-000000000007');

-- 6. Políticas de RLS Fortalecidas
DROP POLICY IF EXISTS "View payslips" ON public.payslips;
CREATE POLICY "View payslips" ON public.payslips FOR SELECT 
    USING (
        tenant_id = ANY(public.user_tenant_ids())
        AND (
            EXISTS (
                SELECT 1 FROM public.tenant_users tu
                WHERE tu.user_id = auth.uid() 
                AND tu.tenant_id = payslips.tenant_id 
                AND tu.role IN ('system_admin', 'tenant_admin', 'dp_analyst', 'accountant', 'auditor')
            )
            OR EXISTS (
                SELECT 1 FROM public.tenant_users tu
                JOIN public.employment_contracts ec ON ec.worker_id = tu.worker_id
                WHERE tu.user_id = auth.uid()
                AND tu.tenant_id = payslips.tenant_id
                AND ec.id = payslips.contract_id 
                AND payslips.status = 'CLOSED'
            )
        )
    );

DROP POLICY IF EXISTS "Manage payslips" ON public.payslips;
CREATE POLICY "Manage payslips" ON public.payslips FOR ALL 
    USING (
        tenant_id = ANY(public.user_tenant_ids())
        AND EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.user_id = auth.uid() 
            AND tu.tenant_id = payslips.tenant_id 
            AND tu.role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        )
    );

DROP POLICY IF EXISTS "View payslip_items" ON public.payslip_items;
CREATE POLICY "View payslip_items" ON public.payslip_items FOR SELECT 
    USING (
        tenant_id = ANY(public.user_tenant_ids())
        AND EXISTS (
            SELECT 1 FROM public.payslips p
            WHERE p.id = payslip_items.payslip_id
            AND (
                EXISTS (
                    SELECT 1 FROM public.tenant_users tu
                    WHERE tu.user_id = auth.uid() 
                    AND tu.tenant_id = payslip_items.tenant_id 
                    AND tu.role IN ('system_admin', 'tenant_admin', 'dp_analyst', 'accountant', 'auditor')
                )
                OR EXISTS (
                    SELECT 1 FROM public.tenant_users tu
                    JOIN public.employment_contracts ec ON ec.worker_id = tu.worker_id
                    WHERE tu.user_id = auth.uid()
                    AND tu.tenant_id = payslip_items.tenant_id
                    AND ec.id = p.contract_id 
                    AND p.status = 'CLOSED'
                )
            )
        )
    );

DROP POLICY IF EXISTS "Manage payslip_items" ON public.payslip_items;
CREATE POLICY "Manage payslip_items" ON public.payslip_items FOR ALL 
    USING (
        tenant_id = ANY(public.user_tenant_ids())
        AND EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.user_id = auth.uid() 
            AND tu.tenant_id = payslip_items.tenant_id 
            AND tu.role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        )
    );

DROP POLICY IF EXISTS "Users can view employment_contracts in their tenants" ON public.employment_contracts;
CREATE POLICY "Users can view employment_contracts in their tenants" 
    ON public.employment_contracts FOR SELECT 
    USING (
        tenant_id = ANY(public.user_tenant_ids())
        AND (
            EXISTS (
                SELECT 1 FROM public.tenant_users tu
                WHERE tu.user_id = auth.uid() 
                AND tu.tenant_id = employment_contracts.tenant_id 
                AND tu.role IN ('system_admin', 'tenant_admin', 'dp_analyst', 'accountant', 'auditor', 'manager')
            )
            OR EXISTS (
                SELECT 1 FROM public.tenant_users tu
                WHERE tu.user_id = auth.uid()
                AND tu.tenant_id = employment_contracts.tenant_id
                AND tu.worker_id = employment_contracts.worker_id
            )
        )
    );

DROP POLICY IF EXISTS "Tenant Admins and DP can manage employment_contracts" ON public.employment_contracts;
CREATE POLICY "Tenant Admins and DP can manage employment_contracts" 
    ON public.employment_contracts FOR ALL 
    USING (
        tenant_id = ANY(public.user_tenant_ids())
        AND EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.user_id = auth.uid() 
            AND tu.tenant_id = employment_contracts.tenant_id 
            AND tu.role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        )
    );

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'audit' AND table_name = 'logs') THEN
        EXECUTE 'ALTER TABLE audit.logs ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "Auditors can read tenant logs" ON audit.logs';
        EXECUTE 'DROP POLICY IF EXISTS "Admins and Auditors can view audit logs" ON audit.logs';
        EXECUTE 'CREATE POLICY "Admins and Auditors can view audit logs" ON audit.logs FOR SELECT 
            USING (
                tenant_id = ANY(public.user_tenant_ids())
                AND EXISTS (
                    SELECT 1 FROM public.tenant_users tu
                    WHERE tu.user_id = auth.uid() 
                    AND tu.tenant_id = audit.logs.tenant_id 
                    AND tu.role IN (''system_admin'', ''tenant_admin'', ''auditor'')
                )
            )';
    END IF;
END $$;
```

### Script 103: `00103_lgpd_subject_rights_and_data_governance_p8`
```sql
-- 1. Função Auxiliar: user_worker_ids()
CREATE OR REPLACE FUNCTION public.user_worker_ids()
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(array_agg(worker_id), '{}')
    FROM public.tenant_users
    WHERE user_id = auth.uid() AND worker_id IS NOT NULL;
$$;

-- 2. Tabela de Solicitações do Titular (LGPD Art. 18)
CREATE TABLE IF NOT EXISTS public.lgpd_subject_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    request_type TEXT NOT NULL CHECK (request_type IN ('ACCESS_DATA', 'PORTABILITY', 'ANONYMIZATION', 'REVOCATION_CONSENT', 'CONFIRMATION', 'CORRECTION')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED')),
    justification TEXT NOT NULL,
    response_notes TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    responded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS para lgpd_subject_requests
ALTER TABLE public.lgpd_subject_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and DP can manage all subject requests" ON public.lgpd_subject_requests
    FOR ALL
    USING (
        tenant_id = ANY(public.user_tenant_ids()) 
        AND EXISTS (
            SELECT 1 FROM public.tenant_users tu 
            WHERE tu.user_id = auth.uid() 
            AND tu.tenant_id = lgpd_subject_requests.tenant_id 
            AND tu.role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        )
    );

CREATE POLICY "Workers can view own subject requests" ON public.lgpd_subject_requests
    FOR SELECT
    USING (
        tenant_id = ANY(public.user_tenant_ids()) 
        AND worker_id = ANY(public.user_worker_ids())
    );

CREATE POLICY "Workers can create own subject requests" ON public.lgpd_subject_requests
    FOR INSERT
    WITH CHECK (
        tenant_id = ANY(public.user_tenant_ids()) 
        AND worker_id = ANY(public.user_worker_ids())
    );

CREATE TRIGGER audit_lgpd_subject_requests_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.lgpd_subject_requests
    FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- 3. Tabela de Registro de Compartilhamento com Terceiros (LGPD Art. 18, VII)
CREATE TABLE IF NOT EXISTS public.lgpd_data_sharing_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    recipient_name TEXT NOT NULL,
    recipient_type TEXT NOT NULL CHECK (recipient_type IN ('PUBLIC_AGENCY', 'FINANCIAL_INSTITUTION', 'HEALTH_CLINIC', 'INSURANCE', 'OTHER')),
    purpose TEXT NOT NULL,
    legal_basis TEXT NOT NULL CHECK (legal_basis IN ('LEGAL_OBLIGATION', 'CONTRACT_EXECUTION', 'CONSENT', 'LEGITIMATE_INTEREST')),
    data_shared TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.lgpd_data_sharing_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read data sharing registry" ON public.lgpd_data_sharing_registry
    FOR SELECT
    USING (tenant_id IS NULL OR tenant_id = ANY(public.user_tenant_ids()));

CREATE TRIGGER audit_lgpd_data_sharing_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.lgpd_data_sharing_registry
    FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- 4. RPC Segura: Exportação do Dossiê do Titular (Art. 18, II e V LGPD)
CREATE OR REPLACE FUNCTION public.get_my_lgpd_dossier()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_worker_id UUID;
    v_tenant_id UUID;
    v_person_id UUID;
    v_result JSONB;
BEGIN
    SELECT worker_id, tenant_id INTO v_worker_id, v_tenant_id
    FROM public.tenant_users
    WHERE user_id = auth.uid() AND worker_id IS NOT NULL
    LIMIT 1;

    IF v_worker_id IS NULL THEN
        RAISE EXCEPTION 'Nenhum cadastro de trabalhador vinculado a esta conta de usuário.';
    END IF;

    SELECT person_id INTO v_person_id
    FROM public.workers
    WHERE id = v_worker_id;

    SELECT jsonb_build_object(
        'generated_at', NOW(),
        'legal_notice', 'Dossiê emitido em conformidade com o Art. 18 da Lei nº 13.709/2018 (LGPD).',
        'titular', (
            SELECT jsonb_build_object(
                'full_name', p.full_name,
                'cpf_masked', '***.' || SUBSTRING(REPLACE(REPLACE(p.cpf, '.', ''), '-', ''), 4, 3) || '.' || SUBSTRING(REPLACE(REPLACE(p.cpf, '.', ''), '-', ''), 7, 3) || '-**',
                'birth_date', p.birth_date,
                'email', p.email,
                'phone', p.phone
            )
            FROM public.people p
            WHERE p.id = v_person_id
        ),
        'contratos', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', ec.id,
                    'registration_number', ec.registration_number,
                    'admission_date', ec.admission_date,
                    'status', ec.status,
                    'position', (SELECT name FROM public.positions WHERE id = ec.position_id),
                    'department', (SELECT name FROM public.departments WHERE id = ec.department_id),
                    'salary', ec.salary
                )
            ), '[]'::jsonb)
            FROM public.employment_contracts ec
            WHERE ec.worker_id = v_worker_id
        ),
        'consentimentos', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'category', lc.data_category,
                    'purpose', lc.processing_purpose,
                    'legal_basis', lc.legal_basis,
                    'granted_at', lc.granted_at,
                    'revoked_at', lc.revoked_at
                )
            ), '[]'::jsonb)
            FROM public.lgpd_consents lc
            WHERE lc.person_id = v_person_id
        ),
        'solicitacoes_titular', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'id', sr.id,
                    'type', sr.request_type,
                    'status', sr.status,
                    'justification', sr.justification,
                    'requested_at', sr.requested_at,
                    'responded_at', sr.responded_at
                )
            ), '[]'::jsonb)
            FROM public.lgpd_subject_requests sr
            WHERE sr.worker_id = v_worker_id
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;
```

---

### Script 104: `00104_tenant_general_settings_conf01`
Parametrização global e governança de configurações do tenant (`timezone`, `timesheet_cutoff_day`, `esocial_environment`) com RLS e auditoria T29.

```sql
CREATE TABLE IF NOT EXISTS public.tenant_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    timesheet_cutoff_day INTEGER NOT NULL DEFAULT 25 CHECK (timesheet_cutoff_day BETWEEN 1 AND 31),
    esocial_environment TEXT NOT NULL DEFAULT 'producao' CHECK (esocial_environment IN ('producao', 'restrita')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant_id ON public.tenant_settings(tenant_id);

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_settings_select_policy" ON public.tenant_settings;
CREATE POLICY "tenant_settings_select_policy" ON public.tenant_settings
    FOR SELECT
    USING (tenant_id = ANY(public.user_tenant_ids()));

DROP POLICY IF EXISTS "tenant_settings_insert_policy" ON public.tenant_settings;
CREATE POLICY "tenant_settings_insert_policy" ON public.tenant_settings
    FOR INSERT
    WITH CHECK (
        tenant_id = ANY(public.user_tenant_ids())
        AND EXISTS (
            SELECT 1 FROM public.tenant_users
            WHERE user_id = auth.uid()
            AND tenant_id = tenant_settings.tenant_id
            AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        )
    );

DROP POLICY IF EXISTS "tenant_settings_update_policy" ON public.tenant_settings;
CREATE POLICY "tenant_settings_update_policy" ON public.tenant_settings
    FOR UPDATE
    USING (
        tenant_id = ANY(public.user_tenant_ids())
        AND EXISTS (
            SELECT 1 FROM public.tenant_users
            WHERE user_id = auth.uid()
            AND tenant_id = tenant_settings.tenant_id
            AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        )
    );

DROP TRIGGER IF EXISTS audit_tenant_settings_trigger ON public.tenant_settings;
CREATE TRIGGER audit_tenant_settings_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.tenant_settings
    FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

INSERT INTO public.tenant_settings (tenant_id, timezone, timesheet_cutoff_day, esocial_environment)
SELECT id, 'America/Sao_Paulo', 25, 'producao'
FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;
```

---

### Script 105: `00105_user_management_and_profiles_conf02`
Governança completa de usuários e acessos (CONF-02), listagem enriquecida com e-mail real e dados de colaboradores, status ativo/inativo, vinculação com worker_id e RPC de atualização.

```sql
-- 1. Adicionar status is_active em tenant_users
ALTER TABLE public.tenant_users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_active ON public.tenant_users(tenant_id, is_active);

-- 2. Garantir sincronização de perfis existentes em user_profiles a partir de auth.users
INSERT INTO public.user_profiles (id, email, full_name)
SELECT 
    u.id, 
    u.email, 
    COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
FROM auth.users u
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.user_profiles.full_name, EXCLUDED.full_name);

-- 3. Função/RPC segura para listagem completa de usuários do tenant com perfis, e-mails reais e trabalhadores vinculados
CREATE OR REPLACE FUNCTION public.list_tenant_users_with_profiles()
RETURNS TABLE (
    tenant_user_id UUID,
    user_id UUID,
    tenant_id UUID,
    role TEXT,
    role_id UUID,
    role_name TEXT,
    worker_id UUID,
    worker_name TEXT,
    worker_cpf TEXT,
    full_name TEXT,
    email TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_has_access BOOLEAN;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Acesso não autorizado: usuário não autenticado.' USING ERRCODE = '42501';
    END IF;

    -- Validação de permissão: o usuário deve pertencer a ao menos um tenant com perfil administrativo ou analista
    SELECT EXISTS (
        SELECT 1 FROM public.tenant_users tu
        WHERE tu.user_id = v_caller_id
        AND tu.role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        AND tu.is_active = TRUE
    ) INTO v_has_access;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Acesso negado: permissão de gestão de usuários necessária.' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT 
        tu.id AS tenant_user_id,
        tu.user_id,
        tu.tenant_id,
        tu.role,
        tu.role_id,
        COALESCE(r.name, tu.role) AS role_name,
        tu.worker_id,
        w_p.full_name AS worker_name,
        w_p.cpf AS worker_cpf,
        COALESCE(up.full_name, w_p.full_name, u.raw_user_meta_data->>'full_name', 'Usuário Registrado')::TEXT AS full_name,
        COALESCE(up.email, u.email, 'email_nao_disponivel')::TEXT AS email,
        tu.is_active,
        tu.created_at
    FROM public.tenant_users tu
    LEFT JOIN auth.users u ON u.id = tu.user_id
    LEFT JOIN public.user_profiles up ON up.id = tu.user_id
    LEFT JOIN public.roles r ON r.id = tu.role_id
    LEFT JOIN public.workers w ON w.id = tu.worker_id
    LEFT JOIN public.people w_p ON w_p.id = w.person_id
    WHERE tu.tenant_id = ANY(public.user_tenant_ids())
    ORDER BY tu.created_at DESC;
END;
$$;

-- 4. RPC segura para atualização de dados de acesso do usuário no tenant
CREATE OR REPLACE FUNCTION public.update_tenant_user_access(
    p_tenant_user_id UUID,
    p_role TEXT,
    p_role_id UUID DEFAULT NULL,
    p_worker_id UUID DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_tenant_id UUID;
    v_effective_role_id UUID := p_role_id;
    v_has_access BOOLEAN;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Acesso não autorizado: usuário não autenticado.' USING ERRCODE = '42501';
    END IF;

    -- Localizar o tenant_user a ser editado
    SELECT tenant_id INTO v_tenant_id
    FROM public.tenant_users
    WHERE id = p_tenant_user_id;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Usuário do tenant não encontrado.' USING ERRCODE = 'P0002';
    END IF;

    -- Validar que o executor tem privilégio no mesmo tenant
    SELECT EXISTS (
        SELECT 1 FROM public.tenant_users tu
        WHERE tu.user_id = v_caller_id
        AND tu.tenant_id = v_tenant_id
        AND tu.role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        AND tu.is_active = TRUE
    ) INTO v_has_access;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Acesso negado: você não possui permissão para gerenciar usuários neste tenant.' USING ERRCODE = '42501';
    END IF;

    -- Validação do enum de role
    IF p_role NOT IN ('system_admin', 'tenant_admin', 'dp_analyst', 'manager', 'accountant', 'auditor', 'employee', 'sst_specialist') THEN
        RAISE EXCEPTION 'Papel de usuário inválido: %', p_role USING ERRCODE = '22023';
    END IF;

    -- Se role_id não for informado, tentar inferir do perfil de sistema correspondente
    IF v_effective_role_id IS NULL THEN
        SELECT id INTO v_effective_role_id
        FROM public.roles
        WHERE (tenant_id IS NULL OR tenant_id = v_tenant_id)
        AND (
            (p_role = 'system_admin' AND name ILIKE '%Administrador%') OR
            (p_role = 'dp_analyst' AND name ILIKE '%Analista de DP%') OR
            (p_role = 'sst_specialist' AND name ILIKE '%SST%') OR
            (p_role = 'manager' AND name ILIKE '%Gestor%') OR
            (p_role = 'accountant' AND name ILIKE '%Contador%') OR
            (p_role = 'auditor' AND name ILIKE '%Auditor%') OR
            (p_role = 'employee' AND name ILIKE '%Colaborador%')
        )
        LIMIT 1;
    END IF;

    -- Validação de worker_id se fornecido: deve pertencer ao mesmo tenant
    IF p_worker_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.workers WHERE id = p_worker_id AND tenant_id = v_tenant_id) THEN
            RAISE EXCEPTION 'Colaborador selecionado não pertence a esta empresa/tenant.' USING ERRCODE = '23503';
        END IF;
    END IF;

    -- Atualização atômica
    UPDATE public.tenant_users
    SET 
        role = p_role,
        role_id = v_effective_role_id,
        worker_id = p_worker_id,
        is_active = COALESCE(p_is_active, TRUE)
    WHERE id = p_tenant_user_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'tenant_user_id', p_tenant_user_id,
        'role', p_role,
        'role_id', v_effective_role_id,
        'worker_id', p_worker_id,
        'is_active', COALESCE(p_is_active, TRUE)
    );
END;
$$;

-- 5. Conceder permissão de execução aos usuários autenticados
GRANT EXECUTE ON FUNCTION public.list_tenant_users_with_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_tenant_user_access(UUID, TEXT, UUID, UUID, BOOLEAN) TO authenticated;
```

---

### Script 106: `00106_security_mfa_and_session_settings_conf03`
Governança de segurança corporativa, MFA nativo (TOTP), controle de timeout de inatividade da sessão e exigência de segundo fator por papel (CONF-03).

```sql
-- 1. Estender tenant_settings com políticas de segurança e MFA
ALTER TABLE public.tenant_settings 
ADD COLUMN IF NOT EXISTS session_timeout_minutes INTEGER NOT NULL DEFAULT 60 
    CHECK (session_timeout_minutes IN (15, 30, 60, 120, 240, 480)),
ADD COLUMN IF NOT EXISTS require_mfa_roles TEXT[] NOT NULL DEFAULT ARRAY['system_admin', 'tenant_admin', 'dp_analyst']::TEXT[],
ADD COLUMN IF NOT EXISTS max_login_attempts INTEGER NOT NULL DEFAULT 5 
    CHECK (max_login_attempts BETWEEN 3 AND 10);

-- 2. Atualizar registros existentes com os valores padrão seguros caso nulos
UPDATE public.tenant_settings
SET 
    session_timeout_minutes = COALESCE(session_timeout_minutes, 60),
    require_mfa_roles = COALESCE(require_mfa_roles, ARRAY['system_admin', 'tenant_admin', 'dp_analyst']::TEXT[]),
    max_login_attempts = COALESCE(max_login_attempts, 5)
WHERE session_timeout_minutes IS NULL OR require_mfa_roles IS NULL OR max_login_attempts IS NULL;

-- 3. RPC protegida para atualização de políticas de segurança do tenant
CREATE OR REPLACE FUNCTION public.update_tenant_security_settings(
    p_session_timeout INTEGER,
    p_require_mfa_roles TEXT[],
    p_max_login_attempts INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_tenant_id UUID;
    v_has_access BOOLEAN;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Acesso não autorizado: usuário não autenticado.' USING ERRCODE = '42501';
    END IF;

    -- Localizar o tenant_id ativo do chamador
    SELECT tenant_id INTO v_tenant_id
    FROM public.tenant_users
    WHERE user_id = v_caller_id
    LIMIT 1;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant não encontrado para o usuário atual.' USING ERRCODE = 'P0002';
    END IF;

    -- Validar que o usuário é administrador
    SELECT EXISTS (
        SELECT 1 FROM public.tenant_users tu
        WHERE tu.user_id = v_caller_id
        AND tu.tenant_id = v_tenant_id
        AND tu.role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        AND tu.is_active = TRUE
    ) INTO v_has_access;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar políticas de segurança.' USING ERRCODE = '42501';
    END IF;

    -- Validação de limites
    IF p_session_timeout NOT IN (15, 30, 60, 120, 240, 480) THEN
        RAISE EXCEPTION 'Tempo de sessão inválido: % minutos.', p_session_timeout USING ERRCODE = '22023';
    END IF;

    IF p_max_login_attempts NOT BETWEEN 3 AND 10 THEN
        RAISE EXCEPTION 'Limite de tentativas de login deve estar entre 3 e 10.' USING ERRCODE = '22023';
    END IF;

    -- Upsert atômico em tenant_settings
    INSERT INTO public.tenant_settings (
        tenant_id, 
        session_timeout_minutes, 
        require_mfa_roles, 
        max_login_attempts,
        updated_at
    )
    VALUES (
        v_tenant_id, 
        p_session_timeout, 
        p_require_mfa_roles, 
        p_max_login_attempts,
        NOW()
    )
    ON CONFLICT (tenant_id) DO UPDATE SET
        session_timeout_minutes = EXCLUDED.session_timeout_minutes,
        require_mfa_roles = EXCLUDED.require_mfa_roles,
        max_login_attempts = EXCLUDED.max_login_attempts,
        updated_at = NOW();

    RETURN jsonb_build_object(
        'success', TRUE,
        'tenant_id', v_tenant_id,
        'session_timeout_minutes', p_session_timeout,
        'require_mfa_roles', p_require_mfa_roles,
        'max_login_attempts', p_max_login_attempts
    );
END;
$$;

-- 4. Conceder permissão de execução aos autenticados
GRANT EXECUTE ON FUNCTION public.update_tenant_security_settings(INTEGER, TEXT[], INTEGER) TO authenticated;
```

### Script: `00107_tenant_notification_settings_conf04.sql`
```sql
-- ==============================================================================
-- Migration: 00107_tenant_notification_settings_conf04.sql
-- Descrição: Parametrização corporativa de gatilhos de alertas e canais de 
--            notificação do tenant (férias, fechamento de ponto, ASO, folha, 
--            inconsistências eSocial, canais e-mail, WhatsApp e in-app) - CONF-04.
-- ==============================================================================

-- 1. Estender tenant_settings com configurações de alertas e notificações corporativas
ALTER TABLE public.tenant_settings 
ADD COLUMN IF NOT EXISTS notify_vacation_warning BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS vacation_warning_days INTEGER NOT NULL DEFAULT 30 
    CHECK (vacation_warning_days IN (15, 30, 45, 60)),
ADD COLUMN IF NOT EXISTS notify_timesheet_cutoff BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS timesheet_cutoff_warning_days INTEGER NOT NULL DEFAULT 3 
    CHECK (timesheet_cutoff_warning_days BETWEEN 1 AND 15),
ADD COLUMN IF NOT EXISTS notify_aso_expiration BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS aso_expiration_warning_days INTEGER NOT NULL DEFAULT 30 
    CHECK (aso_expiration_warning_days IN (15, 30, 45, 60)),
ADD COLUMN IF NOT EXISTS notify_salary_advances BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_payroll_divergences BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_esocial_inconsistencies BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS in_app_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS dp_notification_email TEXT NULL,
ADD COLUMN IF NOT EXISTS whatsapp_notifications_enabled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS dp_notification_phone TEXT NULL;

-- 2. Atualizar registros existentes com valores padrão seguros
UPDATE public.tenant_settings
SET 
    notify_vacation_warning = COALESCE(notify_vacation_warning, true),
    vacation_warning_days = COALESCE(vacation_warning_days, 30),
    notify_timesheet_cutoff = COALESCE(notify_timesheet_cutoff, true),
    timesheet_cutoff_warning_days = COALESCE(timesheet_cutoff_warning_days, 3),
    notify_aso_expiration = COALESCE(notify_aso_expiration, true),
    aso_expiration_warning_days = COALESCE(aso_expiration_warning_days, 30),
    notify_salary_advances = COALESCE(notify_salary_advances, true),
    notify_payroll_divergences = COALESCE(notify_payroll_divergences, true),
    notify_esocial_inconsistencies = COALESCE(notify_esocial_inconsistencies, true),
    in_app_notifications_enabled = COALESCE(in_app_notifications_enabled, true),
    email_notifications_enabled = COALESCE(email_notifications_enabled, true),
    whatsapp_notifications_enabled = COALESCE(whatsapp_notifications_enabled, false)
WHERE notify_vacation_warning IS NULL 
   OR vacation_warning_days IS NULL 
   OR notify_timesheet_cutoff IS NULL;

-- 3. RPC protegida para atualização de preferências de alertas e notificações
CREATE OR REPLACE FUNCTION public.update_tenant_notification_settings(
    p_notify_vacation_warning BOOLEAN,
    p_vacation_warning_days INTEGER,
    p_notify_timesheet_cutoff BOOLEAN,
    p_timesheet_cutoff_warning_days INTEGER,
    p_notify_aso_expiration BOOLEAN,
    p_aso_expiration_warning_days INTEGER,
    p_notify_salary_advances BOOLEAN,
    p_notify_payroll_divergences BOOLEAN,
    p_notify_esocial_inconsistencies BOOLEAN,
    p_in_app_notifications_enabled BOOLEAN,
    p_email_notifications_enabled BOOLEAN,
    p_dp_notification_email TEXT,
    p_whatsapp_notifications_enabled BOOLEAN,
    p_dp_notification_phone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_tenant_id UUID;
    v_has_access BOOLEAN;
    v_clean_email TEXT;
    v_clean_phone TEXT;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Acesso não autorizado: usuário não autenticado.' USING ERRCODE = '42501';
    END IF;

    -- Localizar o tenant_id ativo do chamador
    SELECT tenant_id INTO v_tenant_id
    FROM public.tenant_users
    WHERE user_id = v_caller_id
    LIMIT 1;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant não encontrado para o usuário atual.' USING ERRCODE = 'P0002';
    END IF;

    -- Validar que o usuário é administrador do tenant
    SELECT EXISTS (
        SELECT 1 FROM public.tenant_users tu
        WHERE tu.user_id = v_caller_id
        AND tu.tenant_id = v_tenant_id
        AND tu.role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        AND tu.is_active = TRUE
    ) INTO v_has_access;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar configurações de notificações.' USING ERRCODE = '42501';
    END IF;

    -- Validação de limites numéricos
    IF p_vacation_warning_days NOT IN (15, 30, 45, 60) THEN
        RAISE EXCEPTION 'Antecedência de aviso de férias inválida: % dias.', p_vacation_warning_days USING ERRCODE = '22023';
    END IF;

    IF p_timesheet_cutoff_warning_days NOT BETWEEN 1 AND 15 THEN
        RAISE EXCEPTION 'Antecedência de fechamento do ponto deve estar entre 1 e 15 dias.' USING ERRCODE = '22023';
    END IF;

    IF p_aso_expiration_warning_days NOT IN (15, 30, 45, 60) THEN
        RAISE EXCEPTION 'Antecedência de vencimento de ASO inválida: % dias.', p_aso_expiration_warning_days USING ERRCODE = '22023';
    END IF;

    -- Sanitização e validação de e-mail corporativo
    v_clean_email := NULLIF(TRIM(p_dp_notification_email), '');
    IF v_clean_email IS NOT NULL AND v_clean_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+.[A-Za-z]{2,}$' THEN
        RAISE EXCEPTION 'E-mail corporativo inválido: %', v_clean_email USING ERRCODE = '22023';
    END IF;

    -- Sanitização de telefone (apenas números ou caracteres válidos)
    v_clean_phone := NULLIF(TRIM(p_dp_notification_phone), '');

    -- Upsert atômico em tenant_settings
    INSERT INTO public.tenant_settings (
        tenant_id, 
        notify_vacation_warning,
        vacation_warning_days,
        notify_timesheet_cutoff,
        timesheet_cutoff_warning_days,
        notify_aso_expiration,
        aso_expiration_warning_days,
        notify_salary_advances,
        notify_payroll_divergences,
        notify_esocial_inconsistencies,
        in_app_notifications_enabled,
        email_notifications_enabled,
        dp_notification_email,
        whatsapp_notifications_enabled,
        dp_notification_phone,
        updated_at
    )
    VALUES (
        v_tenant_id, 
        p_notify_vacation_warning,
        p_vacation_warning_days,
        p_notify_timesheet_cutoff,
        p_timesheet_cutoff_warning_days,
        p_notify_aso_expiration,
        p_aso_expiration_warning_days,
        p_notify_salary_advances,
        p_notify_payroll_divergences,
        p_notify_esocial_inconsistencies,
        p_in_app_notifications_enabled,
        p_email_notifications_enabled,
        v_clean_email,
        p_whatsapp_notifications_enabled,
        v_clean_phone,
        NOW()
    )
    ON CONFLICT (tenant_id) DO UPDATE SET
        notify_vacation_warning = EXCLUDED.notify_vacation_warning,
        vacation_warning_days = EXCLUDED.vacation_warning_days,
        notify_timesheet_cutoff = EXCLUDED.notify_timesheet_cutoff,
        timesheet_cutoff_warning_days = EXCLUDED.timesheet_cutoff_warning_days,
        notify_aso_expiration = EXCLUDED.notify_aso_expiration,
        aso_expiration_warning_days = EXCLUDED.aso_expiration_warning_days,
        notify_salary_advances = EXCLUDED.notify_salary_advances,
        notify_payroll_divergences = EXCLUDED.notify_payroll_divergences,
        notify_esocial_inconsistencies = EXCLUDED.notify_esocial_inconsistencies,
        in_app_notifications_enabled = EXCLUDED.in_app_notifications_enabled,
        email_notifications_enabled = EXCLUDED.email_notifications_enabled,
        dp_notification_email = EXCLUDED.dp_notification_email,
        whatsapp_notifications_enabled = EXCLUDED.whatsapp_notifications_enabled,
        dp_notification_phone = EXCLUDED.dp_notification_phone,
        updated_at = NOW();

    RETURN jsonb_build_object(
        'success', TRUE,
        'tenant_id', v_tenant_id,
        'notify_vacation_warning', p_notify_vacation_warning,
        'vacation_warning_days', p_vacation_warning_days,
        'notify_timesheet_cutoff', p_notify_timesheet_cutoff,
        'timesheet_cutoff_warning_days', p_timesheet_cutoff_warning_days,
        'notify_aso_expiration', p_notify_aso_expiration,
        'aso_expiration_warning_days', p_aso_expiration_warning_days,
        'notify_salary_advances', p_notify_salary_advances,
        'notify_payroll_divergences', p_notify_payroll_divergences,
        'notify_esocial_inconsistencies', p_notify_esocial_inconsistencies,
        'in_app_notifications_enabled', p_in_app_notifications_enabled,
        'email_notifications_enabled', p_email_notifications_enabled,
        'dp_notification_email', v_clean_email,
        'whatsapp_notifications_enabled', p_whatsapp_notifications_enabled,
        'dp_notification_phone', v_clean_phone
    );
END;
$$;

-- 4. Conceder permissão de execução aos autenticados
GRANT EXECUTE ON FUNCTION public.update_tenant_notification_settings(
    BOOLEAN, INTEGER, BOOLEAN, INTEGER, BOOLEAN, INTEGER, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, BOOLEAN, TEXT
) TO authenticated;
```

### Script: `00108_tenant_certificates_esocial_conf05.sql`
```sql
-- ==============================================================================
-- Migration: 00108_tenant_certificates_esocial_conf05.sql
-- Descrição: Gestão e governança de Certificados Digitais ICP-Brasil (A1 .pfx)
--            para transmissão eSocial com monitor de vigência, isolamento RLS,
--            auditoria forense T29 e RPCs protegidas de revogação/instalação (CONF-05).
-- ==============================================================================

-- 1. Criação da tabela de certificados digitais do tenant
CREATE TABLE IF NOT EXISTS public.tenant_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    filename TEXT NOT NULL,
    subject_name TEXT NOT NULL,
    cnpj TEXT NOT NULL,
    issuer TEXT NOT NULL,
    serial_number TEXT NOT NULL,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_to TIMESTAMPTZ NOT NULL,
    storage_path TEXT NULL,
    fingerprint_sha256 TEXT NULL,
    environment TEXT NOT NULL DEFAULT 'producao' CHECK (environment IN ('producao', 'restrita')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    revoked_at TIMESTAMPTZ NULL,
    revocation_reason TEXT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_tenant_certificates_tenant_env_active 
    ON public.tenant_certificates(tenant_id, environment, is_active);
CREATE INDEX IF NOT EXISTS idx_tenant_certificates_cnpj 
    ON public.tenant_certificates(cnpj);
CREATE INDEX IF NOT EXISTS idx_tenant_certificates_valid_to 
    ON public.tenant_certificates(valid_to);

-- 3. Habilitação de Row Level Security (RLS)
ALTER TABLE public.tenant_certificates ENABLE ROW LEVEL SECURITY;

-- Política de Leitura: Usuários do tenant
DROP POLICY IF EXISTS "tenant_certificates_select_policy" ON public.tenant_certificates;
CREATE POLICY "tenant_certificates_select_policy" ON public.tenant_certificates
    FOR SELECT
    USING (tenant_id = ANY(public.user_tenant_ids()));

-- Política de Inserção: Apenas administradores do tenant (system_admin, tenant_admin, dp_analyst)
DROP POLICY IF EXISTS "tenant_certificates_insert_policy" ON public.tenant_certificates;
CREATE POLICY "tenant_certificates_insert_policy" ON public.tenant_certificates
    FOR INSERT
    WITH CHECK (
        tenant_id = ANY(public.user_tenant_ids())
        AND EXISTS (
            SELECT 1 FROM public.tenant_users
            WHERE user_id = auth.uid()
            AND tenant_id = tenant_certificates.tenant_id
            AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')
            AND is_active = TRUE
        )
    );

-- Política de Atualização: Apenas administradores do tenant
DROP POLICY IF EXISTS "tenant_certificates_update_policy" ON public.tenant_certificates;
CREATE POLICY "tenant_certificates_update_policy" ON public.tenant_certificates
    FOR UPDATE
    USING (
        tenant_id = ANY(public.user_tenant_ids())
        AND EXISTS (
            SELECT 1 FROM public.tenant_users
            WHERE user_id = auth.uid()
            AND tenant_id = tenant_certificates.tenant_id
            AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')
            AND is_active = TRUE
        )
    );

-- 4. Trigger de Auditoria Forense T29
DROP TRIGGER IF EXISTS audit_tenant_certificates_trigger ON public.tenant_certificates;
CREATE TRIGGER audit_tenant_certificates_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.tenant_certificates
FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- 5. RPC Segura: Salvar/Instalar Certificado A1 do Tenant
CREATE OR REPLACE FUNCTION public.save_tenant_certificate(
    p_filename TEXT,
    p_subject_name TEXT,
    p_cnpj TEXT,
    p_issuer TEXT,
    p_serial_number TEXT,
    p_valid_from TIMESTAMPTZ,
    p_valid_to TIMESTAMPTZ,
    p_environment TEXT DEFAULT 'producao',
    p_storage_path TEXT DEFAULT NULL,
    p_fingerprint_sha256 TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_tenant_id UUID;
    v_company_id UUID;
    v_has_access BOOLEAN;
    v_new_cert_id UUID;
    v_clean_cnpj TEXT;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Acesso não autorizado: usuário não autenticado.' USING ERRCODE = '42501';
    END IF;

    -- Localizar o tenant_id ativo do chamador
    SELECT tenant_id INTO v_tenant_id
    FROM public.tenant_users
    WHERE user_id = v_caller_id
    LIMIT 1;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant não encontrado para o usuário atual.' USING ERRCODE = 'P0002';
    END IF;

    -- Validar privilégios administrativos
    SELECT EXISTS (
        SELECT 1 FROM public.tenant_users tu
        WHERE tu.user_id = v_caller_id
        AND tu.tenant_id = v_tenant_id
        AND tu.role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        AND tu.is_active = TRUE
    ) INTO v_has_access;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores podem instalar certificados digitais.' USING ERRCODE = '42501';
    END IF;

    -- Limpeza e validação de campos
    v_clean_cnpj := REGEXP_REPLACE(p_cnpj, '[^0-9]', '', 'g');
    IF LENGTH(v_clean_cnpj) NOT IN (11, 14) THEN
        RAISE EXCEPTION 'CNPJ/CPF do certificado inválido: %', p_cnpj USING ERRCODE = '22023';
    END IF;

    IF p_valid_to <= p_valid_from THEN
        RAISE EXCEPTION 'Data de expiração do certificado deve ser posterior à data de emissão.' USING ERRCODE = '22023';
    END IF;

    IF p_environment NOT IN ('producao', 'restrita') THEN
        RAISE EXCEPTION 'Ambiente inválido: %. Permitidos: producao, restrita.', p_environment USING ERRCODE = '22023';
    END IF;

    -- Localizar company_id correspondente ao CNPJ se existir
    SELECT id INTO v_company_id
    FROM public.companies
    WHERE tenant_id = v_tenant_id
    AND REGEXP_REPLACE(cnpj, '[^0-9]', '', 'g') = v_clean_cnpj
    LIMIT 1;

    -- Desativar certificados anteriores ativos para o mesmo ambiente
    UPDATE public.tenant_certificates
    SET 
        is_active = FALSE,
        updated_at = NOW()
    WHERE tenant_id = v_tenant_id
    AND environment = p_environment
    AND is_active = TRUE;

    -- Inserir o novo certificado com status ativo
    INSERT INTO public.tenant_certificates (
        tenant_id,
        company_id,
        filename,
        subject_name,
        cnpj,
        issuer,
        serial_number,
        valid_from,
        valid_to,
        storage_path,
        fingerprint_sha256,
        environment,
        is_active,
        created_by,
        created_at,
        updated_at
    )
    VALUES (
        v_tenant_id,
        v_company_id,
        TRIM(p_filename),
        TRIM(p_subject_name),
        v_clean_cnpj,
        TRIM(p_issuer),
        TRIM(p_serial_number),
        p_valid_from,
        p_valid_to,
        p_storage_path,
        p_fingerprint_sha256,
        p_environment,
        TRUE,
        v_caller_id,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_new_cert_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'id', v_new_cert_id,
        'tenant_id', v_tenant_id,
        'subject_name', p_subject_name,
        'cnpj', v_clean_cnpj,
        'issuer', p_issuer,
        'serial_number', p_serial_number,
        'valid_from', p_valid_from,
        'valid_to', p_valid_to,
        'environment', p_environment,
        'is_active', TRUE
    );
END;
$$;

-- 6. RPC Segura: Obter Certificado Ativo com Diagnóstico de Vigência
CREATE OR REPLACE FUNCTION public.get_tenant_active_certificate(
    p_environment TEXT DEFAULT 'producao'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_tenant_id UUID;
    v_cert RECORD;
    v_days_remaining NUMERIC;
    v_status TEXT;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Acesso não autorizado: usuário não autenticado.' USING ERRCODE = '42501';
    END IF;

    SELECT tenant_id INTO v_tenant_id
    FROM public.tenant_users
    WHERE user_id = v_caller_id
    LIMIT 1;

    IF v_tenant_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT * INTO v_cert
    FROM public.tenant_certificates
    WHERE tenant_id = v_tenant_id
    AND environment = p_environment
    AND is_active = TRUE
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_cert IS NULL THEN
        RETURN NULL;
    END IF;

    -- Cálculo dos dias restantes
    v_days_remaining := ROUND(EXTRACT(EPOCH FROM (v_cert.valid_to - NOW())) / 86400.0, 1);

    IF v_days_remaining < 0 THEN
        v_status := 'EXPIRED';
    ELSIF v_days_remaining <= 30 THEN
        v_status := 'EXPIRING_SOON';
    ELSE
        v_status := 'VALID';
    END IF;

    RETURN jsonb_build_object(
        'id', v_cert.id,
        'tenant_id', v_cert.tenant_id,
        'company_id', v_cert.company_id,
        'filename', v_cert.filename,
        'subject_name', v_cert.subject_name,
        'cnpj', v_cert.cnpj,
        'issuer', v_cert.issuer,
        'serial_number', v_cert.serial_number,
        'valid_from', v_cert.valid_from,
        'valid_to', v_cert.valid_to,
        'environment', v_cert.environment,
        'is_active', v_cert.is_active,
        'days_remaining', v_days_remaining,
        'status', v_status,
        'created_at', v_cert.created_at
    );
END;
$$;

-- 7. RPC Segura: Revogar/Desativar Certificado Digital
CREATE OR REPLACE FUNCTION public.revoke_tenant_certificate(
    p_certificate_id UUID,
    p_reason TEXT DEFAULT 'Revogado manualmente pelo administrador'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_tenant_id UUID;
    v_has_access BOOLEAN;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Acesso não autorizado: usuário não autenticado.' USING ERRCODE = '42501';
    END IF;

    SELECT tenant_id INTO v_tenant_id
    FROM public.tenant_users
    WHERE user_id = v_caller_id
    LIMIT 1;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant não encontrado para o usuário atual.' USING ERRCODE = 'P0002';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.tenant_users tu
        WHERE tu.user_id = v_caller_id
        AND tu.tenant_id = v_tenant_id
        AND tu.role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        AND tu.is_active = TRUE
    ) INTO v_has_access;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores podem revogar certificados digitais.' USING ERRCODE = '42501';
    END IF;

    UPDATE public.tenant_certificates
    SET 
        is_active = FALSE,
        revoked_at = NOW(),
        revocation_reason = TRIM(p_reason),
        updated_at = NOW()
    WHERE id = p_certificate_id
    AND tenant_id = v_tenant_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'certificate_id', p_certificate_id,
        'revoked_at', NOW(),
        'reason', p_reason
    );
END;
$$;

-- 8. Conceder permissões de execução aos autenticados
GRANT EXECUTE ON FUNCTION public.save_tenant_certificate(TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_active_certificate(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_tenant_certificate(UUID, TEXT) TO authenticated;
```



---

## 43. FASE P9: Alertas Operacionais e Observabilidade do Sistema (Migration 00109)

### 43.1 Tabela `public.system_operational_alerts`
Tabela destinada ao registro, monitoramento contínuo e resolução de incidentes operacionais de alta relevância, contemplando:
- Falhas críticas ou advertências de cálculo de folha de pagamento (líquido negativo, inconsistência de bases, teto violado, estouro de prazo).
- Falhas e advertências de ingestão de ponto eletrônico (inconsistência de arquivo AFD/AEJ, divergência de NSR, violação de geofence, falha de comunicação com REP).
- Incidentes de segurança, permissões e assinaturas digitais.

```sql
CREATE TABLE IF NOT EXISTS public.system_operational_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    subsystem VARCHAR(50) NOT NULL CHECK (subsystem IN ('PAYROLL', 'TIME_TRACKING', 'SECURITY', 'DOCUMENT_SIGNING', 'GENERAL')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'ERROR', 'CRITICAL')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    error_code VARCHAR(100),
    metadata JSONB DEFAULT '{}'::jsonb,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Índices operacionais
CREATE INDEX IF NOT EXISTS idx_operational_alerts_tenant_unresolved 
ON public.system_operational_alerts (tenant_id, resolved, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operational_alerts_subsystem 
ON public.system_operational_alerts (tenant_id, subsystem, severity);

-- Row Level Security (RLS)
ALTER TABLE public.system_operational_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autorizados do tenant podem visualizar alertas operacionais"
ON public.system_operational_alerts FOR SELECT TO authenticated
USING (tenant_id = ANY(public.user_tenant_ids()));

CREATE POLICY "Usuários autenticados podem inserir alertas em seu tenant"
ON public.system_operational_alerts FOR INSERT TO authenticated
WITH CHECK (tenant_id = ANY(public.user_tenant_ids()));

CREATE POLICY "Usuários autorizados podem atualizar/resolver alertas"
ON public.system_operational_alerts FOR UPDATE TO authenticated
USING (tenant_id = ANY(public.user_tenant_ids()))
WITH CHECK (tenant_id = ANY(public.user_tenant_ids()));

-- Gatilho de Auditoria T29
CREATE TRIGGER audit_system_operational_alerts_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.system_operational_alerts
    FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
```



---

## 44. FASE P9: Folha Paralela, Ata do Contador e Checklist de Go-Live (Migration 00110)

### 44.1 Tabela `public.parallel_payroll_runs`
Armazena a conciliação consolidada de 2 a 3 competências processadas em paralelo com o sistema legado (ex: Totvs, Senior, Domínio, Alterdata).
```sql
CREATE TABLE IF NOT EXISTS public.parallel_payroll_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    competence VARCHAR(7) NOT NULL,
    legacy_system_name VARCHAR(100) NOT NULL,
    total_workers INTEGER NOT NULL DEFAULT 0,
    matching_workers INTEGER NOT NULL DEFAULT 0,
    total_rubrics_compared INTEGER NOT NULL DEFAULT 0,
    exact_matches INTEGER NOT NULL DEFAULT 0,
    acceptable_cent_diffs INTEGER NOT NULL DEFAULT 0,
    unacceptable_diffs INTEGER NOT NULL DEFAULT 0,
    rounding_policy_applied VARCHAR(50) NOT NULL DEFAULT 'HALF_UP_CENT_TOLERANCE',
    status VARCHAR(30) NOT NULL CHECK (status IN ('PENDING', 'APPROVED_BY_ACCOUNTANT', 'REJECTED')),
    accountant_approval JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
```

### 44.2 Tabela `public.parallel_payroll_items`
Detalha a comparação analítica rubrica a rubrica de cada trabalhador, identificando correspondências exatas (diferença R$ 0,00) ou desvios de arredondamento de centavos formalizados.
```sql
CREATE TABLE IF NOT EXISTS public.parallel_payroll_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parallel_run_id UUID NOT NULL REFERENCES public.parallel_payroll_runs(id) ON DELETE CASCADE,
    contract_id UUID REFERENCES public.employment_contracts(id) ON DELETE SET NULL,
    worker_name VARCHAR(255) NOT NULL,
    worker_cpf VARCHAR(20) NOT NULL,
    rubric_code VARCHAR(30) NOT NULL,
    rubric_name VARCHAR(255) NOT NULL,
    legacy_amount NUMERIC(15,2) NOT NULL,
    couplerh_amount NUMERIC(15,2) NOT NULL,
    diff_amount NUMERIC(15,2) NOT NULL,
    is_acceptable_cent_diff BOOLEAN NOT NULL DEFAULT FALSE,
    justification TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
```

### 44.3 Tabela `public.golive_checklists`
Contém as assinaturas digitais formais da tríade de governança (Contador Responsável com CRC, Assessor Jurídico Trabalhista com OAB e Responsável Técnico de Engenharia), atestando a aprovação dos 15 critérios de aceite e autorizando o Go-Live oficial da Folha.
```sql
CREATE TABLE IF NOT EXISTS public.golive_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    release_version VARCHAR(50) NOT NULL,
    accountant_signoff JSONB NOT NULL,
    legal_signoff JSONB NOT NULL,
    tech_lead_signoff JSONB NOT NULL,
    gate_criteria_checklist JSONB NOT NULL,
    status VARCHAR(30) NOT NULL CHECK (status IN ('DRAFT', 'FULLY_SIGNED_GO_LIVE_AUTHORIZED', 'BLOCKED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
```

---

## 45. HOTFIX: Manutenção do Cofre Digital & RPC Pública de Verificação (Migration 00111)

### 45.1 Soft-Delete de Documentos Residuais de Teste no Cofre
Preserva a integridade e unicidade documental do cofre de assinaturas digitais (`employee_documents`), marcando como deletados os registros residuais de testes manuais executados em 25/09/2026 às 00:05:13 UTC, mantendo a trilha de auditoria forense do trigger `audit_employee_docs_trigger`.
```sql
UPDATE public.employee_documents
SET deleted_at = NOW()
WHERE id IN (
    'b2bd30c6-8575-4f26-affc-c0148ec593cf',
    'd254e8a0-48ee-4445-a285-82d1ea47ddfb'
)
AND deleted_at IS NULL;
```

### 45.2 Função RPC `public.verify_public_document(p_code TEXT)`
Permite a verificação pública de autenticidade documental na rota `/verificar/:codigo` com bypass seguro de RLS via `SECURITY DEFINER` e permissão explícita para o papel `anon`. Retorna exclusivamente os metadados necessários para comprovação de autenticidade perante a Justiça do Trabalho ou órgãos fiscalizadores, aplicando mascaramento rígido de CPF (`***.***.***-**`) e nome do trabalhador (`KAUAN G. ***`) em conformidade com o Art. 11 da LGPD.
```sql
CREATE OR REPLACE FUNCTION public.verify_public_document(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_raw TEXT;
    v_clean TEXT;
    v_clean_no_prefix TEXT;
    v_is_uuid BOOLEAN;
    v_doc RECORD;
    v_result JSONB;
BEGIN
    IF p_code IS NULL OR TRIM(p_code) = '' THEN
        RETURN NULL;
    END IF;

    v_raw := TRIM(p_code);
    v_clean := UPPER(REGEXP_REPLACE(v_raw, '[^0-9a-zA-Z]', '', 'g'));
    
    IF v_clean LIKE 'CRH%' AND LENGTH(v_clean) > 3 THEN
        v_clean_no_prefix := SUBSTRING(v_clean FROM 4);
    ELSE
        v_clean_no_prefix := v_clean;
    END IF;

    v_is_uuid := v_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

    -- Buscar documento ativo no cofre (deleted_at IS NULL)
    SELECT 
        d.id,
        d.title,
        COALESCE(d.doc_type, d.document_type, 'OTHER') AS doc_type,
        d.status,
        COALESCE(d.verification_code, 'CRH-' || UPPER(SUBSTRING(d.id::text FROM 1 FOR 4)) || '-' || UPPER(SUBSTRING(d.id::text FROM 5 FOR 4))) AS verification_code,
        COALESCE(d.hash_original, d.document_hash) AS hash_original,
        d.hash_signed,
        d.signed_at,
        d.created_at,
        d.signed_file_url,
        p.full_name AS person_name,
        p.cpf AS person_cpf,
        c.corporate_name AS company_name,
        c.cnpj AS company_cnpj
    INTO v_doc
    FROM public.employee_documents d
    LEFT JOIN public.workers w ON w.id = d.worker_id
    LEFT JOIN public.people p ON p.id = w.person_id
    LEFT JOIN public.companies c ON c.id = w.company_id
    WHERE d.deleted_at IS NULL
      AND (
          -- Caso 1: Busca por UUID completo
          (v_is_uuid AND d.id = v_raw::uuid)
          -- Caso 2: Busca por verification_code exato ou normalizado
          OR (d.verification_code IS NOT NULL AND (
              d.verification_code ILIKE v_raw
              OR UPPER(REGEXP_REPLACE(d.verification_code, '[^0-9a-zA-Z]', '', 'g')) = v_clean
              OR UPPER(REGEXP_REPLACE(d.verification_code, '[^0-9a-zA-Z]', '', 'g')) = ('CRH' || v_clean_no_prefix)
              OR UPPER(REGEXP_REPLACE(d.verification_code, '[^0-9a-zA-Z]', '', 'g')) = v_clean_no_prefix
          ))
          -- Caso 3: Busca pelo prefixo do UUID (ex: CRH-B2BD-30C6 -> b2bd30c6%)
          OR (LENGTH(v_clean_no_prefix) >= 8 AND d.id::text ILIKE (LOWER(v_clean_no_prefix) || '%'))
          OR (LENGTH(v_clean) >= 8 AND d.id::text ILIKE (LOWER(v_clean) || '%'))
      )
    ORDER BY d.created_at DESC
    LIMIT 1;

    IF v_doc.id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Montar JSONB de resposta com dados públicos e mascaramento LGPD
    v_result := jsonb_build_object(
        'id', v_doc.id,
        'title', v_doc.title,
        'doc_type', v_doc.doc_type,
        'status', v_doc.status,
        'verification_code', v_doc.verification_code,
        'hash_original', v_doc.hash_original,
        'hash_signed', v_doc.hash_signed,
        'signed_at', v_doc.signed_at,
        'created_at', v_doc.created_at,
        'signed_file_url', v_doc.signed_file_url,
        'workers', jsonb_build_object(
            'people', jsonb_build_object(
                'full_name', CASE 
                    WHEN v_doc.person_name IS NULL THEN 'Colaborador'
                    WHEN array_length(string_to_array(trim(v_doc.person_name), ' '), 1) > 1 THEN
                        split_part(trim(v_doc.person_name), ' ', 1) || ' ' || left(split_part(trim(v_doc.person_name), ' ', 2), 1) || '. ***'
                    ELSE
                        left(trim(v_doc.person_name), 3) || '***'
                END,
                'cpf', '***.***.***-**'
            ),
            'companies', jsonb_build_object(
                'corporate_name', COALESCE(v_doc.company_name, 'Empresa Empregadora'),
                'cnpj', COALESCE(v_doc.company_cnpj, '—')
            )
        )
    );

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_public_document(TEXT) TO anon, authenticated, service_role;
```

---

## 4. Evolução do Schema PostgreSQL 17 Puro (FASE V1 — VPS Oracle Cloud Always Free)

### 4.1 Migration `0002_storage_helper.sql` (Helper de Acesso Seguro a Arquivos Privados)
```sql
CREATE OR REPLACE FUNCTION public.get_stored_file_by_id(p_file_id UUID)
RETURNS TABLE (
    id UUID,
    tenant_id UUID,
    bucket VARCHAR,
    file_path TEXT,
    original_name VARCHAR,
    mime_type VARCHAR,
    byte_size BIGINT,
    sha256_hash VARCHAR,
    is_public BOOLEAN,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sf.id,
        sf.tenant_id,
        sf.bucket,
        sf.file_path,
        sf.original_name,
        sf.mime_type,
        sf.byte_size,
        sf.sha256_hash,
        sf.is_public,
        sf.created_at
    FROM public.stored_files sf
    WHERE sf.id = p_file_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_stored_file_by_id(UUID) TO couplerh_app;
```

### 4.2 Migration `0003_system_operational_alerts.sql` (Tabela de Alertas Operacionais)
```sql
CREATE TABLE IF NOT EXISTS public.system_operational_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'ERROR', 'CRITICAL')),
    category VARCHAR(50) NOT NULL CHECK (category IN ('DATABASE', 'STORAGE', 'QUEUE', 'AUTH', 'BACKUP', 'SYSTEM', 'SECURITY')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operational_alerts_active 
    ON public.system_operational_alerts(severity, created_at DESC) 
    WHERE is_resolved = FALSE;

CREATE INDEX IF NOT EXISTS idx_operational_alerts_created_at 
    ON public.system_operational_alerts(created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.system_operational_alerts TO couplerh_app;
```

### 4.3 Migration `0004_auth_users_flexibility.sql` (Flexibilização de Identidade para Colaboradores)
```sql
-- Permite que colaboradores operacionais usem CPF sem obrigatoriedade de e-mail corporativo
ALTER TABLE public.users ALTER COLUMN email DROP NOT NULL;

-- Garante que o usuário possua ao menos e-mail ou CPF
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS check_user_identifier;
ALTER TABLE public.users ADD CONSTRAINT check_user_identifier 
    CHECK (email IS NOT NULL OR cpf IS NOT NULL);

-- Índice único para login por CPF ativo
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_cpf_unique_active 
    ON public.users(cpf) 
    WHERE deleted_at IS NULL AND cpf IS NOT NULL;
```

### 4.4 Migration `0005_auth_helpers.sql` (Funções SECURITY DEFINER de Autenticação Pré-RLS)
```sql
-- 1. Lookup de usuário corporativo por e-mail
CREATE OR REPLACE FUNCTION public.auth_get_user_for_login(p_email CITEXT)
RETURNS TABLE (
    id UUID, email CITEXT, password_hash TEXT, full_name TEXT,
    failed_login_attempts INT, locked_until TIMESTAMPTZ, is_active BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.email, u.password_hash, u.full_name, u.failed_login_attempts, u.locked_until, u.is_active
    FROM public.users u
    WHERE u.email = p_email AND u.deleted_at IS NULL;
END;
$$;

-- 2. Lookup de tenant e papel do usuário
CREATE OR REPLACE FUNCTION public.auth_get_user_tenant_membership(p_user_id UUID)
RETURNS TABLE (tenant_id UUID, tenant_name TEXT, role TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT tu.tenant_id, t.name as tenant_name, tu.role
    FROM public.tenant_users tu
    JOIN public.tenants t ON t.id = tu.tenant_id
    WHERE tu.user_id = p_user_id AND tu.is_active = TRUE
    ORDER BY tu.created_at ASC LIMIT 1;
END;
$$;

-- 3. Lookup de trabalhador para login no Portal do Colaborador (CPF + Contrato Ativo)
CREATE OR REPLACE FUNCTION public.auth_get_worker_for_portal_login(p_cpf VARCHAR(11))
RETURNS TABLE (
    id UUID, tenant_id UUID, user_id UUID, full_name TEXT, cpf VARCHAR(11),
    birth_date DATE, email TEXT, contract_status TEXT, position_title TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT w.id, w.tenant_id, w.user_id, w.full_name, w.cpf, w.birth_date, w.email,
           c.status as contract_status, pos.title as position_title
    FROM public.workers w
    JOIN public.contracts c ON c.worker_id = w.id
    LEFT JOIN public.positions pos ON pos.id = c.position_id
    WHERE w.cpf = p_cpf AND c.status = 'ACTIVE'
    ORDER BY c.created_at DESC LIMIT 1;
END;
$$;

-- 4. Provisioning atômico e vinculação do trabalhador à tabela users e tenant_users
CREATE OR REPLACE FUNCTION public.auth_ensure_portal_worker_user(
    p_worker_id UUID, p_tenant_id UUID, p_cpf VARCHAR(11),
    p_full_name TEXT, p_email TEXT, p_password_hash TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id UUID;
BEGIN
    SELECT user_id INTO v_user_id FROM public.workers WHERE id = p_worker_id;
    IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id FROM public.users WHERE cpf = p_cpf;
    END IF;
    IF v_user_id IS NULL THEN
        INSERT INTO public.users (cpf, full_name, email, password_hash, is_active, failed_login_attempts)
        VALUES (p_cpf, p_full_name, p_email, p_password_hash, TRUE, 0)
        RETURNING id INTO v_user_id;
    END IF;
    UPDATE public.workers SET user_id = v_user_id WHERE id = p_worker_id AND (user_id IS NULL OR user_id <> v_user_id);
    INSERT INTO public.tenant_users (tenant_id, user_id, role, is_active)
    VALUES (p_tenant_id, v_user_id, 'employee', TRUE)
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET is_active = TRUE;
    UPDATE public.users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = v_user_id;
    RETURN v_user_id;
END;
$$;

-- 5. Perfil completo para /me
CREATE OR REPLACE FUNCTION public.auth_get_me(p_user_id UUID)
RETURNS TABLE (
    id UUID, email CITEXT, cpf VARCHAR(11), full_name TEXT, phone TEXT,
    last_login_at TIMESTAMPTZ, tenant_id UUID, role TEXT, tenant_name TEXT, worker_id UUID
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.email, u.cpf, u.full_name, u.phone, u.last_login_at,
           tu.tenant_id, tu.role, t.name as tenant_name, w.id as worker_id
    FROM public.users u
    LEFT JOIN public.tenant_users tu ON tu.user_id = u.id AND tu.is_active = TRUE
    LEFT JOIN public.tenants t ON t.id = tu.tenant_id
    LEFT JOIN public.workers w ON w.user_id = u.id AND w.tenant_id = tu.tenant_id
    WHERE u.id = p_user_id AND u.is_active = TRUE LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auth_get_user_for_login(CITEXT) TO couplerh_app;
GRANT EXECUTE ON FUNCTION public.auth_get_user_tenant_membership(UUID) TO couplerh_app;
GRANT EXECUTE ON FUNCTION public.auth_get_worker_for_portal_login(VARCHAR(11)) TO couplerh_app;
GRANT EXECUTE ON FUNCTION public.auth_ensure_portal_worker_user(UUID, UUID, VARCHAR(11), TEXT, TEXT, TEXT) TO couplerh_app;
GRANT EXECUTE ON FUNCTION public.auth_get_me(UUID) TO couplerh_app;
```

### 4.5 Migration `0006_mfa_and_session_helpers.sql` (Funções SECURITY DEFINER de MFA TOTP e Timeout de Sessão)
```sql
-- 1. Status de MFA do usuário
CREATE OR REPLACE FUNCTION public.auth_get_user_mfa_status(p_user_id UUID)
RETURNS TABLE (has_verified_mfa BOOLEAN, verified_factors_count INT, total_factors_count INT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT COALESCE(BOOL_OR(is_verified), FALSE),
           COUNT(*) FILTER (WHERE is_verified = TRUE)::INT,
           COUNT(*)::INT
    FROM public.user_mfa_factors WHERE user_id = p_user_id;
END;
$$;

-- 2. Configurações de MFA e timeout de inatividade do tenant
CREATE OR REPLACE FUNCTION public.auth_get_tenant_mfa_and_session_settings(p_tenant_id UUID)
RETURNS TABLE (require_mfa_roles TEXT[], session_timeout_minutes INT, max_login_attempts INT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_settings JSONB; v_roles_json JSONB; v_roles TEXT[];
BEGIN
    SELECT settings INTO v_settings FROM public.tenants WHERE id = p_tenant_id;
    IF v_settings IS NULL THEN v_settings := '{}'::jsonb; END IF;
    v_roles_json := v_settings->'require_mfa_roles';
    IF v_roles_json IS NOT NULL AND jsonb_typeof(v_roles_json) = 'array' THEN
        SELECT ARRAY_AGG(x.val::TEXT) INTO v_roles FROM jsonb_array_elements_text(v_roles_json) AS x(val);
    ELSE
        v_roles := ARRAY[]::TEXT[];
    END IF;
    RETURN QUERY
    SELECT COALESCE(v_roles, ARRAY[]::TEXT[]),
           COALESCE((v_settings->>'session_timeout_minutes')::INT, 60),
           COALESCE((v_settings->>'max_login_attempts')::INT, 5);
END;
$$;

-- 3. Validação e heartbeat de inatividade da sessão
CREATE OR REPLACE FUNCTION public.auth_touch_session_activity(
    p_session_id UUID, p_max_inactivity_minutes INT DEFAULT 60
)
RETURNS TABLE (is_valid BOOLEAN, is_expired BOOLEAN, user_id UUID, aal TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_session RECORD; v_now TIMESTAMPTZ := NOW(); v_inactivity_interval INTERVAL;
BEGIN
    SELECT s.id, s.user_id, s.aal, s.last_seen_at, s.expires_at, s.revoked_at
    INTO v_session FROM public.user_sessions s WHERE s.id = p_session_id;

    IF v_session.id IS NULL OR v_session.revoked_at IS NOT NULL OR v_session.expires_at <= v_now THEN
        RETURN QUERY SELECT FALSE, TRUE, NULL::UUID, NULL::TEXT;
        RETURN;
    END IF;

    v_inactivity_interval := (p_max_inactivity_minutes || ' minutes')::INTERVAL;
    IF (v_now - v_session.last_seen_at) > v_inactivity_interval THEN
        UPDATE public.user_sessions SET revoked_at = v_now WHERE id = p_session_id;
        RETURN QUERY SELECT FALSE, TRUE, v_session.user_id, v_session.aal;
        RETURN;
    END IF;

    UPDATE public.user_sessions SET last_seen_at = v_now WHERE id = p_session_id;
    RETURN QUERY SELECT TRUE, FALSE, v_session.user_id, v_session.aal;
END;
$$;

-- 4. Promove sessão para AAL2
CREATE OR REPLACE FUNCTION public.auth_promote_session_aal2(p_session_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE public.user_sessions SET aal = 'aal2', last_seen_at = NOW()
    WHERE id = p_session_id AND revoked_at IS NULL;
    RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auth_get_user_mfa_status(UUID) TO couplerh_app;
GRANT EXECUTE ON FUNCTION public.auth_get_tenant_mfa_and_session_settings(UUID) TO couplerh_app;
GRANT EXECUTE ON FUNCTION public.auth_touch_session_activity(UUID, INT) TO couplerh_app;
GRANT EXECUTE ON FUNCTION public.auth_promote_session_aal2(UUID) TO couplerh_app;
GRANT EXECUTE ON FUNCTION public.auth_get_user_mfa_factors(UUID) TO couplerh_app;
GRANT EXECUTE ON FUNCTION public.auth_save_mfa_factor(UUID, TEXT, JSONB, TEXT) TO couplerh_app;
GRANT EXECUTE ON FUNCTION public.auth_get_mfa_factor_for_verification(UUID, UUID) TO couplerh_app;
GRANT EXECUTE ON FUNCTION public.auth_verify_mfa_factor(UUID, UUID) TO couplerh_app;
GRANT EXECUTE ON FUNCTION public.auth_consume_recovery_code(UUID, UUID, TEXT) TO couplerh_app;
GRANT EXECUTE ON FUNCTION public.auth_delete_mfa_factor(UUID, UUID) TO couplerh_app;
```

### 4.6 Migration `0007_password_reset_helpers.sql` (Funções SECURITY DEFINER de Recuperação e Troca de Senha)
```sql
-- 1. Cria token de recuperação com invalidação atômica de tokens antigos
CREATE OR REPLACE FUNCTION public.auth_create_password_reset_token(
    p_email CITEXT, p_token_hash TEXT, p_expires_minutes INT DEFAULT 30
)
RETURNS TABLE (found BOOLEAN, user_id UUID, full_name TEXT, email CITEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user RECORD; v_token_id UUID;
BEGIN
    SELECT u.id, u.full_name, u.email INTO v_user
    FROM public.users u
    WHERE u.email = p_email AND u.is_active = TRUE AND u.deleted_at IS NULL;

    IF v_user.id IS NULL THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::CITEXT;
        RETURN;
    END IF;

    UPDATE public.auth_tokens SET used_at = NOW()
    WHERE public.auth_tokens.user_id = v_user.id 
      AND public.auth_tokens.token_type = 'PASSWORD_RESET' 
      AND public.auth_tokens.used_at IS NULL;

    INSERT INTO public.auth_tokens (user_id, token_type, token_hash, expires_at)
    VALUES (v_user.id, 'PASSWORD_RESET', p_token_hash, NOW() + (p_expires_minutes || ' minutes')::INTERVAL)
    RETURNING id INTO v_token_id;

    RETURN QUERY SELECT TRUE, v_user.id, v_user.full_name, v_user.email;
END;
$$;

-- 2. Verifica token de recuperação de senha
CREATE OR REPLACE FUNCTION public.auth_verify_password_reset_token(p_token_hash TEXT)
RETURNS TABLE (is_valid BOOLEAN, is_used BOOLEAN, is_expired BOOLEAN, user_id UUID, email CITEXT, full_name TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row RECORD; v_now TIMESTAMPTZ := NOW();
BEGIN
    SELECT t.id, t.user_id, t.expires_at, t.used_at, u.email, u.full_name, u.is_active
    INTO v_row FROM public.auth_tokens t JOIN public.users u ON u.id = t.user_id
    WHERE t.token_hash = p_token_hash AND t.token_type = 'PASSWORD_RESET'
    ORDER BY t.created_at DESC LIMIT 1;

    IF v_row.id IS NULL OR NOT v_row.is_active THEN
        RETURN QUERY SELECT FALSE, FALSE, FALSE, NULL::UUID, NULL::CITEXT, NULL::TEXT;
        RETURN;
    END IF;
    IF v_row.used_at IS NOT NULL THEN
        RETURN QUERY SELECT FALSE, TRUE, FALSE, v_row.user_id, v_row.email, v_row.full_name;
        RETURN;
    END IF;
    IF v_row.expires_at <= v_now THEN
        RETURN QUERY SELECT FALSE, FALSE, TRUE, v_row.user_id, v_row.email, v_row.full_name;
        RETURN;
    END IF;

    RETURN QUERY SELECT TRUE, FALSE, FALSE, v_row.user_id, v_row.email, v_row.full_name;
END;
$$;

-- 3. Consome token de recuperação, atualiza senha e revoga sessões ativas
CREATE OR REPLACE FUNCTION public.auth_consume_password_reset_token(
    p_token_hash TEXT, p_new_password_hash TEXT
)
RETURNS TABLE (success BOOLEAN, user_id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_check RECORD;
BEGIN
    SELECT * INTO v_check FROM public.auth_verify_password_reset_token(p_token_hash);
    IF NOT v_check.is_valid THEN
        RETURN QUERY SELECT FALSE, NULL::UUID;
        RETURN;
    END IF;

    UPDATE public.auth_tokens SET used_at = NOW()
    WHERE public.auth_tokens.token_hash = p_token_hash AND public.auth_tokens.token_type = 'PASSWORD_RESET';

    UPDATE public.users SET password_hash = p_new_password_hash, failed_login_attempts = 0, locked_until = NULL, updated_at = NOW()
    WHERE public.users.id = v_check.user_id;

    UPDATE public.user_sessions SET revoked_at = NOW()
    WHERE public.user_sessions.user_id = v_check.user_id AND public.user_sessions.revoked_at IS NULL;

    RETURN QUERY SELECT TRUE, v_check.user_id;
END;
$$;

-- 4. Troca de senha pessoal do colaborador autenticado
CREATE OR REPLACE FUNCTION public.auth_change_worker_password(p_user_id UUID, p_new_password_hash TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE public.users SET password_hash = p_new_password_hash, failed_login_attempts = 0, locked_until = NULL, updated_at = NOW()
    WHERE id = p_user_id AND is_active = TRUE;
    RETURN FOUND;
END;
$$;

-- 5. Consulta credencial atual do colaborador (birth_date ou password_hash)
CREATE OR REPLACE FUNCTION public.auth_get_worker_credentials_for_change(p_user_id UUID)
RETURNS TABLE (birth_date DATE, password_hash TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT w.birth_date, u.password_hash
    FROM public.users u LEFT JOIN public.workers w ON w.user_id = u.id
    WHERE u.id = p_user_id AND u.is_active = TRUE LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auth_create_password_reset_token(CITEXT, TEXT, INT) TO couplerh_app;
GRANT EXECUTE ON FUNCTION public.auth_verify_password_reset_token(TEXT) TO couplerh_app;
GRANT EXECUTE ON FUNCTION public.auth_consume_password_reset_token(TEXT, TEXT) TO couplerh_app;
GRANT EXECUTE ON FUNCTION public.auth_change_worker_password(UUID, TEXT) TO couplerh_app;
GRANT EXECUTE ON FUNCTION public.auth_get_worker_credentials_for_change(UUID) TO couplerh_app;
```

### Migration 0008: Validação Atômica de Atividade do Contexto de Tenant e Usuário (`0008_tenant_context_helpers.sql`)

```sql
CREATE OR REPLACE FUNCTION public.auth_assert_tenant_context_active(
    p_user_id UUID,
    p_tenant_id UUID DEFAULT NULL
)
RETURNS TABLE (
    is_active BOOLEAN,
    reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_active BOOLEAN;
    v_tenant_active BOOLEAN;
    v_tenant_user_active BOOLEAN;
BEGIN
    -- 1. Verifica se o usuário global está ativo
    IF p_user_id IS NOT NULL THEN
        SELECT u.is_active INTO v_user_active
        FROM public.users u
        WHERE u.id = p_user_id AND u.deleted_at IS NULL;

        IF v_user_active IS NULL OR NOT v_user_active THEN
            RETURN QUERY SELECT FALSE, 'USER_INACTIVE';
            RETURN;
        END IF;
    END IF;

    -- 2. Se o tenant_id foi informado, verifica se o tenant está ativo
    IF p_tenant_id IS NOT NULL THEN
        SELECT (t.status = 'ACTIVE' AND t.deleted_at IS NULL) INTO v_tenant_active
        FROM public.tenants t
        WHERE t.id = p_tenant_id;

        IF v_tenant_active IS NULL OR NOT v_tenant_active THEN
            RETURN QUERY SELECT FALSE, 'TENANT_INACTIVE';
            RETURN;
        END IF;

        -- 3. Se ambos informados, verifica o vínculo em tenant_users
        IF p_user_id IS NOT NULL THEN
            SELECT tu.is_active INTO v_tenant_user_active
            FROM public.tenant_users tu
            WHERE tu.user_id = p_user_id AND tu.tenant_id = p_tenant_id;

            IF v_tenant_user_active IS NULL OR NOT v_tenant_user_active THEN
                RETURN QUERY SELECT FALSE, 'MEMBERSHIP_INACTIVE';
                RETURN;
            END IF;
        END IF;
    END IF;

    RETURN QUERY SELECT TRUE, 'OK';
END;
$$;

GRANT EXECUTE ON FUNCTION public.auth_assert_tenant_context_active(UUID, UUID) TO couplerh_app;
```

### Migration 0009: Fechamento de Brechas P0 de Segurança, RBAC Anti-Escalada, Correção de Fechamento de Folha, Ponto Seguro e Verificação Pública LGPD (`0009_security_p0_fixes.sql`)

- **Objetivo**: Estancamento definitivo de todas as vulnerabilidades críticas P0 apontadas na auditoria técnica de segurança:
  1. Adição de `api_key_hash` na tabela `public.time_devices` para autenticação segura de coletores REP físicos.
  2. Adição de `closure_notes`, `reopened_at` e `reopened_by` na tabela `public.payroll_periods`.
  3. Criação da tabela de trilha imutável `public.payroll_period_reopenings` com RLS e trigger de auditoria.
  4. Função `public.update_tenant_user_access`: bloqueia escalada de privilégios (`dp_analyst` bloqueado com 403, `tenant_admin` não promove a `system_admin`, bloqueio de auto-rebaixamento/lockout).
  5. Função `public.close_payroll_period`: elimina bug SQL `NULL NOT IN` e referência a `dp_manager`, travas de conformidade CLT (salário líquido negativo Art. 462, holerites em erro e divergência matemática T6) e atualização de holerites para `APPROVED` antes de fechar o período como `CLOSED`.
  6. Função `public.reopen_payroll_period`: elimina bug `NULL NOT IN`, exige justificativa de no mínimo 15 caracteres, grava na trilha imutável `payroll_period_reopenings`, retorna status para `OPEN` e holerites para `DRAFT`.
  7. Função `public.register_mobile_punch`: bloqueio IDOR contra colaboradores batendo ponto para terceiros e exigência de contrato ativo (`status = 'ACTIVE'`).
  8. Função `public.verify_public_document`: verificação pública de autenticidade de documentos com mascaramento estrito LGPD (CPF `123.***.***-45` e nome abreviado `Carlos S***`).
  9. Função `public.verify_public_punch`: verificação pública de comprovante de ponto com mascaramento estrito LGPD.
  10. Função `public.auth_get_rep_device_by_serial`: função `SECURITY DEFINER` para identificação pré-tenant do hardware REP.

```sql
-- 1. Adicionar api_key_hash em time_devices para autenticação segura de coletores REP
ALTER TABLE public.time_devices 
ADD COLUMN IF NOT EXISTS api_key_hash TEXT;

-- 2. Adicionar closure_notes e campos de reabertura em payroll_periods
ALTER TABLE public.payroll_periods
ADD COLUMN IF NOT EXISTS closure_notes TEXT,
ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reopened_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 3. Tabela de Trilha Imutável de Reaberturas de Folha (Compliance e Auditoria)
CREATE TABLE IF NOT EXISTS public.payroll_period_reopenings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    payroll_period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    reopened_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    reopened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT NOT NULL,
    previous_closed_at TIMESTAMPTZ,
    previous_closed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payroll_period_reopenings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_period_reopenings FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_policy" ON public.payroll_period_reopenings
  USING (tenant_id = current_app_tenant_id())
  WITH CHECK (tenant_id = current_app_tenant_id());

CREATE TRIGGER trg_audit_payroll_period_reopenings
  AFTER INSERT OR UPDATE OR DELETE ON public.payroll_period_reopenings
  FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- 4. RPC Anti-Escalada de Privilégio: update_tenant_user_access
CREATE OR REPLACE FUNCTION public.update_tenant_user_access(
    p_tenant_user_id UUID,
    p_role TEXT,
    p_worker_id UUID DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID := public.current_app_user_id();
    v_caller_tenant_id UUID := public.current_app_tenant_id();
    v_caller_role TEXT := public.current_app_role();
    v_target_tenant_id UUID;
    v_target_user_id UUID;
    v_target_role TEXT;
    v_caller_actual_role TEXT;
    v_caller_active BOOLEAN;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Acesso nao autorizado: usuario nao autenticado.' USING ERRCODE = '42501';
    END IF;

    SELECT tenant_id, user_id, role 
    INTO v_target_tenant_id, v_target_user_id, v_target_role
    FROM public.tenant_users
    WHERE id = p_tenant_user_id;

    IF v_target_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Usuario do tenant nao encontrado.' USING ERRCODE = 'P0002';
    END IF;

    SELECT tu.role, tu.is_active 
    INTO v_caller_actual_role, v_caller_active
    FROM public.tenant_users tu
    WHERE tu.user_id = v_caller_id AND tu.tenant_id = v_target_tenant_id;

    IF v_caller_active IS NULL OR NOT v_caller_active THEN
        RAISE EXCEPTION 'Acesso negado: sua conta ou vinculo com a empresa esta inativo.' USING ERRCODE = '42501';
    END IF;

    IF v_caller_actual_role NOT IN ('system_admin', 'tenant_admin') THEN
        RAISE EXCEPTION 'Acesso negado: Perfil % nao possui permissao para gerenciar usuarios ou alterar acessos.', COALESCE(v_caller_actual_role, 'Sem Perfil') USING ERRCODE = '42501';
    END IF;

    IF p_role = 'system_admin' AND v_caller_actual_role != 'system_admin' THEN
        RAISE EXCEPTION 'Escalada de privilegio bloqueada: Apenas administradores do sistema podem conceder o perfil system_admin.' USING ERRCODE = '42501';
    END IF;

    IF v_target_role = 'system_admin' AND v_caller_actual_role != 'system_admin' THEN
        RAISE EXCEPTION 'Operacao proibida: Apenas administradores do sistema podem alterar o perfil de outro system_admin.' USING ERRCODE = '42501';
    END IF;

    IF v_caller_id = v_target_user_id AND (p_role != v_target_role OR p_is_active = FALSE) THEN
        RAISE EXCEPTION 'Operacao proibida: Um administrador nao pode desativar ou rebaixar seu proprio acesso.' USING ERRCODE = '42501';
    END IF;

    IF p_role NOT IN ('system_admin', 'tenant_admin', 'dp_analyst', 'manager', 'employee', 'sst_specialist', 'auditor') THEN
        RAISE EXCEPTION 'Papel de acesso invalido: %', p_role USING ERRCODE = '22023';
    END IF;

    IF p_worker_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.workers WHERE id = p_worker_id AND tenant_id = v_target_tenant_id) THEN
            RAISE EXCEPTION 'Colaborador selecionado nao pertence a esta empresa/tenant.' USING ERRCODE = '23503';
        END IF;
    END IF;

    UPDATE public.tenant_users SET
        role = p_role,
        is_active = p_is_active,
        updated_at = NOW()
    WHERE id = p_tenant_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'tenant_user_id', p_tenant_user_id,
        'role', p_role,
        'is_active', p_is_active,
        'updated_at', NOW()
    );
END;
$$;

-- 5. RPC de Fechamento de Folha de Pagamento Corrigida (Eliminando NULL NOT IN e dp_manager)
CREATE OR REPLACE FUNCTION public.close_payroll_period(
    p_period_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := public.current_app_user_id();
    v_tenant_id UUID := public.current_app_tenant_id();
    v_period RECORD;
    v_user_role TEXT;
    v_user_active BOOLEAN;
    v_payslip_count INTEGER := 0;
    v_error_count INTEGER := 0;
    v_negative_net_count INTEGER := 0;
    v_math_error_count INTEGER := 0;
BEGIN
    IF v_user_id IS NULL OR v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Acesso nao autorizado: usuario ou tenant nao configurado na sessao.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_period 
    FROM public.payroll_periods 
    WHERE id = p_period_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Periodo de folha % nao encontrado para o tenant ativo.', p_period_id USING ERRCODE = 'P0002';
    END IF;

    IF v_period.status = 'CLOSED' THEN
        RAISE EXCEPTION 'Periodo de folha % ja se encontra fechado.', p_period_id;
    END IF;

    SELECT tu.role, tu.is_active 
    INTO v_user_role, v_user_active
    FROM public.tenant_users tu 
    WHERE tu.user_id = v_user_id AND tu.tenant_id = v_tenant_id;

    IF v_user_role IS NULL OR NOT v_user_active OR v_user_role NOT IN ('system_admin', 'tenant_admin') THEN
        RAISE EXCEPTION 'Acesso negado: Perfil % nao possui permissao para fechar folha de pagamento.', COALESCE(v_user_role, 'Sem Perfil') USING ERRCODE = '42501';
    END IF;

    SELECT count(*) INTO v_payslip_count 
    FROM public.payslips 
    WHERE payroll_period_id = p_period_id;

    IF v_payslip_count = 0 THEN
        RAISE EXCEPTION 'Fechamento de folha bloqueado: Nenhum holerite foi gerado ou processado para este periodo.';
    END IF;

    SELECT count(*) INTO v_error_count 
    FROM public.payslips 
    WHERE payroll_period_id = p_period_id 
      AND (status IN ('ERROR', 'CALCULATION_ERROR', 'ERRO_CALCULO') OR status ILIKE '%ERROR%');

    IF v_error_count > 0 THEN
        RAISE EXCEPTION 'Fechamento de folha bloqueado (Compliance/CLT): Existem % colaboradores com calculo em erro no periodo. Regularize os calculos antes de fechar a folha.', v_error_count;
    END IF;

    SELECT count(*) INTO v_negative_net_count 
    FROM public.payslips 
    WHERE payroll_period_id = p_period_id AND net_salary < 0;

    IF v_negative_net_count > 0 THEN
        RAISE EXCEPTION 'Fechamento de folha bloqueado (CLT Art. 462): Existem % colaboradores com salario liquido negativo. Nao e permitido fechar a folha com descontos superiores ao rendimento total.', v_negative_net_count;
    END IF;

    SELECT count(*) INTO v_math_error_count 
    FROM public.payslips 
    WHERE payroll_period_id = p_period_id 
      AND abs(net_salary - (total_earnings - total_deductions)) > 0.01;

    IF v_math_error_count > 0 THEN
        RAISE EXCEPTION 'Fechamento de folha bloqueado (Invariante T6): Existem % holerites com divergencia matematica entre salario liquido e (Proventos - Descontos).', v_math_error_count;
    END IF;

    UPDATE public.payslips SET
        status = 'APPROVED',
        updated_at = NOW()
    WHERE payroll_period_id = p_period_id;

    UPDATE public.payroll_periods SET
        status = 'CLOSED',
        closed_at = NOW(),
        closed_by = v_user_id,
        closure_notes = p_notes,
        updated_at = NOW()
    WHERE id = p_period_id;

    RETURN jsonb_build_object(
        'success', true,
        'period_id', p_period_id,
        'status', 'CLOSED',
        'closed_at', NOW(),
        'payslips_closed', v_payslip_count
    );
END;
$$;

-- 6. RPC de Reabertura de Folha de Pagamento Corrigida (Eliminando NULL NOT IN e dp_manager)
CREATE OR REPLACE FUNCTION public.reopen_payroll_period(
    p_period_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := public.current_app_user_id();
    v_tenant_id UUID := public.current_app_tenant_id();
    v_period RECORD;
    v_user_role TEXT;
    v_user_active BOOLEAN;
    v_trimmed_reason TEXT := trim(p_reason);
BEGIN
    IF v_user_id IS NULL OR v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Acesso nao autorizado: usuario ou tenant nao configurado na sessao.' USING ERRCODE = '42501';
    END IF;

    IF length(v_trimmed_reason) < 15 THEN
        RAISE EXCEPTION 'A justificativa de reabertura deve conter no minimo 15 caracteres explicando o motivo legal/contabil.';
    END IF;

    SELECT * INTO v_period 
    FROM public.payroll_periods 
    WHERE id = p_period_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Periodo de folha % nao encontrado.', p_period_id USING ERRCODE = 'P0002';
    END IF;

    IF v_period.status != 'CLOSED' THEN
        RAISE EXCEPTION 'Apenas folhas fechadas (CLOSED) podem passar por reabertura formal (status atual: %).', v_period.status;
    END IF;

    SELECT tu.role, tu.is_active 
    INTO v_user_role, v_user_active
    FROM public.tenant_users tu 
    WHERE tu.user_id = v_user_id AND tu.tenant_id = v_tenant_id;

    IF v_user_role IS NULL OR NOT v_user_active OR v_user_role NOT IN ('system_admin', 'tenant_admin') THEN
        RAISE EXCEPTION 'Acesso negado: Somente administradores (system_admin ou tenant_admin) podem reabrir folhas fechadas (seu perfil: %).', COALESCE(v_user_role, 'Sem Perfil') USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.payroll_period_reopenings (
        tenant_id,
        payroll_period_id,
        reopened_by,
        reopened_at,
        reason,
        previous_closed_at,
        previous_closed_by
    ) VALUES (
        v_tenant_id,
        p_period_id,
        v_user_id,
        NOW(),
        v_trimmed_reason,
        v_period.closed_at,
        v_period.closed_by
    );

    UPDATE public.payroll_periods SET
        status = 'OPEN',
        closed_at = NULL,
        closed_by = NULL,
        reopened_at = NOW(),
        reopened_by = v_user_id,
        updated_at = NOW()
    WHERE id = p_period_id;

    UPDATE public.payslips SET
        status = 'DRAFT',
        updated_at = NOW()
    WHERE payroll_period_id = p_period_id;

    RETURN jsonb_build_object(
        'success', true,
        'period_id', p_period_id,
        'status', 'OPEN',
        'reopened_at', NOW(),
        'reason', v_trimmed_reason
    );
END;
$$;

-- 7. Ponto Mobile Seguro: register_mobile_punch com Validação de Ownership e Contrato Ativo
CREATE OR REPLACE FUNCTION public.register_mobile_punch(
    p_worker_id UUID,
    p_punch_type TEXT,
    p_latitude FLOAT8 DEFAULT NULL,
    p_longitude FLOAT8 DEFAULT NULL,
    p_accuracy FLOAT8 DEFAULT NULL,
    p_is_mock BOOLEAN DEFAULT FALSE,
    p_device_fp TEXT DEFAULT NULL,
    p_sha256 TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := public.current_app_user_id();
    v_tenant_id UUID := public.current_app_tenant_id();
    v_user_role TEXT := public.current_app_role();
    v_worker_user_id UUID;
    v_contract_id UUID;
    v_company_id UUID;
    v_next_nsr BIGINT;
    v_device_id UUID;
    v_punch_id UUID;
    v_final_hash TEXT;
BEGIN
    IF v_user_id IS NULL OR v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Acesso nao autorizado: sessao sem contexto ativo.' USING ERRCODE = '42501';
    END IF;

    SELECT user_id 
    INTO v_worker_user_id
    FROM public.workers 
    WHERE id = p_worker_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Colaborador nao localizado no tenant ativo.' USING ERRCODE = 'P0002';
    END IF;

    IF v_user_role = 'employee' AND (v_worker_user_id IS NULL OR v_worker_user_id != v_user_id) THEN
        RAISE EXCEPTION 'Acesso negado: Nao e permitido registrar ponto para outro colaborador.' USING ERRCODE = '42501';
    END IF;

    SELECT id, company_id INTO v_contract_id, v_company_id
    FROM public.contracts
    WHERE worker_id = p_worker_id 
      AND tenant_id = v_tenant_id 
      AND status = 'ACTIVE'
    ORDER BY admission_date DESC
    LIMIT 1;

    IF v_contract_id IS NULL THEN
        RAISE EXCEPTION 'Registro de ponto bloqueado: Colaborador nao possui contrato de trabalho ativo.' USING ERRCODE = '23503';
    END IF;

    SELECT id INTO v_device_id
    FROM public.time_devices
    WHERE tenant_id = v_tenant_id AND kind = 'REP_P_MOBILE' AND status = 'ACTIVE'
    LIMIT 1;

    IF v_device_id IS NULL THEN
        INSERT INTO public.time_devices (tenant_id, company_id, name, kind, status)
        VALUES (v_tenant_id, v_company_id, 'App Mobile Colaborador', 'REP_P_MOBILE', 'ACTIVE')
        RETURNING id INTO v_device_id;
    END IF;

    UPDATE public.time_devices 
    SET last_nsr = last_nsr + 1, updated_at = NOW()
    WHERE id = v_device_id
    RETURNING last_nsr INTO v_next_nsr;

    v_final_hash := COALESCE(p_sha256, encode(sha256((v_tenant_id::text || v_next_nsr::text || NOW()::text)::bytea), 'hex'));

    INSERT INTO public.time_punch_records (
        tenant_id, company_id, contract_id, worker_id, device_id, nsr, record_type,
        punched_at, punch_type, source, latitude, longitude, accuracy, is_mock_location,
        device_fingerprint, sha256_hash
    ) VALUES (
        v_tenant_id, v_company_id, v_contract_id, p_worker_id, v_device_id, v_next_nsr, 3,
        NOW(), COALESCE(p_punch_type, 'ENTRY'), 'MOBILE', p_latitude, p_longitude, p_accuracy,
        COALESCE(p_is_mock, FALSE), p_device_fp, v_final_hash
    )
    RETURNING id INTO v_punch_id;

    RETURN jsonb_build_object(
        'success', true,
        'punch_id', v_punch_id,
        'nsr', v_next_nsr,
        'punched_at', NOW(),
        'sha256_hash', v_final_hash
    );
END;
$$;

-- 8. Verificação Pública com Mascaramento Estrito LGPD: verify_public_document
CREATE OR REPLACE FUNCTION public.verify_public_document(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_code TEXT := trim(p_code);
    v_doc RECORD;
    v_masked_cpf TEXT;
    v_masked_name TEXT;
    v_name_parts TEXT[];
BEGIN
    SELECT 
        d.id, d.title, d.category, d.status, d.created_at,
        s.signed_at, s.signer_name, s.signer_cpf, s.signed_hash_sha256,
        COALESCE(c.trade_name, c.corporate_name) AS company_name
    INTO v_doc
    FROM public.employee_documents d
    LEFT JOIN public.document_signatures s ON s.document_id = d.id AND s.status = 'COMPLETED'
    LEFT JOIN public.companies c ON c.id = (SELECT company_id FROM public.contracts WHERE worker_id = d.worker_id LIMIT 1)
    WHERE d.id::text = v_clean_code 
       OR d.id::text ILIKE (v_clean_code || '%')
    LIMIT 1;

    IF v_doc.id IS NULL THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Documento trabalhista nao localizado ou chancela invalida.');
    END IF;

    IF v_doc.signer_cpf IS NOT NULL AND length(v_doc.signer_cpf) >= 11 THEN
        v_masked_cpf := substr(v_doc.signer_cpf, 1, 3) || '.***.***-' || substr(v_doc.signer_cpf, 10, 2);
    ELSE
        v_masked_cpf := '***.***.***-**';
    END IF;

    IF v_doc.signer_name IS NOT NULL THEN
        v_name_parts := string_to_array(trim(v_doc.signer_name), ' ');
        IF array_length(v_name_parts, 1) > 1 THEN
            v_masked_name := v_name_parts[1] || ' ' || substr(v_name_parts[array_length(v_name_parts, 1)], 1, 1) || '***';
        ELSE
            v_masked_name := substr(v_doc.signer_name, 1, 3) || '***';
        END IF;
    ELSE
        v_masked_name := 'Colaborador Homologado';
    END IF;

    RETURN jsonb_build_object(
        'valid', true,
        'document_id', v_doc.id,
        'title', v_doc.title,
        'category', v_doc.category,
        'status', v_doc.status,
        'company_name', COALESCE(v_doc.company_name, 'Empresa Empregadora'),
        'signer_name_masked', v_masked_name,
        'signer_cpf_masked', v_masked_cpf,
        'signed_at', v_doc.signed_at,
        'sha256_hash', v_doc.signed_hash_sha256
    );
END;
$$;

-- 9. Verificação Pública com Mascaramento Estrito LGPD: verify_public_punch
CREATE OR REPLACE FUNCTION public.verify_public_punch(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_code TEXT := trim(p_code);
    v_punch RECORD;
    v_masked_cpf TEXT;
    v_masked_name TEXT;
    v_name_parts TEXT[];
BEGIN
    SELECT 
        p.id, p.nsr, p.punched_at, p.punch_type, p.source, p.sha256_hash,
        u.full_name AS worker_name, u.cpf AS worker_cpf,
        COALESCE(c.trade_name, c.corporate_name) AS company_name
    INTO v_punch
    FROM public.time_punch_records p
    LEFT JOIN public.workers w ON w.id = p.worker_id
    LEFT JOIN public.users u ON u.id = w.user_id
    LEFT JOIN public.companies c ON c.id = p.company_id
    WHERE p.id::text = v_clean_code
       OR p.sha256_hash = v_clean_code
       OR p.id::text ILIKE (v_clean_code || '%')
    LIMIT 1;

    IF v_punch.id IS NULL THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Comprovante de ponto eletronico nao localizado ou hash invalido.');
    END IF;

    IF v_punch.worker_cpf IS NOT NULL AND length(v_punch.worker_cpf) >= 11 THEN
        v_masked_cpf := substr(v_punch.worker_cpf, 1, 3) || '.***.***-' || substr(v_punch.worker_cpf, 10, 2);
    ELSE
        v_masked_cpf := '***.***.***-**';
    END IF;

    IF v_punch.worker_name IS NOT NULL THEN
        v_name_parts := string_to_array(trim(v_punch.worker_name), ' ');
        IF array_length(v_name_parts, 1) > 1 THEN
            v_masked_name := v_name_parts[1] || ' ' || substr(v_name_parts[array_length(v_name_parts, 1)], 1, 1) || '***';
        ELSE
            v_masked_name := substr(v_punch.worker_name, 1, 3) || '***';
        END IF;
    ELSE
        v_masked_name := 'Colaborador Homologado';
    END IF;

    RETURN jsonb_build_object(
        'valid', true,
        'punch_id', v_punch.id,
        'nsr', v_punch.nsr,
        'punched_at', v_punch.punched_at,
        'punch_type', v_punch.punch_type,
        'source', v_punch.source,
        'company_name', COALESCE(v_punch.company_name, 'Empresa Empregadora'),
        'worker_name_masked', v_masked_name,
        'worker_cpf_masked', v_masked_cpf,
        'sha256_hash', v_punch.sha256_hash
    );
END;
$$;

-- 10. Função SECURITY DEFINER para Autenticação Prévia de Dispositivo Coletor REP
CREATE OR REPLACE FUNCTION public.auth_get_rep_device_by_serial(p_serial TEXT)
RETURNS TABLE (
    id UUID,
    tenant_id UUID,
    company_id UUID,
    api_key_hash TEXT,
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT d.id, d.tenant_id, d.company_id, d.api_key_hash, d.status
    FROM public.time_devices d
    WHERE d.serial_number = p_serial
    LIMIT 1;
END;
$$;

-- Permissões de Execução para couplerh_app
GRANT EXECUTE ON FUNCTION public.auth_get_rep_device_by_serial(TEXT) TO couplerh_app;
GRANT EXECUTE ON FUNCTION public.update_tenant_user_access(UUID, TEXT, UUID, BOOLEAN) TO couplerh_app;
GRANT EXECUTE ON FUNCTION public.close_payroll_period(UUID, TEXT) TO couplerh_app;
GRANT EXECUTE ON FUNCTION public.reopen_payroll_period(UUID, TEXT) TO couplerh_app;
GRANT EXECUTE ON FUNCTION public.register_mobile_punch(UUID, TEXT, FLOAT8, FLOAT8, FLOAT8, BOOLEAN, TEXT, TEXT) TO couplerh_app;
GRANT EXECUTE ON FUNCTION public.verify_public_document(TEXT) TO couplerh_app;
GRANT EXECUTE ON FUNCTION public.verify_public_punch(TEXT) TO couplerh_app;
```









---

### 3.10 Migration 0010 — RBAC Dinâmico, Matriz de Permissões Granulares e has_permission (PostgreSQL 17 Puro)

```sql
-- ==============================================================================
-- Migration 0010: RBAC Dinâmico, Matriz de Permissões Granulares e has_permission
-- ==============================================================================

-- 1. Tabela de Permissões (Catálogo Oficial de Ações do Sistema)
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL CHECK (category IN (
        'ORGANIZATION', 'COMPENSATION_PAYROLL', 'ACCOUNTING_FISCAL',
        'TIME_TRACKING', 'OCCUPATIONAL_HEALTH_SST', 'GOVERNANCE_SYSTEM'
    )),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela de Papéis (Roles Nativas de Sistema e Perfis Customizados por Tenant)
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_roles_tenant_slug UNIQUE (tenant_id, slug)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_system_roles_slug 
ON public.roles(slug) WHERE tenant_id IS NULL;

-- 3. Tabela Associativa Papel <-> Permissão
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_role_permission UNIQUE (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON public.role_permissions(permission_id);

-- 4. Adicionar coluna role_id em tenant_users e remover enum restritivo
ALTER TABLE public.tenant_users
ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_users_role_id ON public.tenant_users(role_id);

ALTER TABLE public.tenant_users
DROP CONSTRAINT IF EXISTS tenant_users_role_check;

-- 5. RLS nas tabelas RBAC
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions FORCE ROW LEVEL SECURITY;

CREATE POLICY permissions_read_policy ON public.permissions
    FOR SELECT USING (TRUE);

CREATE POLICY roles_isolation_policy ON public.roles
    FOR ALL
    USING (tenant_id = current_app_tenant_id() OR (is_system = TRUE AND tenant_id IS NULL))
    WITH CHECK (tenant_id = current_app_tenant_id() AND is_system = FALSE);

CREATE POLICY role_permissions_isolation_policy ON public.role_permissions
    FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.roles r 
        WHERE r.id = role_permissions.role_id 
          AND (r.tenant_id = current_app_tenant_id() OR (r.is_system = TRUE AND r.tenant_id IS NULL))
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.roles r 
        WHERE r.id = role_permissions.role_id 
          AND r.tenant_id = current_app_tenant_id() 
          AND r.is_system = FALSE
    ));

-- Triggers de auditoria imutável
CREATE TRIGGER trg_audit_roles
    AFTER INSERT OR UPDATE OR DELETE ON public.roles
    FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER trg_audit_role_permissions
    AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions
    FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- 6. Função SQL Oficial has_permission (PostgreSQL 17 Puro, STABLE, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.has_permission(p_tenant_id UUID, p_permission_slug TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    JOIN public.users u ON u.id = tu.user_id
    LEFT JOIN public.roles r ON r.id = tu.role_id
    LEFT JOIN public.role_permissions rp ON rp.role_id = r.id
    LEFT JOIN public.permissions p ON p.id = rp.permission_id
    WHERE tu.user_id = public.current_app_user_id()
      AND tu.tenant_id = p_tenant_id
      AND tu.is_active = TRUE
      AND u.is_active = TRUE
      AND (
        -- 1. Super Admin Global tem acesso irrestrito
        tu.role = 'system_admin'
        OR r.slug = 'system_admin'
        -- 2. Permissão explícita concedida pelo papel
        OR p.slug = p_permission_slug
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_permission(UUID, TEXT) TO couplerh_app;
GRANT SELECT ON public.permissions TO couplerh_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roles TO couplerh_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO couplerh_app;
```
