-- ==============================================================================
-- MIGRATION 00087: Sincronização de colunas de time_daily_summary e time_bank_accounts
-- Garante a compatibilidade estrutural das colunas company_id e current_balance_minutes
-- ==============================================================================

-- 1. ADICIONAR COLUNAS FALTANTES EM time_daily_summary
ALTER TABLE public.time_daily_summary 
    ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS expected_work_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS break_taken_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS break_expected_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS night_overtime_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS interjornada_violation_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS time_bank_credited_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS time_bank_debited_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS inconsistencies TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS approved_by UUID,
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. BACKFILL DE company_id A PARTIR DE employment_contracts
UPDATE public.time_daily_summary tds
SET company_id = ec.company_id
FROM public.employment_contracts ec
WHERE ec.id = tds.contract_id 
  AND tds.company_id IS NULL;

-- 3. ÍNDICE DE PERFORMANCE PARA FILTRAGEM POR EMPRESA E DATA
CREATE INDEX IF NOT EXISTS idx_time_daily_summary_company_date 
    ON public.time_daily_summary(company_id, date);

-- 4. COMPATIBILIDADE DE current_balance_minutes EM time_bank_accounts
ALTER TABLE public.time_bank_accounts
    ADD COLUMN IF NOT EXISTS current_balance_minutes INTEGER;

UPDATE public.time_bank_accounts
SET current_balance_minutes = balance_minutes
WHERE current_balance_minutes IS NULL;

-- Gatilho para manter current_balance_minutes sempre sincronizado com balance_minutes
CREATE OR REPLACE FUNCTION public.sync_time_bank_current_balance()
RETURNS TRIGGER AS $$
BEGIN
    NEW.current_balance_minutes := NEW.balance_minutes;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_time_bank_current_balance ON public.time_bank_accounts;
CREATE TRIGGER trg_sync_time_bank_current_balance
    BEFORE INSERT OR UPDATE OF balance_minutes ON public.time_bank_accounts
    FOR EACH ROW EXECUTE FUNCTION public.sync_time_bank_current_balance();

-- 5. RECARREGAR O SCHEMA CACHE DO POSTGREST
NOTIFY pgrst, 'reload schema';
