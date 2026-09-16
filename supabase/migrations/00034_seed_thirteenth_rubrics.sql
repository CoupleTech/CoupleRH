-- Migration: 00034_seed_thirteenth_rubrics
-- Description: Injeção das rubricas padrão para 13º Salário

DO $$ 
DECLARE
    tenant RECORD;
BEGIN
    FOR tenant IN SELECT id FROM public.tenants LOOP
        
        -- 1. 13º Salário - 1ª Parcela (Provento, Cód 501)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND code = '501';
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base,
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '501', '13º Salário - 1ª Parcela', 'EARNING', 'OTHER', 'FIXED', 'AUTOMATICA', NULL,
            false, false, true, false, false, true
        );

        -- 2. 13º Salário - 2ª Parcela (Provento, Cód 502)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND code = '502';
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base,
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '502', '13º Salário - 2ª Parcela', 'EARNING', 'OTHER', 'FIXED', 'AUTOMATICA', NULL,
            true, true, true, true, true, true
        );

        -- 3. Desconto Adiantamento 13º (Desconto, Cód 803)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND code = '803';
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base,
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '803', 'Desconto Adiant. 13º Salário', 'DEDUCTION', 'OTHER', 'FIXED', 'AUTOMATICA', NULL,
            false, false, false, false, false, false
        );

    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
