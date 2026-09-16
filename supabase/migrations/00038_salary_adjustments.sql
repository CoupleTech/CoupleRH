-- Migration: 00038_salary_adjustments
-- Description: Adiciona tabela para histórico de reajustes salariais e dissídios

CREATE TABLE IF NOT EXISTS public.salary_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    old_salary DECIMAL(10, 2) NOT NULL,
    new_salary DECIMAL(10, 2) NOT NULL,
    percentage DECIMAL(5, 2), -- ex: 10.50 para 10,5%
    effective_date DATE NOT NULL,
    approval_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.salary_adjustments ENABLE ROW LEVEL SECURITY;

-- Create policy for tenant access
CREATE POLICY "Tenants can manage their salary_adjustments" ON public.salary_adjustments
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id 
            FROM public.tenant_users 
            WHERE user_id = auth.uid()
        )
    );

NOTIFY pgrst, 'reload schema';
