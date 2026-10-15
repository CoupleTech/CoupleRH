-- ==============================================================================
-- COUPLE RH - ATUALIZAÇÃO DE COLUNAS CONTRATUAIS E EVENTOS FIXOS
-- Execute este script no SQL Editor do Supabase (https://supabase.com/dashboard)
-- Idempotente: pode ser executado múltiplas vezes sem risco de duplicidade ou perda de dados.
-- ==============================================================================

-- 1. Coluna allow_cumulative_hazard_allowances na tabela employment_contracts (CLT art. 193 §2º / CCT)
ALTER TABLE public.employment_contracts 
ADD COLUMN IF NOT EXISTS allow_cumulative_hazard_allowances BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.employment_contracts.allow_cumulative_hazard_allowances IS 
'Permite cumulatividade excepcional de adicional de insalubridade e periculosidade prevista em CCT (CLT art. 193 §2º padrão: não cumulativo).';

-- 2. Coluna is_apprentice na tabela employment_contracts (Menor Aprendiz / FGTS 2%)
ALTER TABLE public.employment_contracts 
ADD COLUMN IF NOT EXISTS is_apprentice BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.employment_contracts.is_apprentice IS 
'Indica se o contrato é de Menor Aprendiz (CLT art. 428 / Lei 8.036/90 art. 15), aplicando alíquota reduzida de FGTS de 2%.';

-- 3. Coluna value_type na tabela employee_fixed_events (Adicionais fixos em R$ ou %)
ALTER TABLE public.employee_fixed_events 
ADD COLUMN IF NOT EXISTS value_type TEXT NOT NULL DEFAULT 'AMOUNT' 
CHECK (value_type IN ('AMOUNT', 'PERCENT'));

COMMENT ON COLUMN public.employee_fixed_events.value_type IS 
'Tipo de valor do adicional fixo: AMOUNT (R$) ou PERCENT (% sobre a base da rubrica).';

-- 4. Coluna apply_on_types na tabela employee_deductions (Descontos fixos por tipo de folha)
ALTER TABLE public.employee_deductions
ADD COLUMN IF NOT EXISTS apply_on_types TEXT[] DEFAULT NULL;

COMMENT ON COLUMN public.employee_deductions.apply_on_types IS 
'Tipos de folha aos quais a dedução fixa se aplica (ex: MONTHLY, ADVANCE, VACATION, THIRTEENTH).';

-- 5. Atualização do cache do PostgREST da API do Supabase
NOTIFY pgrst, 'reload schema';
