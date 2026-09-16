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
