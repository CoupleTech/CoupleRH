-- MISSING MIGRATIONS RECOVERY SCRIPT

-- ==========================================
-- Source: 00036_add_trct_to_terminations.sql
-- ==========================================

-- Migration: 00036_add_trct_to_terminations
-- Description: Adiciona coluna calculated_trct para salvar o snapshot do TRCT

ALTER TABLE public.terminations ADD COLUMN IF NOT EXISTS calculated_trct JSONB;

NOTIFY pgrst, 'reload schema';


-- ==========================================
-- Source: 00037_complementary_payroll.sql
-- ==========================================

-- Migration: 00037_complementary_payroll
-- Description: Adiciona suporte a folha complementar na tabela payroll_periods

-- 1. Modificar a constraint de type
ALTER TABLE public.payroll_periods DROP CONSTRAINT IF EXISTS payroll_periods_type_check;

ALTER TABLE public.payroll_periods ADD CONSTRAINT payroll_periods_type_check 
    CHECK (type IN ('MONTHLY', 'ADVANCE', '13TH', 'THIRTEENTH_1', 'THIRTEENTH_2', 'VACATION', 'PROFIT_SHARING', 'COMPLEMENTARY'));

-- 2. Adicionar colunas de relacionamento e motivo
ALTER TABLE public.payroll_periods ADD COLUMN IF NOT EXISTS parent_period_id UUID REFERENCES public.payroll_periods(id);
ALTER TABLE public.payroll_periods ADD COLUMN IF NOT EXISTS complement_reason TEXT;

NOTIFY pgrst, 'reload schema';


-- ==========================================
-- Source: 00038_salary_adjustments.sql
-- ==========================================

-- Migration: 00038_salary_adjustments
-- Description: Adiciona tabela para histórico de reajustes salariais e dissídios

CREATE TABLE IF NOT EXISTS public.salary_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES public.employment_contracts(id) ON DELETE CASCADE,
    old_salary DECIMAL(10, 2) NOT NULL,
    new_salary DECIMAL(10, 2) NOT NULL,
    percentage DECIMAL(5, 2), -- ex: 10.50 para 10,5%
    effective_date DATE NOT NULL,
    approval_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.salary_adjustments ENABLE ROW LEVEL SECURITY;

-- Create policy for tenant access
DROP POLICY IF EXISTS "Tenants can manage their salary_adjustments" ON public.salary_adjustments;
CREATE POLICY "Tenants can manage their salary_adjustments" ON public.salary_adjustments
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id 
            FROM public.tenant_users 
            WHERE user_id = auth.uid()
        )
    );

NOTIFY pgrst, 'reload schema';


-- ==========================================
-- Source: 00039_expand_audit_engine.sql
-- ==========================================

-- Migration: 00039_expand_audit_engine
-- Description: Extensão da engine de auditoria para capturar motivo, versão do motor e expor logs via view.

-- 1. Adicionar colunas em audit.logs
ALTER TABLE audit.logs 
    ADD COLUMN IF NOT EXISTS reason TEXT,
    ADD COLUMN IF NOT EXISTS engine_version TEXT;

-- 2. Atualizar a função de trigger para injetar as sessões
CREATE OR REPLACE FUNCTION audit.audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    current_tenant_id UUID;
    v_old JSONB;
    v_new JSONB;
    v_reason TEXT;
    v_engine TEXT;
BEGIN
    -- Capturar motivo e engine injetados via set_config, se existirem
    BEGIN
        v_reason := current_setting('app.audit_reason', true);
    EXCEPTION WHEN OTHERS THEN
        v_reason := NULL;
    END;

    BEGIN
        v_engine := current_setting('app.engine_version', true);
    EXCEPTION WHEN OTHERS THEN
        v_engine := NULL;
    END;

    -- Capturar o tenant_id da linha modificada, se existir
    IF TG_OP = 'DELETE' THEN
        v_old := to_jsonb(OLD);
        BEGIN
            current_tenant_id := OLD.tenant_id;
        EXCEPTION WHEN OTHERS THEN
            current_tenant_id := NULL;
        END;
    ELSE
        v_new := to_jsonb(NEW);
        BEGIN
            current_tenant_id := NEW.tenant_id;
        EXCEPTION WHEN OTHERS THEN
            current_tenant_id := NULL;
        END;
        
        IF TG_OP = 'UPDATE' THEN
            v_old := to_jsonb(OLD);
            -- Não auditar se nada mudou de fato
            IF v_old = v_new THEN
                RETURN NEW;
            END IF;
        END IF;
    END IF;

    -- Inserir o log com SYSTEM_USER (bypass RLS)
    INSERT INTO audit.logs (
        tenant_id,
        actor_id,
        action,
        entity_type,
        entity_id,
        old_values,
        new_values,
        reason,
        engine_version
    ) VALUES (
        current_tenant_id,
        COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::UUID),
        TG_OP,
        TG_TABLE_NAME::TEXT,
        COALESCE((v_new->>'id'), (v_old->>'id'), 'unknown'),
        v_old,
        v_new,
        v_reason,
        v_engine
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Criar a view exposta publicamente para consumir no Frontend via PostgREST
CREATE OR REPLACE VIEW public.audit_logs_view AS
SELECT 
    id,
    timestamp,
    tenant_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    ip_address,
    reason,
    engine_version
FROM audit.logs;

-- Atribuir grants na View
GRANT SELECT ON public.audit_logs_view TO authenticated, anon;

-- 4. Anexar trigger de auditoria nas tabelas solicitadas (apenas se não existirem ainda)

DO $$
BEGIN
    -- payroll_rubrics
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_rubrics_trigger') THEN
        DROP TRIGGER IF EXISTS audit_payroll_rubrics_trigger ON public.table_name_placeholder;
DROP TRIGGER IF EXISTS audit_payroll_rubrics_trigger ON public.payroll_rubrics;
CREATE TRIGGER audit_payroll_rubrics_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.payroll_rubrics
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    -- employment_contracts
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_employment_contracts_trigger') THEN
        DROP TRIGGER IF EXISTS audit_employment_contracts_trigger ON public.table_name_placeholder;
DROP TRIGGER IF EXISTS audit_employment_contracts_trigger ON public.employment_contracts;
CREATE TRIGGER audit_employment_contracts_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.employment_contracts
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    -- salary_adjustments
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_salary_adjustments_trigger') THEN
        DROP TRIGGER IF EXISTS audit_salary_adjustments_trigger ON public.table_name_placeholder;
DROP TRIGGER IF EXISTS audit_salary_adjustments_trigger ON public.salary_adjustments;
CREATE TRIGGER audit_salary_adjustments_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.salary_adjustments
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    -- payroll_variable_events
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_variable_events_trigger') THEN
        DROP TRIGGER IF EXISTS audit_payroll_variable_events_trigger ON public.table_name_placeholder;
DROP TRIGGER IF EXISTS audit_payroll_variable_events_trigger ON public.payroll_variable_events;
CREATE TRIGGER audit_payroll_variable_events_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.payroll_variable_events
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    -- employee_fixed_events
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_employee_fixed_events_trigger') THEN
        DROP TRIGGER IF EXISTS audit_employee_fixed_events_trigger ON public.table_name_placeholder;
DROP TRIGGER IF EXISTS audit_employee_fixed_events_trigger ON public.employee_fixed_events;
CREATE TRIGGER audit_employee_fixed_events_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.employee_fixed_events
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;

    -- payroll_periods
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'audit_payroll_periods_trigger') THEN
        DROP TRIGGER IF EXISTS audit_payroll_periods_trigger ON public.table_name_placeholder;
DROP TRIGGER IF EXISTS audit_payroll_periods_trigger ON public.payroll_periods;
CREATE TRIGGER audit_payroll_periods_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.payroll_periods
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;


-- ==========================================
-- Source: 00040_expand_payroll_periods_status.sql
-- ==========================================

-- Migration: 00040_expand_payroll_periods_status
-- Description: Altera a constraint de status da tabela payroll_periods para suportar o fluxo da Fase 31.

-- Primeiro, verificamos e removemos a constraint atual se existir
ALTER TABLE public.payroll_periods DROP CONSTRAINT IF EXISTS payroll_periods_status_check;

-- Em seguida, adicionamos a nova constraint suportando todos os estados da máquina
ALTER TABLE public.payroll_periods ADD CONSTRAINT payroll_periods_status_check 
    CHECK (status IN ('DRAFT', 'CALCULATED', 'CONFERENCE', 'CLOSED', 'REOPENED', 'CANCELED'));

-- Recarregar o schema para o PostgREST
NOTIFY pgrst, 'reload schema';


-- ==========================================
-- Source: 00041_add_payslip_versions.sql
-- ==========================================

-- Migration: 00041_add_payslip_versions
-- Description: Adiciona colunas para armazenar as versões dos motores e tabelas utilizadas no cálculo de cada holerite (Fase 32).

ALTER TABLE public.payslips ADD COLUMN IF NOT EXISTS engine_version TEXT DEFAULT '1.0.0',
    ADD COLUMN IF NOT EXISTS rubrics_version TEXT DEFAULT '1.0.0',
    ADD COLUMN IF NOT EXISTS rules_version TEXT DEFAULT '1.0.0',
    ADD COLUMN IF NOT EXISTS inss_table_version TEXT DEFAULT '2026.1',
    ADD COLUMN IF NOT EXISTS irrf_table_version TEXT DEFAULT '2026.1',
    ADD COLUMN IF NOT EXISTS fgts_table_version TEXT DEFAULT '1.0.0';

-- Recarregar o schema para o PostgREST
NOTIFY pgrst, 'reload schema';


-- ==========================================
-- Source: 00042_add_employee_contacts_banks_docs.sql
-- ==========================================

-- Migration: 00042_add_employee_contacts_banks_docs
-- Description: Adiciona campos de contato à pessoa, dados bancários ao trabalhador e cria tabela de documentos pessoais

-- 1. Contatos na tabela people
ALTER TABLE public.people ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS corporate_email TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS mobile TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_relation TEXT;

-- 2. Dados bancários na tabela workers (Vínculo da pessoa com a empresa)
ALTER TABLE public.workers ADD COLUMN IF NOT EXISTS bank_code TEXT,
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS agency TEXT,
ADD COLUMN IF NOT EXISTS agency_digit TEXT,
ADD COLUMN IF NOT EXISTS account_number TEXT,
ADD COLUMN IF NOT EXISTS account_digit TEXT,
ADD COLUMN IF NOT EXISTS account_type TEXT, -- 'CORRENTE', 'POUPANCA', 'SALARIO'
ADD COLUMN IF NOT EXISTS pix_key TEXT,
ADD COLUMN IF NOT EXISTS pix_type TEXT; -- 'CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM'

-- 3. Nova tabela de Documentos do Colaborador (worker_personal_documents)
CREATE TABLE IF NOT EXISTS public.worker_personal_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL, -- 'RG', 'CPF', 'CNH', 'PIS', 'ASO_ADMISSIONAL', 'COMPROVANTE_RESIDENCIA', etc
    document_number TEXT,
    issuer TEXT, -- Órgão emissor
    issue_date DATE,
    expiration_date DATE,
    file_url TEXT, -- Preparado para futuro storage
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'EXPIRED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Ativar RLS
ALTER TABLE public.worker_personal_documents ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para worker_personal_documents
DROP POLICY IF EXISTS "Users can view worker_personal_documents in their tenants" ON public.worker_personal_documents;
CREATE POLICY "Users can view worker_personal_documents in their tenants" 
    ON public.worker_personal_documents FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

DROP POLICY IF EXISTS "Tenant Admins and DP can manage worker_personal_documents" ON public.worker_personal_documents;
CREATE POLICY "Tenant Admins and DP can manage worker_personal_documents" 
    ON public.worker_personal_documents FOR ALL 
    USING (
        tenant_id = ANY (public.user_tenant_ids()) 
        AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = worker_personal_documents.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
    );

-- Anexar ao motor de auditoria (Triggers)
DROP TRIGGER IF EXISTS audit_worker_personal_documents_trigger ON public.worker_personal_documents;
DROP TRIGGER IF EXISTS audit_worker_personal_documents_trigger ON public.table_name_placeholder;
DROP TRIGGER IF EXISTS audit_worker_personal_documents_trigger ON public.worker_personal_documents;
CREATE TRIGGER audit_worker_personal_documents_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.worker_personal_documents
FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();


-- ==========================================
-- Source: 00043_employee_portal_auth.sql
-- ==========================================

-- Migration: 00043_employee_portal_auth
-- Description: Criação da função de autenticação (RPC) para o Portal do Colaborador (CPF e Data de Nascimento)

CREATE OR REPLACE FUNCTION public.authenticate_employee(p_cpf TEXT, p_birth_date TEXT)
RETURNS TABLE (
    worker_id UUID,
    person_id UUID,
    company_id UUID,
    tenant_id UUID,
    full_name TEXT
)
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        w.id as worker_id,
        p.id as person_id,
        w.company_id,
        w.tenant_id,
        p.full_name
    FROM public.people p
    JOIN public.workers w ON w.person_id = p.id
    WHERE 
        -- Remove formatação do CPF, se houver
        REGEXP_REPLACE(p.cpf, '[^0-9]', '', 'g') = REGEXP_REPLACE(p_cpf, '[^0-9]', '', 'g')
        -- Compara a data formatada DDMMAAAA com a data de nascimento no banco
        AND to_char(p.birth_date, 'DDMMYYYY') = p_birth_date
        -- Apenas trabalhadores ativos
        AND w.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions for authenticated and anonymous users to call the auth function
GRANT EXECUTE ON FUNCTION public.authenticate_employee(TEXT, TEXT) TO authenticated, anon;


-- ==========================================
-- Source: 00044_user_profiles_and_dynamic_rbac.sql
-- ==========================================

-- Migration: 00044_user_profiles_and_dynamic_rbac
-- Description: Criação de perfis dinâmicos (RBAC), tabela de usuários e vinculação com auth.users

-- 1. User Profiles
-- Armazena dados públicos dos usuários já que não podemos consultar auth.users no frontend diretamente
CREATE TABLE IF NOT EXISTS public.user_profiles (
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
DROP TRIGGER IF EXISTS on_auth_user_created ON public.table_name_placeholder;
DROP TRIGGER IF EXISTS on_auth_user_created ON public.handle_new_user;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Dynamic RBAC (Roles e Permissions)

-- Tabela de Permissões Disponíveis no Sistema
CREATE TABLE IF NOT EXISTS public.permissions (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    module TEXT NOT NULL,
    description TEXT
);

-- Tabela de Perfis (Roles)
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE, -- NULL = System Global Role
    name TEXT NOT NULL,
    description TEXT,
    is_system_role BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Permissões vinculadas a um perfil
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_slug TEXT NOT NULL REFERENCES public.permissions(slug) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_slug)
);

-- Adicionar role_id à tabela tenant_users
ALTER TABLE public.tenant_users ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL;

-- Habilitar RLS nas novas tabelas
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Políticas RBAC básicas
-- Todo mundo pode ler permissões
DROP POLICY IF EXISTS "Anyone can read permissions" ON public.permissions;
CREATE POLICY "Anyone can read permissions" ON public.permissions FOR SELECT USING (true);

-- Perfis globais (tenant_id IS NULL) e perfis do próprio tenant
DROP POLICY IF EXISTS "Users can read roles" ON public.roles;
CREATE POLICY "Users can read roles" ON public.roles FOR SELECT 
    USING (tenant_id IS NULL OR tenant_id = ANY(public.user_tenant_ids()));

DROP POLICY IF EXISTS "Admins can manage tenant roles" ON public.roles;
CREATE POLICY "Admins can manage tenant roles" ON public.roles FOR ALL
    USING (tenant_id = ANY(public.user_tenant_ids()));

DROP POLICY IF EXISTS "Users can read role_permissions" ON public.role_permissions;
CREATE POLICY "Users can read role_permissions" ON public.role_permissions FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.roles r 
            WHERE r.id = role_permissions.role_id 
            AND (r.tenant_id IS NULL OR r.tenant_id = ANY(public.user_tenant_ids()))
        )
    );

DROP POLICY IF EXISTS "Admins can manage role_permissions" ON public.role_permissions;
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


-- ==========================================
-- Source: 00045_add_company_to_benefits.sql
-- ==========================================

-- Migration: 00045_add_company_to_benefits
-- Description: Adiciona company_id a benefit_catalogs para permitir benefícios específicos por filial.

ALTER TABLE public.benefit_catalogs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- Se company_id for null, o benefício é global para o tenant.


-- ==========================================
-- Source: 00046_add_payment_date_to_payroll.sql
-- ==========================================

-- Migration: 00046_add_payment_date_to_payroll
-- Description: Adiciona a coluna payment_date para suportar o prazo de pagamento (ex: 2 dias antes das férias ou rescisão) e evitar o erro do schema cache.

ALTER TABLE public.payroll_periods ADD COLUMN IF NOT EXISTS payment_date DATE;

-- Força a atualização do cache do PostgREST (API do Supabase)
NOTIFY pgrst, 'reload schema';


-- ==========================================
-- Source: 00047_seed_absences_rubrics.sql
-- ==========================================

-- Migration: 00047_seed_absences_rubrics
-- Description: Cria rubricas padrões de Faltas Injustificadas e Atrasos para o Espelho de Ponto Dinâmico.

DO $$ 
DECLARE
    tenant RECORD;
BEGIN
    FOR tenant IN SELECT id FROM public.tenants LOOP
        
        -- Falta Injustificada (Cód 210)
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '210', 'Faltas Injustificadas', 'DEDUCTION', 'OTHER', 'FORMULA', 'DIAS', 'SALARIO_BASE',
            true, true, true, true, true, true
        ) ON CONFLICT (tenant_id, code) DO NOTHING;

        -- Atrasos (Cód 211)
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, factor,
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '211', 'Atrasos (Horas/Minutos)', 'DEDUCTION', 'OTHER', 'FORMULA', 'HORAS', 'SALARIO_BASE', 1.0,
            true, true, true, true, true, true
        ) ON CONFLICT (tenant_id, code) DO NOTHING;

        -- DSR sobre Faltas/Atrasos (Cód 212)
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '212', 'DSR s/ Faltas', 'DEDUCTION', 'OTHER', 'FORMULA', 'DIAS', 'SALARIO_BASE',
            true, true, true, true, true, true
        ) ON CONFLICT (tenant_id, code) DO NOTHING;

    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';


-- ==========================================
-- Source: 00048_fix_rubrics_schema.sql
-- ==========================================

-- Migration: 00048_fix_rubrics_schema
-- Description: Alinha o schema da tabela payroll_rubrics com os nomes de colunas 
-- esperados pela tela Rubrics.tsx e pelo motor de cálculo (Edge Function).
-- Resolve o BUG R1 (colunas com nomes incompatíveis entre frontend e banco).

-- 1. Adicionar colunas que a tela Rubrics.tsx espera mas não existem
ALTER TABLE public.payroll_rubrics ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS valid_from DATE,
  ADD COLUMN IF NOT EXISTS valid_to DATE,
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS esocial_description TEXT;

-- 2. Adicionar colunas com os nomes corretos que a tela usa para incidências patronais
-- (A tela envia: incidence_inss_patronal, incidence_rat, incidence_third_parties)
-- (O banco antigo tinha: inss_patronal_incidence, rat_incidence, terceiros_incidence)
ALTER TABLE public.payroll_rubrics ADD COLUMN IF NOT EXISTS incidence_inss_patronal BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS incidence_rat BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS incidence_third_parties BOOLEAN DEFAULT false;

-- 3. Adicionar colunas com os nomes corretos que a tela usa para bases geradas
-- (A tela envia: generates_base_inss, generates_base_irrf, generates_base_fgts)
-- (O banco antigo tinha: generates_inss_base, generates_irrf_base, generates_fgts_base)
ALTER TABLE public.payroll_rubrics ADD COLUMN IF NOT EXISTS generates_base_inss BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS generates_base_irrf BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS generates_base_fgts BOOLEAN DEFAULT false;

-- 4. Migrar dados existentes das colunas antigas para as novas (se existirem)
DO $$
BEGIN
  -- Migrar incidências patronais
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_rubrics' AND column_name = 'inss_patronal_incidence') THEN
    UPDATE public.payroll_rubrics SET 
      incidence_inss_patronal = COALESCE(inss_patronal_incidence, false)
    WHERE inss_patronal_incidence IS NOT NULL AND inss_patronal_incidence = true;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_rubrics' AND column_name = 'rat_incidence') THEN
    UPDATE public.payroll_rubrics SET 
      incidence_rat = COALESCE(rat_incidence, false)
    WHERE rat_incidence IS NOT NULL AND rat_incidence = true;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_rubrics' AND column_name = 'terceiros_incidence') THEN
    UPDATE public.payroll_rubrics SET 
      incidence_third_parties = COALESCE(terceiros_incidence, false)
    WHERE terceiros_incidence IS NOT NULL AND terceiros_incidence = true;
  END IF;
  
  -- Migrar bases geradas
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_rubrics' AND column_name = 'generates_inss_base') THEN
    UPDATE public.payroll_rubrics SET 
      generates_base_inss = COALESCE(generates_inss_base, false)
    WHERE generates_inss_base IS NOT NULL AND generates_inss_base = true;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_rubrics' AND column_name = 'generates_irrf_base') THEN
    UPDATE public.payroll_rubrics SET 
      generates_base_irrf = COALESCE(generates_irrf_base, false)
    WHERE generates_irrf_base IS NOT NULL AND generates_irrf_base = true;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payroll_rubrics' AND column_name = 'generates_fgts_base') THEN
    UPDATE public.payroll_rubrics SET 
      generates_base_fgts = COALESCE(generates_fgts_base, false)
    WHERE generates_fgts_base IS NOT NULL AND generates_fgts_base = true;
  END IF;
END $$;

-- 5. Garantir que a coluna calculation_order existe com um bom default
ALTER TABLE public.payroll_rubrics 
  ALTER COLUMN calculation_order SET DEFAULT 50;

NOTIFY pgrst, 'reload schema';


-- ==========================================
-- Source: 00049_fix_rubrics_and_codes.sql
-- ==========================================

-- Migration: 00049_fix_rubrics_and_codes
-- Description: Seed de Rubricas Padrão Corrigido

-- 1. Limpar rubricas duplicadas (1001 vs 101, 2001 vs 901)
-- Se as antigas (1001) não têm vínculos, as deletamos. (Evitando FK violation na payroll_rubrics se já foi usada).
DO $$
BEGIN
  BEGIN
    DELETE FROM public.payroll_rubrics WHERE code IN ('1001', '2001', '2002', '2005');
  EXCEPTION WHEN OTHERS THEN
    -- Soft delete se não for possível hard delete (por foreign key constraint)
    UPDATE public.payroll_rubrics SET is_active = false WHERE code IN ('1001', '2001', '2002', '2005');
  END;
END $$;

-- 2. Inserir rubricas 150 (HE50) e 160 (HE100) para o Espelho de Ponto
DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Percorre todos os tenants para garantir as rubricas
  FOR v_tenant_id IN SELECT id FROM public.tenants LOOP
    
    IF NOT EXISTS (SELECT 1 FROM public.payroll_rubrics WHERE tenant_id = v_tenant_id AND code = '150') THEN
      INSERT INTO public.payroll_rubrics (
        tenant_id, code, name, description, type, category, calculation_type, calculation_base, factor, calculation_order, generates_base_inss, generates_base_irrf, generates_base_fgts, origin, valid_from, is_active
      ) VALUES (
        v_tenant_id, '150', 'Hora Extra 50%', 'Hora Extra Padrão (50%)', 'EARNING', 'OVERTIME', 'HORAS', 'SALARIO_BASE', 1.5, 30, true, true, true, 'IMPORTADA', CURRENT_DATE, true
      );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.payroll_rubrics WHERE tenant_id = v_tenant_id AND code = '160') THEN
      INSERT INTO public.payroll_rubrics (
        tenant_id, code, name, description, type, category, calculation_type, calculation_base, factor, calculation_order, generates_base_inss, generates_base_irrf, generates_base_fgts, origin, valid_from, is_active
      ) VALUES (
        v_tenant_id, '160', 'Hora Extra 100%', 'Hora Extra Domingos/Feriados (100%)', 'EARNING', 'OVERTIME', 'HORAS', 'SALARIO_BASE', 2.0, 30, true, true, true, 'IMPORTADA', CURRENT_DATE, true
      );
    END IF;

  END LOOP;
END $$;


-- ==========================================
-- Source: 00051_employee_portal_rpc.sql
-- ==========================================

-- Migration: 00051_employee_portal_rpc
-- Description: Criação de RPCs para o Portal do Colaborador acessar seus dados com segurança

CREATE OR REPLACE FUNCTION public.get_employee_payslips(p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', p.id,
            'net_salary', p.net_salary,
            'status', p.status,
            'period_month', pp.month,
            'period_year', pp.year,
            'period_type', pp.type
        ) ORDER BY pp.year DESC, pp.month DESC
    ) INTO v_result
    FROM public.payslips p
    JOIN public.payroll_periods pp ON pp.id = p.period_id
    WHERE p.contract_id IN (
        SELECT id FROM public.employment_contracts WHERE worker_id = p_worker_id
    )
    AND p.status = 'CLOSED';

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_employee_vacation_balance(p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', vp.id,
            'start_date', vp.start_date,
            'end_date', vp.end_date,
            'concessive_start_date', vp.concessive_start_date,
            'concessive_end_date', vp.concessive_end_date,
            'days_earned', vp.earned_days,
            'days_taken', vp.taken_days,
            'days_lost', vp.lost_days,
            'status', vp.status
        ) ORDER BY vp.start_date DESC
    ) INTO v_result
    FROM public.vacation_vesting_periods vp
    WHERE vp.contract_id IN (
        SELECT id FROM public.employment_contracts WHERE worker_id = p_worker_id
    );

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_employee_payslips(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_vacation_balance(UUID) TO anon, authenticated;


-- ==========================================
-- Source: 00052_employee_portal_profile_rpc.sql
-- ==========================================

-- Migration: 00052_employee_portal_profile_rpc
-- Description: RPC para o Portal do Colaborador acessar seus dados de perfil, benefícios e contrato

-- 1. Dados completos do perfil do colaborador
CREATE OR REPLACE FUNCTION public.get_employee_profile(p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_build_object(
        -- Dados pessoais
        'full_name', p.full_name,
        'social_name', p.social_name,
        'cpf', p.cpf,
        'birth_date', p.birth_date,
        'gender', p.gender,
        'email', p.email,
        'phone', p.phone,
        'mobile', p.mobile,
        -- Endereço
        'address', json_build_object(
            'zip_code', p.zip_code,
            'street', p.street,
            'number', p.number,
            'complement', p.complement,
            'neighborhood', p.neighborhood,
            'city', p.city,
            'state', p.state,
            'country', p.country
        ),
        -- Contato de emergência
        'emergency_contact', json_build_object(
            'name', p.emergency_contact_name,
            'phone', p.emergency_contact_phone,
            'relation', p.emergency_contact_relation
        ),
        -- Dados bancários
        'bank', json_build_object(
            'bank_name', w.bank_name,
            'agency', w.agency,
            'account_number', w.account_number,
            'account_digit', w.account_digit,
            'account_type', w.account_type,
            'pix_key', w.pix_key,
            'pix_type', w.pix_type
        ),
        -- Dados do contrato
        'contract', json_build_object(
            'id', ec.id,
            'contract_type', ct.name,
            'contract_category', ct.category,
            'admission_date', ec.admission_date,
            'base_salary', ec.base_salary,
            'status', ec.status,
            'position_title', pos.title,
            'position_cbo', pos.cbo,
            'department_name', dept.name
        )
    ) INTO v_result
    FROM public.workers w
    JOIN public.people p ON p.id = w.person_id
    LEFT JOIN public.employment_contracts ec ON ec.worker_id = w.id AND ec.status = 'ACTIVE'
    LEFT JOIN public.positions pos ON pos.id = ec.position_id
    LEFT JOIN public.departments dept ON dept.id = ec.department_id
    LEFT JOIN public.contract_types ct ON ct.id = ec.contract_type_id
    WHERE w.id = p_worker_id;

    RETURN COALESCE(v_result, '{}'::JSON);
END;
$$ LANGUAGE plpgsql;

-- 2. Benefícios ativos do colaborador
CREATE OR REPLACE FUNCTION public.get_employee_benefits(p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', eb.id,
            'benefit_name', bc.name,
            'benefit_type', bc.benefit_type,
            'provider_name', bc.provider_name,
            'discount_type', bc.discount_type,
            'discount_value', COALESCE(eb.custom_discount_value, bc.default_discount_value),
            'card_number', eb.card_number,
            'dependent_count', eb.dependent_count,
            'status', eb.status
        ) ORDER BY bc.name
    ) INTO v_result
    FROM public.employee_benefits eb
    JOIN public.benefits_catalog bc ON bc.id = eb.benefit_id
    WHERE eb.contract_id IN (
        SELECT id FROM public.employment_contracts WHERE worker_id = p_worker_id AND status = 'ACTIVE'
    )
    AND eb.status = 'ACTIVE';

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_employee_profile(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_benefits(UUID) TO anon, authenticated;


-- ==========================================
-- Source: 00053_fix_payslips_rpc.sql
-- ==========================================

-- Migration: 00053_fix_payslips_rpc
-- Description: Adiciona SECURITY DEFINER à função get_employee_payslips para o Portal do Colaborador

CREATE OR REPLACE FUNCTION public.get_employee_payslips(p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', p.id,
            'net_salary', p.net_salary,
            'status', p.status,
            'period_month', pp.month,
            'period_year', pp.year,
            'period_type', pp.type
        ) ORDER BY pp.year DESC, pp.month DESC
    ) INTO v_result
    FROM public.payslips p
    JOIN public.payroll_periods pp ON pp.id = p.period_id
    WHERE p.contract_id IN (
        SELECT id FROM public.employment_contracts WHERE worker_id = p_worker_id
    )
    AND p.status = 'CLOSED';

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_employee_payslips(UUID) TO anon, authenticated;


-- ==========================================
-- Source: 00054_payslip_details_rpc.sql
-- ==========================================

-- Migration: 00054_payslip_details_rpc
-- Description: RPC para obter os detalhes analíticos de um holerite (rubricas, totais e bases)

CREATE OR REPLACE FUNCTION public.get_employee_payslip_details(p_payslip_id UUID, p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    -- Segurança: Garante que o holerite solicitado pertence ao contrato do colaborador
    IF NOT EXISTS (
        SELECT 1 FROM public.payslips p
        JOIN public.employment_contracts ec ON ec.id = p.contract_id
        WHERE p.id = p_payslip_id AND ec.worker_id = p_worker_id
    ) THEN
        RETURN '{}'::JSON;
    END IF;

    SELECT json_build_object(
        'totals', json_build_object(
            'total_earnings', p.total_earnings,
            'total_deductions', p.total_deductions,
            'net_salary', p.net_salary,
            'base_inss', p.base_inss,
            'base_irrf', p.base_irrf,
            'base_fgts', p.base_fgts,
            'fgts_month', p.fgts_month
        ),
        'items', (
            SELECT COALESCE(json_agg(
                json_build_object(
                    'code', pr.code,
                    'name', pr.name,
                    'reference', pi.reference,
                    'amount', pi.amount,
                    'type', pi.type
                ) ORDER BY pi.type DESC, pr.code ASC
            ), '[]'::JSON)
            FROM public.payslip_items pi
            JOIN public.payroll_rubrics pr ON pr.id = pi.rubric_id
            WHERE pi.payslip_id = p.id
        )
    ) INTO v_result
    FROM public.payslips p
    WHERE p.id = p_payslip_id;

    RETURN COALESCE(v_result, '{}'::JSON);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_employee_payslip_details(UUID, UUID) TO anon, authenticated;


-- ==========================================
-- Source: 00055_vacation_requests_rpc.sql
-- ==========================================

-- Migration: 00055_vacation_requests_rpc
-- Description: Atualiza a RPC get_employee_vacation_balance para incluir as solicitações/férias programadas (vacation_requests)

CREATE OR REPLACE FUNCTION public.get_employee_vacation_balance(p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', vp.id,
            'start_date', vp.start_date,
            'end_date', vp.end_date,
            'concessive_start_date', vp.concessive_start_date,
            'concessive_end_date', vp.concessive_end_date,
            'days_earned', vp.earned_days,
            'days_taken', vp.taken_days,
            'days_lost', vp.lost_days,
            'status', vp.status,
            'requests', (
                SELECT COALESCE(json_agg(
                    json_build_object(
                        'id', vr.id,
                        'start_date', vr.start_date,
                        'end_date', vr.end_date,
                        'days_taken', vr.days_taken,
                        'status', vr.status
                    ) ORDER BY vr.start_date ASC
                ), '[]'::JSON)
                FROM public.vacation_requests vr
                WHERE vr.vesting_period_id = vp.id
            )
        ) ORDER BY vp.start_date DESC
    ) INTO v_result
    FROM public.vacation_vesting_periods vp
    WHERE vp.contract_id IN (
        SELECT id FROM public.employment_contracts WHERE worker_id = p_worker_id
    );

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql;


-- ==========================================
-- Source: 00056_employee_documents_storage.sql
-- ==========================================

-- Migration: 00056_employee_documents_storage
-- Description: Criação do bucket employee-documents, políticas de storage e RPCs para a Central de Documentos

-- 1. Criar o bucket se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-documents', 'employee-documents', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Políticas de Storage para o bucket employee-documents
-- Permitir leitura pública (já que o bucket é public, mas garantindo acesso)
CREATE POLICY "employee_docs_public_access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'employee-documents');

-- Permitir upload pelo portal do colaborador (como usa autenticação customizada, precisamos liberar para anon)
CREATE POLICY "employee_docs_anon_upload" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'employee-documents');

-- Permitir upload e gerência pelo admin (autenticado)
CREATE POLICY "employee_docs_admin_full_access" 
ON storage.objects FOR ALL 
USING (bucket_id = 'employee-documents' AND auth.role() = 'authenticated');

-- 3. RPC para buscar documentos pessoais (Portal)
CREATE OR REPLACE FUNCTION public.get_worker_personal_documents(p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', d.id,
            'document_type', d.document_type,
            'status', d.status,
            'file_url', d.file_url,
            'issue_date', d.issue_date,
            'expiration_date', d.expiration_date,
            'created_at', d.created_at,
            'updated_at', d.updated_at
        ) ORDER BY d.created_at DESC
    ) INTO v_result
    FROM public.worker_personal_documents d
    WHERE d.worker_id = p_worker_id;

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql;

-- 4. RPC para o colaborador enviar um documento
CREATE OR REPLACE FUNCTION public.submit_worker_personal_document(
    p_worker_id UUID,
    p_document_type TEXT,
    p_file_url TEXT
)
RETURNS UUID
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id UUID;
    v_doc_id UUID;
BEGIN
    -- Pegar o tenant_id do worker
    SELECT tenant_id INTO v_tenant_id FROM public.employment_contracts WHERE worker_id = p_worker_id LIMIT 1;
    
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Worker not found';
    END IF;

    -- Verificar se já existe um documento pendente ou rejeitado deste tipo
    SELECT id INTO v_doc_id
    FROM public.worker_personal_documents
    WHERE worker_id = p_worker_id AND document_type = p_document_type
    LIMIT 1;

    IF v_doc_id IS NOT NULL THEN
        -- Atualizar existente
        UPDATE public.worker_personal_documents
        SET file_url = p_file_url,
            status = 'SUBMITTED',
            updated_at = NOW()
        WHERE id = v_doc_id;
    ELSE
        -- Inserir novo
        INSERT INTO public.worker_personal_documents (
            tenant_id,
            worker_id,
            document_type,
            file_url,
            status
        ) VALUES (
            v_tenant_id,
            p_worker_id,
            p_document_type,
            p_file_url,
            'SUBMITTED'
        ) RETURNING id INTO v_doc_id;
    END IF;

    RETURN v_doc_id;
END;
$$ LANGUAGE plpgsql;

-- 5. RPC para o Analista de RH atualizar o status do documento (Aprovar/Rejeitar)
CREATE OR REPLACE FUNCTION public.update_worker_document_status(
    p_document_id UUID,
    p_status TEXT
)
RETURNS BOOLEAN
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.worker_personal_documents
    SET status = p_status,
        updated_at = NOW()
    WHERE id = p_document_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;


-- ==========================================
-- Source: 00057_worker_signatures_rpc.sql
-- ==========================================

-- Migration: 00057_worker_signatures_rpc

CREATE OR REPLACE FUNCTION public.get_worker_signatures(p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', ed.id,
            'title', ed.title,
            'status', ed.status,
            'file_url', ed.file_url,
            'requires_employee_signature', ed.requires_employee_signature,
            'created_at', ed.created_at
        ) ORDER BY ed.created_at DESC
    ) INTO v_result
    FROM public.employee_documents ed
    WHERE ed.worker_id = p_worker_id;

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.sign_worker_document(p_document_id UUID, p_worker_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.employee_documents
    SET status = 'SIGNED',
        updated_at = NOW()
    WHERE id = p_document_id AND worker_id = p_worker_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;


-- ==========================================
-- Source: 00058_alter_worker_docs_status.sql
-- ==========================================

-- Migration: 00058_alter_worker_docs_status
-- Description: Altera a constraint de status em worker_personal_documents para suportar o fluxo de upload e auditoria

ALTER TABLE public.worker_personal_documents
DROP CONSTRAINT IF EXISTS worker_personal_documents_status_check;

ALTER TABLE public.worker_personal_documents
ADD CONSTRAINT worker_personal_documents_status_check 
CHECK (status = ANY (ARRAY['ACTIVE', 'INACTIVE', 'EXPIRED', 'PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED']));


-- ==========================================
-- Source: 00059_payroll_periods_company.sql
-- ==========================================

-- Migration: 00042_payroll_periods_company
-- Description: Adiciona company_id aos períodos de folha para permitir que cada empresa tenha seus próprios fechamentos.

-- 1. Adiciona a coluna company_id (permitindo null inicialmente para dados antigos)
-- ALTER TABLE public.payroll_periods ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- 2. Limpa os períodos existentes para evitar inconsistências (como estamos em dev/MVP e a folha deve ser por empresa)
-- Obs: Isso vai apagar os holerites calculados, será necessário rodar o motor novamente.
TRUNCATE TABLE public.payroll_periods CASCADE;

-- 3. Torna a coluna NOT NULL após a limpeza
-- ALTER TABLE public.payroll_periods ALTER COLUMN company_id SET NOT NULL;

-- 4. Atualiza a constraint de unicidade para incluir a empresa
-- ALTER TABLE public.payroll_periods DROP CONSTRAINT IF EXISTS payroll_periods_tenant_id_month_year_type_key;

-- Dependendo de como a constraint foi nomeada, pode ser "payroll_periods_tenant_id_competence_month_competence_y_key"
-- Vamos garantir removendo qualquer constraint de unique nas colunas antigas:
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT constraint_name 
              FROM information_schema.table_constraints 
              WHERE table_name = 'payroll_periods' AND constraint_type = 'UNIQUE') 
    LOOP
        EXECUTE '-- ALTER TABLE public.payroll_periods DROP CONSTRAINT ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

-- ALTER TABLE public.payroll_periods ADD CONSTRAINT payroll_periods_tenant_company_month_year_type_key UNIQUE (tenant_id, company_id, month, year, type);

NOTIFY pgrst, 'reload schema';


NOTIFY pgrst, 'reload schema';
