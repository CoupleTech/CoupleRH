-- Migration: 00064_fix_employee_benefits_rpc
-- Description: Corrige a view de benefícios no Portal do Colaborador para usar o schema correto.

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
            'card_number', NULL, -- eb.card_number was dropped in schema
            'dependent_count', 0, -- eb.dependent_count was dropped in schema
            'status', CASE WHEN eb.opt_in THEN 'ACTIVE' ELSE 'INACTIVE' END
        ) ORDER BY bc.name
    ) INTO v_result
    FROM public.employee_benefits eb
    JOIN public.benefit_catalogs bc ON bc.id = eb.benefit_catalog_id
    WHERE eb.contract_id IN (
        SELECT id FROM public.employment_contracts WHERE worker_id = p_worker_id AND status = 'ACTIVE'
    )
    AND eb.opt_in = true;

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_employee_benefits(UUID) TO anon, authenticated;
