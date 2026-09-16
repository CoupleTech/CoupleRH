-- Adiciona a coluna rubric_id para criar a ponte entre o Catálogo de Benefícios real e as Rubricas (Motor de Cálculo)
ALTER TABLE public.benefits_catalog 
ADD COLUMN rubric_id UUID REFERENCES public.payroll_rubrics(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.benefits_catalog.rubric_id IS 'Rubrica (geralmente de desconto) associada a este benefício que será inserida automaticamente na folha';
