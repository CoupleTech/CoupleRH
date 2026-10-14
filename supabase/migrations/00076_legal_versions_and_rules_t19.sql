-- Migration: 00076_legal_versions_and_rules_t19
-- Fase P4 / Tarefa T19: Dependentes, 13º, FGTS aprendiz, patronais por regime e versões reais gravadas

-- 1. Payslips: coluna para armazenar o ID real da versão de tabela legal utilizada
ALTER TABLE public.payslips 
ADD COLUMN IF NOT EXISTS legal_version_id UUID REFERENCES public.legal_versions(id);

COMMENT ON COLUMN public.payslips.legal_version_id IS 
'ID da versão de tabelas e parâmetros legais (legal_versions) efetivamente vigente e utilizada no cálculo do holerite.';

-- 2. Employment Contracts: flag explícita de aprendiz (alíquota de 2% de FGTS)
ALTER TABLE public.employment_contracts 
ADD COLUMN IF NOT EXISTS is_apprentice BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.employment_contracts.is_apprentice IS 
'Indica se o contrato é de Menor Aprendiz (CLT art. 428 / Lei 8.036/90 art. 15), aplicando alíquota reduzida de FGTS de 2%.';

-- 3. Companies: regime tributário, anexo do Simples Nacional e desoneração da folha (CPRB)
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS tax_regime TEXT DEFAULT 'LUCRO_PRESUMIDO';

ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS is_cprb_exempted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS simples_anexo TEXT DEFAULT NULL;

COMMENT ON COLUMN public.companies.tax_regime IS 
'Regime de tributação da empresa: SIMPLES, SIMPLES_NACIONAL, LUCRO_PRESUMIDO ou LUCRO_REAL.';

COMMENT ON COLUMN public.companies.is_cprb_exempted IS 
'Indica se a empresa é optante pela Desoneração da Folha de Pagamento (CPRB - Lei 12.546/2011), isentando a cota patronal previdenciária de 20%.';

COMMENT ON COLUMN public.companies.simples_anexo IS 
'Anexo do Simples Nacional (ex: I, II, III, IV, V). Anexos I, II, III e V são isentos de patronal/RAT/terceiros; Anexo IV recolhe patronal e RAT.';

NOTIFY pgrst, 'reload schema';
