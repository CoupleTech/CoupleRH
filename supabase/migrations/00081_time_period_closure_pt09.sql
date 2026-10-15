-- ==============================================================================
-- Migration: 00081_time_period_closure_pt09.sql
-- Descrição: Fase P5 / Tarefa PT-09 — Fechamento Automático de Ponto Eletrônico
--            com Geração de Eventos Variáveis na Folha e Rastreabilidade.
-- ==============================================================================

-- 1. TABELA DE FECHAMENTO DO PERÍODO DE PONTO (time_period_closures)
CREATE TABLE IF NOT EXISTS public.time_period_closures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    payroll_period_id UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
    
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'CLOSED' CHECK (status IN ('OPEN', 'PROCESSING', 'CLOSED', 'REOPENED')),
    
    total_contracts INTEGER NOT NULL DEFAULT 0,
    total_events_generated INTEGER NOT NULL DEFAULT 0,
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    closed_by UUID,
    closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reopened_by UUID,
    reopened_at TIMESTAMPTZ,
    reopen_reason TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id, payroll_period_id, company_id)
);

-- 2. EXTENSÃO DA TABELA payroll_variable_events COM ORIGEM E RASTREIO
ALTER TABLE public.payroll_variable_events
    ADD COLUMN IF NOT EXISTS quantity NUMERIC(10, 4) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'MANUAL' CHECK (origin IN ('MANUAL', 'TIME_TRACKING', 'IMPORT', 'SYSTEM')),
    ADD COLUMN IF NOT EXISTS time_period_closure_id UUID REFERENCES public.time_period_closures(id) ON DELETE CASCADE;

-- 3. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_time_period_closures_period
    ON public.time_period_closures(payroll_period_id, status);

CREATE INDEX IF NOT EXISTS idx_payroll_variable_events_closure
    ON public.payroll_variable_events(time_period_closure_id);

CREATE INDEX IF NOT EXISTS idx_payroll_variable_events_origin
    ON public.payroll_variable_events(period_id, origin);

-- 4. RLS (ROW LEVEL SECURITY)
ALTER TABLE public.time_period_closures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant multitenant access for time_period_closures" ON public.time_period_closures;
CREATE POLICY "Tenant multitenant access for time_period_closures"
    ON public.time_period_closures
    FOR ALL
    USING (tenant_id = ANY (public.user_tenant_ids()));

-- 5. GATILHO DE AUDITORIA (T29)
DROP TRIGGER IF EXISTS audit_time_period_closures_trigger ON public.time_period_closures;
CREATE TRIGGER audit_time_period_closures_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.time_period_closures
    FOR EACH ROW
    EXECUTE FUNCTION audit.audit_trigger_func();
