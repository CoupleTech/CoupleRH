-- Migration: 00037_complementary_payroll
-- Description: Adiciona suporte a folha complementar na tabela payroll_periods

-- 1. Modificar a constraint de type
ALTER TABLE public.payroll_periods DROP CONSTRAINT IF EXISTS payroll_periods_type_check;

ALTER TABLE public.payroll_periods ADD CONSTRAINT payroll_periods_type_check 
    CHECK (type IN ('MONTHLY', 'ADVANCE', '13TH', 'THIRTEENTH_1', 'THIRTEENTH_2', 'VACATION', 'PROFIT_SHARING', 'COMPLEMENTARY'));

-- 2. Adicionar colunas de relacionamento e motivo
ALTER TABLE public.payroll_periods ADD COLUMN IF NOT EXISTS parent_period_id UUID REFERENCES public.payroll_periods(id);
ALTER TABLE public.payroll_periods ADD COLUMN IF NOT EXISTS complement_reason TEXT;

NOTIFY pgrst, 'reload schema';
