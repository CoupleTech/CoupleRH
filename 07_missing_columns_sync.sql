-- ============================================================================
-- SCRIPT: 07_missing_columns_sync.sql
-- DESCRIÇÃO: Sincroniza o banco de dados com as interfaces do Frontend (TS).
--            Adiciona colunas ausentes sem afetar dados existentes.
-- ============================================================================

-- 1. employment_contracts
ALTER TABLE public.employment_contracts
ADD COLUMN IF NOT EXISTS contract_type TEXT,
ADD COLUMN IF NOT EXISTS workload_hours NUMERIC;

-- 2. payroll_rubrics
ALTER TABLE public.payroll_rubrics
ADD COLUMN IF NOT EXISTS calculation_form TEXT,
ADD COLUMN IF NOT EXISTS type TEXT;

-- 3. work_schedules
ALTER TABLE public.work_schedules
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';

-- 4. payroll_periods
ALTER TABLE public.payroll_periods
ADD COLUMN IF NOT EXISTS month INTEGER,
ADD COLUMN IF NOT EXISTS year INTEGER,
ADD COLUMN IF NOT EXISTS type TEXT,
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS parent_period_id UUID REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS complement_reason TEXT;

-- 5. employment_contract_history
ALTER TABLE public.employment_contract_history
ADD COLUMN IF NOT EXISTS employment_contract_id UUID REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS event_type TEXT,
ADD COLUMN IF NOT EXISTS old_value JSONB,
ADD COLUMN IF NOT EXISTS new_value JSONB,
ADD COLUMN IF NOT EXISTS event_date DATE;

-- 6. payroll_memory_calc
ALTER TABLE public.payroll_memory_calc
ADD COLUMN IF NOT EXISTS logs JSONB;

-- ============================================================================
-- ATUALIZAÇÃO DO CACHE DA API (PostgREST)
-- ============================================================================
NOTIFY pgrst, 'reload schema';
