-- 18_sync_user_profiles.sql
-- Este script resolve o problema dos nomes e e-mails aparecendo como "Usuário Existente" e "E-mail Oculto".
-- Ele sincroniza os usuários que já existiam no sistema (tabela interna do Supabase auth.users) 
-- para a tabela pública (user_profiles) que a tela do sistema consegue ler.

-- 1. Inserir ou atualizar os perfis baseados no auth.users
INSERT INTO public.user_profiles (id, email, full_name)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'full_name', 'Administrador Global') as full_name
FROM auth.users
ON CONFLICT (id) DO UPDATE 
SET 
    email = EXCLUDED.email,
    full_name = COALESCE(public.user_profiles.full_name, EXCLUDED.full_name);

-- 2. Garantir que a RLS (Segurança) da tabela permite que usuários do mesmo tenant se enxerguem
DROP POLICY IF EXISTS "Users can view profiles in their tenants" ON public.user_profiles;

CREATE POLICY "Users can view profiles in their tenants" 
    ON public.user_profiles FOR SELECT 
    USING (
        id IN (
            SELECT user_id FROM public.tenant_users WHERE tenant_id = ANY(public.user_tenant_ids())
        )
        OR id = auth.uid()
    );
