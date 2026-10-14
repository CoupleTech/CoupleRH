-- Migration: 00074_fixed_events_value_type_and_hazard_concurrency_t14
-- Tarefa T14: Adiciona value_type em employee_fixed_events e allow_cumulative_hazard_allowances em employment_contracts

ALTER TABLE public.employee_fixed_events 
ADD COLUMN IF NOT EXISTS value_type TEXT NOT NULL DEFAULT 'AMOUNT' 
CHECK (value_type IN ('AMOUNT', 'PERCENT'));

COMMENT ON COLUMN public.employee_fixed_events.value_type IS 
'Tipo de valor do adicional/evento fixo: AMOUNT (valor fixo em R$) ou PERCENT (percentual aplicado sobre a base de cálculo da rubrica).';

ALTER TABLE public.employment_contracts 
ADD COLUMN IF NOT EXISTS allow_cumulative_hazard_allowances BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.employment_contracts.allow_cumulative_hazard_allowances IS 
'Permite cumulatividade excepcional de adicional de insalubridade e periculosidade prevista em CCT (CLT art. 193 §2º padrão: não cumulativo).';

NOTIFY pgrst, 'reload schema';
