-- ==============================================================================
-- MIGRATION 00088: Sincronização de colunas de employee_documents e auditoria de assinaturas
-- Garante compatibilidade total entre colunas legadas e novas do cofre de assinaturas
-- ==============================================================================

-- 1. ADICIONAR COLUNAS FALTANTES EM employee_documents
ALTER TABLE public.employee_documents 
    ADD COLUMN IF NOT EXISTS doc_type TEXT DEFAULT 'OTHER',
    ADD COLUMN IF NOT EXISTS verification_code TEXT,
    ADD COLUMN IF NOT EXISTS hash_original TEXT,
    ADD COLUMN IF NOT EXISTS hash_signed TEXT,
    ADD COLUMN IF NOT EXISTS signed_file_url TEXT,
    ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- 2. BACKFILL DE DADOS A PARTIR DE COLUNAS LEGADAS
UPDATE public.employee_documents
SET 
    doc_type = COALESCE(doc_type, document_type, 'OTHER'),
    hash_original = COALESCE(hash_original, document_hash),
    signed_file_url = COALESCE(signed_file_url, file_url)
WHERE doc_type IS NULL OR hash_original IS NULL OR signed_file_url IS NULL;

-- 3. GERAR CÓDIGO DE VERIFICAÇÃO PARA DOCUMENTOS QUE AINDA NÃO POSSUEM
UPDATE public.employee_documents
SET verification_code = 'CRH-' || UPPER(SUBSTRING(MD5(id::text || COALESCE(created_at::text, 'seed')) FROM 1 FOR 4)) || '-' || UPPER(SUBSTRING(MD5(id::text || COALESCE(created_at::text, 'seed')) FROM 5 FOR 4))
WHERE verification_code IS NULL;

-- 4. ÍNDICES DE PERFORMANCE E UNICIDADE
CREATE INDEX IF NOT EXISTS idx_employee_documents_doc_type 
    ON public.employee_documents(doc_type);

CREATE INDEX IF NOT EXISTS idx_employee_documents_verification_code 
    ON public.employee_documents(verification_code);

-- 5. CRIAR TABELA DE AUDITORIA DE EVENTOS DE DOCUMENTOS (SE NÃO EXISTIR)
CREATE TABLE IF NOT EXISTS public.document_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    document_id UUID REFERENCES public.employee_documents(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    actor_id UUID,
    ip_address TEXT,
    user_agent TEXT,
    geolocation JSONB,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS em document_events
ALTER TABLE public.document_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_document_events_document_id 
    ON public.document_events(document_id);

CREATE INDEX IF NOT EXISTS idx_document_events_tenant_id 
    ON public.document_events(tenant_id);

-- Políticas RLS permissivas baseadas em tenant
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'document_events' AND policyname = 'tenant_isolation_document_events'
    ) THEN
        CREATE POLICY tenant_isolation_document_events ON public.document_events
            FOR ALL
            USING (tenant_id = auth.jwt() ->> 'tenant_id' OR auth.role() = 'service_role')
            WITH CHECK (tenant_id = auth.jwt() ->> 'tenant_id' OR auth.role() = 'service_role');
    END IF;
END $$;

-- 6. RECARREGAR O SCHEMA CACHE DO POSTGREST
NOTIFY pgrst, 'reload schema';
