-- Migration 00091: Adicionar colunas de rastreabilidade de ponto em payroll_variable_events
-- Permite diferenciar lançamentos manuais do DP de eventos integrados do ponto eletrônico (HE 50%, HE 100%, Noturno, Faltas, Atrasos)

DO $$ 
BEGIN
    -- 1. Coluna origin
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'payroll_variable_events' 
          AND column_name = 'origin'
    ) THEN
        ALTER TABLE public.payroll_variable_events 
        ADD COLUMN origin TEXT NOT NULL DEFAULT 'MANUAL';
    END IF;

    -- 2. Coluna time_period_closure_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'payroll_variable_events' 
          AND column_name = 'time_period_closure_id'
    ) THEN
        ALTER TABLE public.payroll_variable_events 
        ADD COLUMN time_period_closure_id TEXT;
    END IF;

    -- 3. Coluna description
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'payroll_variable_events' 
          AND column_name = 'description'
    ) THEN
        ALTER TABLE public.payroll_variable_events 
        ADD COLUMN description TEXT;
    END IF;
END $$;

-- Recarregar cache de schema do PostgREST
NOTIFY pgrst, 'reload schema';
