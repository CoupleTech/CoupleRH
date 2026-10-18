-- ==============================================================================
-- Migration: 00109_operational_alerts_and_observability_p9.sql
-- Descrição: Tabela de Alertas Operacionais e Observabilidade do Sistema (Fase P9)
-- Sub-sistemas: Falhas de Folha de Pagamento, Falhas de Ingestão de Ponto, Segurança
-- RLS habilitada por tenant + Políticas canônicas + Gatilho de Auditoria T29
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.system_operational_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    subsystem VARCHAR(50) NOT NULL CHECK (subsystem IN ('PAYROLL', 'TIME_TRACKING', 'SECURITY', 'DOCUMENT_SIGNING', 'GENERAL')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'ERROR', 'CRITICAL')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    error_code VARCHAR(100),
    metadata JSONB DEFAULT '{}'::jsonb,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Índices para buscas rápidas e relatórios
CREATE INDEX IF NOT EXISTS idx_operational_alerts_tenant_unresolved 
ON public.system_operational_alerts (tenant_id, resolved, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operational_alerts_subsystem 
ON public.system_operational_alerts (tenant_id, subsystem, severity);

-- Habilitar RLS
ALTER TABLE public.system_operational_alerts ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS Canônicas utilizando public.user_tenant_ids()
-- 1. Leitura: Usuários pertencentes ao tenant
DROP POLICY IF EXISTS "Usuários autorizados do tenant podem visualizar alertas operacionais" ON public.system_operational_alerts;
CREATE POLICY "Usuários autorizados do tenant podem visualizar alertas operacionais"
ON public.system_operational_alerts
FOR SELECT
TO authenticated
USING (
    tenant_id = ANY(public.user_tenant_ids())
);

-- 2. Inserção: Aplicação autenticada pode registrar alertas para o seu tenant
DROP POLICY IF EXISTS "Usuários autenticados podem inserir alertas em seu tenant" ON public.system_operational_alerts;
CREATE POLICY "Usuários autenticados podem inserir alertas em seu tenant"
ON public.system_operational_alerts
FOR INSERT
TO authenticated
WITH CHECK (
    tenant_id = ANY(public.user_tenant_ids())
);

-- 3. Atualização (Resolução de alertas): Usuários autorizados do tenant podem resolver alertas
DROP POLICY IF EXISTS "Usuários autorizados podem atualizar/resolver alertas" ON public.system_operational_alerts;
CREATE POLICY "Usuários autorizados podem atualizar/resolver alertas"
ON public.system_operational_alerts
FOR UPDATE
TO authenticated
USING (
    tenant_id = ANY(public.user_tenant_ids())
)
WITH CHECK (
    tenant_id = ANY(public.user_tenant_ids())
);

-- Gatilho de Auditoria T29
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'audit' AND p.proname = 'audit_trigger_func'
    ) THEN
        DROP TRIGGER IF EXISTS audit_system_operational_alerts_trigger ON public.system_operational_alerts;
        CREATE TRIGGER audit_system_operational_alerts_trigger
            AFTER INSERT OR UPDATE OR DELETE ON public.system_operational_alerts
            FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;
