-- Migration: 00003_worker_contract_schema
-- Description: Separação de Pessoa (Civil), Trabalhador (eSocial) e Contrato (Vínculo)

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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(tenant_id, cpf)
);

-- 2. Workers (O registro geral do indivíduo no Tenant/Empresa para fins de eSocial)
-- Cada worker pertence a uma company (raiz do eSocial) e representa a pessoa lá.
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
    UNIQUE(company_id, person_id) -- A pessoa só tem 1 base de worker por empresa
);

-- 3. Employment Contracts (Vínculos Contratuais)
-- Onde ocorrem admissões, demissões, afastamentos e promoções de cargo
CREATE TABLE public.employment_contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    establishment_id UUID REFERENCES public.establishments(id) ON DELETE RESTRICT,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    position_id UUID REFERENCES public.positions(id) ON DELETE RESTRICT,
    
    contract_type TEXT NOT NULL DEFAULT 'CLT',
    admission_date DATE NOT NULL,
    resignation_date DATE,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'VACATION')),
    
    base_salary NUMERIC(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'BRL',
    workload_hours NUMERIC(5, 2), -- Horas mensais (ex: 220)
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Ativar RLS
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employment_contracts ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Users can view people in their tenants" 
    ON public.people FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view workers in their tenants" 
    ON public.workers FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view employment_contracts in their tenants" 
    ON public.employment_contracts FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Tenant Admins and DP can manage people" 
    ON public.people FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = people.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
    );

CREATE POLICY "Tenant Admins and DP can manage workers" 
    ON public.workers FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = workers.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
    );

CREATE POLICY "Tenant Admins and DP can manage employment_contracts" 
    ON public.employment_contracts FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = employment_contracts.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
    );

-- Anexar ao Motor de Auditoria (Triggers)
CREATE TRIGGER audit_people_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.people
FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_workers_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.workers
FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

CREATE TRIGGER audit_contracts_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.employment_contracts
FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
