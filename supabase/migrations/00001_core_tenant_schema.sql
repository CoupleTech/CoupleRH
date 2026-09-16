-- Migration: 00001_core_tenant_schema
-- Description: Criação das entidades organizacionais e estruturação de multi-tenancy com RLS.

-- 1. Tenants (As contas principais do SaaS)
CREATE TABLE public.tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 2. Tenant Users (Associação de usuários aos tenants com papéis)
-- Note: users vêm de auth.users do Supabase
CREATE TABLE public.tenant_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- FK logicamente para auth.users(id)
    role TEXT NOT NULL CHECK (role IN ('system_admin', 'tenant_admin', 'dp_analyst', 'manager', 'employee', 'sst_specialist', 'auditor')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

-- 3. Companies (Empresas - CNPJ raiz)
CREATE TABLE public.companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    corporate_name TEXT NOT NULL,
    trade_name TEXT,
    cnpj TEXT NOT NULL,
    legal_nature TEXT,
    primary_cnae TEXT,
    tax_regime TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(tenant_id, cnpj)
);

-- 4. Establishments (Estabelecimentos / Filiais - CNPJ completo)
CREATE TABLE public.establishments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    cnpj TEXT NOT NULL,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(tenant_id, cnpj)
);

-- 5. Departments (Departamentos / Centros de Custo)
CREATE TABLE public.departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    cost_center_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 6. Positions (Cargos)
CREATE TABLE public.positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    cbo TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Ativar RLS em todas as tabelas
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.establishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

-- Security Definer Function para obter os tenants do usuário logado de forma rápida
CREATE OR REPLACE FUNCTION public.user_tenant_ids()
RETURNS UUID[] AS $$
  SELECT ARRAY(
    SELECT tenant_id 
    FROM public.tenant_users 
    WHERE user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- RLS Policies

-- Políticas para tenants (Usuário só vê o tenant se pertencer a ele)
CREATE POLICY "Users can view their tenants" 
    ON public.tenants FOR SELECT 
    USING (id = ANY (public.user_tenant_ids()));

-- Políticas para tenant_users (Usuários do mesmo tenant podem ver os outros, útil para RH ver acessos)
CREATE POLICY "Users can view tenant_users in their tenants" 
    ON public.tenant_users FOR SELECT 
    USING (tenant_id = ANY (public.user_tenant_ids()));

-- Políticas para companies
CREATE POLICY "Users can view companies in their tenants" 
    ON public.companies FOR SELECT 
    USING (tenant_id = ANY (public.user_tenant_ids()));

-- Políticas genéricas de CRUD para admins e DP (simplicada para o momento, a ser expandida depois)
CREATE POLICY "Tenant Admins and DP can manage companies" 
    ON public.companies FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (
            SELECT 1 FROM public.tenant_users 
            WHERE user_id = auth.uid() 
            AND tenant_id = companies.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst')
        )
    );

CREATE POLICY "Tenant Admins and DP can manage establishments" 
    ON public.establishments FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = establishments.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
    )
    WITH CHECK (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = establishments.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
    );

CREATE POLICY "Tenant Admins and DP can manage departments" 
    ON public.departments FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = departments.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
    )
    WITH CHECK (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = departments.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
    );

CREATE POLICY "Tenant Admins and DP can manage positions" 
    ON public.positions FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = positions.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
    )
    WITH CHECK (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = positions.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
    );

-- (Nota: Para Establishments, Departments e Positions a política de visualização é a mesma: 
-- quem está no tenant_id, pode ver).
CREATE POLICY "Users can view establishments in their tenants" 
    ON public.establishments FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view departments in their tenants" 
    ON public.departments FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view positions in their tenants" 
    ON public.positions FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));
