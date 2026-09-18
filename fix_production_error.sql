-- SCRIPT PARA CORREÇÃO EM PRODUÇÃO
-- Este script irá adicionar a coluna ausente SEM APAGAR OS DADOS (seguro para produção) e forçará a atualização do cache da API.

ALTER TABLE public.employment_contracts 
ADD COLUMN IF NOT EXISTS receives_advance BOOLEAN DEFAULT true;

-- Força a atualização do cache da API (PostgREST)
NOTIFY pgrst, 'reload schema';
