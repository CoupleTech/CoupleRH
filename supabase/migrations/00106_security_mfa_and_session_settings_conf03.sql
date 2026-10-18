-- ==============================================================================
-- Migration: 00106_security_mfa_and_session_settings_conf03.sql
-- Descrição: Governança de segurança corporativa, MFA (TOTP), controle de timeout
--            de sessão e exigência de segundo fator por papel (CONF-03).
-- ==============================================================================

-- 1. Estender tenant_settings com políticas de segurança e MFA
ALTER TABLE public.tenant_settings 
ADD COLUMN IF NOT EXISTS session_timeout_minutes INTEGER NOT NULL DEFAULT 60 
    CHECK (session_timeout_minutes IN (15, 30, 60, 120, 240, 480)),
ADD COLUMN IF NOT EXISTS require_mfa_roles TEXT[] NOT NULL DEFAULT ARRAY['system_admin', 'tenant_admin', 'dp_analyst']::TEXT[],
ADD COLUMN IF NOT EXISTS max_login_attempts INTEGER NOT NULL DEFAULT 5 
    CHECK (max_login_attempts BETWEEN 3 AND 10);

-- 2. Atualizar registros existentes com os valores padrão seguros caso nulos
UPDATE public.tenant_settings
SET 
    session_timeout_minutes = COALESCE(session_timeout_minutes, 60),
    require_mfa_roles = COALESCE(require_mfa_roles, ARRAY['system_admin', 'tenant_admin', 'dp_analyst']::TEXT[]),
    max_login_attempts = COALESCE(max_login_attempts, 5)
WHERE session_timeout_minutes IS NULL OR require_mfa_roles IS NULL OR max_login_attempts IS NULL;

-- 3. RPC protegida para atualização de políticas de segurança do tenant
CREATE OR REPLACE FUNCTION public.update_tenant_security_settings(
    p_session_timeout INTEGER,
    p_require_mfa_roles TEXT[],
    p_max_login_attempts INTEGER
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

    -- Localizar o tenant_id ativo do chamador
    SELECT tenant_id INTO v_tenant_id
    FROM public.tenant_users
    WHERE user_id = v_caller_id
    LIMIT 1;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant não encontrado para o usuário atual.' USING ERRCODE = 'P0002';
    END IF;

    -- Validar que o usuário é administrador
    SELECT EXISTS (
        SELECT 1 FROM public.tenant_users tu
        WHERE tu.user_id = v_caller_id
        AND tu.tenant_id = v_tenant_id
        AND tu.role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        AND tu.is_active = TRUE
    ) INTO v_has_access;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Acesso negado: apenas administradores podem alterar políticas de segurança.' USING ERRCODE = '42501';
    END IF;

    -- Validação de limites
    IF p_session_timeout NOT IN (15, 30, 60, 120, 240, 480) THEN
        RAISE EXCEPTION 'Tempo de sessão inválido: % minutos.', p_session_timeout USING ERRCODE = '22023';
    END IF;

    IF p_max_login_attempts NOT BETWEEN 3 AND 10 THEN
        RAISE EXCEPTION 'Limite de tentativas de login deve estar entre 3 e 10.' USING ERRCODE = '22023';
    END IF;

    -- Upsert atômico em tenant_settings
    INSERT INTO public.tenant_settings (
        tenant_id, 
        session_timeout_minutes, 
        require_mfa_roles, 
        max_login_attempts,
        updated_at
    )
    VALUES (
        v_tenant_id, 
        p_session_timeout, 
        p_require_mfa_roles, 
        p_max_login_attempts,
        NOW()
    )
    ON CONFLICT (tenant_id) DO UPDATE SET
        session_timeout_minutes = EXCLUDED.session_timeout_minutes,
        require_mfa_roles = EXCLUDED.require_mfa_roles,
        max_login_attempts = EXCLUDED.max_login_attempts,
        updated_at = NOW();

    RETURN jsonb_build_object(
        'success', TRUE,
        'tenant_id', v_tenant_id,
        'session_timeout_minutes', p_session_timeout,
        'require_mfa_roles', p_require_mfa_roles,
        'max_login_attempts', p_max_login_attempts
    );
END;
$$;

-- 4. Conceder permissão de execução aos autenticados
GRANT EXECUTE ON FUNCTION public.update_tenant_security_settings(INTEGER, TEXT[], INTEGER) TO authenticated;
