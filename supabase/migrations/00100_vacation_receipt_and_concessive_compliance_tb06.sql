-- Migration: 00100_vacation_receipt_and_concessive_compliance_tb06
-- Description: Atualiza a RPC get_employee_vacation_balance para incluir abono pecuniário (cash_allowance_days)
-- e metadados de concessão para o Recibo de Férias Completo (TB-06 / CLT Art. 134 e 145)

CREATE OR REPLACE FUNCTION public.get_employee_vacation_balance(p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', vp.id,
            'contract_id', vp.contract_id,
            'start_date', vp.start_date,
            'end_date', vp.end_date,
            'concessive_start_date', vp.concessive_start_date,
            'concessive_end_date', vp.concessive_end_date,
            'days_earned', vp.earned_days,
            'days_taken', vp.taken_days,
            'days_lost', vp.lost_days,
            'status', vp.status,
            'requests', (
                SELECT COALESCE(json_agg(
                    json_build_object(
                        'id', vr.id,
                        'start_date', vr.start_date,
                        'end_date', vr.end_date,
                        'days_taken', vr.days_taken,
                        'cash_allowance_days', COALESCE(vr.cash_allowance_days, 0),
                        'status', vr.status,
                        'created_at', vr.created_at
                    ) ORDER BY vr.start_date ASC
                ), '[]'::JSON)
                FROM public.vacation_requests vr
                WHERE vr.vesting_period_id = vp.id
            )
        ) ORDER BY vp.start_date DESC
    ) INTO v_result
    FROM public.vacation_vesting_periods vp
    WHERE vp.contract_id IN (
        SELECT id FROM public.employment_contracts WHERE worker_id = p_worker_id
    );

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_employee_vacation_balance(UUID) TO anon, authenticated;
