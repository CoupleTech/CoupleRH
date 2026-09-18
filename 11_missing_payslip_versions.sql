-- Migration: 00041_add_payslip_versions
-- Description: Adiciona colunas para armazenar as versões dos motores e tabelas utilizadas no cálculo de cada holerite (Fase 32).

ALTER TABLE public.payslips 
    ADD COLUMN IF NOT EXISTS engine_version TEXT DEFAULT '1.0.0',
    ADD COLUMN IF NOT EXISTS rubrics_version TEXT DEFAULT '1.0.0',
    ADD COLUMN IF NOT EXISTS rules_version TEXT DEFAULT '1.0.0',
    ADD COLUMN IF NOT EXISTS inss_table_version TEXT DEFAULT '2026.1',
    ADD COLUMN IF NOT EXISTS irrf_table_version TEXT DEFAULT '2026.1',
    ADD COLUMN IF NOT EXISTS fgts_table_version TEXT DEFAULT '1.0.0';

-- Recarregar o schema para o PostgREST
NOTIFY pgrst, 'reload schema';
