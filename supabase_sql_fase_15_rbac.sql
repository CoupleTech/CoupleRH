-- Migration: 00044_user_profiles_and_dynamic_rbac
-- Description: Criação de perfis dinâmicos (RBAC), tabela de usuários e vinculação com auth.users

-- 1. User Profiles
-- Armazena dados públicos dos usuários já que não podemos consultar auth.users no frontend diretamente
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ativar RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver perfis de quem está no mesmo tenant
CREATE POLICY "Users can view profiles in their tenants" 
    ON public.user_profiles FOR SELECT 
    USING (
        id IN (
            SELECT user_id FROM public.tenant_users WHERE tenant_id = ANY(public.user_tenant_ids())
        )
        OR id = auth.uid()
    );

-- Trigger para sincronizar auth.users -> public.user_profiles
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name)
    VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Garantir que o trigger não duplique se executado novamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Dynamic RBAC (Roles e Permissions)

-- Tabela de Permissões Disponíveis no Sistema
CREATE TABLE public.permissions (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    module TEXT NOT NULL,
    description TEXT
);

-- Tabela de Perfis (Roles)
CREATE TABLE public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE, -- NULL = System Global Role
    name TEXT NOT NULL,
    description TEXT,
    is_system_role BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Permissões vinculadas a um perfil
CREATE TABLE public.role_permissions (
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_slug TEXT NOT NULL REFERENCES public.permissions(slug) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_slug)
);

-- Adicionar role_id à tabela tenant_users
ALTER TABLE public.tenant_users ADD COLUMN role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL;

-- Habilitar RLS nas novas tabelas
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Políticas RBAC básicas
-- Todo mundo pode ler permissões
CREATE POLICY "Anyone can read permissions" ON public.permissions FOR SELECT USING (true);

-- Perfis globais (tenant_id IS NULL) e perfis do próprio tenant
CREATE POLICY "Users can read roles" ON public.roles FOR SELECT 
    USING (tenant_id IS NULL OR tenant_id = ANY(public.user_tenant_ids()));

CREATE POLICY "Admins can manage tenant roles" ON public.roles FOR ALL
    USING (tenant_id = ANY(public.user_tenant_ids()));

CREATE POLICY "Users can read role_permissions" ON public.role_permissions FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.roles r 
            WHERE r.id = role_permissions.role_id 
            AND (r.tenant_id IS NULL OR r.tenant_id = ANY(public.user_tenant_ids()))
        )
    );

CREATE POLICY "Admins can manage role_permissions" ON public.role_permissions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.roles r 
            WHERE r.id = role_permissions.role_id 
            AND r.tenant_id = ANY(public.user_tenant_ids())
            AND r.is_system_role = FALSE -- Não pode alterar roles do sistema
        )
    );

-- 3. Seed Dados Base

-- Permissões Básicas
INSERT INTO public.permissions (slug, name, module, description) VALUES
('manage_users', 'Gerenciar Usuários e Perfis', 'Configurações', 'Criar usuários e perfis de acesso'),
('manage_settings', 'Configurações Globais', 'Configurações', 'Alterar preferências do sistema'),
('manage_employees', 'Gestão de Funcionários', 'RH', 'Cadastrar e editar dados de colaboradores'),
('manage_payroll', 'Folha de Pagamento', 'DP', 'Calcular folha, lançar eventos, férias e rescisões'),
('manage_sst', 'Saúde e Segurança', 'SST', 'Gerenciar atestados e eventos de SST'),
('view_reports', 'Visualizar Relatórios', 'Geral', 'Acesso aos relatórios e exportações')
ON CONFLICT (slug) DO NOTHING;

-- Criar Roles do Sistema
INSERT INTO public.roles (id, tenant_id, name, description, is_system_role) VALUES
('00000000-0000-0000-0000-000000000001', NULL, 'Administrador Global', 'Acesso total a todos os módulos do sistema.', TRUE),
('00000000-0000-0000-0000-000000000002', NULL, 'Analista de DP', 'Acesso à folha de pagamento e gestão de funcionários.', TRUE),
('00000000-0000-0000-0000-000000000003', NULL, 'Especialista SST', 'Acesso restrito ao módulo de Saúde e Segurança.', TRUE)
ON CONFLICT DO NOTHING;

-- Vincular permissões ao Admin
INSERT INTO public.role_permissions (role_id, permission_slug) VALUES
('00000000-0000-0000-0000-000000000001', 'manage_users'),
('00000000-0000-0000-0000-000000000001', 'manage_settings'),
('00000000-0000-0000-0000-000000000001', 'manage_employees'),
('00000000-0000-0000-0000-000000000001', 'manage_payroll'),
('00000000-0000-0000-0000-000000000001', 'manage_sst'),
('00000000-0000-0000-0000-000000000001', 'view_reports')
ON CONFLICT DO NOTHING;

-- Vincular permissões ao Analista DP
INSERT INTO public.role_permissions (role_id, permission_slug) VALUES
('00000000-0000-0000-0000-000000000002', 'manage_employees'),
('00000000-0000-0000-0000-000000000002', 'manage_payroll'),
('00000000-0000-0000-0000-000000000002', 'view_reports')
ON CONFLICT DO NOTHING;

-- Atualizar tenant_users existentes para apontarem para as Roles baseadas na string antiga
UPDATE public.tenant_users 
SET role_id = '00000000-0000-0000-0000-000000000001' 
WHERE role IN ('system_admin', 'tenant_admin');

UPDATE public.tenant_users 
SET role_id = '00000000-0000-0000-0000-000000000002' 
WHERE role = 'dp_analyst';

UPDATE public.tenant_users 
SET role_id = '00000000-0000-0000-0000-000000000003' 
WHERE role = 'sst_specialist';

-- Nota: Não iremos dropar a constraint antiga 'role' de imediato para não quebrar 
-- as políticas RLS existentes (que usam role IN ('system_admin', ...)).
-- Vamos usar role_id + roles e custom roles progressivamente.
