-- ==============================================================================
-- Migration: 00082_employee_time_tracking_pt10.sql
-- Descrição: Fase P5 / Tarefa PT-10 — RPCs do Portal do Colaborador para
--            Ponto Eletrônico (batidas de hoje, extrato de banco de horas,
--            espelhos de ponto, assinatura e contestação).
-- ==============================================================================

-- 1. CONSULTAR BATIDAS DE HOJE DO COLABORADOR
CREATE OR REPLACE FUNCTION public.get_employee_today_punches(p_contract_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_punches JSONB;
BEGIN
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', te.id,
                'entry_type', te.entry_type,
                'original_timestamp', te.original_timestamp,
                'status', te.status,
                'punch_record_id', te.punch_record_id,
                'receipt_code', pr.receipt_code,
                'nsr', pr.nsr
            ) ORDER BY te.original_timestamp ASC
        ),
        '[]'::jsonb
    ) INTO v_punches
    FROM public.time_entries te
    LEFT JOIN public.time_punch_records pr ON pr.id = te.punch_record_id
    WHERE te.contract_id = p_contract_id
      AND DATE(te.original_timestamp AT TIME ZONE 'America/Sao_Paulo') = DATE(NOW() AT TIME ZONE 'America/Sao_Paulo');

    RETURN v_punches;
END;
$$;

-- 2. CONSULTAR RESUMO DO BANCO DE HORAS ATIVO DO COLABORADOR
CREATE OR REPLACE FUNCTION public.get_employee_time_bank(p_contract_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_account RECORD;
    v_transactions JSONB;
    v_days_left INT;
    v_alert TEXT := 'NORMAL';
BEGIN
    SELECT * INTO v_account
    FROM public.time_bank_accounts
    WHERE contract_id = p_contract_id
      AND status = 'ACTIVE'
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'has_active_account', false,
            'balance_minutes', 0,
            'formatted_balance', '+00:00',
            'transactions', '[]'::jsonb
        );
    END IF;

    -- Calcular dias restantes para expiração
    v_days_left := (v_account.valid_until - CURRENT_DATE);

    IF v_days_left <= 0 THEN
        v_alert := 'EXPIRED';
    ELSIF v_days_left <= 30 THEN
        v_alert := 'EXPIRING_SOON';
    END IF;

    -- Obter últimas 20 transações
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', t.id,
                'transaction_type', t.transaction_type,
                'minutes', t.minutes,
                'balance_after_minutes', t.balance_after_minutes,
                'origin_date', t.origin_date,
                'description', t.description,
                'created_at', t.created_at
            ) ORDER BY t.created_at DESC
        ),
        '[]'::jsonb
    ) INTO v_transactions
    FROM (
        SELECT * FROM public.time_bank_transactions
        WHERE account_id = v_account.id
        ORDER BY created_at DESC
        LIMIT 20
    ) t;

    RETURN jsonb_build_object(
        'has_active_account', true,
        'account_id', v_account.id,
        'agreement_type', v_account.agreement_type,
        'balance_minutes', v_account.balance_minutes,
        'valid_from', v_account.valid_from,
        'valid_until', v_account.valid_until,
        'days_remaining', v_days_left,
        'alert_status', v_alert,
        'max_monthly_negative_balance', v_account.max_monthly_negative_balance,
        'transactions', v_transactions
    );
END;
$$;

-- 3. CONSULTAR ESPELHOS MENSAIS DO COLABORADOR
CREATE OR REPLACE FUNCTION public.get_employee_timesheets(p_contract_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sheets JSONB;
BEGIN
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', ts.id,
                'period_year', ts.period_year,
                'period_month', ts.period_month,
                'status', ts.status,
                'total_regular_minutes', ts.total_regular_minutes,
                'total_overtime_50_minutes', ts.total_overtime_50_minutes,
                'total_overtime_100_minutes', ts.total_overtime_100_minutes,
                'total_night_shift_minutes', ts.total_night_shift_minutes,
                'total_delay_minutes', ts.total_delay_minutes,
                'total_absence_minutes', ts.total_absence_minutes,
                'time_bank_balance_minutes', ts.time_bank_balance_minutes,
                'document_hash', ts.document_hash,
                'contested_at', ts.contested_at,
                'signed_at', ts.signed_at,
                'created_at', ts.created_at
            ) ORDER BY ts.period_year DESC, ts.period_month DESC
        ),
        '[]'::jsonb
    ) INTO v_sheets
    FROM public.timesheets ts
    WHERE ts.contract_id = p_contract_id;

    RETURN v_sheets;
END;
$$;

-- 4. ASSINATURA DIGITAL / CIÊNCIA DO ESPELHO DE PONTO
CREATE OR REPLACE FUNCTION public.sign_employee_timesheet(
    p_contract_id UUID,
    p_timesheet_id UUID,
    p_signature_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ts RECORD;
BEGIN
    SELECT * INTO v_ts
    FROM public.timesheets
    WHERE id = p_timesheet_id
      AND contract_id = p_contract_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Espelho de ponto não encontrado.');
    END IF;

    IF v_ts.status = 'SIGNED' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Espelho já assinado anteriormente.');
    END IF;

    UPDATE public.timesheets
    SET status = 'SIGNED',
        signed_at = NOW(),
        document_hash = COALESCE(document_hash, p_signature_hash),
        updated_at = NOW()
    WHERE id = p_timesheet_id;

    RETURN jsonb_build_object('success', true, 'signed_at', NOW());
END;
$$;
