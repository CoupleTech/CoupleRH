-- ==============================================================================
-- Migration: 00080_timesheet_and_contest_pt08.sql
-- Descrição: Fase P5 / Tarefa PT-08 — Espelho de Ponto Eletrônico (Portaria MTP 671/2021)
--            e Fluxo de Contestação com Auditoria e RLS.
-- ==============================================================================

-- 1. ESTENDER A TABELA timesheets COM TOTALIZADORES LEGAIS E CAMPOS DE CONTESTAÇÃO
ALTER TABLE public.timesheets
    ADD COLUMN IF NOT EXISTS total_overtime_50_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_overtime_100_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_delay_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_absence_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_intrajornada_violation_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS time_bank_balance_minutes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS document_hash TEXT,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS contested_at TIMESTAMPTZ;

-- 2. ATUALIZAR STATUS DE timesheets PARA INCLUIR CONTESTED
ALTER TABLE public.timesheets
    DROP CONSTRAINT IF EXISTS timesheets_status_check;

ALTER TABLE public.timesheets
    ADD CONSTRAINT timesheets_status_check
    CHECK (status IN ('DRAFT', 'PENDING_SIGNATURE', 'SIGNED', 'CONTESTED', 'CLOSED'));

-- 3. CRIAR TABELA DE CONTESTAÇÕES DO ESPELHO DE PONTO (timesheet_contests)
CREATE TABLE IF NOT EXISTS public.timesheet_contests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    timesheet_id UUID NOT NULL REFERENCES public.timesheets(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    worker_id UUID REFERENCES public.workers(id) ON DELETE SET NULL,
    
    reason TEXT NOT NULL,
    affected_dates DATE[] NOT NULL DEFAULT '{}',
    attachment_url TEXT,
    
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'UNDER_REVIEW', 'RESOLVED_ACCEPTED', 'REJECTED')),
    reviewed_by UUID,
    review_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_timesheet_contests_timesheet
    ON public.timesheet_contests(timesheet_id);

CREATE INDEX IF NOT EXISTS idx_timesheet_contests_contract
    ON public.timesheet_contests(contract_id);

CREATE INDEX IF NOT EXISTS idx_timesheet_contests_status
    ON public.timesheet_contests(status)
    WHERE status = 'PENDING';

-- 5. RLS (ROW LEVEL SECURITY)
ALTER TABLE public.timesheet_contests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant multitenant access for timesheet_contests" ON public.timesheet_contests;
CREATE POLICY "Tenant multitenant access for timesheet_contests"
    ON public.timesheet_contests
    FOR ALL
    USING (tenant_id = ANY (public.user_tenant_ids()));

-- Permitir que o próprio colaborador crie e consulte suas contestações
DROP POLICY IF EXISTS "Workers can read and create their own timesheet contests" ON public.timesheet_contests;
CREATE POLICY "Workers can read and create their own timesheet contests"
    ON public.timesheet_contests
    FOR ALL
    USING (
        worker_id IN (
            SELECT id FROM public.workers WHERE user_id = auth.uid()
        )
    );

-- 6. GATILHO DE AUDITORIA (T29)
DROP TRIGGER IF EXISTS audit_timesheet_contests_trigger ON public.timesheet_contests;
CREATE TRIGGER audit_timesheet_contests_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.timesheet_contests
    FOR EACH ROW
    EXECUTE FUNCTION audit.audit_trigger_func();
