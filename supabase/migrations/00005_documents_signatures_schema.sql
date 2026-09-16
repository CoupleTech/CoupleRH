-- Migration: 00005_documents_signatures_schema
-- Description: Motor de Templates de Documentos, GED Assinável e Trilha de Assinaturas (Validade Jurídica)

-- 1. Templates de Documentos
-- Armazena os modelos de contratos (ex: {{nome_funcionario}}, {{salario}})
CREATE TABLE public.document_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    content_body TEXT NOT NULL, -- HTML ou texto puro com chaves de substituição
    category TEXT NOT NULL CHECK (category IN ('CONTRACT', 'POLICY', 'AGREEMENT', 'OTHER')),
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 2. Documentos do Colaborador (O Cofre)
-- Quando um template vira um documento final e fica pendente de assinatura
CREATE TABLE public.employee_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
    document_template_id UUID REFERENCES public.document_templates(id) ON DELETE SET NULL,
    
    title TEXT NOT NULL,
    document_hash TEXT, -- Hash SHA-256 do arquivo final gerado (garantia contra adulteração)
    file_url TEXT, -- Link pro PDF estático gerado (Supabase Storage)
    
    status TEXT NOT NULL DEFAULT 'PENDING_SIGNATURE' CHECK (status IN ('PENDING_SIGNATURE', 'PARTIALLY_SIGNED', 'SIGNED', 'CANCELED')),
    requires_employee_signature BOOLEAN NOT NULL DEFAULT true,
    requires_employer_signature BOOLEAN NOT NULL DEFAULT false,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 3. Trilha de Assinaturas (Evidências de Validade Jurídica)
CREATE TABLE public.signatures_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    employee_document_id UUID NOT NULL REFERENCES public.employee_documents(id) ON DELETE CASCADE,
    
    signer_user_id UUID NOT NULL, -- Quem assinou (auth.uid())
    signer_role TEXT NOT NULL CHECK (signer_role IN ('EMPLOYEE', 'EMPLOYER', 'WITNESS')),
    
    ip_address TEXT NOT NULL,
    user_agent TEXT NOT NULL,
    signature_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    document_hash_at_signing TEXT NOT NULL, -- O hash do documento no exato momento da assinatura
    
    UNIQUE(employee_document_id, signer_user_id) -- Não permite assinar duas vezes o mesmo arquivo
);

-- RLS
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signatures_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view templates in their tenants" ON public.document_templates FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Users can view employee documents in their tenants" ON public.employee_documents FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));
CREATE POLICY "Users can view signature logs in their tenants" ON public.signatures_log FOR SELECT USING (tenant_id = ANY (public.user_tenant_ids()));

-- Políticas de Gerenciamento para DP e Admins
CREATE POLICY "Tenant Admins and DP can manage templates" 
    ON public.document_templates FOR ALL USING (
        tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = document_templates.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
    );

CREATE POLICY "Tenant Admins and DP can manage employee documents" 
    ON public.employee_documents FOR ALL USING (
        tenant_id = ANY (public.user_tenant_ids()) AND EXISTS (SELECT 1 FROM public.tenant_users WHERE user_id = auth.uid() AND tenant_id = employee_documents.tenant_id AND role IN ('system_admin', 'tenant_admin', 'dp_analyst'))
    );

CREATE POLICY "System generates signature logs" 
    ON public.signatures_log FOR INSERT WITH CHECK (
        tenant_id = ANY (public.user_tenant_ids())
    );
-- Nota: signatures_log NÃO PODE receber UPDATE ou DELETE por ninguém, garantindo a trilha imutável. (Ausência de policies de Update/Delete faz isso)

-- Triggers de Auditoria
CREATE TRIGGER audit_templates_trigger AFTER INSERT OR UPDATE OR DELETE ON public.document_templates FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
CREATE TRIGGER audit_employee_docs_trigger AFTER INSERT OR UPDATE OR DELETE ON public.employee_documents FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
-- Não criamos trigger de auditoria para signatures_log pois ela própria já é um log imutável de sistema.
