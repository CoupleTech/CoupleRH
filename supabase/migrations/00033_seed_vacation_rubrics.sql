-- Migration: 00033_seed_vacation_rubrics
-- Description: Injeção das rubricas padrão para Férias

DO $$ 
DECLARE
    tenant RECORD;
BEGIN
    FOR tenant IN SELECT id FROM public.tenants LOOP
        
        -- 1. Férias Gozadas (Provento, Cód 401)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND code = '401';
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base,
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '401', 'Férias Gozadas', 'EARNING', 'OTHER', 'FIXED', 'AUTOMATICA', NULL,
            true, true, true, true, true, true
        );

        -- 2. 1/3 Constitucional de Férias (Provento, Cód 402)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND code = '402';
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base,
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '402', '1/3 Férias Gozadas', 'EARNING', 'OTHER', 'FIXED', 'AUTOMATICA', NULL,
            true, true, true, true, true, true
        );

        -- 3. Abono Pecuniário (Provento, Cód 403)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND code = '403';
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base,
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '403', 'Abono Pecuniário', 'EARNING', 'OTHER', 'FIXED', 'AUTOMATICA', NULL,
            false, false, false, false, false, false
        );

        -- 4. 1/3 Abono Pecuniário (Provento, Cód 404)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND code = '404';
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base,
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '404', '1/3 Abono Pecuniário', 'EARNING', 'OTHER', 'FIXED', 'AUTOMATICA', NULL,
            false, false, false, false, false, false
        );

        -- 5. Adiantamento 13º Salário (Provento, Cód 405)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND code = '405';
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base,
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '405', 'Adiantamento 13º nas Férias', 'EARNING', 'OTHER', 'FIXED', 'AUTOMATICA', NULL,
            false, false, true, false, false, true
        );

    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
