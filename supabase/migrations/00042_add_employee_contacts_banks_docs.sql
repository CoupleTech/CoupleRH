-- Migration: 00042_add_employee_contacts_banks_docs
-- Description: Adiciona campos de contato à pessoa, dados bancários ao trabalhador e cria tabela de documentos pessoais

-- 1. Contatos na tabela people
ALTER TABLE public.people
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS corporate_email TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS mobile TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_relation TEXT;

-- 2. Dados bancários na tabela workers (Vínculo da pessoa com a empresa)
ALTER TABLE public.workers
ADD COLUMN IF NOT EXISTS bank_code TEXT,
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
CREATE TRIGGER audit_worker_personal_documents_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.worker_personal_documents
FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
