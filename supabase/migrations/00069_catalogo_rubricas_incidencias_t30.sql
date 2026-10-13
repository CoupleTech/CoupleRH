-- Migration: 00069_catalogo_rubricas_incidencias_t30
-- Description: Fase P2 / T30, T12, T13 - Catálogo CLT 2026 Completo, Matriz de Incidências, 
-- Formas de Cálculo, Desativação de Duplicidades e Rubricas Ausentes.

DO $$
DECLARE
    t RECORD;
BEGIN
    -- 1. DESATIVAÇÃO DE DUPLICIDADE (Doc §5.1 / §5.3: desativar rubrica 103 mantendo 104 e 170)
    UPDATE public.payroll_rubrics
    SET is_active = false,
        description = COALESCE(description || ' | ', '') || 'Desativada por duplicidade com 104 (Fase P2 / T30)'
    WHERE code = '103';

    -- 2. ITERAÇÃO POR TENANT PARA ATUALIZAÇÃO DA MATRIZ E INSERÇÃO DAS AUSENTES
    FOR t IN SELECT id FROM public.tenants LOOP

        -- =====================================================================
        -- 2.1 ATUALIZAÇÃO DAS FORMAS DE CÁLCULO E INCIDÊNCIAS DAS RUBRICAS EXISTENTES
        -- =====================================================================

        -- 101 Salário Base
        UPDATE public.payroll_rubrics SET
            type = 'EARNING', category = 'SALARY', calculation_form = 'FIXO', calculation_type = 'FIXED',
            calculation_base = 'SALARIO_BASE', calculation_order = 10,
            generates_base_inss = true, generates_base_irrf = true, generates_base_fgts = true,
            generates_inss_base = true, generates_irrf_base = true, generates_fgts_base = true,
            incidence_inss = true, incidence_irrf = true, incidence_fgts = true,
            incidence_inss_patronal = true, incidence_rat = true, incidence_third_parties = true,
            is_active = true
        WHERE tenant_id = t.id AND code = '101';

        -- 102 Salário Proporcional
        UPDATE public.payroll_rubrics SET
            type = 'EARNING', category = 'SALARY', calculation_form = 'DIAS', calculation_type = 'DAYS',
            calculation_base = 'SALARIO_BASE', calculation_order = 10,
            generates_base_inss = true, generates_base_irrf = true, generates_base_fgts = true,
            generates_inss_base = true, generates_irrf_base = true, generates_fgts_base = true,
            incidence_inss = true, incidence_irrf = true, incidence_fgts = true,
            incidence_inss_patronal = true, incidence_rat = true, incidence_third_parties = true,
            is_active = true
        WHERE tenant_id = t.id AND code = '102';

        -- 104 DSR sobre Variáveis
        UPDATE public.payroll_rubrics SET
            type = 'EARNING', category = 'SALARY', calculation_form = 'PERCENTUAL', calculation_type = 'PERCENTAGE_OF_BASE',
            calculation_base = 'BASE_DSR', calculation_order = 45,
            generates_base_inss = true, generates_base_irrf = true, generates_base_fgts = true,
            generates_inss_base = true, generates_irrf_base = true, generates_fgts_base = true,
            incidence_inss = true, incidence_irrf = true, incidence_fgts = true,
            incidence_inss_patronal = true, incidence_rat = true, incidence_third_parties = true,
            is_active = true
        WHERE tenant_id = t.id AND code = '104';

        -- 105 Salário Maternidade
        UPDATE public.payroll_rubrics SET
            type = 'EARNING', category = 'SALARY', calculation_form = 'DIAS', calculation_type = 'DAYS',
            calculation_base = 'SALARIO_BASE', calculation_order = 10,
            generates_base_inss = true, generates_base_irrf = true, generates_base_fgts = true,
            generates_inss_base = true, generates_irrf_base = true, generates_fgts_base = true,
            incidence_inss = true, incidence_irrf = true, incidence_fgts = true,
            is_active = true
        WHERE tenant_id = t.id AND code = '105';

        -- 107 Adicional de Função
        UPDATE public.payroll_rubrics SET
            type = 'EARNING', category = 'SALARY', calculation_form = 'PERCENTUAL', calculation_type = 'PERCENTAGE_OF_BASE',
            calculation_base = 'SALARIO_BASE', calculation_order = 20,
            generates_base_inss = true, generates_base_irrf = true, generates_base_fgts = true,
            generates_inss_base = true, generates_irrf_base = true, generates_fgts_base = true,
            incidence_inss = true, incidence_irrf = true, incidence_fgts = true,
            incidence_inss_patronal = true, incidence_rat = true, incidence_third_parties = true,
            is_active = true
        WHERE tenant_id = t.id AND code = '107';

        -- 150 Hora Extra 50%
        UPDATE public.payroll_rubrics SET
            type = 'EARNING', category = 'OVERTIME', calculation_form = 'HORAS', calculation_type = 'HOURS',
            calculation_base = 'SALARIO_BASE', factor = 1.5, calculation_order = 40,
            generates_base_inss = true, generates_base_irrf = true, generates_base_fgts = true,
            generates_inss_base = true, generates_irrf_base = true, generates_fgts_base = true,
            incidence_inss = true, incidence_irrf = true, incidence_fgts = true,
            incidence_inss_patronal = true, incidence_rat = true, incidence_third_parties = true,
            is_active = true
        WHERE tenant_id = t.id AND code = '150';

        -- 151 Hora Extra 60%
        UPDATE public.payroll_rubrics SET
            type = 'EARNING', category = 'OVERTIME', calculation_form = 'HORAS', calculation_type = 'HOURS',
            calculation_base = 'SALARIO_BASE', factor = 1.6, calculation_order = 40,
            generates_base_inss = true, generates_base_irrf = true, generates_base_fgts = true,
            generates_inss_base = true, generates_irrf_base = true, generates_fgts_base = true,
            incidence_inss = true, incidence_irrf = true, incidence_fgts = true,
            incidence_inss_patronal = true, incidence_rat = true, incidence_third_parties = true,
            is_active = true
        WHERE tenant_id = t.id AND code = '151';

        -- 160 Hora Extra 100%
        UPDATE public.payroll_rubrics SET
            type = 'EARNING', category = 'OVERTIME', calculation_form = 'HORAS', calculation_type = 'HOURS',
            calculation_base = 'SALARIO_BASE', factor = 2.0, calculation_order = 40,
            generates_base_inss = true, generates_base_irrf = true, generates_base_fgts = true,
            generates_inss_base = true, generates_irrf_base = true, generates_fgts_base = true,
            incidence_inss = true, incidence_irrf = true, incidence_fgts = true,
            incidence_inss_patronal = true, incidence_rat = true, incidence_third_parties = true,
            is_active = true
        WHERE tenant_id = t.id AND code = '160';

        -- 170 DSR sobre Horas Extras
        UPDATE public.payroll_rubrics SET
            type = 'EARNING', category = 'OVERTIME', calculation_form = 'PERCENTUAL', calculation_type = 'PERCENTAGE_OF_BASE',
            calculation_base = 'BASE_DSR', calculation_order = 45,
            generates_base_inss = true, generates_base_irrf = true, generates_base_fgts = true,
            generates_inss_base = true, generates_irrf_base = true, generates_fgts_base = true,
            incidence_inss = true, incidence_irrf = true, incidence_fgts = true,
            incidence_inss_patronal = true, incidence_rat = true, incidence_third_parties = true,
            is_active = true
        WHERE tenant_id = t.id AND code = '170';

        -- 171 DSR sobre Adic. Noturno
        UPDATE public.payroll_rubrics SET
            type = 'EARNING', category = 'DSR', calculation_form = 'PERCENTUAL', calculation_type = 'PERCENTAGE_OF_BASE',
            calculation_base = 'BASE_DSR_NOTURNO', calculation_order = 46,
            generates_base_inss = true, generates_base_irrf = true, generates_base_fgts = true,
            generates_inss_base = true, generates_irrf_base = true, generates_fgts_base = true,
            incidence_inss = true, incidence_irrf = true, incidence_fgts = true,
            incidence_inss_patronal = true, incidence_rat = true, incidence_third_parties = true,
            is_active = true
        WHERE tenant_id = t.id AND code = '171';

        -- 201 Vale Transporte
        UPDATE public.payroll_rubrics SET
            type = 'DEDUCTION', category = 'ALLOWANCE', calculation_form = 'MANUAL', calculation_type = 'MANUAL',
            calculation_order = 85,
            generates_base_inss = false, generates_base_irrf = false, generates_base_fgts = false,
            generates_inss_base = false, generates_irrf_base = false, generates_fgts_base = false,
            incidence_inss = false, incidence_irrf = false, incidence_fgts = false,
            is_active = true
        WHERE tenant_id = t.id AND code = '201';

        -- 202 Vale Refeição / Alimentação
        UPDATE public.payroll_rubrics SET
            type = 'DEDUCTION', category = 'ALLOWANCE', calculation_form = 'MANUAL', calculation_type = 'MANUAL',
            calculation_order = 85,
            generates_base_inss = false, generates_base_irrf = false, generates_base_fgts = false,
            generates_inss_base = false, generates_irrf_base = false, generates_fgts_base = false,
            incidence_inss = false, incidence_irrf = false, incidence_fgts = false,
            is_active = true
        WHERE tenant_id = t.id AND code = '202';

        -- 203 Plano Médico
        UPDATE public.payroll_rubrics SET
            type = 'DEDUCTION', category = 'ALLOWANCE', calculation_form = 'MANUAL', calculation_type = 'MANUAL',
            calculation_order = 85,
            generates_base_inss = false, generates_base_irrf = false, generates_base_fgts = false,
            generates_inss_base = false, generates_irrf_base = false, generates_fgts_base = false,
            incidence_inss = false, incidence_irrf = false, incidence_fgts = false,
            is_active = true
        WHERE tenant_id = t.id AND code = '203';

        -- 204 Plano Odontológico
        UPDATE public.payroll_rubrics SET
            type = 'DEDUCTION', category = 'ALLOWANCE', calculation_form = 'MANUAL', calculation_type = 'MANUAL',
            calculation_order = 85,
            generates_base_inss = false, generates_base_irrf = false, generates_base_fgts = false,
            generates_inss_base = false, generates_irrf_base = false, generates_fgts_base = false,
            incidence_inss = false, incidence_irrf = false, incidence_fgts = false,
            is_active = true
        WHERE tenant_id = t.id AND code = '204';

        -- 250 Adiantamento Quinzenal
        UPDATE public.payroll_rubrics SET
            type = 'EARNING', category = 'ADVANCE', calculation_form = 'PERCENTUAL', calculation_type = 'PERCENTAGE_OF_BASE',
            calculation_base = 'SALARIO_BASE', percentage = 40, calculation_order = 15,
            generates_base_inss = false, generates_base_irrf = false, generates_base_fgts = false,
            generates_inss_base = false, generates_irrf_base = false, generates_fgts_base = false,
            incidence_inss = false, incidence_irrf = false, incidence_fgts = false,
            is_active = true
        WHERE tenant_id = t.id AND code = '250';

        -- 301 Adicional Noturno
        UPDATE public.payroll_rubrics SET
            type = 'EARNING', category = 'OTHER', calculation_form = 'HORAS', calculation_type = 'HOURS',
            calculation_base = 'SALARIO_BASE', factor = 0.2, percentage = 20, calculation_order = 20,
            generates_base_inss = true, generates_base_irrf = true, generates_base_fgts = true,
            generates_inss_base = true, generates_irrf_base = true, generates_fgts_base = true,
            incidence_inss = true, incidence_irrf = true, incidence_fgts = true,
            incidence_inss_patronal = true, incidence_rat = true, incidence_third_parties = true,
            is_active = true
        WHERE tenant_id = t.id AND code = '301';

        -- 302 Adicional de Insalubridade
        UPDATE public.payroll_rubrics SET
            type = 'EARNING', category = 'OTHER', calculation_form = 'PERCENTUAL', calculation_type = 'PERCENTAGE_OF_BASE',
            calculation_base = 'SALARIO_MINIMO', calculation_order = 20,
            generates_base_inss = true, generates_base_irrf = true, generates_base_fgts = true,
            generates_inss_base = true, generates_irrf_base = true, generates_fgts_base = true,
            incidence_inss = true, incidence_irrf = true, incidence_fgts = true,
            incidence_inss_patronal = true, incidence_rat = true, incidence_third_parties = true,
            is_active = true
        WHERE tenant_id = t.id AND code = '302';

        -- 303 Adicional de Periculosidade
        UPDATE public.payroll_rubrics SET
            type = 'EARNING', category = 'OTHER', calculation_form = 'PERCENTUAL', calculation_type = 'PERCENTAGE_OF_BASE',
            calculation_base = 'SALARIO_BASE', percentage = 30, calculation_order = 20,
            generates_base_inss = true, generates_base_irrf = true, generates_base_fgts = true,
            generates_inss_base = true, generates_irrf_base = true, generates_fgts_base = true,
            incidence_inss = true, incidence_irrf = true, incidence_fgts = true,
            incidence_inss_patronal = true, incidence_rat = true, incidence_third_parties = true,
            is_active = true
        WHERE tenant_id = t.id AND code = '303';

        -- 304 Adicional por Tempo de Serviço
        UPDATE public.payroll_rubrics SET
            type = 'EARNING', category = 'OTHER', calculation_form = 'PERCENTUAL', calculation_type = 'PERCENTAGE_OF_BASE',
            calculation_base = 'SALARIO_BASE', calculation_order = 20,
            generates_base_inss = true, generates_base_irrf = true, generates_base_fgts = true,
            generates_inss_base = true, generates_irrf_base = true, generates_fgts_base = true,
            incidence_inss = true, incidence_irrf = true, incidence_fgts = true,
            incidence_inss_patronal = true, incidence_rat = true, incidence_third_parties = true,
            is_active = true
        WHERE tenant_id = t.id AND code = '304';

        -- 401 Comissão
        UPDATE public.payroll_rubrics SET
            type = 'EARNING', category = 'OTHER', calculation_form = 'MANUAL', calculation_type = 'MANUAL',
            calculation_order = 30,
            generates_base_inss = true, generates_base_irrf = true, generates_base_fgts = true,
            generates_inss_base = true, generates_irrf_base = true, generates_fgts_base = true,
            incidence_inss = true, incidence_irrf = true, incidence_fgts = true,
            incidence_inss_patronal = true, incidence_rat = true, incidence_third_parties = true,
            is_active = true
        WHERE tenant_id = t.id AND code = '401';

        -- 402 Gratificação
        UPDATE public.payroll_rubrics SET
            type = 'EARNING', category = 'OTHER', calculation_form = 'MANUAL', calculation_type = 'MANUAL',
            calculation_order = 30,
            generates_base_inss = true, generates_base_irrf = true, generates_base_fgts = true,
            generates_inss_base = true, generates_irrf_base = true, generates_fgts_base = true,
            incidence_inss = true, incidence_irrf = true, incidence_fgts = true,
            incidence_inss_patronal = true, incidence_rat = true, incidence_third_parties = true,
            is_active = true
        WHERE tenant_id = t.id AND code = '402';

        -- 403 Prêmio
        UPDATE public.payroll_rubrics SET
            type = 'EARNING', category = 'OTHER', calculation_form = 'MANUAL', calculation_type = 'MANUAL',
            calculation_order = 30,
            generates_base_inss = false, generates_base_irrf = false, generates_base_fgts = false,
            generates_inss_base = false, generates_irrf_base = false, generates_fgts_base = false,
            incidence_inss = false, incidence_irrf = false, incidence_fgts = false,
            is_active = true
        WHERE tenant_id = t.id AND code = '403';

        -- 404 Participação nos Lucros/Resultados (PLR)
        UPDATE public.payroll_rubrics SET
            type = 'EARNING', category = 'OTHER', calculation_form = 'MANUAL', calculation_type = 'MANUAL',
            calculation_order = 30,
            generates_base_inss = false, generates_base_irrf = true, generates_base_fgts = false,
            generates_inss_base = false, generates_irrf_base = true, generates_fgts_base = false,
            incidence_inss = false, incidence_irrf = true, incidence_fgts = false,
            is_active = true
        WHERE tenant_id = t.id AND code = '404';

        -- 501 Férias
        UPDATE public.payroll_rubrics SET
            type = 'EARNING', category = 'OTHER', calculation_form = 'DIAS', calculation_type = 'DAYS',
            calculation_base = 'SALARIO_BASE', calculation_order = 50,
            generates_base_inss = true, generates_base_irrf = true, generates_base_fgts = true,
            generates_inss_base = true, generates_irrf_base = true, generates_fgts_base = true,
            incidence_inss = true, incidence_irrf = true, incidence_fgts = true,
            is_active = true
        WHERE tenant_id = t.id AND code = '501';

        -- 502 1/3 Constitucional de Férias
        UPDATE public.payroll_rubrics SET
            type = 'EARNING', category = 'OTHER', calculation_form = 'FORMULA', calculation_type = 'FORMULA',
            calculation_base = 'SALARIO_BASE', calculation_order = 50,
            generates_base_inss = true, generates_base_irrf = true, generates_base_fgts = true,
            generates_inss_base = true, generates_irrf_base = true, generates_fgts_base = true,
            incidence_inss = true, incidence_irrf = true, incidence_fgts = true,
            is_active = true
        WHERE tenant_id = t.id AND code = '502';

        -- 503 Abono Pecuniário
        UPDATE public.payroll_rubrics SET
            type = 'EARNING', category = 'OTHER', calculation_form = 'DIAS', calculation_type = 'DAYS',
            calculation_base = 'SALARIO_BASE', calculation_order = 50,
            generates_base_inss = false, generates_base_irrf = false, generates_base_fgts = false,
            generates_inss_base = false, generates_irrf_base = false, generates_fgts_base = false,
            incidence_inss = false, incidence_irrf = false, incidence_fgts = false,
            is_active = true
        WHERE tenant_id = t.id AND code = '503';

        -- 504 1/3 sobre Abono Pecuniário
        UPDATE public.payroll_rubrics SET
            type = 'EARNING', category = 'OTHER', calculation_form = 'FORMULA', calculation_type = 'FORMULA',
            calculation_base = 'SALARIO_BASE', calculation_order = 50,
            generates_base_inss = false, generates_base_irrf = false, generates_base_fgts = false,
            generates_inss_base = false, generates_irrf_base = false, generates_fgts_base = false,
            incidence_inss = false, incidence_irrf = false, incidence_fgts = false,
            is_active = true
        WHERE tenant_id = t.id AND code = '504';

        -- 508 Desconto de Férias
        UPDATE public.payroll_rubrics SET
            type = 'DEDUCTION', category = 'OTHER', calculation_form = 'MANUAL', calculation_type = 'MANUAL',
            calculation_order = 50,
            generates_base_inss = false, generates_base_irrf = false, generates_base_fgts = false,
            generates_inss_base = false, generates_irrf_base = false, generates_fgts_base = false,
            incidence_inss = false, incidence_irrf = false, incidence_fgts = false,
            is_active = true
        WHERE tenant_id = t.id AND code = '508';

        -- 601 13º Salário
        UPDATE public.payroll_rubrics SET
            type = 'EARNING', category = 'OTHER', calculation_form = 'AVOS', calculation_type = 'FIXED',
            calculation_base = 'SALARIO_BASE', calculation_order = 50,
            generates_base_inss = true, generates_base_irrf = true, generates_base_fgts = true,
            generates_inss_base = true, generates_irrf_base = true, generates_fgts_base = true,
            incidence_inss = true, incidence_irrf = true, incidence_fgts = true,
            is_active = true
        WHERE tenant_id = t.id AND code = '601';

        -- 602 Adiantamento 13º
        UPDATE public.payroll_rubrics SET
            type = 'EARNING', category = 'ADVANCE', calculation_form = 'AVOS', calculation_type = 'FIXED',
            calculation_base = 'SALARIO_BASE', calculation_order = 50,
            generates_base_inss = false, generates_base_irrf = false, generates_base_fgts = true,
            generates_inss_base = false, generates_irrf_base = false, generates_fgts_base = true,
            incidence_inss = false, incidence_irrf = false, incidence_fgts = true,
            is_active = true
        WHERE tenant_id = t.id AND code = '602';

        -- 608 Desconto de Adiantamento 13º
        UPDATE public.payroll_rubrics SET
            type = 'DEDUCTION', category = 'ADVANCE', calculation_form = 'MANUAL', calculation_type = 'MANUAL',
            calculation_order = 50,
            generates_base_inss = false, generates_base_irrf = false, generates_base_fgts = false,
            generates_inss_base = false, generates_irrf_base = false, generates_fgts_base = false,
            incidence_inss = false, incidence_irrf = false, incidence_fgts = false,
            is_active = true
        WHERE tenant_id = t.id AND code = '608';

        -- 701 Saldo de Salário
        UPDATE public.payroll_rubrics SET
            type = 'EARNING', category = 'SALARY', calculation_form = 'DIAS', calculation_type = 'DAYS',
            calculation_base = 'SALARIO_BASE', calculation_order = 60,
            generates_base_inss = true, generates_base_irrf = true, generates_base_fgts = true,
            generates_inss_base = true, generates_irrf_base = true, generates_fgts_base = true,
            incidence_inss = true, incidence_irrf = true, incidence_fgts = true,
            is_active = true
        WHERE tenant_id = t.id AND code = '701';

        -- 707 Aviso Prévio Indenizado
        UPDATE public.payroll_rubrics SET
            type = 'EARNING', category = 'OTHER', calculation_form = 'DIAS', calculation_type = 'DAYS',
            calculation_base = 'SALARIO_BASE', calculation_order = 60,
            generates_base_inss = false, generates_base_irrf = false, generates_base_fgts = true,
            generates_inss_base = false, generates_irrf_base = false, generates_fgts_base = true,
            incidence_inss = false, incidence_irrf = false, incidence_fgts = true,
            is_active = true
        WHERE tenant_id = t.id AND code = '707';

        -- 708 Multa Rescisória FGTS
        UPDATE public.payroll_rubrics SET
            type = 'EARNING', category = 'OTHER', calculation_form = 'PERCENTUAL', calculation_type = 'PERCENTAGE_OF_BASE',
            calculation_order = 60,
            generates_base_inss = false, generates_base_irrf = false, generates_base_fgts = false,
            generates_inss_base = false, generates_irrf_base = false, generates_fgts_base = false,
            incidence_inss = false, incidence_irrf = false, incidence_fgts = false,
            is_active = true
        WHERE tenant_id = t.id AND code = '708';

        -- 801 Faltas
        UPDATE public.payroll_rubrics SET
            type = 'DEDUCTION', category = 'OTHER', calculation_form = 'DIAS', calculation_type = 'DAYS',
            calculation_base = 'SALARIO_BASE', calculation_order = 80,
            generates_base_inss = true, generates_base_irrf = true, generates_base_fgts = true,
            generates_inss_base = true, generates_irrf_base = true, generates_fgts_base = true,
            incidence_inss = true, incidence_irrf = true, incidence_fgts = true,
            is_active = true
        WHERE tenant_id = t.id AND code = '801';

        -- 802 Atrasos
        UPDATE public.payroll_rubrics SET
            type = 'DEDUCTION', category = 'OTHER', calculation_form = 'HORAS', calculation_type = 'HOURS',
            calculation_base = 'SALARIO_BASE', calculation_order = 80,
            generates_base_inss = true, generates_base_irrf = true, generates_base_fgts = true,
            generates_inss_base = true, generates_irrf_base = true, generates_fgts_base = true,
            incidence_inss = true, incidence_irrf = true, incidence_fgts = true,
            is_active = true
        WHERE tenant_id = t.id AND code = '802';

        -- 803 DSR sobre Falta
        UPDATE public.payroll_rubrics SET
            type = 'DEDUCTION', category = 'OTHER', calculation_form = 'DIAS', calculation_type = 'DAYS',
            calculation_base = 'SALARIO_BASE', calculation_order = 80,
            generates_base_inss = true, generates_base_irrf = true, generates_base_fgts = true,
            generates_inss_base = true, generates_irrf_base = true, generates_fgts_base = true,
            incidence_inss = true, incidence_irrf = true, incidence_fgts = true,
            is_active = true
        WHERE tenant_id = t.id AND code = '803';

        -- 850 Desconto de Adiantamento
        UPDATE public.payroll_rubrics SET
            type = 'DEDUCTION', category = 'ADVANCE', calculation_form = 'MANUAL', calculation_type = 'MANUAL',
            calculation_order = 85,
            generates_base_inss = false, generates_base_irrf = false, generates_base_fgts = false,
            generates_inss_base = false, generates_irrf_base = false, generates_fgts_base = false,
            incidence_inss = false, incidence_irrf = false, incidence_fgts = false,
            is_active = true
        WHERE tenant_id = t.id AND code = '850';

        -- 901 Contribuição INSS
        UPDATE public.payroll_rubrics SET
            type = 'DEDUCTION', category = 'TAX', calculation_form = 'AUTOMATICA', calculation_type = 'REFERENCE_TABLE',
            calculation_order = 90,
            generates_base_inss = false, generates_base_irrf = false, generates_base_fgts = false,
            generates_inss_base = false, generates_irrf_base = false, generates_fgts_base = false,
            incidence_inss = false, incidence_irrf = false, incidence_fgts = false,
            is_active = true
        WHERE tenant_id = t.id AND code = '901';

        -- 902 IRRF Mensal
        UPDATE public.payroll_rubrics SET
            type = 'DEDUCTION', category = 'TAX', calculation_form = 'AUTOMATICA', calculation_type = 'REFERENCE_TABLE',
            calculation_order = 95,
            generates_base_inss = false, generates_base_irrf = false, generates_base_fgts = false,
            generates_inss_base = false, generates_irrf_base = false, generates_fgts_base = false,
            incidence_inss = false, incidence_irrf = false, incidence_fgts = false,
            is_active = true
        WHERE tenant_id = t.id AND code = '902';

        -- 903 FGTS Mensal
        UPDATE public.payroll_rubrics SET
            type = 'BASE', category = 'TAX', calculation_form = 'AUTOMATICA', calculation_type = 'REFERENCE_TABLE',
            calculation_order = 50,
            generates_base_inss = false, generates_base_irrf = false, generates_base_fgts = false,
            generates_inss_base = false, generates_irrf_base = false, generates_fgts_base = false,
            incidence_inss = false, incidence_irrf = false, incidence_fgts = false,
            is_active = true
        WHERE tenant_id = t.id AND code = '903';


        -- =====================================================================
        -- 2.2 GARANTIA DE SEED PARA AS RUBRICAS 250 E 850 (T12)
        -- =====================================================================
        IF NOT EXISTS (SELECT 1 FROM public.payroll_rubrics WHERE tenant_id = t.id AND code = '250') THEN
            INSERT INTO public.payroll_rubrics (
                tenant_id, code, name, description, type, rubric_type, category, calculation_form, calculation_type,
                calculation_base, percentage, calculation_order, generates_base_inss, generates_base_irrf, generates_base_fgts,
                generates_inss_base, generates_irrf_base, generates_fgts_base, incidence_inss, incidence_irrf, incidence_fgts,
                esocial_code, origin, valid_from, is_active
            ) VALUES (
                t.id, '250', 'Adiantamento Quinzenal', 'Adiantamento salarial quinzenal padrão (40%)', 'EARNING', 'EARNING', 'ADVANCE',
                'PERCENTUAL', 'PERCENTAGE_OF_BASE', 'SALARIO_BASE', 40, 15, false, false, false,
                false, false, false, false, false, false, '5501', 'IMPORTADA', CURRENT_DATE, true
            );
        END IF;

        IF NOT EXISTS (SELECT 1 FROM public.payroll_rubrics WHERE tenant_id = t.id AND code = '850') THEN
            INSERT INTO public.payroll_rubrics (
                tenant_id, code, name, description, type, rubric_type, category, calculation_form, calculation_type,
                calculation_order, generates_base_inss, generates_base_irrf, generates_base_fgts,
                generates_inss_base, generates_irrf_base, generates_fgts_base, incidence_inss, incidence_irrf, incidence_fgts,
                esocial_code, origin, valid_from, is_active
            ) VALUES (
                t.id, '850', 'Desconto de Adiantamento', 'Desconto de adiantamento quinzenal na folha mensal', 'DEDUCTION', 'DEDUCTION', 'ADVANCE',
                'MANUAL', 'MANUAL', 85, false, false, false,
                false, false, false, false, false, false, '9214', 'AUTOMATICA', CURRENT_DATE, true
            );
        END IF;


        -- =====================================================================
        -- 2.3 CRIAÇÃO DAS RUBRICAS AUSENTES DO CATÁLOGO CLT (T30 / Doc §5.1 / §5.2)
        -- =====================================================================

        -- 106 Salário Família
        IF NOT EXISTS (SELECT 1 FROM public.payroll_rubrics WHERE tenant_id = t.id AND code = '106') THEN
            INSERT INTO public.payroll_rubrics (
                tenant_id, code, name, description, type, rubric_type, category, calculation_form, calculation_type,
                calculation_order, generates_base_inss, generates_base_irrf, generates_base_fgts,
                generates_inss_base, generates_irrf_base, generates_fgts_base, incidence_inss, incidence_irrf, incidence_fgts,
                esocial_code, origin, valid_from, is_active
            ) VALUES (
                t.id, '106', 'Salário Família', 'Benefício previdenciário pago pelo empregador por filho até 14 anos', 'EARNING', 'EARNING', 'SALARY',
                'AUTOMATICA', 'REFERENCE_TABLE', 10, false, false, false,
                false, false, false, false, false, false, '1409', 'AUTOMATICA', CURRENT_DATE, true
            );
        END IF;

        -- 152 Banco de Horas (Crédito)
        IF NOT EXISTS (SELECT 1 FROM public.payroll_rubrics WHERE tenant_id = t.id AND code = '152') THEN
            INSERT INTO public.payroll_rubrics (
                tenant_id, code, name, description, type, rubric_type, category, calculation_form, calculation_type,
                calculation_base, factor, calculation_order, generates_base_inss, generates_base_irrf, generates_base_fgts,
                generates_inss_base, generates_irrf_base, generates_fgts_base, incidence_inss, incidence_irrf, incidence_fgts,
                incidence_inss_patronal, incidence_rat, incidence_third_parties, esocial_code, origin, valid_from, is_active
            ) VALUES (
                t.id, '152', 'Banco de Horas (Crédito)', 'Pagamento de saldo positivo de banco de horas não compensado', 'EARNING', 'EARNING', 'OVERTIME',
                'HORAS', 'HOURS', 'SALARIO_BASE', 1.5, 40, true, true, true,
                true, true, true, true, true, true, true, true, true, '1004', 'IMPORTADA', CURRENT_DATE, true
            );
        END IF;

        -- 153 Hora Extra 70%
        IF NOT EXISTS (SELECT 1 FROM public.payroll_rubrics WHERE tenant_id = t.id AND code = '153') THEN
            INSERT INTO public.payroll_rubrics (
                tenant_id, code, name, description, type, rubric_type, category, calculation_form, calculation_type,
                calculation_base, factor, calculation_order, generates_base_inss, generates_base_irrf, generates_base_fgts,
                generates_inss_base, generates_irrf_base, generates_fgts_base, incidence_inss, incidence_irrf, incidence_fgts,
                incidence_inss_patronal, incidence_rat, incidence_third_parties, esocial_code, origin, valid_from, is_active
            ) VALUES (
                t.id, '153', 'Hora Extra 70%', 'Hora Extra com adicional de 70% previsto em CCT/ACT', 'EARNING', 'EARNING', 'OVERTIME',
                'HORAS', 'HOURS', 'SALARIO_BASE', 1.7, 40, true, true, true,
                true, true, true, true, true, true, true, true, true, '1003', 'IMPORTADA', CURRENT_DATE, true
            );
        END IF;

        -- 305 Adicional de Penosidade
        IF NOT EXISTS (SELECT 1 FROM public.payroll_rubrics WHERE tenant_id = t.id AND code = '305') THEN
            INSERT INTO public.payroll_rubrics (
                tenant_id, code, name, description, type, rubric_type, category, calculation_form, calculation_type,
                calculation_base, calculation_order, generates_base_inss, generates_base_irrf, generates_base_fgts,
                generates_inss_base, generates_irrf_base, generates_fgts_base, incidence_inss, incidence_irrf, incidence_fgts,
                incidence_inss_patronal, incidence_rat, incidence_third_parties, esocial_code, origin, valid_from, is_active
            ) VALUES (
                t.id, '305', 'Adicional de Penosidade', 'Adicional por trabalho em condições penosas (previsto em norma coletiva)', 'EARNING', 'EARNING', 'OTHER',
                'PERCENTUAL', 'PERCENTAGE_OF_BASE', 'SALARIO_BASE', 20, true, true, true,
                true, true, true, true, true, true, true, true, true, '1204', 'MANUAL', CURRENT_DATE, true
            );
        END IF;

        -- 804 Pensão Alimentícia
        IF NOT EXISTS (SELECT 1 FROM public.payroll_rubrics WHERE tenant_id = t.id AND code = '804') THEN
            INSERT INTO public.payroll_rubrics (
                tenant_id, code, name, description, type, rubric_type, category, calculation_form, calculation_type,
                calculation_order, generates_base_inss, generates_base_irrf, generates_base_fgts,
                generates_inss_base, generates_irrf_base, generates_fgts_base, incidence_inss, incidence_irrf, incidence_fgts,
                esocial_code, origin, valid_from, is_active
            ) VALUES (
                t.id, '804', 'Pensão Alimentícia', 'Desconto judicial de pensão alimentícia (dedutível da base de IRRF)', 'DEDUCTION', 'DEDUCTION', 'OTHER',
                'MANUAL', 'MANUAL', 85, false, false, false,
                false, false, false, false, false, false, '9200', 'MANUAL', CURRENT_DATE, true
            );
        END IF;

        -- 805 Empréstimo Consignado
        IF NOT EXISTS (SELECT 1 FROM public.payroll_rubrics WHERE tenant_id = t.id AND code = '805') THEN
            INSERT INTO public.payroll_rubrics (
                tenant_id, code, name, description, type, rubric_type, category, calculation_form, calculation_type,
                calculation_order, generates_base_inss, generates_base_irrf, generates_base_fgts,
                generates_inss_base, generates_irrf_base, generates_fgts_base, incidence_inss, incidence_irrf, incidence_fgts,
                esocial_code, origin, valid_from, is_active
            ) VALUES (
                t.id, '805', 'Empréstimo Consignado', 'Desconto de parcela de empréstimo consignado em folha', 'DEDUCTION', 'DEDUCTION', 'OTHER',
                'MANUAL', 'MANUAL', 85, false, false, false,
                false, false, false, false, false, false, '9210', 'MANUAL', CURRENT_DATE, true
            );
        END IF;

        -- 806 Contribuição Sindical / Assistencial
        IF NOT EXISTS (SELECT 1 FROM public.payroll_rubrics WHERE tenant_id = t.id AND code = '806') THEN
            INSERT INTO public.payroll_rubrics (
                tenant_id, code, name, description, type, rubric_type, category, calculation_form, calculation_type,
                calculation_order, generates_base_inss, generates_base_irrf, generates_base_fgts,
                generates_inss_base, generates_irrf_base, generates_fgts_base, incidence_inss, incidence_irrf, incidence_fgts,
                esocial_code, origin, valid_from, is_active
            ) VALUES (
                t.id, '806', 'Contribuição Sindical / Assistencial', 'Desconto de contribuição sindical ou assistencial autorizada', 'DEDUCTION', 'DEDUCTION', 'OTHER',
                'MANUAL', 'MANUAL', 85, false, false, false,
                false, false, false, false, false, false, '9230', 'MANUAL', CURRENT_DATE, true
            );
        END IF;

    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
