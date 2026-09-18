-- Migration: 00062_seed_all_clt_rubrics
-- Description: Correção das rubricas com tipo incorreto (PROVENTO vs DESCONTO) e Seed do Catálogo CLT 2026 completo.

-- 1. CORREÇÃO DAS RUBRICAS EXISTENTES
-- Muitos impostos e descontos foram cadastrados/atualizados como EARNING no passado,
-- o que os fazia aparecer como "PROVENTO (+)" na interface e prejudicava o cálculo.
UPDATE public.payroll_rubrics
SET type = 'DEDUCTION'
WHERE code IN ('901', '902', '201', '202') AND type != 'DEDUCTION';

UPDATE public.payroll_rubrics
SET type = 'BASE'
WHERE code IN ('903') AND type != 'BASE';

-- 2. SEED DO CATÁLOGO 2026 COMPLETO PARA TODOS OS TENANTS
DO $$ 
DECLARE
    tenant RECORD;
BEGIN
    FOR tenant IN SELECT id FROM public.tenants LOOP
        
        -- Inserções com UPSERT usando a restrição UNIQUE(tenant_id, code)
        -- ====================================================================
        -- === SALÁRIO E REMUNERAÇÃO (Ordem 10) ===
        -- ====================================================================
        INSERT INTO public.payroll_rubrics (tenant_id, code, name, type, rubric_type, category, calculation_type, calculation_base, calculation_order, generates_base_inss, generates_base_irrf, generates_base_fgts, esocial_code)
        VALUES 
            (tenant.id, '101', 'Salário Base', 'EARNING', 'EARNING', 'SALARY', 'FIXED', 'SALARIO_BASE', 10, true, true, true, '1000'),
            (tenant.id, '102', 'Salário Proporcional', 'EARNING', 'EARNING', 'SALARY', 'FIXED', 'SALARIO_BASE', 10, true, true, true, '1000'),
            (tenant.id, '103', 'DSR', 'EARNING', 'EARNING', 'SALARY', 'PERCENTAGE_OF_BASE', 'BASE_DSR', 10, true, true, true, '1012'),
            (tenant.id, '105', 'Salário Maternidade', 'EARNING', 'EARNING', 'SALARY', 'FIXED', 'SALARIO_BASE', 10, true, true, true, '4050')
        ON CONFLICT (tenant_id, code) DO UPDATE SET 
            type = EXCLUDED.type, rubric_type = EXCLUDED.rubric_type, category = EXCLUDED.category, esocial_code = EXCLUDED.esocial_code, calculation_order = EXCLUDED.calculation_order;

        -- ====================================================================
        -- === ADICIONAIS (Ordem 20) ===
        -- ====================================================================
        INSERT INTO public.payroll_rubrics (tenant_id, code, name, type, rubric_type, category, calculation_type, calculation_base, calculation_order, generates_base_inss, generates_base_irrf, generates_base_fgts, esocial_code)
        VALUES 
            (tenant.id, '301', 'Adicional Noturno', 'EARNING', 'EARNING', 'OTHER', 'FORMULA', 'SALARIO_BASE', 20, true, true, true, '1205'),
            (tenant.id, '302', 'Adicional de Insalubridade', 'EARNING', 'EARNING', 'OTHER', 'FORMULA', 'SALARIO_MINIMO', 20, true, true, true, '1202'),
            (tenant.id, '303', 'Adicional de Periculosidade', 'EARNING', 'EARNING', 'OTHER', 'FORMULA', 'SALARIO_BASE', 20, true, true, true, '1203'),
            (tenant.id, '304', 'Adicional por Tempo de Serviço', 'EARNING', 'EARNING', 'OTHER', 'FORMULA', 'SALARIO_BASE', 20, true, true, true, '1206'),
            (tenant.id, '107', 'Adicional de Função', 'EARNING', 'EARNING', 'SALARY', 'PERCENTAGE_OF_BASE', 'SALARIO_BASE', 20, true, true, true, '1201')
        ON CONFLICT (tenant_id, code) DO UPDATE SET 
            type = EXCLUDED.type, rubric_type = EXCLUDED.rubric_type, category = EXCLUDED.category, esocial_code = EXCLUDED.esocial_code, calculation_order = EXCLUDED.calculation_order;

        -- ====================================================================
        -- === COMISSÕES, GRATIFICAÇÕES E PRÊMIOS (Ordem 30) ===
        -- ====================================================================
        INSERT INTO public.payroll_rubrics (tenant_id, code, name, type, rubric_type, category, calculation_type, calculation_base, calculation_order, generates_base_inss, generates_base_irrf, generates_base_fgts, esocial_code)
        VALUES 
            (tenant.id, '401', 'Comissão', 'EARNING', 'EARNING', 'OTHER', 'FIXED', NULL, 30, true, true, true, '1207'),
            (tenant.id, '402', 'Gratificação', 'EARNING', 'EARNING', 'OTHER', 'FIXED', NULL, 30, true, true, true, '1211'),
            (tenant.id, '403', 'Prêmio', 'EARNING', 'EARNING', 'OTHER', 'FIXED', NULL, 30, false, false, false, '2501'),
            (tenant.id, '404', 'Participação nos Lucros/Resultados', 'EARNING', 'EARNING', 'OTHER', 'FIXED', NULL, 30, false, true, false, '1300')
        ON CONFLICT (tenant_id, code) DO UPDATE SET 
            type = EXCLUDED.type, rubric_type = EXCLUDED.rubric_type, category = EXCLUDED.category, esocial_code = EXCLUDED.esocial_code, calculation_order = EXCLUDED.calculation_order;

        -- ====================================================================
        -- === HORAS EXTRAS E BANCO DE HORAS (Ordem 40) ===
        -- ====================================================================
        INSERT INTO public.payroll_rubrics (tenant_id, code, name, type, rubric_type, category, calculation_type, calculation_base, factor, calculation_order, generates_base_inss, generates_base_irrf, generates_base_fgts, esocial_code)
        VALUES 
            (tenant.id, '150', 'Hora Extra 50%', 'EARNING', 'EARNING', 'OVERTIME', 'FORMULA', 'SALARIO_BASE', 1.5, 40, true, true, true, '1003'),
            (tenant.id, '151', 'Hora Extra 60%', 'EARNING', 'EARNING', 'OVERTIME', 'FORMULA', 'SALARIO_BASE', 1.6, 40, true, true, true, '1003'),
            (tenant.id, '160', 'Hora Extra 100%', 'EARNING', 'EARNING', 'OVERTIME', 'FORMULA', 'SALARIO_BASE', 2.0, 40, true, true, true, '1003')
        ON CONFLICT (tenant_id, code) DO UPDATE SET 
            type = EXCLUDED.type, rubric_type = EXCLUDED.rubric_type, category = EXCLUDED.category, esocial_code = EXCLUDED.esocial_code, calculation_order = EXCLUDED.calculation_order;

        -- ====================================================================
        -- === DSR SOBRE VARIÁVEIS E HORAS EXTRAS (Ordem 45) ===
        -- ====================================================================
        INSERT INTO public.payroll_rubrics (tenant_id, code, name, type, rubric_type, category, calculation_type, calculation_base, calculation_order, generates_base_inss, generates_base_irrf, generates_base_fgts, esocial_code)
        VALUES 
            (tenant.id, '170', 'DSR sobre Horas Extras', 'EARNING', 'EARNING', 'OVERTIME', 'PERCENTAGE_OF_BASE', 'BASE_DSR', 45, true, true, true, '1012'),
            (tenant.id, '104', 'DSR sobre Variáveis', 'EARNING', 'EARNING', 'SALARY', 'PERCENTAGE_OF_BASE', 'BASE_DSR', 45, true, true, true, '1012')
        ON CONFLICT (tenant_id, code) DO UPDATE SET 
            type = EXCLUDED.type, rubric_type = EXCLUDED.rubric_type, category = EXCLUDED.category, esocial_code = EXCLUDED.esocial_code, calculation_order = EXCLUDED.calculation_order;

        -- ====================================================================
        -- === FÉRIAS E 13º (Ordem 50) ===
        -- ====================================================================
        INSERT INTO public.payroll_rubrics (tenant_id, code, name, type, rubric_type, category, calculation_type, calculation_base, calculation_order, generates_base_inss, generates_base_irrf, generates_base_fgts, esocial_code)
        VALUES 
            (tenant.id, '501', 'Férias', 'EARNING', 'EARNING', 'OTHER', 'FIXED', 'SALARIO_BASE', 50, true, true, true, '1016'),
            (tenant.id, '502', '1/3 Constitucional de Férias', 'EARNING', 'EARNING', 'OTHER', 'FORMULA', 'SALARIO_BASE', 50, true, true, true, '1017'),
            (tenant.id, '503', 'Abono Pecuniário', 'EARNING', 'EARNING', 'OTHER', 'FIXED', 'SALARIO_BASE', 50, false, false, false, '1023'),
            (tenant.id, '504', '1/3 sobre Abono Pecuniário', 'EARNING', 'EARNING', 'OTHER', 'FORMULA', 'SALARIO_BASE', 50, false, false, false, '1023'),
            (tenant.id, '508', 'Desconto de Férias', 'DEDUCTION', 'DEDUCTION', 'OTHER', 'FIXED', NULL, 50, false, false, false, '9221'),
            (tenant.id, '601', '13º Salário', 'EARNING', 'EARNING', 'OTHER', 'FIXED', 'SALARIO_BASE', 50, true, true, true, '5001'),
            (tenant.id, '602', 'Adiantamento 13º', 'EARNING', 'EARNING', 'ADVANCE', 'FIXED', 'SALARIO_BASE', 50, false, false, true, '5504'),
            (tenant.id, '608', 'Desconto de Adiantamento 13º', 'DEDUCTION', 'DEDUCTION', 'ADVANCE', 'FIXED', NULL, 50, false, false, false, '9214')
        ON CONFLICT (tenant_id, code) DO UPDATE SET 
            type = EXCLUDED.type, rubric_type = EXCLUDED.rubric_type, category = EXCLUDED.category, esocial_code = EXCLUDED.esocial_code, calculation_order = EXCLUDED.calculation_order;

        -- ====================================================================
        -- === RESCISÃO (Ordem 60) ===
        -- ====================================================================
        INSERT INTO public.payroll_rubrics (tenant_id, code, name, type, rubric_type, category, calculation_type, calculation_base, calculation_order, generates_base_inss, generates_base_irrf, generates_base_fgts, esocial_code)
        VALUES 
            (tenant.id, '701', 'Saldo de Salário', 'EARNING', 'EARNING', 'SALARY', 'FORMULA', 'SALARIO_BASE', 60, true, true, true, '6000'),
            (tenant.id, '707', 'Aviso Prévio Indenizado', 'EARNING', 'EARNING', 'OTHER', 'FORMULA', 'SALARIO_BASE', 60, false, true, true, '6003'),
            (tenant.id, '708', 'Multa Rescisória FGTS', 'EARNING', 'EARNING', 'OTHER', 'FIXED', NULL, 60, false, false, false, '6101')
        ON CONFLICT (tenant_id, code) DO UPDATE SET 
            type = EXCLUDED.type, rubric_type = EXCLUDED.rubric_type, category = EXCLUDED.category, esocial_code = EXCLUDED.esocial_code, calculation_order = EXCLUDED.calculation_order;

        -- ====================================================================
        -- === FALTAS E ATRASOS (Ordem 80) ===
        -- ====================================================================
        INSERT INTO public.payroll_rubrics (tenant_id, code, name, type, rubric_type, category, calculation_type, calculation_base, calculation_order, generates_base_inss, generates_base_irrf, generates_base_fgts, esocial_code)
        VALUES 
            (tenant.id, '801', 'Faltas', 'DEDUCTION', 'DEDUCTION', 'OTHER', 'FORMULA', 'SALARIO_BASE', 80, false, false, false, '9207'),
            (tenant.id, '802', 'Atrasos', 'DEDUCTION', 'DEDUCTION', 'OTHER', 'FORMULA', 'SALARIO_BASE', 80, false, false, false, '9208'),
            (tenant.id, '803', 'DSR sobre Falta', 'DEDUCTION', 'DEDUCTION', 'OTHER', 'FORMULA', 'SALARIO_BASE', 80, false, false, false, '9211')
        ON CONFLICT (tenant_id, code) DO UPDATE SET 
            type = EXCLUDED.type, rubric_type = EXCLUDED.rubric_type, category = EXCLUDED.category, esocial_code = EXCLUDED.esocial_code, calculation_order = EXCLUDED.calculation_order;

        -- ====================================================================
        -- === BENEFÍCIOS E DESCONTOS DE EMPREGADO (Ordem 85) ===
        -- ====================================================================
        INSERT INTO public.payroll_rubrics (tenant_id, code, name, type, rubric_type, category, calculation_type, calculation_base, calculation_order, generates_base_inss, generates_base_irrf, generates_base_fgts, esocial_code)
        VALUES 
            (tenant.id, '201', 'Vale-Transporte', 'DEDUCTION', 'DEDUCTION', 'ALLOWANCE', 'FIXED', NULL, 85, false, false, false, '9216'),
            (tenant.id, '202', 'Vale Refeição / Alimentação', 'DEDUCTION', 'DEDUCTION', 'ALLOWANCE', 'FIXED', NULL, 85, false, false, false, '9219'),
            (tenant.id, '203', 'Plano Médico', 'DEDUCTION', 'DEDUCTION', 'ALLOWANCE', 'FIXED', NULL, 85, false, false, false, '9219'),
            (tenant.id, '204', 'Plano Odontológico', 'DEDUCTION', 'DEDUCTION', 'ALLOWANCE', 'FIXED', NULL, 85, false, false, false, '9219')
        ON CONFLICT (tenant_id, code) DO UPDATE SET 
            type = EXCLUDED.type, rubric_type = EXCLUDED.rubric_type, category = EXCLUDED.category, esocial_code = EXCLUDED.esocial_code, calculation_order = EXCLUDED.calculation_order;

        -- ====================================================================
        -- === DESCONTOS PREVIDENCIÁRIOS E FISCAIS (Ordem 90 a 95) ===
        -- ====================================================================
        INSERT INTO public.payroll_rubrics (tenant_id, code, name, type, rubric_type, category, calculation_type, calculation_base, calculation_order, generates_base_inss, generates_base_irrf, generates_base_fgts, esocial_code)
        VALUES 
            (tenant.id, '901', 'INSS', 'DEDUCTION', 'DEDUCTION', 'TAX', 'FORMULA', NULL, 90, false, false, false, '9201'),
            (tenant.id, '902', 'IRRF', 'DEDUCTION', 'DEDUCTION', 'TAX', 'FORMULA', NULL, 95, false, false, false, '9203')
        ON CONFLICT (tenant_id, code) DO UPDATE SET 
            type = EXCLUDED.type, rubric_type = EXCLUDED.rubric_type, category = EXCLUDED.category, esocial_code = EXCLUDED.esocial_code, calculation_order = EXCLUDED.calculation_order;

    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
