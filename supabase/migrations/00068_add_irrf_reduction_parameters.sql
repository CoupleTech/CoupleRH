-- Migration 00068: Adiciona colunas de cálculo do redutor do IRRF 2026 (T3 / Doc §4)
-- Tabela: public.general_legal_parameters

ALTER TABLE public.general_legal_parameters
ADD COLUMN IF NOT EXISTS irrf_reduction_a NUMERIC(12,2) DEFAULT 978.62,
ADD COLUMN IF NOT EXISTS irrf_reduction_b NUMERIC(12,6) DEFAULT 0.133145;

COMMENT ON COLUMN public.general_legal_parameters.irrf_reduction_a IS 'Termo fixo da fórmula do redutor progressivo do IRRF 2026 (padrão: 978.62)';
COMMENT ON COLUMN public.general_legal_parameters.irrf_reduction_b IS 'Coeficiente angular da fórmula do redutor progressivo do IRRF 2026 (padrão: 0.133145)';

-- Atualiza parâmetros existentes da versão legal ativa de 2026
UPDATE public.general_legal_parameters
SET 
  irrf_reduction_a = COALESCE(irrf_reduction_a, 978.62),
  irrf_reduction_b = COALESCE(irrf_reduction_b, 0.133145),
  irrf_exemption_limit = COALESCE(irrf_exemption_limit, 5000.00),
  irrf_reduction_formula_limit = COALESCE(irrf_reduction_formula_limit, 7350.00),
  irrf_base_reduction = COALESCE(irrf_base_reduction, 312.89),
  simplified_discount = CASE 
    WHEN simplified_discount IS NULL OR simplified_discount = 0 THEN 607.20 
    ELSE simplified_discount 
  END;

-- Recarrega o cache do PostgREST
NOTIFY pgrst, 'reload schema';
