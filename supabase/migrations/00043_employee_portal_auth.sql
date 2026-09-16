-- Migration: 00043_employee_portal_auth
-- Description: Criação da função de autenticação (RPC) para o Portal do Colaborador (CPF e Data de Nascimento)

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

-- Grant permissions for authenticated and anonymous users to call the auth function
GRANT EXECUTE ON FUNCTION public.authenticate_employee(TEXT, TEXT) TO authenticated, anon;
