-- Migration: 00101_audit_t29_immutability_and_full_coverage
-- Description: Implementação de T29 - Auditoria Ampliada e Imutabilidade dos Logs de Auditoria
-- Escopo:
--   1. Bloqueio absoluto de UPDATE e DELETE na tabela audit.logs (Append-Only / Trilha Forense Imutável).
--   2. Extensão dos gatilhos de auditoria audit.audit_trigger_func() para todas as tabelas de Folha, Parâmetros Legais, Ponto Eletrônico e Assinaturas.

-- 1. Trava de Imutabilidade Estrita em audit.logs (CLT / LGPD / Compliance T29)
CREATE OR REPLACE FUNCTION audit.prevent_audit_logs_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'A tabela audit.logs e estritamente imutavel (append-only). Operacoes de UPDATE ou DELETE sao proibidas por conformidade legal e auditoria forense (CLT / LGPD / T29).';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_audit_logs_mutation ON audit.logs;
CREATE TRIGGER trg_prevent_audit_logs_mutation
BEFORE UPDATE OR DELETE ON audit.logs
FOR EACH ROW
EXECUTE FUNCTION audit.prevent_audit_logs_mutation();

-- 2. Gatilhos de Auditoria Idempotentes em Folha de Pagamento, Parâmetros Legais, Ponto e Assinaturas
DO $$
BEGIN
    -- 2.1 Folha de Pagamento
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payslips_trigger') THEN
        CREATE TRIGGER audit_payslips_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.payslips
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payslip_items_trigger') THEN
        CREATE TRIGGER audit_payslip_items_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.payslip_items
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_memory_calc_trigger') THEN
        CREATE TRIGGER audit_payroll_memory_calc_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.payroll_memory_calc
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_company_taxes_trigger') THEN
        CREATE TRIGGER audit_payroll_company_taxes_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.payroll_company_taxes
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_employee_deductions_trigger') THEN
        CREATE TRIGGER audit_employee_deductions_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.employee_deductions
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_periods_trigger') THEN
        CREATE TRIGGER audit_payroll_periods_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.payroll_periods
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_variable_events_trigger') THEN
        CREATE TRIGGER audit_payroll_variable_events_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.payroll_variable_events
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_employee_fixed_events_trigger') THEN
        CREATE TRIGGER audit_employee_fixed_events_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.employee_fixed_events
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    -- 2.2 Parâmetros Legais e Governança Tributária
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_legal_versions_trigger') THEN
        CREATE TRIGGER audit_legal_versions_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.legal_versions
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_inss_parameters_trigger') THEN
        CREATE TRIGGER audit_inss_parameters_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.inss_parameters
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_irrf_parameters_trigger') THEN
        CREATE TRIGGER audit_irrf_parameters_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.irrf_parameters
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_general_legal_parameters_trigger') THEN
        CREATE TRIGGER audit_general_legal_parameters_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.general_legal_parameters
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_progressive_tables_trigger') THEN
        CREATE TRIGGER audit_payroll_progressive_tables_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.payroll_progressive_tables
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    -- 2.3 Ponto Eletrônico e Jornadas
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_time_daily_summary_trigger') THEN
        CREATE TRIGGER audit_time_daily_summary_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.time_daily_summary
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_time_punch_records_trigger') THEN
        CREATE TRIGGER audit_time_punch_records_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.time_punch_records
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_time_bank_accounts_trigger') THEN
        CREATE TRIGGER audit_time_bank_accounts_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.time_bank_accounts
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_time_bank_transactions_trigger') THEN
        CREATE TRIGGER audit_time_bank_transactions_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.time_bank_transactions
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_timesheets_trigger') THEN
        CREATE TRIGGER audit_timesheets_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.timesheets
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_timesheet_contests_trigger') THEN
        CREATE TRIGGER audit_timesheet_contests_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.timesheet_contests
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    -- 2.4 Assinaturas Digitais e Evidências Forenses
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_signatures_log_trigger') THEN
        CREATE TRIGGER audit_signatures_log_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.signatures_log
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_document_events_trigger') THEN
        CREATE TRIGGER audit_document_events_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.document_events
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;
