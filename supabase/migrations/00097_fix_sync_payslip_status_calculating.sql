-- Migration: 00097_fix_sync_payslip_status_calculating.sql
-- Description: Ajusta o trigger sync_payslip_status_with_period para ignorar o status intermediário 'CALCULATING'
--              e expande a constraint payslips_status_check para suportar 'CALCULATING' com segurança.

-- 1. Permitir 'CALCULATING' na constraint de status da tabela payslips
ALTER TABLE public.payslips DROP CONSTRAINT IF EXISTS payslips_status_check;
ALTER TABLE public.payslips ADD CONSTRAINT payslips_status_check 
    CHECK (status IN ('DRAFT', 'CALCULATING', 'CALCULATED', 'CONFERENCE', 'CLOSED', 'REOPENED', 'CANCELED'));

-- 2. Atualizar o trigger para que não sincronize 'CALCULATING' aos holerites existentes durante processamento
CREATE OR REPLACE FUNCTION public.sync_payslip_status_with_period()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'CALCULATING' THEN
        UPDATE public.payslips
        SET status = NEW.status
        WHERE period_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

NOTIFY pgrst, 'reload schema';
