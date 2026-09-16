-- Migration: 00035_alter_payroll_periods_type
-- Description: Altera a constraint de type da tabela payroll_periods para suportar as parcelas do 13º

-- Primeiro, removemos a constraint atual
ALTER TABLE public.payroll_periods DROP CONSTRAINT IF EXISTS payroll_periods_type_check;

-- Agora criamos a constraint correta
ALTER TABLE public.payroll_periods ADD CONSTRAINT payroll_periods_type_check 
    CHECK (type IN ('MONTHLY', 'ADVANCE', '13TH', 'THIRTEENTH_1', 'THIRTEENTH_2', 'VACATION', 'PROFIT_SHARING'));

NOTIFY pgrst, 'reload schema';
