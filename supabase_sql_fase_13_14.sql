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
