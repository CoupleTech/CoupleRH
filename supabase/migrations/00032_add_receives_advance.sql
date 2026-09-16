-- Migration: 00032_add_receives_advance
-- Description: Adiciona flag de adiantamento quinzenal no contrato

ALTER TABLE public.employment_contracts
ADD COLUMN IF NOT EXISTS receives_advance BOOLEAN DEFAULT true;

NOTIFY pgrst, 'reload schema';
