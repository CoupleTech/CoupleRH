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
