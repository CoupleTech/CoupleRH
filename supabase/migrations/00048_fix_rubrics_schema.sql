-- Migration: 00048_fix_rubrics_schema
-- Description: Alinha o schema da tabela payroll_rubrics com os nomes de colunas 
-- esperados pela tela Rubrics.tsx e pelo motor de cálculo (Edge Function).
-- Resolve o BUG R1 (colunas com nomes incompatíveis entre frontend e banco).

-- 1. Adicionar colunas que a tela Rubrics.tsx espera mas não existem
ALTER TABLE public.payroll_rubrics 
  ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS valid_from DATE,
  ADD COLUMN IF NOT EXISTS valid_to DATE,
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS esocial_description TEXT;

-- 2. Adicionar colunas com os nomes corretos que a tela usa para incidências patronais
-- (A tela envia: incidence_inss_patronal, incidence_rat, incidence_third_parties)
-- (O banco antigo tinha: inss_patronal_incidence, rat_incidence, terceiros_incidence)
ALTER TABLE public.payroll_rubrics 
  ADD COLUMN IF NOT EXISTS incidence_inss_patronal BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS incidence_rat BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS incidence_third_parties BOOLEAN DEFAULT false;

-- 3. Adicionar colunas com os nomes corretos que a tela usa para bases geradas
-- (A tela envia: generates_base_inss, generates_base_irrf, generates_base_fgts)
-- (O banco antigo tinha: generates_inss_base, generates_irrf_base, generates_fgts_base)
ALTER TABLE public.payroll_rubrics 
  ADD COLUMN IF NOT EXISTS generates_base_inss BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS generates_base_irrf BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS generates_base_fgts BOOLEAN DEFAULT false;

-- 4. Migrar dados existentes das colunas antigas para as novas (se existirem)
DO $$
BEGIN
  -- Migrar incidências patronais
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_rubrics' AND column_name = 'inss_patronal_incidence') THEN
    UPDATE public.payroll_rubrics SET 
      incidence_inss_patronal = COALESCE(inss_patronal_incidence, false)
    WHERE inss_patronal_incidence IS NOT NULL AND inss_patronal_incidence = true;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_rubrics' AND column_name = 'rat_incidence') THEN
    UPDATE public.payroll_rubrics SET 
      incidence_rat = COALESCE(rat_incidence, false)
    WHERE rat_incidence IS NOT NULL AND rat_incidence = true;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_rubrics' AND column_name = 'terceiros_incidence') THEN
    UPDATE public.payroll_rubrics SET 
      incidence_third_parties = COALESCE(terceiros_incidence, false)
    WHERE terceiros_incidence IS NOT NULL AND terceiros_incidence = true;
  END IF;
  
  -- Migrar bases geradas
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_rubrics' AND column_name = 'generates_inss_base') THEN
    UPDATE public.payroll_rubrics SET 
      generates_base_inss = COALESCE(generates_inss_base, false)
    WHERE generates_inss_base IS NOT NULL AND generates_inss_base = true;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_rubrics' AND column_name = 'generates_irrf_base') THEN
    UPDATE public.payroll_rubrics SET 
      generates_base_irrf = COALESCE(generates_irrf_base, false)
    WHERE generates_irrf_base IS NOT NULL AND generates_irrf_base = true;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_rubrics' AND column_name = 'generates_fgts_base') THEN
    UPDATE public.payroll_rubrics SET 
      generates_base_fgts = COALESCE(generates_fgts_base, false)
    WHERE generates_fgts_base IS NOT NULL AND generates_fgts_base = true;
  END IF;
END $$;

-- 5. Garantir que a coluna calculation_order existe com um bom default
ALTER TABLE public.payroll_rubrics 
  ALTER COLUMN calculation_order SET DEFAULT 50;

NOTIFY pgrst, 'reload schema';
