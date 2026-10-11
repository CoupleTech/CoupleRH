-- Migration 00067_revoke_sign_worker_document.sql
-- FASE P0 / TAREFA T27 (provisório): Revogar execução da RPC sign_worker_document para anon/authenticated
-- Bloqueador de Segurança B7: Impedir assinatura fraca/insegura até a implantação do fluxo seguro AS-04 (Fase P6)

-- 1. Revogar permissão de execução de sign_worker_document para anon, authenticated e public
DO $$
BEGIN
    -- Revoga a assinatura com 5 parâmetros (se existir)
    IF EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
          AND p.proname = 'sign_worker_document' 
          AND pronargs = 5
    ) THEN
        EXECUTE 'REVOKE EXECUTE ON FUNCTION public.sign_worker_document(UUID, UUID, TEXT, TEXT, TEXT) FROM anon, authenticated, public;';
    END IF;

    -- Revoga a assinatura legada com 2 parâmetros (se existir)
    IF EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
          AND p.proname = 'sign_worker_document' 
          AND pronargs = 2
    ) THEN
        EXECUTE 'REVOKE EXECUTE ON FUNCTION public.sign_worker_document(UUID, UUID) FROM anon, authenticated, public;';
    END IF;
END $$;

-- 2. Atualizar comentário explicativo para registro de auditoria
COMMENT ON FUNCTION public.sign_worker_document(UUID, UUID, TEXT, TEXT, TEXT) IS 'RPC legada de assinatura. Execução revogada em produção (T27) por motivos de segurança até a implantação da Edge Function sign-document com rubrica na tela e manifesto (Fase P6 / AS-04).';

NOTIFY pgrst, 'reload schema';
