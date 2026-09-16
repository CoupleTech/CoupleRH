-- Migration: 00031_seed_advance_rubrics
-- Description: Injeção das rubricas padrão para Adiantamento Salarial e seu respectivo Desconto

DO $$ 
DECLARE
    tenant RECORD;
BEGIN
    FOR tenant IN SELECT id FROM public.tenants LOOP
        
        -- 1. ADIANTAMENTO SALARIAL (Provento, Cód 301)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND code = '301';
        
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, percentage,
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '301', 'Adiantamento Salarial', 'EARNING', 'ADVANCE', 'PERCENTAGE_OF_BASE', 'AUTOMATICA', 'SALARIO_BASE', 40.00,
            false, false, false, false, false, false
        );

        -- 2. DESCONTO DE ADIANTAMENTO (Desconto, Cód 801)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND code = '801';
        
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '801', 'Desconto de Adiantamento', 'DEDUCTION', 'ADVANCE', 'FIXED', 'AUTOMATICA', NULL, 
            false, false, false, false, false, false
        );

    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
