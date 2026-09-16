-- Migration: 00053_fix_payslips_rpc
-- Description: Adiciona SECURITY DEFINER à função get_employee_payslips para o Portal do Colaborador

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

GRANT EXECUTE ON FUNCTION public.get_employee_payslips(UUID) TO anon, authenticated;
