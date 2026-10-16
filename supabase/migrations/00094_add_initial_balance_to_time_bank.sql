-- ==============================================================================
-- Migration: 00094_add_initial_balance_to_time_bank.sql
-- Descrição: Tarefa TB-03 — Lançamento Manual e Carga de Saldo Inicial de Banco de Horas
--            (Migração de Sistema Anterior)
--            Adiciona 'INITIAL_BALANCE' aos tipos válidos de time_bank_transactions,
--            adiciona RPC transacional register_time_bank_initial_balance
--            com provisionamento automático de conta de banco de horas se inexistente.
-- ==============================================================================

-- 1. ATUALIZAR CONSTRAINT EM time_bank_transactions (Adicionando INITIAL_BALANCE)
ALTER TABLE public.time_bank_transactions
    DROP CONSTRAINT IF EXISTS time_bank_transactions_transaction_type_check;

ALTER TABLE public.time_bank_transactions
    ADD CONSTRAINT time_bank_transactions_transaction_type_check
    CHECK (transaction_type IN (
        'INITIAL_BALANCE',
        'OVERTIME',
        'DELAY',
        'ABSENCE',
        'COMPENSATION_DAY_OFF',
        'COMPENSATION_DELAY',
        'COMPENSATION_ABSENCE',
        'MANUAL_ADJUSTMENT',
        'PAYOUT',
        'EXPIRATION_PAYOUT'
    ));

COMMENT ON CONSTRAINT time_bank_transactions_transaction_type_check ON public.time_bank_transactions IS 
'Tipos de transação de banco de horas suportados: INITIAL_BALANCE (carga legada/saldo inicial), OVERTIME, DELAY, ABSENCE, COMPENSATION_DAY_OFF, COMPENSATION_DELAY, COMPENSATION_ABSENCE, MANUAL_ADJUSTMENT, PAYOUT e EXPIRATION_PAYOUT.';

-- 2. RPC ATÔMICA PARA PROVISIONAMENTO E LANÇAMENTO DE SALDO INICIAL
CREATE OR REPLACE FUNCTION public.register_time_bank_initial_balance(
    p_tenant_id UUID,
    p_contract_id UUID,
    p_cutoff_date DATE,
    p_minutes INTEGER,
    p_justification TEXT,
    p_policy_type TEXT DEFAULT 'ACORDO_INDIVIDUAL',
    p_validity_months INTEGER DEFAULT 6,
    p_company_id UUID DEFAULT NULL
)
RETURNS TABLE (
    account_id UUID,
    transaction_id UUID,
    final_balance_minutes INTEGER,
    cutoff_date DATE,
    message TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_account_id UUID;
    v_tx_id UUID;
    v_current_balance INTEGER := 0;
    v_new_balance INTEGER := 0;
    v_end_date DATE;
    v_validity INTEGER := COALESCE(p_validity_months, 6);
    v_policy TEXT := COALESCE(p_policy_type, 'ACORDO_INDIVIDUAL');
BEGIN
    -- Validação legal CLT Art. 59
    IF v_policy = 'ACORDO_INDIVIDUAL' AND v_validity > 6 THEN
        RAISE EXCEPTION 'Banco de horas por Acordo Individual não pode ter vigência superior a 6 meses (Art. 59 § 5º CLT).';
    END IF;

    IF (v_policy = 'CCT' OR v_policy = 'ACT') AND v_validity > 12 THEN
        RAISE EXCEPTION 'Banco de horas por CCT/ACT não pode ter vigência superior a 12 meses (Art. 59 § 2º CLT).';
    END IF;

    -- 1. Localizar conta ativa existente para o contrato
    SELECT id, balance_minutes 
    INTO v_account_id, v_current_balance
    FROM public.time_bank_accounts
    WHERE tenant_id = p_tenant_id
      AND contract_id = p_contract_id
      AND status = 'ACTIVE'
    ORDER BY created_at DESC
    LIMIT 1;

    -- 2. Se não existir, provisionar nova conta ativa a partir da data de corte
    IF v_account_id IS NULL THEN
        -- Calcula data final somando meses de vigência menos 1 dia
        v_end_date := (p_cutoff_date + (v_validity || ' months')::INTERVAL - '1 day'::INTERVAL)::DATE;

        INSERT INTO public.time_bank_accounts (
            tenant_id,
            company_id,
            contract_id,
            balance_minutes,
            start_date,
            end_date,
            status,
            policy_type,
            validity_months,
            expiration_rule,
            warning_days_before_expiration,
            payout_rubric_code,
            created_at,
            updated_at
        ) VALUES (
            p_tenant_id,
            p_company_id,
            p_contract_id,
            0,
            p_cutoff_date,
            v_end_date,
            'ACTIVE',
            v_policy,
            v_validity,
            'PAY_AS_OVERTIME',
            30,
            '152',
            NOW(),
            NOW()
        )
        RETURNING id INTO v_account_id;
        
        v_current_balance := 0;
    END IF;

    -- 3. Inserir a transação de INITIAL_BALANCE
    v_new_balance := v_current_balance + p_minutes;

    INSERT INTO public.time_bank_transactions (
        tenant_id,
        account_id,
        date,
        minutes,
        transaction_type,
        description,
        created_at
    ) VALUES (
        p_tenant_id,
        v_account_id,
        p_cutoff_date,
        p_minutes,
        'INITIAL_BALANCE',
        COALESCE(p_justification, 'Carga de saldo inicial / migração de sistema anterior'),
        NOW()
    )
    RETURNING id INTO v_tx_id;

    -- 4. Atualizar saldo acumulado da conta
    UPDATE public.time_bank_accounts
    SET balance_minutes = v_new_balance,
        updated_at = NOW()
    WHERE id = v_account_id;

    RETURN QUERY
    SELECT 
        v_account_id,
        v_tx_id,
        v_new_balance,
        p_cutoff_date,
        'Saldo inicial lançado com sucesso no banco de horas.'::TEXT;
END;
$$;

-- Notifica o PostgREST para recarregar o schema cache
NOTIFY pgrst, 'reload schema';
