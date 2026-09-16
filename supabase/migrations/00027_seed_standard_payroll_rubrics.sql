-- Migration: 00027_seed_standard_payroll_rubrics
-- Description: Saneamento do banco e injeção de rubricas oficiais para funcionamento pleno do Motor.

DO $$ 
DECLARE
    tenant RECORD;
    v_rubric_vt UUID;
    v_rubric_vr UUID;
BEGIN
    FOR tenant IN SELECT id FROM public.tenants LOOP
        
        -- 1. SALÁRIO BASE (Cód 101)
        -- Apaga qualquer lixo criado manualmente para Salário Base
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND (code = '101' OR name ILIKE 'Salário Base');
        
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '101', 'Salário Base', 'EARNING', 'SALARY', 'FIXED', 'FIXO', 'SALARIO_BASE', 
            true, true, true, true, true, true
        );

        -- 2. INSS AUTOMÁTICO (Cód 901)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND (code = '901' OR code = 'INSS_AUTO');
        
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '901', 'Contribuição INSS', 'DEDUCTION', 'TAX', 'FORMULA', 'AUTOMATICA', NULL, 
            false, false, false, false, false, false
        );

        -- 3. IRRF AUTOMÁTICO (Cód 902)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND (code = '902' OR code = 'IRRF_AUTO');
        
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '902', 'IRRF Mensal', 'DEDUCTION', 'TAX', 'FORMULA', 'AUTOMATICA', NULL, 
            false, false, false, false, false, false
        );

        -- 4. FGTS AUTOMÁTICO (Cód 903)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND (code = '903' OR code = 'FGTS_AUTO');
        
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '903', 'FGTS Mensal (Depósito)', 'BASE', 'TAX', 'FORMULA', 'AUTOMATICA', NULL, 
            false, false, false, false, false, false
        );

        -- 5. VALE TRANSPORTE (Cód 201)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND (code = '201' OR name ILIKE 'Vale Transporte');
        
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '201', 'Vale Transporte', 'DEDUCTION', 'ALLOWANCE', 'FIXED', 'MANUAL', NULL, 
            false, false, false, false, false, false
        ) RETURNING id INTO v_rubric_vt;

        -- 6. VALE REFEIÇÃO / ALIMENTAÇÃO (Cód 202)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND code = '202';
        
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '202', 'Vale Refeição / Alimentação', 'DEDUCTION', 'ALLOWANCE', 'FIXED', 'MANUAL', NULL, 
            false, false, false, false, false, false
        ) RETURNING id INTO v_rubric_vr;

        -- 7. VINCULAÇÃO NO CATÁLOGO DE BENEFÍCIOS
        -- Atualiza catálogo de VT para amarrar à rubrica correta
        UPDATE public.benefits_catalog 
        SET rubric_id = v_rubric_vt, discount_type = 'PERCENTAGE', default_discount_value = 6
        WHERE tenant_id = tenant.id AND (benefit_type = 'VT' OR name ILIKE 'Vale Transporte');

        -- Atualiza catálogo de VR para amarrar à rubrica correta
        UPDATE public.benefits_catalog 
        SET rubric_id = v_rubric_vr, discount_type = 'FIXED_VALUE'
        WHERE tenant_id = tenant.id AND (benefit_type = 'VR' OR name ILIKE 'Vale Refeição');

    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
