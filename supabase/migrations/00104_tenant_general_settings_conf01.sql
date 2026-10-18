-- ==============================================================================
-- Migration: 00104_tenant_general_settings_conf01.sql
-- Descrição: Criação da tabela tenant_settings para persistência de parâmetros
--            gerais do tenant (timezone, timesheet_cutoff_day, esocial_environment)
--            com RLS multitenant estrito, auditoria forense e seed automático.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    timesheet_cutoff_day INTEGER NOT NULL DEFAULT 25 CHECK (timesheet_cutoff_day BETWEEN 1 AND 31),
    esocial_environment TEXT NOT NULL DEFAULT 'producao' CHECK (esocial_environment IN ('producao', 'restrita')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id)
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant_id ON public.tenant_settings(tenant_id);

-- Habilitação do Row Level Security (RLS)
ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

-- Política de Leitura: Usuários pertencentes ao tenant
DROP POLICY IF EXISTS "tenant_settings_select_policy" ON public.tenant_settings;
CREATE POLICY "tenant_settings_select_policy" ON public.tenant_settings
    FOR SELECT
    USING (tenant_id = ANY(public.user_tenant_ids()));

-- Política de Inserção: Apenas administradores do tenant (system_admin, tenant_admin, dp_analyst)
DROP POLICY IF EXISTS "tenant_settings_insert_policy" ON public.tenant_settings;
CREATE POLICY "tenant_settings_insert_policy" ON public.tenant_settings
    FOR INSERT
    WITH CHECK (
        tenant_id = ANY(public.user_tenant_ids())
        AND EXISTS (
            SELECT 1 FROM public.tenant_users
            WHERE user_id = auth.uid()
            AND tenant_id = tenant_settings.tenant_id
            AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        )
    );

-- Política de Atualização: Apenas administradores do tenant (system_admin, tenant_admin, dp_analyst)
DROP POLICY IF EXISTS "tenant_settings_update_policy" ON public.tenant_settings;
CREATE POLICY "tenant_settings_update_policy" ON public.tenant_settings
    FOR UPDATE
    USING (
        tenant_id = ANY(public.user_tenant_ids())
        AND EXISTS (
            SELECT 1 FROM public.tenant_users
            WHERE user_id = auth.uid()
            AND tenant_id = tenant_settings.tenant_id
            AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        )
    );

-- Trigger de Auditoria Forense T29 (imutabilidade de logs e trilha)
DROP TRIGGER IF EXISTS audit_tenant_settings_trigger ON public.tenant_settings;
CREATE TRIGGER audit_tenant_settings_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.tenant_settings
    FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- Seed / Backfill: Garante que os tenants já existentes possuam registro default de configurações
INSERT INTO public.tenant_settings (tenant_id, timezone, timesheet_cutoff_day, esocial_environment)
SELECT id, 'America/Sao_Paulo', 25, 'producao'
FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;
