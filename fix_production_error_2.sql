-- =========================================================================
-- SCRIPT DE RECUPERAÇÃO SEGURA PARA PRODUÇÃO
-- Resolve os erros 404 (Not Found) e 400 (Bad Request) da tela de Funcionários
-- =========================================================================

-- 1. SALARY ADJUSTMENTS (Histórico de Reajustes - 404)
CREATE TABLE IF NOT EXISTS public.salary_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    old_salary DECIMAL(10, 2) NOT NULL,
    new_salary DECIMAL(10, 2) NOT NULL,
    percentage DECIMAL(5, 2),
    effective_date DATE NOT NULL,
    approval_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.salary_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenants can manage their salary_adjustments" ON public.salary_adjustments;
CREATE POLICY "Tenants can manage their salary_adjustments" ON public.salary_adjustments
    FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));


-- 2. EMPLOYEE FIXED EVENTS (Eventos Fixos/Rubricas - 404)
CREATE TABLE IF NOT EXISTS public.employee_fixed_events (
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
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'employee_fixed_events_active_rubric_idx' AND n.nspname = 'public') THEN
        CREATE UNIQUE INDEX employee_fixed_events_active_rubric_idx 
        ON public.employee_fixed_events (contract_id, rubric_id) 
        WHERE is_active = true AND end_date IS NULL;
    END IF;
END
$$;
ALTER TABLE public.employee_fixed_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Admins and DP can manage employee_fixed_events" ON public.employee_fixed_events;
CREATE POLICY "Tenant Admins and DP can manage employee_fixed_events" 
    ON public.employee_fixed_events FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids())
        AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = employee_fixed_events.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
    );


-- 3. BENEFITS CATALOG & EMPLOYEE BENEFITS (Benefícios - 400 Bad Request)
CREATE TABLE IF NOT EXISTS public.benefits_catalog (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    benefit_type TEXT NOT NULL CHECK (benefit_type IN ('VT', 'VR', 'VA', 'HEALTH', 'DENTAL', 'GYM', 'OTHER')),
    discount_type TEXT NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FIXED_VALUE', 'NONE')),
    default_discount_value NUMERIC(10, 2) DEFAULT 0,
    provider_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.employee_benefits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    benefit_id UUID NOT NULL REFERENCES public.benefits_catalog(id) ON DELETE RESTRICT,
    custom_discount_value NUMERIC(10, 2),
    card_number TEXT,
    dependent_count INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Previne erro de chave única duplicada
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'employee_benefits_contract_id_benefit_id_key'
    ) THEN
        ALTER TABLE public.employee_benefits ADD CONSTRAINT employee_benefits_contract_id_benefit_id_key UNIQUE(contract_id, benefit_id);
    END IF;
END $$;

-- Adiciona coluna que pode estar faltando no benefits_catalog (da migration 00024)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='benefits_catalog' AND column_name='rubric_id') THEN
        ALTER TABLE public.benefits_catalog ADD COLUMN rubric_id UUID REFERENCES public.payroll_rubrics(id);
    END IF;
END
$$;

ALTER TABLE public.benefits_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_benefits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view benefits catalog" ON public.benefits_catalog;
CREATE POLICY "Users can view benefits catalog" ON public.benefits_catalog FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

DROP POLICY IF EXISTS "Users can view employee benefits" ON public.employee_benefits;
CREATE POLICY "Users can view employee benefits" ON public.employee_benefits FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));


-- 4. GRANTS GLOBAIS DE SEGURANÇA E ACESSO
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- 5. REINICIA E RECARREGA A API DO SUPABASE (VITAL PARA CORRIGIR O 400 BAD REQUEST)
NOTIFY pgrst, 'reload schema';
