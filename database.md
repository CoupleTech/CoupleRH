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



