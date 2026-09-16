-- Migration: 00030_employer_taxes_schema
-- Description: Criação da tabela de impostos patronais consolidados da folha

CREATE TABLE IF NOT EXISTS public.payroll_company_taxes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    
    total_base_inss NUMERIC(15, 2) DEFAULT 0,
    total_base_fgts NUMERIC(15, 2) DEFAULT 0,
    
    inss_patronal NUMERIC(15, 2) DEFAULT 0,
    rat_adjusted NUMERIC(15, 2) DEFAULT 0,
    terceiros NUMERIC(15, 2) DEFAULT 0,
    fgts_patronal NUMERIC(15, 2) DEFAULT 0,
    
    total_taxes NUMERIC(15, 2) DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(period_id, company_id)
);

ALTER TABLE public.payroll_company_taxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View payroll_company_taxes" ON public.payroll_company_taxes 
    FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));
    
CREATE POLICY "Manage payroll_company_taxes" ON public.payroll_company_taxes 
    FOR ALL USING (
    tenant_id = ANY (public.user_tenant_ids()) 
    AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = payroll_company_taxes.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
);

NOTIFY pgrst, 'reload schema';
