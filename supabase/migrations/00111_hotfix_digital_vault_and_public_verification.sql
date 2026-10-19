-- ==============================================================================
-- MIGRATION 00111: Hotfix de Manutenção do Cofre Digital & Verificação Pública
-- Tarefas:
--   1. Expurgo/soft-delete (deleted_at = now()) dos 2 documentos de testes manuais
--      duplicados de 25/09/2026 às 00:05:13 no cofre (employee_documents).
--   2. Criação da RPC segura verify_public_document(p_code TEXT) com SECURITY DEFINER
--      e permissão para a role 'anon', viabilizando a validação pública de autenticidade
--      digital na rota /verificar/:codigo sem bloqueio de RLS e com proteção LGPD.
-- ==============================================================================

-- 1. EXPURGO / SOFT-DELETE DE DOCUMENTOS DUPLICADOS RESIDUAIS
UPDATE public.employee_documents
SET deleted_at = NOW()
WHERE id IN (
    'b2bd30c6-8575-4f26-affc-c0148ec593cf',
    'd254e8a0-48ee-4445-a285-82d1ea47ddfb'
)
AND deleted_at IS NULL;

-- 2. FUNÇÃO RPC PÚBLICA DE VERIFICAÇÃO DE AUTENTICIDADE DIGITAL (COM BYPASS SEGURO DE RLS)
CREATE OR REPLACE FUNCTION public.verify_public_document(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_raw TEXT;
    v_clean TEXT;
    v_clean_no_prefix TEXT;
    v_is_uuid BOOLEAN;
    v_doc RECORD;
    v_result JSONB;
BEGIN
    IF p_code IS NULL OR TRIM(p_code) = '' THEN
        RETURN NULL;
    END IF;

    v_raw := TRIM(p_code);
    v_clean := UPPER(REGEXP_REPLACE(v_raw, '[^0-9a-zA-Z]', '', 'g'));
    
    IF v_clean LIKE 'CRH%' AND LENGTH(v_clean) > 3 THEN
        v_clean_no_prefix := SUBSTRING(v_clean FROM 4);
    ELSE
        v_clean_no_prefix := v_clean;
    END IF;

    v_is_uuid := v_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

    -- Buscar documento ativo no cofre (deleted_at IS NULL)
    SELECT 
        d.id,
        d.title,
        COALESCE(d.doc_type, d.document_type, 'OTHER') AS doc_type,
        d.status,
        COALESCE(d.verification_code, 'CRH-' || UPPER(SUBSTRING(d.id::text FROM 1 FOR 4)) || '-' || UPPER(SUBSTRING(d.id::text FROM 5 FOR 4))) AS verification_code,
        COALESCE(d.hash_original, d.document_hash) AS hash_original,
        d.hash_signed,
        d.signed_at,
        d.created_at,
        d.signed_file_url,
        p.full_name AS person_name,
        p.cpf AS person_cpf,
        c.corporate_name AS company_name,
        c.cnpj AS company_cnpj
    INTO v_doc
    FROM public.employee_documents d
    LEFT JOIN public.workers w ON w.id = d.worker_id
    LEFT JOIN public.people p ON p.id = w.person_id
    LEFT JOIN public.companies c ON c.id = w.company_id
    WHERE d.deleted_at IS NULL
      AND (
          -- Caso 1: Busca por UUID completo
          (v_is_uuid AND d.id = v_raw::uuid)
          -- Caso 2: Busca por verification_code exato ou normalizado
          OR (d.verification_code IS NOT NULL AND (
              d.verification_code ILIKE v_raw
              OR UPPER(REGEXP_REPLACE(d.verification_code, '[^0-9a-zA-Z]', '', 'g')) = v_clean
              OR UPPER(REGEXP_REPLACE(d.verification_code, '[^0-9a-zA-Z]', '', 'g')) = ('CRH' || v_clean_no_prefix)
              OR UPPER(REGEXP_REPLACE(d.verification_code, '[^0-9a-zA-Z]', '', 'g')) = v_clean_no_prefix
          ))
          -- Caso 3: Busca pelo prefixo do UUID (ex: CRH-B2BD-30C6 -> b2bd30c6%)
          OR (LENGTH(v_clean_no_prefix) >= 8 AND d.id::text ILIKE (LOWER(v_clean_no_prefix) || '%'))
          OR (LENGTH(v_clean) >= 8 AND d.id::text ILIKE (LOWER(v_clean) || '%'))
      )
    ORDER BY d.created_at DESC
    LIMIT 1;

    IF v_doc.id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Montar JSONB de resposta com dados públicos e mascaramento LGPD
    v_result := jsonb_build_object(
        'id', v_doc.id,
        'title', v_doc.title,
        'doc_type', v_doc.doc_type,
        'status', v_doc.status,
        'verification_code', v_doc.verification_code,
        'hash_original', v_doc.hash_original,
        'hash_signed', v_doc.hash_signed,
        'signed_at', v_doc.signed_at,
        'created_at', v_doc.created_at,
        'signed_file_url', v_doc.signed_file_url,
        'workers', jsonb_build_object(
            'people', jsonb_build_object(
                'full_name', CASE 
                    WHEN v_doc.person_name IS NULL THEN 'Colaborador'
                    WHEN array_length(string_to_array(trim(v_doc.person_name), ' '), 1) > 1 THEN
                        split_part(trim(v_doc.person_name), ' ', 1) || ' ' || left(split_part(trim(v_doc.person_name), ' ', 2), 1) || '. ***'
                    ELSE
                        left(trim(v_doc.person_name), 3) || '***'
                END,
                'cpf', '***.***.***-**'
            ),
            'companies', jsonb_build_object(
                'corporate_name', COALESCE(v_doc.company_name, 'Empresa Empregadora'),
                'cnpj', COALESCE(v_doc.company_cnpj, '—')
            )
        )
    );

    RETURN v_result;
END;
$$;

-- 3. PERMISSÕES PÚBLICAS
GRANT EXECUTE ON FUNCTION public.verify_public_document(TEXT) TO anon, authenticated, service_role;

-- 4. RECARREGAR O SCHEMA CACHE DO POSTGREST
NOTIFY pgrst, 'reload schema';
