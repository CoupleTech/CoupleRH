-- ==============================================================================
-- Migration: 00110_parallel_payroll_and_golive_checklist_p9.sql
-- Descrição: Gestão de Folha Paralela (2 a 3 competências), Ata do Contador,
--            Política de Centavos e Checklist de Go-Live (Fase P9 / Doc §10)
-- RLS habilitada por tenant + Políticas canônicas + Gatilho de Auditoria T29
-- ==============================================================================

-- 1. Tabela de Execuções de Folha Paralela
CREATE TABLE IF NOT EXISTS public.parallel_payroll_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    competence VARCHAR(7) NOT NULL, -- formato 'YYYY-MM'
    legacy_system_name VARCHAR(100) NOT NULL,
    total_workers INTEGER NOT NULL DEFAULT 0,
    matching_workers INTEGER NOT NULL DEFAULT 0,
    total_rubrics_compared INTEGER NOT NULL DEFAULT 0,
    exact_matches INTEGER NOT NULL DEFAULT 0,
    acceptable_cent_diffs INTEGER NOT NULL DEFAULT 0,
    unacceptable_diffs INTEGER NOT NULL DEFAULT 0,
    rounding_policy_applied VARCHAR(50) NOT NULL DEFAULT 'HALF_UP_CENT_TOLERANCE',
    status VARCHAR(30) NOT NULL CHECK (status IN ('PENDING', 'APPROVED_BY_ACCOUNTANT', 'REJECTED')),
    accountant_approval JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Tabela de Itens Comparados na Folha Paralela (Rubrica a Rubrica)
CREATE TABLE IF NOT EXISTS public.parallel_payroll_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parallel_run_id UUID NOT NULL REFERENCES public.parallel_payroll_runs(id) ON DELETE CASCADE,
    contract_id UUID REFERENCES public.employment_contracts(id) ON DELETE SET NULL,
    worker_name VARCHAR(255) NOT NULL,
    worker_cpf VARCHAR(20) NOT NULL,
    rubric_code VARCHAR(30) NOT NULL,
    rubric_name VARCHAR(255) NOT NULL,
    legacy_amount NUMERIC(15,2) NOT NULL,
    couplerh_amount NUMERIC(15,2) NOT NULL,
    diff_amount NUMERIC(15,2) NOT NULL,
    is_acceptable_cent_diff BOOLEAN NOT NULL DEFAULT FALSE,
    justification TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Tabela do Checklist de Go-Live Assinado
CREATE TABLE IF NOT EXISTS public.golive_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    release_version VARCHAR(50) NOT NULL,
    accountant_signoff JSONB NOT NULL,
    legal_signoff JSONB NOT NULL,
    tech_lead_signoff JSONB NOT NULL,
    gate_criteria_checklist JSONB NOT NULL,
    status VARCHAR(30) NOT NULL CHECK (status IN ('DRAFT', 'FULLY_SIGNED_GO_LIVE_AUTHORIZED', 'BLOCKED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Índices operacionais
CREATE INDEX IF NOT EXISTS idx_parallel_runs_tenant_comp 
ON public.parallel_payroll_runs (tenant_id, competence, status);

CREATE INDEX IF NOT EXISTS idx_parallel_items_run 
ON public.parallel_payroll_items (parallel_run_id, is_acceptable_cent_diff);

CREATE INDEX IF NOT EXISTS idx_golive_checklists_tenant 
ON public.golive_checklists (tenant_id, release_version, status);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.parallel_payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parallel_payroll_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.golive_checklists ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS Canônicas para parallel_payroll_runs
DROP POLICY IF EXISTS "Usuários autorizados podem ler parallel_payroll_runs" ON public.parallel_payroll_runs;
CREATE POLICY "Usuários autorizados podem ler parallel_payroll_runs"
ON public.parallel_payroll_runs FOR SELECT TO authenticated
USING (tenant_id = ANY(public.user_tenant_ids()));

DROP POLICY IF EXISTS "Usuários autorizados podem inserir parallel_payroll_runs" ON public.parallel_payroll_runs;
CREATE POLICY "Usuários autorizados podem inserir parallel_payroll_runs"
ON public.parallel_payroll_runs FOR INSERT TO authenticated
WITH CHECK (tenant_id = ANY(public.user_tenant_ids()));

DROP POLICY IF EXISTS "Usuários autorizados podem atualizar parallel_payroll_runs" ON public.parallel_payroll_runs;
CREATE POLICY "Usuários autorizados podem atualizar parallel_payroll_runs"
ON public.parallel_payroll_runs FOR UPDATE TO authenticated
USING (tenant_id = ANY(public.user_tenant_ids()))
WITH CHECK (tenant_id = ANY(public.user_tenant_ids()));

-- Políticas de RLS para parallel_payroll_items
DROP POLICY IF EXISTS "Usuários autorizados podem ler parallel_payroll_items" ON public.parallel_payroll_items;
CREATE POLICY "Usuários autorizados podem ler parallel_payroll_items"
ON public.parallel_payroll_items FOR SELECT TO authenticated
USING (
    parallel_run_id IN (
        SELECT id FROM public.parallel_payroll_runs WHERE tenant_id = ANY(public.user_tenant_ids())
    )
);

DROP POLICY IF EXISTS "Usuários autorizados podem inserir parallel_payroll_items" ON public.parallel_payroll_items;
CREATE POLICY "Usuários autorizados podem inserir parallel_payroll_items"
ON public.parallel_payroll_items FOR INSERT TO authenticated
WITH CHECK (
    parallel_run_id IN (
        SELECT id FROM public.parallel_payroll_runs WHERE tenant_id = ANY(public.user_tenant_ids())
    )
);

-- Políticas de RLS para golive_checklists
DROP POLICY IF EXISTS "Usuários autorizados podem ler golive_checklists" ON public.golive_checklists;
CREATE POLICY "Usuários autorizados podem ler golive_checklists"
ON public.golive_checklists FOR SELECT TO authenticated
USING (tenant_id = ANY(public.user_tenant_ids()));

DROP POLICY IF EXISTS "Usuários autorizados podem inserir golive_checklists" ON public.golive_checklists;
CREATE POLICY "Usuários autorizados podem inserir golive_checklists"
ON public.golive_checklists FOR INSERT TO authenticated
WITH CHECK (tenant_id = ANY(public.user_tenant_ids()));

DROP POLICY IF EXISTS "Usuários autorizados podem atualizar golive_checklists" ON public.golive_checklists;
CREATE POLICY "Usuários autorizados podem atualizar golive_checklists"
ON public.golive_checklists FOR UPDATE TO authenticated
USING (tenant_id = ANY(public.user_tenant_ids()))
WITH CHECK (tenant_id = ANY(public.user_tenant_ids()));

-- Gatilhos de Auditoria T29
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'audit' AND p.proname = 'audit_trigger_func'
    ) THEN
        DROP TRIGGER IF EXISTS audit_parallel_payroll_runs_trigger ON public.parallel_payroll_runs;
        CREATE TRIGGER audit_parallel_payroll_runs_trigger
            AFTER INSERT OR UPDATE OR DELETE ON public.parallel_payroll_runs
            FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

        DROP TRIGGER IF EXISTS audit_golive_checklists_trigger ON public.golive_checklists;
        CREATE TRIGGER audit_golive_checklists_trigger
            AFTER INSERT OR UPDATE OR DELETE ON public.golive_checklists
            FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;
