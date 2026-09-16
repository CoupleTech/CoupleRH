-- Migration: 00040_expand_payroll_periods_status
-- Description: Altera a constraint de status da tabela payroll_periods para suportar o fluxo da Fase 31.

-- Primeiro, verificamos e removemos a constraint atual se existir
ALTER TABLE public.payroll_periods DROP CONSTRAINT IF EXISTS payroll_periods_status_check;

-- Em seguida, adicionamos a nova constraint suportando todos os estados da máquina
ALTER TABLE public.payroll_periods ADD CONSTRAINT payroll_periods_status_check 
    CHECK (status IN ('DRAFT', 'CALCULATED', 'CONFERENCE', 'CLOSED', 'REOPENED', 'CANCELED'));

-- Recarregar o schema para o PostgREST
NOTIFY pgrst, 'reload schema';
