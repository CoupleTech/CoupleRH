-- ==============================================================================
-- Migration: 00079_time_bank_pt07.sql
-- Descrição: Fase P5 / Tarefa PT-07 — Banco de Horas (CLT Art. 59 §§ 2º, 3º e 5º)
--            Atualização de constraints para liquidação/pagamento como HE,
--            vínculo com períodos de folha e resumo diário, alertas e índices.
-- ==============================================================================

-- 1. ATUALIZAR CONSTRAINT EM time_bank_transactions (Adicionando PAYOUT e EXPIRATION_PAYOUT)
ALTER TABLE public.time_bank_transactions
    DROP CONSTRAINT IF EXISTS time_bank_transactions_transaction_type_check;

ALTER TABLE public.time_bank_transactions
    ADD CONSTRAINT time_bank_transactions_transaction_type_check
    CHECK (transaction_type IN (
        'OVERTIME',
        'DELAY',
        'ABSENCE',
        'COMPENSATION_DAY_OFF',
        'MANUAL_ADJUSTMENT',
        'PAYOUT',
        'EXPIRATION_PAYOUT'
    ));

-- 2. ADICIONAR COLUNAS DE RASTREABILIDADE EM time_bank_transactions
ALTER TABLE public.time_bank_transactions
    ADD COLUMN IF NOT EXISTS payroll_period_id UUID REFERENCES public.payroll_periods(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS daily_summary_id UUID REFERENCES public.time_daily_summary(id) ON DELETE SET NULL;

-- 3. ADICIONAR COLUNAS DE GOVERNANÇA E QUITAÇÃO EM time_bank_accounts
ALTER TABLE public.time_bank_accounts
    ADD COLUMN IF NOT EXISTS warning_days_before_expiration INTEGER DEFAULT 30,
    ADD COLUMN IF NOT EXISTS paid_out_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS paid_out_payroll_period_id UUID REFERENCES public.payroll_periods(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS payout_rubric_code TEXT DEFAULT '152';

-- 4. ÍNDICES DE PERFORMANCE PARA CONSULTAS DE EXTRATO E EXPIRAÇÃO
CREATE INDEX IF NOT EXISTS idx_time_bank_accounts_contract_status
    ON public.time_bank_accounts(contract_id, status);

CREATE INDEX IF NOT EXISTS idx_time_bank_accounts_end_date
    ON public.time_bank_accounts(end_date)
    WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_time_bank_transactions_account_date
    ON public.time_bank_transactions(account_id, date ASC, created_at ASC);

-- 5. RPC TRANSACIONAL ATÔMICA PARA LIQUIDAÇÃO E FECHAMENTO DO BANCO DE HORAS
CREATE OR REPLACE FUNCTION public.close_and_payout_time_bank_account(
    p_account_id UUID,
    p_closure_date DATE,
    p_reason TEXT, -- 'EXPIRATION' | 'TERMINATION' | 'MANUAL'
    p_payroll_period_id UUID DEFAULT NULL,
    p_overtime_factor NUMERIC DEFAULT 1.5,
    p_rubric_code TEXT DEFAULT '152'
)
RETURNS TABLE (
    account_id UUID,
    final_balance_minutes INTEGER,
    status TEXT,
    closure_date DATE,
    payout_hours NUMERIC,
    rubric_code TEXT
) AS $$
DECLARE
    v_account public.time_bank_accounts%ROWTYPE;
    v_balance INTEGER;
    v_tx_type TEXT;
    v_desc TEXT;
    v_hours NUMERIC;
BEGIN
    SELECT * INTO v_account 
    FROM public.time_bank_accounts 
    WHERE id = p_account_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conta de banco de horas não encontrada: %', p_account_id;
    END IF;

    IF v_account.status != 'ACTIVE' THEN
        RAISE EXCEPTION 'Apenas contas ATIVAS podem ser liquidadas. Status atual: %', v_account.status;
    END IF;

    v_balance := v_account.balance_minutes;

    IF v_balance > 0 THEN
        v_hours := ROUND((v_balance::NUMERIC / 60.0), 2);
        
        IF p_reason = 'EXPIRATION' THEN
            v_tx_type := 'EXPIRATION_PAYOUT';
            v_desc := 'Liquidação de banco de horas vencido para pagamento em folha (Art. 59 §3º CLT)';
        ELSE
            v_tx_type := 'PAYOUT';
            v_desc := 'Liquidação rescisória de banco de horas para pagamento em folha (Art. 59 §3º CLT)';
        END IF;

        -- Registra débito de quitação
        INSERT INTO public.time_bank_transactions (
            tenant_id,
            account_id,
            date,
            minutes,
            transaction_type,
            description,
            payroll_period_id
        ) VALUES (
            v_account.tenant_id,
            v_account.id,
            p_closure_date,
            -v_balance,
            v_tx_type,
            v_desc,
            p_payroll_period_id
        );

        -- Atualiza conta
        UPDATE public.time_bank_accounts
        SET balance_minutes = 0,
            status = 'PAID_OUT',
            closure_date = p_closure_date,
            paid_out_at = NOW(),
            paid_out_payroll_period_id = p_payroll_period_id,
            updated_at = NOW()
        WHERE id = v_account.id;

    ELSE
        -- Saldo zerado ou negativo
        v_hours := 0;
        UPDATE public.time_bank_accounts
        SET status = 'CLOSED',
            closure_date = p_closure_date,
            updated_at = NOW()
        WHERE id = v_account.id;
    END IF;

    RETURN QUERY SELECT 
        v_account.id,
        0,
        CASE WHEN v_balance > 0 THEN 'PAID_OUT' ELSE 'CLOSED' END,
        p_closure_date,
        v_hours,
        p_rubric_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.close_and_payout_time_bank_account TO authenticated;
