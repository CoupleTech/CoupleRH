-- SCRIPT PARA CORREÇÃO DA Lotação (Workplace) EM PRODUÇÃO
-- Adiciona a coluna ausente SEM APAGAR DADOS (seguro) e recarrega o cache.

ALTER TABLE public.employment_contracts 
ADD COLUMN IF NOT EXISTS workplace_id UUID REFERENCES public.workplaces(id) ON DELETE SET NULL;

-- Força a atualização do cache da API (PostgREST)
NOTIFY pgrst, 'reload schema';
