-- ==============================================================================
-- COUPLE RH - CORREÇÃO DE COLUNA company_id E RLS EM time_bank_accounts
-- Executar no SQL Editor do Supabase Dashboard (https://supabase.com/dashboard)
-- ==============================================================================

-- 1. ADICIONAR COLUNA company_id EM time_bank_accounts
ALTER TABLE public.time_bank_accounts
    ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- 2. BACKFILL DE company_id A PARTIR DE employment_contracts
UPDATE public.time_bank_accounts tba
SET company_id = ec.company_id
FROM public.employment_contracts ec
WHERE ec.id = tba.contract_id 
  AND tba.company_id IS NULL;

-- 3. ÍNDICES DE ALTA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_time_bank_accounts_company_status 
    ON public.time_bank_accounts(company_id, status);

CREATE INDEX IF NOT EXISTS idx_time_bank_accounts_tenant_status 
    ON public.time_bank_accounts(tenant_id, status);

-- 4. POLÍTICAS RLS PARA time_bank_accounts
ALTER TABLE public.time_bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can manage time_bank_accounts" ON public.time_bank_accounts;
CREATE POLICY "Tenant users can manage time_bank_accounts" 
    ON public.time_bank_accounts FOR ALL 
    TO authenticated
    USING (tenant_id = ANY (public.user_tenant_ids()))
    WITH CHECK (tenant_id = ANY (public.user_tenant_ids()));

-- 5. POLÍTICAS RLS PARA time_bank_transactions
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
