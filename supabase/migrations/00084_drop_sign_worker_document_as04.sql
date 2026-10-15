-- Migration: 00084_drop_sign_worker_document_as04.sql
-- FASE P6 / AS-04: Remoção definitiva da RPC legada e vulnerável sign_worker_document
-- Referência: DOCUMENTO_MELHORIAS_PRODUCAO_COUPLERH.md §8.2 e fase.md

DO $$
BEGIN
    -- Remove assinatura legada de 5 parâmetros
    DROP FUNCTION IF EXISTS public.sign_worker_document(UUID, UUID, TEXT, TEXT, TEXT);

    -- Remove assinatura legada de 2 parâmetros
    DROP FUNCTION IF EXISTS public.sign_worker_document(UUID, UUID);
END $$;

NOTIFY pgrst, 'reload schema';
