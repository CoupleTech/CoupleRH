-- Migration: 00013_auto_provision_tenant
-- Description: Trigger para criar automaticamente um Tenant (Workspace) quando um novo usuário se cadastrar no Supabase, e associá-lo como system_admin. Também processa retroativamente usuários já existentes que estejam sem tenant.

-- 1. Cria a função que será chamada pelo Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
DECLARE
  new_tenant_id UUID;
BEGIN
  -- Cria um novo tenant para o usuário (usando o email como base de nome provisório)
  INSERT INTO public.tenants (name)
  VALUES ('Workspace de ' || COALESCE(new.email, 'Usuário'))
  RETURNING id INTO new_tenant_id;

  -- Associa o usuário ao novo tenant com o cargo de system_admin
  INSERT INTO public.tenant_users (tenant_id, user_id, role)
  VALUES (new_tenant_id, new.id, 'system_admin');

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Associa a função ao Trigger da tabela auth.users (do Supabase)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Bloco para processar retroativamente os usuários órfãos (como o seu usuário atual que já foi criado)
DO $$
DECLARE
  orphan_user RECORD;
  new_tenant_id UUID;
BEGIN
  FOR orphan_user IN 
    SELECT u.id, u.email 
    FROM auth.users u 
    LEFT JOIN public.tenant_users tu ON u.id = tu.user_id 
    WHERE tu.id IS NULL
  LOOP
    -- Cria um tenant
    INSERT INTO public.tenants (name)
    VALUES ('Workspace de ' || COALESCE(orphan_user.email, 'Usuário'))
    RETURNING id INTO new_tenant_id;

    -- Associa
    INSERT INTO public.tenant_users (tenant_id, user_id, role)
    VALUES (new_tenant_id, orphan_user.id, 'system_admin');
  END LOOP;
END;
$$;
