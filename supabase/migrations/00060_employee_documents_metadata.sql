-- Migration: 00060_employee_documents_metadata
-- Description: Adiciona colunas para renderização dinâmica (Paperless) e atualiza RPC de assinatura para validade legal (IP, Hash)

-- 1. Adicionar metadata e tipo em employee_documents
ALTER TABLE public.employee_documents
ADD COLUMN IF NOT EXISTS document_type TEXT, -- ex: 'VACATION_NOTICE', 'VACATION_RECEIPT', 'TRCT'
ADD COLUMN IF NOT EXISTS metadata JSONB; -- Guarda parâmetros para renderizar dinamicamente

-- 2. Atualizar a RPC de listagem de assinaturas para retornar o documento dinâmico (Paperless)
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
            'document_type', ed.document_type,
            'metadata', ed.metadata,
            'created_at', ed.created_at
        ) ORDER BY ed.created_at DESC
    ) INTO v_result
    FROM public.employee_documents ed
    WHERE ed.worker_id = p_worker_id;

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql;

-- 3. Atualizar a RPC de assinatura para logar evidências com validade jurídica
DROP FUNCTION IF EXISTS public.sign_worker_document(UUID, UUID);

CREATE OR REPLACE FUNCTION public.sign_worker_document(
    p_document_id UUID,
    p_worker_id UUID,
    p_ip_address TEXT,
    p_user_agent TEXT,
    p_document_hash TEXT
)
RETURNS BOOLEAN
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id UUID;
    v_status TEXT;
    v_signer_user_id UUID;
BEGIN
    -- Pegar o tenant_id e status atual do documento
    SELECT tenant_id, status INTO v_tenant_id, v_status
    FROM public.employee_documents
    WHERE id = p_document_id AND worker_id = p_worker_id;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Document not found or does not belong to worker';
    END IF;

    IF v_status = 'SIGNED' THEN
        RAISE EXCEPTION 'Document is already signed';
    END IF;

    -- Obter o ID do usuário que está chamando a RPC (O trabalhador logado)
    v_signer_user_id := auth.uid();
    IF v_signer_user_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    -- Registrar o log de assinatura imutável
    INSERT INTO public.signatures_log (
        tenant_id,
        employee_document_id,
        signer_user_id,
        signer_role,
        ip_address,
        user_agent,
        document_hash_at_signing
    ) VALUES (
        v_tenant_id,
        p_document_id,
        v_signer_user_id,
        'EMPLOYEE',
        p_ip_address,
        p_user_agent,
        p_document_hash
    );

    -- Atualizar o status do documento para assinado e salvar o hash
    UPDATE public.employee_documents
    SET status = 'SIGNED',
        document_hash = p_document_hash,
        updated_at = NOW()
    WHERE id = p_document_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Garantir acesso
GRANT EXECUTE ON FUNCTION public.sign_worker_document(UUID, UUID, TEXT, TEXT, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
