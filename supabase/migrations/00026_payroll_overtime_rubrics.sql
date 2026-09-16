-- Migration: 00026_payroll_overtime_rubrics
-- Description: Cria rubricas padrões de Horas Extras e DSR para todos os tenants.

DO $$ 
DECLARE
    tenant RECORD;
BEGIN
    FOR tenant IN SELECT id FROM public.tenants LOOP
        
        -- Hora Extra 50%
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, factor, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '150', 'Hora Extra 50%', 'EARNING', 'OVERTIME', 'FORMULA', 'HORAS', 'SALARIO_BASE', 1.5,
            true, true, true, true, true, true
        ) ON CONFLICT (tenant_id, code) DO NOTHING;

        -- Hora Extra 100%
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, factor, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '160', 'Hora Extra 100%', 'EARNING', 'OVERTIME', 'FORMULA', 'HORAS', 'SALARIO_BASE', 2.0,
            true, true, true, true, true, true
        ) ON CONFLICT (tenant_id, code) DO NOTHING;

        -- DSR sobre Horas Extras
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, formula, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '170', 'DSR sobre Horas Extras', 'EARNING', 'OVERTIME', 'FORMULA', 'FORMULA', '(BASE_DSR / DIAS_UTEIS) * DIAS_INUTEIS',
            true, true, true, true, true, true
        ) ON CONFLICT (tenant_id, code) DO NOTHING;
        
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
