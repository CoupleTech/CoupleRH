-- Migration: 00029_create_employee_fixed_events
-- Description: Tabela para vinculação permanente de adicionais e proventos fixos ao contrato do empregado.

CREATE TABLE public.employee_fixed_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    rubric_id UUID NOT NULL REFERENCES public.payroll_rubrics(id),
    
    value NUMERIC(10,2), -- Opcional: pode ser nulo se a rubrica já for PERCENTUAL
    quantity NUMERIC(10,2) DEFAULT 1, -- Quantidade de referência (ex: 1 para insalubridade, ou qtde de cotas)
    
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
