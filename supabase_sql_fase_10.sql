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
