-- ==============================================================================
-- MIGRATION 00089: Adição da coluna status em time_entries e correção de get_employee_today_punches
-- Resolve erro 42703 (column te.status does not exist) no Portal do Colaborador
-- ==============================================================================

-- 1. ADICIONAR COLUNA STATUS EM time_entries COM VALOR PADRÃO
ALTER TABLE public.time_entries 
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'APPROVED';

-- 2. RECRIAR RPC get_employee_today_punches COM SEGURANÇA E COALESCE
CREATE OR REPLACE FUNCTION public.get_employee_today_punches(p_contract_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_punches JSONB;
BEGIN
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', te.id,
                'entry_type', te.entry_type,
                'original_timestamp', te.original_timestamp,
                'status', COALESCE(te.status, 'APPROVED'),
                'punch_record_id', te.punch_record_id,
                'receipt_code', pr.receipt_code,
                'nsr', pr.nsr
            ) ORDER BY te.original_timestamp ASC
        ),
        '[]'::jsonb
    ) INTO v_punches
    FROM public.time_entries te
    LEFT JOIN public.time_punch_records pr ON pr.id = te.punch_record_id
    WHERE te.contract_id = p_contract_id
      AND DATE(te.original_timestamp AT TIME ZONE 'America/Sao_Paulo') = DATE(NOW() AT TIME ZONE 'America/Sao_Paulo');

    RETURN v_punches;
END;
$$;

-- 3. PERMISSÕES DE EXECUÇÃO
GRANT EXECUTE ON FUNCTION public.get_employee_today_punches(UUID) TO anon, authenticated, service_role;

-- 4. RECARREGAR SCHEMA CACHE DO POSTGREST
NOTIFY pgrst, 'reload schema';
