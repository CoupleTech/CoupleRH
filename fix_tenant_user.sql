DO $$
DECLARE
  v_tenant_id uuid;
  v_user_id uuid := '7eb7573a-4fcf-47e8-94e7-47ede5bbfd45';
  v_role_id uuid;
BEGIN
  -- 1. Tentar encontrar o primeiro tenant que já exista
  SELECT id INTO v_tenant_id FROM public.tenants LIMIT 1;
  
  -- Se não existir nenhum tenant (banco zerado), cria um tenant padrão
  IF v_tenant_id IS NULL THEN
    v_tenant_id := gen_random_uuid();
    INSERT INTO public.tenants (id, name, created_at, updated_at)
    VALUES (v_tenant_id, 'Empresa Principal', now(), now());
  END IF;

  -- 2. Pegar a role de admin (para retrocompatibilidade com bancos onde role_id existe)
  BEGIN
    SELECT id INTO v_role_id FROM public.roles WHERE is_system_role = true LIMIT 1;
  EXCEPTION WHEN undefined_table THEN
    v_role_id := NULL;
  END;

  -- 3. Inserir o vínculo do usuário (com a coluna "role" antiga que ainda é obrigatória)
  BEGIN
    INSERT INTO public.tenant_users (tenant_id, user_id, role, role_id)
    VALUES (v_tenant_id, v_user_id, 'system_admin', v_role_id);
  EXCEPTION WHEN undefined_column THEN
    -- Se por acaso role_id não existir na tabela
    INSERT INTO public.tenant_users (tenant_id, user_id, role)
    VALUES (v_tenant_id, v_user_id, 'system_admin');
  WHEN unique_violation THEN
    -- Se já existir a relação, atualizamos a role
    UPDATE public.tenant_users 
    SET role = 'system_admin', role_id = v_role_id
    WHERE user_id = v_user_id;
  END;

END $$;
