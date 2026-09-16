-- Migration: 00004_onboarding_schema
-- Description: Máquina de estados para Admissão e Gestão de Documentos (GED)

-- 1. Processos de Onboarding (Máquina de Estados)
CREATE TABLE public.onboarding_processes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
    
    -- Dados preenchidos gradativamente
    candidate_name TEXT NOT NULL,
    candidate_cpf TEXT,
    candidate_email TEXT,
    
    -- Cargo e Departamento previstos
    department_id UUID REFERENCES public.departments(id),
    position_id UUID REFERENCES public.positions(id),
    proposed_salary NUMERIC(10,2),
    
    -- Estado da Admissão
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PENDING_DOCS', 'PENDING_ASO', 'DP_REVIEW', 'ESOCIAL_READY', 'CONCLUDED', 'CANCELLED')),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 2. Documentos de Admissão (GED)
CREATE TABLE public.onboarding_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    onboarding_process_id UUID NOT NULL REFERENCES public.onboarding_processes(id) ON DELETE CASCADE,
    
    document_type TEXT NOT NULL CHECK (document_type IN ('RG', 'CPF', 'COMPROVANTE_RESIDENCIA', 'TITULO_ELEITOR', 'ASO', 'OUTROS')),
    file_url TEXT NOT NULL, -- Referência no Storage do Supabase
    is_verified BOOLEAN DEFAULT false, -- RH marcou como válido
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Dependentes (Será ligado à pessoa após a efetivação, ou coletado aqui temporariamente)
CREATE TABLE public.dependents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    onboarding_process_id UUID REFERENCES public.onboarding_processes(id) ON DELETE CASCADE,
    person_id UUID REFERENCES public.people(id) ON DELETE CASCADE,
    
    full_name TEXT NOT NULL,
    cpf TEXT,
    birth_date DATE NOT NULL,
    relationship TEXT NOT NULL CHECK (relationship IN ('SPOUSE', 'CHILD', 'PARENT', 'OTHER')),
    is_irrf_dependent BOOLEAN DEFAULT false,
    is_family_allowance_dependent BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT check_parent_link CHECK (
        (onboarding_process_id IS NOT NULL AND person_id IS NULL) OR 
        (onboarding_process_id IS NULL AND person_id IS NOT NULL)
    )
);

-- RLS
ALTER TABLE public.onboarding_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dependents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view onboarding in their tenants" 
    ON public.onboarding_processes FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view onboarding docs in their tenants" 
    ON public.onboarding_documents FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

CREATE POLICY "Users can view dependents in their tenants" 
    ON public.dependents FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

-- Políticas de Gerenciamento para DP e Admins
CREATE POLICY "Tenant Admins and DP can manage onboarding" 
    ON public.onboarding_processes FOR ALL USING (
        tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = onboarding_processes.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
    );

CREATE POLICY "Tenant Admins and DP can manage onboarding docs" 
    ON public.onboarding_documents FOR ALL USING (
        tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = onboarding_documents.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
    );

CREATE POLICY "Tenant Admins and DP can manage dependents" 
    ON public.dependents FOR ALL USING (
        tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = dependents.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
    );

-- Triggers de Auditoria
CREATE TRIGGER audit_onboarding_processes_trigger AFTER INSERT OR UPDATE OR DELETE ON public.onboarding_processes FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_onboarding_documents_trigger AFTER INSERT OR UPDATE OR DELETE ON public.onboarding_documents FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_dependents_trigger AFTER INSERT OR UPDATE OR DELETE ON public.dependents FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
