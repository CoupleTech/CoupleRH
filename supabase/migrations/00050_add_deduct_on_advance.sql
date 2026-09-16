-- Migration: 00050_add_deduct_on_advance
-- Description: Adiciona flag para descontar retenções/deduções no adiantamento (vale)

ALTER TABLE public.employee_deductions 
ADD COLUMN IF NOT EXISTS deduct_on_advance BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.employee_deductions.deduct_on_advance IS 'Se verdadeiro, o desconto será aplicado na folha de adiantamento (ADVANCE) e não na mensal (MONTHLY).';
