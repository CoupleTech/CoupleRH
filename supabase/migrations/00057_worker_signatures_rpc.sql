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
