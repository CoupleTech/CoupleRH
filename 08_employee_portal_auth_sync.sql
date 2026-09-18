-- ============================================================================
-- SCRIPT: 08_employee_portal_auth_sync.sql
-- DESCRIÇÃO: Sincroniza a função de autenticação do Portal do Colaborador 
--            que estava faltando no banco de produção.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.authenticate_employee(p_cpf TEXT, p_birth_date TEXT)
RETURNS TABLE (
    worker_id UUID,
    person_id UUID,
    company_id UUID,
    tenant_id UUID,
    full_name TEXT
)
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        w.id as worker_id,
        p.id as person_id,
        w.company_id,
        w.tenant_id,
        p.full_name
    FROM public.people p
    JOIN public.workers w ON w.person_id = p.id
    WHERE 
        -- Remove formatação do CPF, se houver
        REGEXP_REPLACE(p.cpf, '[^0-9]', '', 'g') = REGEXP_REPLACE(p_cpf, '[^0-9]', '', 'g')
        -- Compara a data formatada DDMMAAAA com a data de nascimento no banco
        AND to_char(p.birth_date, 'DDMMYYYY') = p_birth_date
        -- Apenas trabalhadores ativos
        AND w.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Garante que o Supabase permita a execução dessa função pelo frontend
GRANT EXECUTE ON FUNCTION public.authenticate_employee(TEXT, TEXT) TO authenticated, anon;

-- Atualiza cache
NOTIFY pgrst, 'reload schema';
