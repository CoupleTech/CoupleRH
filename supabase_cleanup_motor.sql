-- ==============================================================================
-- LIMPEZA: RECRIAÇÃO DAS TABELAS DO MOTOR (REMOVE DADOS ANTIGOS)
-- Executar ANTES do supabase_sql_fase_13_14.sql
-- ==============================================================================

-- 1. Dropar triggers de auditoria (se existirem)
DROP TRIGGER IF EXISTS audit_payroll_periods_trigger ON public.payroll_periods;
DROP TRIGGER IF EXISTS audit_payroll_variable_events_trigger ON public.payroll_variable_events;
DROP TRIGGER IF EXISTS audit_payslips_trigger ON public.payslips;

-- 2. Dropar tabelas na ordem correta (dependências primeiro)
DROP TABLE IF EXISTS public.payroll_memory_calc CASCADE;
DROP TABLE IF EXISTS public.payslip_items CASCADE;
DROP TABLE IF EXISTS public.payslips CASCADE;
DROP TABLE IF EXISTS public.payroll_variable_events CASCADE;
DROP TABLE IF EXISTS public.payroll_periods CASCADE;

-- 3. Limpar logs de auditoria órfãos dessas tabelas (opcional)
DELETE FROM audit.logs WHERE entity_type IN ('payroll_periods', 'payslips', 'payslip_items', 'payroll_variable_events', 'payroll_memory_calc');

-- Atualizar cache
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- AGORA EXECUTE O supabase_sql_fase_13_14.sql LOGO EM SEGUIDA
-- ==============================================================================
