-- Migration 00075_deductions_apply_on_types_t17.sql
-- Fase P4 / Tarefa T17: Descontos fixos por tipo de folha (apply_on_types) e regra de pensão alimentícia

ALTER TABLE public.employee_deductions
ADD COLUMN IF NOT EXISTS apply_on_types TEXT[] DEFAULT NULL;

COMMENT ON COLUMN public.employee_deductions.apply_on_types IS 
'Tipos de folha aos quais a dedução fixa se aplica (ex: MONTHLY, ADVANCE, VACATION, THIRTEENTH_1, THIRTEENTH_2, COMPLEMENTARY). Se nulo ou vazio, adota o padrão: MONTHLY ou ADVANCE de acordo com deduct_on_advance, sem vazar para Férias ou 13º.';
