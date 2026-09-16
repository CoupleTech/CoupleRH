-- Cria a tabela de histórico de movimentações do funcionário
CREATE TABLE IF NOT EXISTS public.employment_contract_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    employment_contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- SALARY, POSITION, DEPARTMENT, SHIFT, GENERAL
    old_value TEXT,
    new_value TEXT NOT NULL,
    reason TEXT,
    event_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.employment_contract_history ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Tenant Admins and DP can view history" 
    ON public.employment_contract_history FOR SELECT USING (
        tenant_id = ANY (public.user_tenant_ids()) 
    );

CREATE POLICY "Tenant Admins and DP can manage history" 
    ON public.employment_contract_history FOR ALL USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (
            SELECT 1 FROM public.tenant_users 
            WHERE user_id = auth.uid() 
            AND tenant_users.tenant_id = employment_contract_history.tenant_id 
            AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        )
    );
