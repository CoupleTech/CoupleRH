-- Migration: 00052_employee_portal_profile_rpc
-- Description: RPC para o Portal do Colaborador acessar seus dados de perfil, benefícios e contrato

-- 1. Dados completos do perfil do colaborador
CREATE OR REPLACE FUNCTION public.get_employee_profile(p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_build_object(
        -- Dados pessoais
        'full_name', p.full_name,
        'social_name', p.social_name,
        'cpf', p.cpf,
        'birth_date', p.birth_date,
        'gender', p.gender,
        'email', p.email,
        'phone', p.phone,
        'mobile', p.mobile,
        -- Endereço
        'address', json_build_object(
            'zip_code', p.zip_code,
            'street', p.street,
            'number', p.number,
            'complement', p.complement,
            'neighborhood', p.neighborhood,
            'city', p.city,
            'state', p.state,
            'country', p.country
        ),
        -- Contato de emergência
        'emergency_contact', json_build_object(
            'name', p.emergency_contact_name,
            'phone', p.emergency_contact_phone,
            'relation', p.emergency_contact_relation
        ),
        -- Dados bancários
        'bank', json_build_object(
            'bank_name', w.bank_name,
            'agency', w.agency,
            'account_number', w.account_number,
            'account_digit', w.account_digit,
            'account_type', w.account_type,
            'pix_key', w.pix_key,
            'pix_type', w.pix_type
        ),
        -- Dados do contrato
        'contract', json_build_object(
            'id', ec.id,
            'contract_type', ct.name,
            'contract_category', ct.category,
            'admission_date', ec.admission_date,
            'base_salary', ec.base_salary,
            'status', ec.status,
            'position_title', pos.title,
            'position_cbo', pos.cbo,
            'department_name', dept.name
        )
    ) INTO v_result
    FROM public.workers w
    JOIN public.people p ON p.id = w.person_id
    LEFT JOIN public.employment_contracts ec ON ec.worker_id = w.id AND ec.status = 'ACTIVE'
    LEFT JOIN public.positions pos ON pos.id = ec.position_id
    LEFT JOIN public.departments dept ON dept.id = ec.department_id
    LEFT JOIN public.contract_types ct ON ct.id = ec.contract_type_id
    WHERE w.id = p_worker_id;

    RETURN COALESCE(v_result, '{}'::JSON);
END;
$$ LANGUAGE plpgsql;

-- 2. Benefícios ativos do colaborador
CREATE OR REPLACE FUNCTION public.get_employee_benefits(p_worker_id UUID)
RETURNS JSON
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', eb.id,
            'benefit_name', bc.name,
            'benefit_type', bc.benefit_type,
            'provider_name', bc.provider_name,
            'discount_type', bc.discount_type,
            'discount_value', COALESCE(eb.custom_discount_value, bc.default_discount_value),
            'card_number', eb.card_number,
            'dependent_count', eb.dependent_count,
            'status', eb.status
        ) ORDER BY bc.name
    ) INTO v_result
    FROM public.employee_benefits eb
    JOIN public.benefits_catalog bc ON bc.id = eb.benefit_id
    WHERE eb.contract_id IN (
        SELECT id FROM public.employment_contracts WHERE worker_id = p_worker_id AND status = 'ACTIVE'
    )
    AND eb.status = 'ACTIVE';

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_employee_profile(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_benefits(UUID) TO anon, authenticated;
