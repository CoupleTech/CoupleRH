-- Migration: 00054_payslip_details_rpc
-- Description: RPC para obter os detalhes analíticos de um holerite (rubricas, totais e bases)

CREATE OR REPLACE FUNCTION public.get_employee_payslip_details(p_payslip_id UUID, p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    -- Segurança: Garante que o holerite solicitado pertence ao contrato do colaborador
    IF NOT EXISTS (
        SELECT 1 FROM public.payslips p
        JOIN public.employment_contracts ec ON ec.id = p.contract_id
        WHERE p.id = p_payslip_id AND ec.worker_id = p_worker_id
    ) THEN
        RETURN '{}'::JSON;
    END IF;

    SELECT json_build_object(
        'totals', json_build_object(
            'total_earnings', p.total_earnings,
            'total_deductions', p.total_deductions,
            'net_salary', p.net_salary,
            'base_inss', p.base_inss,
            'base_irrf', p.base_irrf,
            'base_fgts', p.base_fgts,
            'fgts_month', p.fgts_month
        ),
        'items', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'code', pr.code,
                    'name', pr.name,
                    'reference', pi.reference,
                    'amount', pi.amount,
                    'type', pi.type
                ) ORDER BY pi.type DESC, pr.code ASC
            ), '[]'::JSON)
            FROM public.payslip_items pi
            JOIN public.payroll_rubrics pr ON pr.id = pi.rubric_id
            WHERE pi.payslip_id = p.id
        )
    ) INTO v_result
    FROM public.payslips p
    WHERE p.id = p_payslip_id;

    RETURN COALESCE(v_result, '{}'::JSON);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_employee_payslip_details(UUID, UUID) TO anon, authenticated;
