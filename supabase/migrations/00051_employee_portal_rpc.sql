-- Migration: 00051_employee_portal_rpc
-- Description: Criação de RPCs para o Portal do Colaborador acessar seus dados com segurança

CREATE OR REPLACE FUNCTION public.get_employee_payslips(p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', p.id,
            'net_salary', p.net_salary,
            'status', p.status,
            'period_month', pp.month,
            'period_year', pp.year,
            'period_type', pp.type
        ) ORDER BY pp.year DESC, pp.month DESC
    ) INTO v_result
    FROM public.payslips p
    JOIN public.payroll_periods pp ON pp.id = p.period_id
    WHERE p.contract_id IN (
        SELECT id FROM public.employment_contracts WHERE worker_id = p_worker_id
    )
    AND p.status = 'CLOSED';

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql;

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
            'status', vp.status
        ) ORDER BY vp.start_date DESC
    ) INTO v_result
    FROM public.vacation_vesting_periods vp
    WHERE vp.contract_id IN (
        SELECT id FROM public.employment_contracts WHERE worker_id = p_worker_id
    );

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_employee_payslips(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_vacation_balance(UUID) TO anon, authenticated;
