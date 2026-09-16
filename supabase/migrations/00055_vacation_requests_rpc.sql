-- Migration: 00055_vacation_requests_rpc
-- Description: Atualiza a RPC get_employee_vacation_balance para incluir as solicitações/férias programadas (vacation_requests)

CREATE OR REPLACE FUNCTION public.get_employee_vacation_balance(p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', vp.id,
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
                        'status', vr.status
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
