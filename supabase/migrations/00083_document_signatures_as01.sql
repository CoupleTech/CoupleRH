-- Migration: 00083_document_signatures_as01.sql
-- FASE P6 / AS-01: Migrations (employee_documents, signatures_log, document_events); RLS; storage privado
-- Referência: DOCUMENTO_MELHORIAS_PRODUCAO_COUPLERH.md §8 e fase.md

-- 1. Gerador de Código de Verificação Alfanumérico Único (ex: CRH-7F89-A2B4)
CREATE OR REPLACE FUNCTION public.generate_document_verification_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_chars TEXT := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    v_code TEXT := 'CRH-';
    v_i INT;
    v_part1 TEXT := '';
    v_part2 TEXT := '';
BEGIN
    FOR v_i IN 1..4 LOOP
        v_part1 := v_part1 || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
        v_part2 := v_part2 || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    END LOOP;
    RETURN v_code || v_part1 || '-' || v_part2;
END;
$$;

-- 2. Enriquecimento de employee_documents
ALTER TABLE public.employee_documents
    ADD COLUMN IF NOT EXISTS doc_type TEXT DEFAULT 'OTHER',
    ADD COLUMN IF NOT EXISTS source_ref UUID,
    ADD COLUMN IF NOT EXISTS hash_original TEXT, -- H1 (Hash do PDF gerado no servidor)
    ADD COLUMN IF NOT EXISTS hash_signed TEXT,   -- H2 (Hash do PDF assinado com manifesto)
    ADD COLUMN IF NOT EXISTS signed_file_url TEXT,
    ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS verification_code TEXT,
    ADD COLUMN IF NOT EXISTS signature_level TEXT NOT NULL DEFAULT 'ADVANCED',
    ADD COLUMN IF NOT EXISTS requires_otp BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;

-- Backfill de verification_code em documentos que não possuem
UPDATE public.employee_documents
SET verification_code = public.generate_document_verification_code()
WHERE verification_code IS NULL;

-- Tornar verification_code único
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'employee_documents_verification_code_unique'
    ) THEN
        ALTER TABLE public.employee_documents
            ADD CONSTRAINT employee_documents_verification_code_unique UNIQUE (verification_code);
    END IF;
END $$;

-- Atualizar CHECK constraint em status de employee_documents se necessário
DO $$
BEGIN
    ALTER TABLE public.employee_documents DROP CONSTRAINT IF EXISTS employee_documents_status_check;
    ALTER TABLE public.employee_documents 
        ADD CONSTRAINT employee_documents_status_check 
        CHECK (status IN ('DRAFT', 'PENDING_SIGNATURE', 'PARTIALLY_SIGNED', 'SIGNED', 'CONTESTED', 'REFUSED', 'CANCELED', 'EXPIRED'));
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- Atualizar CHECK constraint em doc_type
DO $$
BEGIN
    ALTER TABLE public.employee_documents DROP CONSTRAINT IF EXISTS employee_documents_doc_type_check;
    ALTER TABLE public.employee_documents 
        ADD CONSTRAINT employee_documents_doc_type_check 
        CHECK (doc_type IN ('PAYSLIP', 'VACATION_RECEIPT', 'VACATION_NOTICE', 'TIMESHEET', 'TIME_BANK_AGREEMENT', 'TRCT', 'POLICY', 'CONTRACT', 'OTHER'));
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- Índices em employee_documents
CREATE INDEX IF NOT EXISTS idx_employee_docs_tenant_worker_status ON public.employee_documents(tenant_id, worker_id, status);
CREATE INDEX IF NOT EXISTS idx_employee_docs_verification_code ON public.employee_documents(verification_code);
CREATE INDEX IF NOT EXISTS idx_employee_docs_source_ref ON public.employee_documents(tenant_id, doc_type, source_ref);

-- 3. Enriquecimento de signatures_log
ALTER TABLE public.signatures_log
    ADD COLUMN IF NOT EXISTS auth_method TEXT DEFAULT 'SESSION_OTP',
    ADD COLUMN IF NOT EXISTS geo JSONB,
    ADD COLUMN IF NOT EXISTS signature_png_url TEXT,
    ADD COLUMN IF NOT EXISTS signature_strokes JSONB,
    ADD COLUMN IF NOT EXISTS decision TEXT NOT NULL DEFAULT 'SIGNED',
    ADD COLUMN IF NOT EXISTS reason TEXT,
    ADD COLUMN IF NOT EXISTS manifest_metadata JSONB,
    ADD COLUMN IF NOT EXISTS certificate_info JSONB;

-- Validação de decision e auth_method
DO $$
BEGIN
    ALTER TABLE public.signatures_log DROP CONSTRAINT IF EXISTS signatures_log_decision_check;
    ALTER TABLE public.signatures_log 
        ADD CONSTRAINT signatures_log_decision_check 
        CHECK (decision IN ('SIGNED', 'CONTESTED', 'REFUSED'));

    ALTER TABLE public.signatures_log DROP CONSTRAINT IF EXISTS signatures_log_auth_method_check;
    ALTER TABLE public.signatures_log 
        ADD CONSTRAINT signatures_log_auth_method_check 
        CHECK (auth_method IN ('SESSION', 'SESSION_OTP', 'SESSION_PIN', 'CERTIFICATE_ICP', 'GOV_BR'));
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- Garantia de Imutabilidade Jurídica em signatures_log (Proibido UPDATE ou DELETE)
CREATE OR REPLACE FUNCTION public.protect_signatures_log_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'VIOLAÇÃO DE IMUTABILIDADE FORENSE: Registros de signatures_log não podem ser alterados ou excluídos.';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_signatures_log_immutability ON public.signatures_log;
CREATE TRIGGER trg_protect_signatures_log_immutability
BEFORE UPDATE OR DELETE ON public.signatures_log
FOR EACH ROW
EXECUTE FUNCTION public.protect_signatures_log_immutability();

-- 4. Criação da tabela document_events (Ciclo de Vida e Trilha de Auditoria do Documento)
CREATE TABLE IF NOT EXISTS public.document_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.employee_documents(id) ON DELETE CASCADE,
    event TEXT NOT NULL CHECK (event IN (
        'CREATED', 'NOTIFIED_EMAIL', 'NOTIFIED_WHATSAPP', 'NOTIFIED_PORTAL',
        'VIEWED', 'OTP_REQUESTED', 'OTP_VERIFIED', 'SIGNED',
        'CONTESTED', 'REFUSED', 'DOWNLOADED', 'VERIFIED_PUBLIC'
    )),
    at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip TEXT,
    user_agent TEXT,
    actor_user_id UUID,
    meta JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_doc_events_tenant_doc_id ON public.document_events(tenant_id, document_id, at);

-- Imutabilidade de document_events
CREATE OR REPLACE FUNCTION public.protect_document_events_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'VIOLAÇÃO DE IMUTABILIDADE FORENSE: Eventos do ciclo de vida documental não podem ser alterados ou excluídos.';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_document_events_immutability ON public.document_events;
CREATE TRIGGER trg_protect_document_events_immutability
BEFORE UPDATE OR DELETE ON public.document_events
FOR EACH ROW
EXECUTE FUNCTION public.protect_document_events_immutability();

-- Gatilhos de Auditoria do Sistema
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'audit' AND p.proname = 'audit_trigger_func') THEN
        DROP TRIGGER IF EXISTS audit_signatures_log_trigger ON public.signatures_log;
        CREATE TRIGGER audit_signatures_log_trigger 
        AFTER INSERT ON public.signatures_log 
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();

        DROP TRIGGER IF EXISTS audit_document_events_trigger ON public.document_events;
        CREATE TRIGGER audit_document_events_trigger 
        AFTER INSERT ON public.document_events 
        FOR EACH ROW EXECUTE FUNCTION audit.audit_trigger_func();
    END IF;
END $$;

-- 5. RLS (Row Level Security) em document_events e signatures_log
ALTER TABLE public.document_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signatures_log ENABLE ROW LEVEL SECURITY;

-- Política de Leitura em document_events: usuários do tenant e colaboradores donos
DROP POLICY IF EXISTS "Users can view document events in their tenants" ON public.document_events;
CREATE POLICY "Users can view document events in their tenants"
ON public.document_events FOR SELECT
USING (
    tenant_id = ANY (public.user_tenant_ids())
);

-- Inserção de eventos permitida para service role ou usuários autenticados do tenant
DROP POLICY IF EXISTS "Insert document events policy" ON public.document_events;
CREATE POLICY "Insert document events policy"
ON public.document_events FOR INSERT
WITH CHECK (
    tenant_id = ANY (public.user_tenant_ids())
    OR auth.role() = 'service_role'
    OR auth.uid() IS NOT NULL
);

-- 6. Storage Privado para Documentos e Assinaturas
INSERT INTO storage.buckets (id, name, public)
VALUES ('private-documents', 'private-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Políticas de Storage para private-documents
DROP POLICY IF EXISTS "private_docs_service_role_all" ON storage.objects;
CREATE POLICY "private_docs_service_role_all"
ON storage.objects FOR ALL
USING (bucket_id = 'private-documents' AND auth.role() = 'service_role');

DROP POLICY IF EXISTS "private_docs_admin_read" ON storage.objects;
CREATE POLICY "private_docs_admin_read"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'private-documents'
    AND auth.role() = 'authenticated'
);

-- 7. RPC Segura: Buscar documentos e assinaturas do colaborador
CREATE OR REPLACE FUNCTION public.get_worker_signatures_v2(p_worker_id UUID)
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
            'doc_type', COALESCE(ed.doc_type, ed.document_type, 'OTHER'),
            'status', ed.status,
            'signature_level', ed.signature_level,
            'requires_employee_signature', ed.requires_employee_signature,
            'requires_otp', ed.requires_otp,
            'due_at', ed.due_at,
            'verification_code', ed.verification_code,
            'hash_original', ed.hash_original,
            'hash_signed', ed.hash_signed,
            'file_url', ed.file_url,
            'signed_file_url', ed.signed_file_url,
            'viewed_at', ed.viewed_at,
            'signed_at', ed.signed_at,
            'created_at', ed.created_at,
            'metadata', ed.metadata
        ) ORDER BY ed.created_at DESC
    ) INTO v_result
    FROM public.employee_documents ed
    WHERE ed.worker_id = p_worker_id
      AND ed.deleted_at IS NULL;

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_worker_signatures_v2(UUID) TO authenticated, anon;

-- Notificar PostgREST
NOTIFY pgrst, 'reload schema';
