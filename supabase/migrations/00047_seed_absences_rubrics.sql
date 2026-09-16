-- Migration: 00047_seed_absences_rubrics
-- Description: Cria rubricas padrões de Faltas Injustificadas e Atrasos para o Espelho de Ponto Dinâmico.

DO $$ 
DECLARE
    tenant RECORD;
BEGIN
    FOR tenant IN SELECT id FROM public.tenants LOOP
        
        -- Falta Injustificada (Cód 210)
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '210', 'Faltas Injustificadas', 'DEDUCTION', 'OTHER', 'FORMULA', 'DIAS', 'SALARIO_BASE',
            true, true, true, true, true, true
        ) ON CONFLICT (tenant_id, code) DO NOTHING;

        -- Atrasos (Cód 211)
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, factor,
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '211', 'Atrasos (Horas/Minutos)', 'DEDUCTION', 'OTHER', 'FORMULA', 'HORAS', 'SALARIO_BASE', 1.0,
            true, true, true, true, true, true
        ) ON CONFLICT (tenant_id, code) DO NOTHING;

        -- DSR sobre Faltas/Atrasos (Cód 212)
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '212', 'DSR s/ Faltas', 'DEDUCTION', 'OTHER', 'FORMULA', 'DIAS', 'SALARIO_BASE',
            true, true, true, true, true, true
        ) ON CONFLICT (tenant_id, code) DO NOTHING;

    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
