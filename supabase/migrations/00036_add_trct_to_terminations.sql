-- Migration: 00036_add_trct_to_terminations
-- Description: Adiciona coluna calculated_trct para salvar o snapshot do TRCT

ALTER TABLE public.terminations ADD COLUMN IF NOT EXISTS calculated_trct JSONB;

NOTIFY pgrst, 'reload schema';
