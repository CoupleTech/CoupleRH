-- Migration: 00098_fix_payroll_memory_calc_immutability_trigger.sql
-- Description: Corrige a busca do period_id na função check_payroll_period_immutability para payroll_memory_calc
--              (tabela que usa payslip_id e não period_id diretamente).

CREATE OR REPLACE FUNCTION public.check_payroll_period_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_period_id UUID;
    v_status TEXT;
BEGIN
    -- Identificar o period_id dependendo da tabela de origem
    IF TG_TABLE_NAME = 'payslips' THEN
        v_period_id := COALESCE(OLD.period_id, NEW.period_id);
    ELSIF TG_TABLE_NAME = 'payslip_items' THEN
        SELECT period_id INTO v_period_id FROM public.payslips WHERE id = COALESCE(OLD.payslip_id, NEW.payslip_id);
    ELSIF TG_TABLE_NAME = 'payroll_company_taxes' THEN
        v_period_id := COALESCE(OLD.period_id, NEW.period_id);
    ELSIF TG_TABLE_NAME = 'payroll_memory_calc' THEN
        SELECT period_id INTO v_period_id FROM public.payslips WHERE id = COALESCE(OLD.payslip_id, NEW.payslip_id);
    END IF;

    IF v_period_id IS NOT NULL THEN
        SELECT status INTO v_status FROM public.payroll_periods WHERE id = v_period_id;
        IF v_status = 'CLOSED' THEN
            RAISE EXCEPTION 'Operação bloqueada (Imutabilidade Legal CLT): O período de folha % está FECHADO (CLOSED). Nenhum holerite, item ou imposto pode ser alterado ou excluído sem reabertura formal autorizada.', v_period_id;
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
