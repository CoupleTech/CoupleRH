-- ==============================================================================
-- Migration: 00108_tenant_certificates_esocial_conf05.sql
-- Descrição: Gestão e governança de Certificados Digitais ICP-Brasil (A1 .pfx)
--            para transmissão eSocial com monitor de vigência, isolamento RLS,
--            auditoria forense T29 e RPCs protegidas de revogação/instalação (CONF-05).
-- ==============================================================================

-- 1. Criação da tabela de certificados digitais do tenant
CREATE TABLE IF NOT EXISTS public.tenant_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    filename TEXT NOT NULL,
    subject_name TEXT NOT NULL,
    cnpj TEXT NOT NULL,
    issuer TEXT NOT NULL,
    serial_number TEXT NOT NULL,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_to TIMESTAMPTZ NOT NULL,
    storage_path TEXT NULL,
    fingerprint_sha256 TEXT NULL,
    environment TEXT NOT NULL DEFAULT 'producao' CHECK (environment IN ('producao', 'restrita')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    revoked_at TIMESTAMPTZ NULL,
    revocation_reason TEXT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_tenant_certificates_tenant_env_active 
    ON public.tenant_certificates(tenant_id, environment, is_active);
CREATE INDEX IF NOT EXISTS idx_tenant_certificates_cnpj 
    ON public.tenant_certificates(cnpj);
CREATE INDEX IF NOT EXISTS idx_tenant_certificates_valid_to 
    ON public.tenant_certificates(valid_to);

-- 3. Habilitação de Row Level Security (RLS)
ALTER TABLE public.tenant_certificates ENABLE ROW LEVEL SECURITY;

-- Política de Leitura: Usuários do tenant
DROP POLICY IF EXISTS "tenant_certificates_select_policy" ON public.tenant_certificates;
CREATE POLICY "tenant_certificates_select_policy" ON public.tenant_certificates
    FOR SELECT
    USING (tenant_id = ANY(public.user_tenant_ids()));

-- Política de Inserção: Apenas administradores do tenant (system_admin, tenant_admin, dp_analyst)
DROP POLICY IF EXISTS "tenant_certificates_insert_policy" ON public.tenant_certificates;
CREATE POLICY "tenant_certificates_insert_policy" ON public.tenant_certificates
    FOR INSERT
    WITH CHECK (
        tenant_id = ANY(public.user_tenant_ids())
        AND EXISTS (
            SELECT 1 FROM public.tenant_users
            WHERE user_id = auth.uid()
            AND tenant_id = tenant_certificates.tenant_id
            AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')
            AND is_active = TRUE
        )
    );

-- Política de Atualização: Apenas administradores do tenant
DROP POLICY IF EXISTS "tenant_certificates_update_policy" ON public.tenant_certificates;
CREATE POLICY "tenant_certificates_update_policy" ON public.tenant_certificates
    FOR UPDATE
    USING (
        tenant_id = ANY(public.user_tenant_ids())
        AND EXISTS (
            SELECT 1 FROM public.tenant_users
            WHERE user_id = auth.uid()
            AND tenant_id = tenant_certificates.tenant_id
            AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')
            AND is_active = TRUE
        )
    );

-- 4. Trigger de Auditoria Forense T29
DROP TRIGGER IF EXISTS audit_tenant_certificates_trigger ON public.tenant_certificates;
CREATE TRIGGER audit_tenant_certificates_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.tenant_certificates
FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

-- 5. RPC Segura: Salvar/Instalar Certificado A1 do Tenant
CREATE OR REPLACE FUNCTION public.save_tenant_certificate(
    p_filename TEXT,
    p_subject_name TEXT,
    p_cnpj TEXT,
    p_issuer TEXT,
    p_serial_number TEXT,
    p_valid_from TIMESTAMPTZ,
    p_valid_to TIMESTAMPTZ,
    p_environment TEXT DEFAULT 'producao',
    p_storage_path TEXT DEFAULT NULL,
    p_fingerprint_sha256 TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_tenant_id UUID;
    v_company_id UUID;
    v_has_access BOOLEAN;
    v_new_cert_id UUID;
    v_clean_cnpj TEXT;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Acesso não autorizado: usuário não autenticado.' USING ERRCODE = '42501';
    END IF;

    -- Localizar o tenant_id ativo do chamador
    SELECT tenant_id INTO v_tenant_id
    FROM public.tenant_users
    WHERE user_id = v_caller_id
    LIMIT 1;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant não encontrado para o usuário atual.' USING ERRCODE = 'P0002';
    END IF;

    -- Validar privilégios administrativos
    SELECT EXISTS (
        SELECT 1 FROM public.tenant_users tu
        WHERE tu.user_id = v_caller_id
        AND tu.tenant_id = v_tenant_id
        AND tu.role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        AND tu.is_active = TRUE
    ) INTO v_has_access;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores podem instalar certificados digitais.' USING ERRCODE = '42501';
    END IF;

    -- Limpeza e validação de campos
    v_clean_cnpj := REGEXP_REPLACE(p_cnpj, '[^0-9]', '', 'g');
    IF LENGTH(v_clean_cnpj) NOT IN (11, 14) THEN
        RAISE EXCEPTION 'CNPJ/CPF do certificado inválido: %', p_cnpj USING ERRCODE = '22023';
    END IF;

    IF p_valid_to <= p_valid_from THEN
        RAISE EXCEPTION 'Data de expiração do certificado deve ser posterior à data de emissão.' USING ERRCODE = '22023';
    END IF;

    IF p_environment NOT IN ('producao', 'restrita') THEN
        RAISE EXCEPTION 'Ambiente inválido: %. Permitidos: producao, restrita.', p_environment USING ERRCODE = '22023';
    END IF;

    -- Localizar company_id correspondente ao CNPJ se existir
    SELECT id INTO v_company_id
    FROM public.companies
    WHERE tenant_id = v_tenant_id
    AND REGEXP_REPLACE(cnpj, '[^0-9]', '', 'g') = v_clean_cnpj
    LIMIT 1;

    -- Desativar certificados anteriores ativos para o mesmo ambiente
    UPDATE public.tenant_certificates
    SET 
        is_active = FALSE,
        updated_at = NOW()
    WHERE tenant_id = v_tenant_id
    AND environment = p_environment
    AND is_active = TRUE;

    -- Inserir o novo certificado com status ativo
    INSERT INTO public.tenant_certificates (
        tenant_id,
        company_id,
        filename,
        subject_name,
        cnpj,
        issuer,
        serial_number,
        valid_from,
        valid_to,
        storage_path,
        fingerprint_sha256,
        environment,
        is_active,
        created_by,
        created_at,
        updated_at
    )
    VALUES (
        v_tenant_id,
        v_company_id,
        TRIM(p_filename),
        TRIM(p_subject_name),
        v_clean_cnpj,
        TRIM(p_issuer),
        TRIM(p_serial_number),
        p_valid_from,
        p_valid_to,
        p_storage_path,
        p_fingerprint_sha256,
        p_environment,
        TRUE,
        v_caller_id,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_new_cert_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'id', v_new_cert_id,
        'tenant_id', v_tenant_id,
        'subject_name', p_subject_name,
        'cnpj', v_clean_cnpj,
        'issuer', p_issuer,
        'serial_number', p_serial_number,
        'valid_from', p_valid_from,
        'valid_to', p_valid_to,
        'environment', p_environment,
        'is_active', TRUE
    );
END;
$$;

-- 6. RPC Segura: Obter Certificado Ativo com Diagnóstico de Vigência
CREATE OR REPLACE FUNCTION public.get_tenant_active_certificate(
    p_environment TEXT DEFAULT 'producao'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_tenant_id UUID;
    v_cert RECORD;
    v_days_remaining NUMERIC;
    v_status TEXT;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Acesso não autorizado: usuário não autenticado.' USING ERRCODE = '42501';
    END IF;

    SELECT tenant_id INTO v_tenant_id
    FROM public.tenant_users
    WHERE user_id = v_caller_id
    LIMIT 1;

    IF v_tenant_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT * INTO v_cert
    FROM public.tenant_certificates
    WHERE tenant_id = v_tenant_id
    AND environment = p_environment
    AND is_active = TRUE
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_cert IS NULL THEN
        RETURN NULL;
    END IF;

    -- Cálculo dos dias restantes
    v_days_remaining := ROUND(EXTRACT(EPOCH FROM (v_cert.valid_to - NOW())) / 86400.0, 1);

    IF v_days_remaining < 0 THEN
        v_status := 'EXPIRED';
    ELSIF v_days_remaining <= 30 THEN
        v_status := 'EXPIRING_SOON';
    ELSE
        v_status := 'VALID';
    END IF;

    RETURN jsonb_build_object(
        'id', v_cert.id,
        'tenant_id', v_cert.tenant_id,
        'company_id', v_cert.company_id,
        'filename', v_cert.filename,
        'subject_name', v_cert.subject_name,
        'cnpj', v_cert.cnpj,
        'issuer', v_cert.issuer,
        'serial_number', v_cert.serial_number,
        'valid_from', v_cert.valid_from,
        'valid_to', v_cert.valid_to,
        'environment', v_cert.environment,
        'is_active', v_cert.is_active,
        'days_remaining', v_days_remaining,
        'status', v_status,
        'created_at', v_cert.created_at
    );
END;
$$;

-- 7. RPC Segura: Revogar/Desativar Certificado Digital
CREATE OR REPLACE FUNCTION public.revoke_tenant_certificate(
    p_certificate_id UUID,
    p_reason TEXT DEFAULT 'Revogado manualmente pelo administrador'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_tenant_id UUID;
    v_has_access BOOLEAN;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Acesso não autorizado: usuário não autenticado.' USING ERRCODE = '42501';
    END IF;

    SELECT tenant_id INTO v_tenant_id
    FROM public.tenant_users
    WHERE user_id = v_caller_id
    LIMIT 1;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant não encontrado para o usuário atual.' USING ERRCODE = 'P0002';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.tenant_users tu
        WHERE tu.user_id = v_caller_id
        AND tu.tenant_id = v_tenant_id
        AND tu.role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        AND tu.is_active = TRUE
    ) INTO v_has_access;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores podem revogar certificados digitais.' USING ERRCODE = '42501';
    END IF;

    UPDATE public.tenant_certificates
    SET 
        is_active = FALSE,
        revoked_at = NOW(),
        revocation_reason = TRIM(p_reason),
        updated_at = NOW()
    WHERE id = p_certificate_id
    AND tenant_id = v_tenant_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'certificate_id', p_certificate_id,
        'revoked_at', NOW(),
        'reason', p_reason
    );
END;
$$;

-- 8. Conceder permissões de execução aos autenticados
GRANT EXECUTE ON FUNCTION public.save_tenant_certificate(TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_active_certificate(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_tenant_certificate(UUID, TEXT) TO authenticated;
