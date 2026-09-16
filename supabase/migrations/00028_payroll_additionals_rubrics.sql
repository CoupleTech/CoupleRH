-- Migration: 00028_payroll_additionals_rubrics
-- Description: Inserção de rubricas padrão para Fase 16 (Adicional Noturno, Insalubridade, Periculosidade, Comissões e Prêmios).

DO $$ 
DECLARE
    tenant RECORD;
BEGIN
    -- Atualiza a constraint para permitir a categoria COMMISSION
    ALTER TABLE public.payroll_rubrics DROP CONSTRAINT IF EXISTS payroll_rubrics_category_check;
    ALTER TABLE public.payroll_rubrics ADD CONSTRAINT payroll_rubrics_category_check CHECK (category IN ('SALARY', 'OVERTIME', 'ALLOWANCE', 'TAX', 'ADVANCE', 'OTHER', 'COMMISSION'));

    FOR tenant IN SELECT id FROM public.tenants LOOP
        
        -- 1. Adicional Noturno (Cód 180)
        -- Apaga caso exista para recriar com a regra correta
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND (code = '180' OR name ILIKE 'Adicional Noturno');
        
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, factor,
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '180', 'Adicional Noturno', 'EARNING', 'OVERTIME', 'FORMULA', 'HORAS', 'SALARIO_BASE', 0.20,
            true, true, true, true, true, true
        );

        -- 2. Insalubridade 10% (Grau Mínimo) (Cód 181)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND code = '181';
        
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, percentage,
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '181', 'Insalubridade 10% (Grau Mínimo)', 'EARNING', 'ALLOWANCE', 'PERCENTAGE_OF_BASE', 'PERCENTUAL', 'SALARIO_MINIMO', 10,
            true, true, true, true, true, true
        );

        -- 3. Insalubridade 20% (Grau Médio) (Cód 182)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND code = '182';
        
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, percentage,
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '182', 'Insalubridade 20% (Grau Médio)', 'EARNING', 'ALLOWANCE', 'PERCENTAGE_OF_BASE', 'PERCENTUAL', 'SALARIO_MINIMO', 20,
            true, true, true, true, true, true
        );

        -- 4. Insalubridade 40% (Grau Máximo) (Cód 183)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND code = '183';
        
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, percentage,
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '183', 'Insalubridade 40% (Grau Máximo)', 'EARNING', 'ALLOWANCE', 'PERCENTAGE_OF_BASE', 'PERCENTUAL', 'SALARIO_MINIMO', 40,
            true, true, true, true, true, true
        );

        -- 5. Periculosidade 30% (Cód 185)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND code = '185';
        
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, percentage,
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '185', 'Periculosidade 30%', 'EARNING', 'ALLOWANCE', 'PERCENTAGE_OF_BASE', 'PERCENTUAL', 'SALARIO_BASE', 30,
            true, true, true, true, true, true
        );

        -- 6. Comissão (Cód 190)
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND (code = '190' OR name ILIKE 'Comissão');
        
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '190', 'Comissões', 'EARNING', 'COMMISSION', 'FIXED', 'MANUAL', NULL,
            true, true, true, true, true, true
        );

        -- 7. Prêmio (Cód 191) - Reforma Trabalhista (Art. 457, § 2º): isento de INSS/FGTS e base
        DELETE FROM public.payroll_rubrics WHERE tenant_id = tenant.id AND code = '191';
        
        INSERT INTO public.payroll_rubrics (
            tenant_id, code, name, type, category, calculation_type, calculation_form, calculation_base, 
            incidence_inss, incidence_irrf, incidence_fgts, generates_inss_base, generates_irrf_base, generates_fgts_base
        ) VALUES (
            tenant.id, '191', 'Prêmios', 'EARNING', 'ALLOWANCE', 'FIXED', 'MANUAL', NULL,
            false, true, false, false, true, false
        );

    END LOOP;
END $$;
