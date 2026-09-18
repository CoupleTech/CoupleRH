-- =========================================================================================
-- SCRIPT DE INSERÇÃO DE RUBRICAS DE ADIANTAMENTO (Fase 33 - Hotfix)
-- Este script insere as rubricas 250 (Adiantamento Quinzenal) e 850 (Desconto de Adiantamento)
-- para todos os tenants existentes.
-- =========================================================================================

DO $$
DECLARE
    tenant RECORD;
BEGIN
    FOR tenant IN SELECT id FROM public.tenants
    LOOP
        -- Insere a Rubrica de Adiantamento Quinzenal (Provento)
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, rubric_type, category, 
            calculation_type, calculation_base, calculation_order, 
            generates_base_inss, generates_base_irrf, generates_base_fgts, esocial_code
        )
        VALUES (
            tenant.id, '250', 'Adiantamento Quinzenal', 'EARNING', 'EARNING', 'ADVANCE', 
            'FIXED', 'SALARIO_BASE', 15, 
            false, false, true, '5504' -- Incide FGTS (eSocial 5504)
        )
        ON CONFLICT (tenant_id, code) DO UPDATE SET 
            name = EXCLUDED.name,
            category = EXCLUDED.category,
            generates_base_inss = EXCLUDED.generates_base_inss,
            generates_base_irrf = EXCLUDED.generates_base_irrf,
            generates_base_fgts = EXCLUDED.generates_base_fgts;

        -- Insere a Rubrica de Desconto de Adiantamento (Desconto)
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, rubric_type, category, 
            calculation_type, calculation_base, calculation_order, 
            generates_base_inss, generates_base_irrf, generates_base_fgts, esocial_code
        )
        VALUES (
            tenant.id, '850', 'Desconto de Adiantamento', 'DEDUCTION', 'DEDUCTION', 'ADVANCE', 
            'FIXED', NULL, 85, 
            false, false, false, '9214' -- Não incide impostos (eSocial 9214)
        )
        ON CONFLICT (tenant_id, code) DO UPDATE SET 
            name = EXCLUDED.name,
            category = EXCLUDED.category,
            generates_base_inss = EXCLUDED.generates_base_inss,
            generates_base_irrf = EXCLUDED.generates_base_irrf,
            generates_base_fgts = EXCLUDED.generates_base_fgts;
            
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
