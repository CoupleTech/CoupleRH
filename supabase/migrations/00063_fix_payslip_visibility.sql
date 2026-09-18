-- Migration: 00063_fix_payslip_visibility
-- Description: Adiciona trigger para sincronizar status do payslip com payroll_period e corrige a view do portal.

-- 1. Sync Trigger
CREATE OR REPLACE FUNCTION public.sync_payslip_status_with_period()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        UPDATE public.payslips
        SET status = NEW.status
        WHERE period_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_payslip_status_trigger ON public.payroll_periods;
CREATE TRIGGER sync_payslip_status_trigger
AFTER UPDATE OF status ON public.payroll_periods
FOR EACH ROW
EXECUTE FUNCTION public.sync_payslip_status_with_period();

-- 2. Atualizar todos os payslips já existentes baseados no status dos periods
UPDATE public.payslips p
SET status = pp.status
FROM public.payroll_periods pp
WHERE p.period_id = pp.id
AND p.status IS DISTINCT FROM pp.status;

-- 3. Atualizar a RPC para ser mais resiliente e garantir que o status vem do período
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
            'status', pp.status,
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
    AND (p.status = 'CLOSED' OR pp.status = 'CLOSED'); -- Segurança dupla

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_employee_payslips(UUID) TO anon, authenticated;
