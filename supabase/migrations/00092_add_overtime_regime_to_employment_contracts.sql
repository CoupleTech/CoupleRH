-- Migration: 00092_add_overtime_regime_to_employment_contracts
-- Tarefa TB-01: Adiciona overtime_regime em employment_contracts para definir a regra de compensação de horas de cada colaborador

ALTER TABLE public.employment_contracts 
ADD COLUMN IF NOT EXISTS overtime_regime TEXT NOT NULL DEFAULT 'TIME_BANK' 
CHECK (overtime_regime IN ('TIME_BANK', 'OVERTIME_PAYROLL', 'HYBRID'));

COMMENT ON COLUMN public.employment_contracts.overtime_regime IS 
'Regime de compensação de jornada do contrato de trabalho: TIME_BANK (Banco de Horas - CLT Art. 59 § 2º/§ 5º), OVERTIME_PAYROLL (Horas Extras em Folha de Pagamento - 100% Remuneradas) ou HYBRID (Regime Híbrido - 50% Banco / 100% Dinheiro).';

NOTIFY pgrst, 'reload schema';
