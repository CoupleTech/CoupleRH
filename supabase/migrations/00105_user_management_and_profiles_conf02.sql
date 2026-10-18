-- Migration: 00105_user_management_and_profiles_conf02
-- Description: Governança completa de usuários e acessos (CONF-02), listagem enriquecida, status ativo/inativo, vinculação com worker_id e RPC de atualização.

-- 1. Adicionar status is_active em tenant_users
ALTER TABLE public.tenant_users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_active ON public.tenant_users(tenant_id, is_active);

-- 2. Garantir sincronização de perfis existentes em user_profiles a partir de auth.users
INSERT INTO public.user_profiles (id, email, full_name)
SELECT 
    u.id, 
    u.email, 
    COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
FROM auth.users u
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.user_profiles.full_name, EXCLUDED.full_name);

-- 3. Função/RPC segura para listagem completa de usuários do tenant com perfis, e-mails reais e trabalhadores vinculados
CREATE OR REPLACE FUNCTION public.list_tenant_users_with_profiles()
RETURNS TABLE (
    tenant_user_id UUID,
    user_id UUID,
    tenant_id UUID,
    role TEXT,
    role_id UUID,
    role_name TEXT,
    worker_id UUID,
    worker_name TEXT,
    worker_cpf TEXT,
    full_name TEXT,
    email TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_has_access BOOLEAN;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Acesso não autorizado: usuário não autenticado.' USING ERRCODE = '42501';
    END IF;

    -- Validação de permissão: o usuário deve pertencer a ao menos um tenant com perfil administrativo ou analista
    SELECT EXISTS (
        SELECT 1 FROM public.tenant_users tu
        WHERE tu.user_id = v_caller_id
        AND tu.role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        AND tu.is_active = TRUE
    ) INTO v_has_access;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Acesso negado: permissão de gestão de usuários necessária.' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT 
        tu.id AS tenant_user_id,
        tu.user_id,
        tu.tenant_id,
        tu.role,
        tu.role_id,
        COALESCE(r.name, tu.role) AS role_name,
        tu.worker_id,
        w_p.full_name AS worker_name,
        w_p.cpf AS worker_cpf,
        COALESCE(up.full_name, w_p.full_name, u.raw_user_meta_data->>'full_name', 'Usuário Registrado')::TEXT AS full_name,
        COALESCE(up.email, u.email, 'email_nao_disponivel')::TEXT AS email,
        tu.is_active,
        tu.created_at
    FROM public.tenant_users tu
    LEFT JOIN auth.users u ON u.id = tu.user_id
    LEFT JOIN public.user_profiles up ON up.id = tu.user_id
    LEFT JOIN public.roles r ON r.id = tu.role_id
    LEFT JOIN public.workers w ON w.id = tu.worker_id
    LEFT JOIN public.people w_p ON w_p.id = w.person_id
    WHERE tu.tenant_id = ANY(public.user_tenant_ids())
    ORDER BY tu.created_at DESC;
END;
$$;

-- 4. RPC segura para atualização de dados de acesso do usuário no tenant
CREATE OR REPLACE FUNCTION public.update_tenant_user_access(
    p_tenant_user_id UUID,
    p_role TEXT,
    p_role_id UUID DEFAULT NULL,
    p_worker_id UUID DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_tenant_id UUID;
    v_effective_role_id UUID := p_role_id;
    v_has_access BOOLEAN;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Acesso não autorizado: usuário não autenticado.' USING ERRCODE = '42501';
    END IF;

    -- Localizar o tenant_user a ser editado
    SELECT tenant_id INTO v_tenant_id
    FROM public.tenant_users
    WHERE id = p_tenant_user_id;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Usuário do tenant não encontrado.' USING ERRCODE = 'P0002';
    END IF;

    -- Validar que o executor tem privilégio no mesmo tenant
    SELECT EXISTS (
        SELECT 1 FROM public.tenant_users tu
        WHERE tu.user_id = v_caller_id
        AND tu.tenant_id = v_tenant_id
        AND tu.role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        AND tu.is_active = TRUE
    ) INTO v_has_access;

    IF NOT v_has_access THEN
        RAISE EXCEPTION 'Acesso negado: você não possui permissão para gerenciar usuários neste tenant.' USING ERRCODE = '42501';
    END IF;

    -- Validação do enum de role
    IF p_role NOT IN ('system_admin', 'tenant_admin', 'dp_analyst', 'manager', 'accountant', 'auditor', 'employee', 'sst_specialist') THEN
        RAISE EXCEPTION 'Papel de usuário inválido: %', p_role USING ERRCODE = '22023';
    END IF;

    -- Se role_id não for informado, tentar inferir do perfil de sistema correspondente
    IF v_effective_role_id IS NULL THEN
        SELECT id INTO v_effective_role_id
        FROM public.roles
        WHERE (tenant_id IS NULL OR tenant_id = v_tenant_id)
        AND (
            (p_role = 'system_admin' AND name ILIKE '%Administrador%') OR
            (p_role = 'dp_analyst' AND name ILIKE '%Analista de DP%') OR
            (p_role = 'sst_specialist' AND name ILIKE '%SST%') OR
            (p_role = 'manager' AND name ILIKE '%Gestor%') OR
            (p_role = 'accountant' AND name ILIKE '%Contador%') OR
            (p_role = 'auditor' AND name ILIKE '%Auditor%') OR
            (p_role = 'employee' AND name ILIKE '%Colaborador%')
        )
        LIMIT 1;
    END IF;

    -- Validação de worker_id se fornecido: deve pertencer ao mesmo tenant
    IF p_worker_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.workers WHERE id = p_worker_id AND tenant_id = v_tenant_id) THEN
            RAISE EXCEPTION 'Colaborador selecionado não pertence a esta empresa/tenant.' USING ERRCODE = '23503';
        END IF;
    END IF;

    -- Atualização atômica
    UPDATE public.tenant_users
    SET 
        role = p_role,
        role_id = v_effective_role_id,
        worker_id = p_worker_id,
        is_active = COALESCE(p_is_active, TRUE)
    WHERE id = p_tenant_user_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'tenant_user_id', p_tenant_user_id,
        'role', p_role,
        'role_id', v_effective_role_id,
        'worker_id', p_worker_id,
        'is_active', COALESCE(p_is_active, TRUE)
    );
END;
$$;

-- 5. Conceder permissão de execução aos usuários autenticados
GRANT EXECUTE ON FUNCTION public.list_tenant_users_with_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_tenant_user_access(UUID, TEXT, UUID, UUID, BOOLEAN) TO authenticated;
