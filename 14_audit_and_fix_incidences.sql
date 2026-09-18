-- =========================================================================================
-- SCRIPT DE AUDITORIA E CORREÇÃO GERAL DE INCIDÊNCIAS (18/09/2026)
-- Este script corrige os impostos (INSS, IRRF, FGTS) de todas as rubricas já cadastradas.
-- =========================================================================================

DO $$
BEGIN
    -- 1. 🟢 PROVENTOS QUE INCIDEM TUDO (INSS, IRRF, FGTS = true)
    -- Salários, DSR, Horas Extras, Adicionais, Comissões, Férias, 13º, Saldo de Salário
    UPDATE public.payroll_rubrics 
    SET generates_base_inss = true, generates_base_irrf = true, generates_base_fgts = true
    WHERE code IN (
        '101', '102', '103', -- Salários
        '104', '170',        -- DSR
        '150', '151', '160', -- Horas Extras
        '301', '302', '303', -- Adicionais
        '401',               -- Comissão
        '501', '502',        -- Férias e 1/3
        '601',               -- 13º Salário (2ª parcela)
        '701'                -- Saldo de Salário Rescisão
    );

    -- 2. 🔴 DESCONTOS QUE REDUZEM AS BASES (INSS, IRRF, FGTS = true)
    -- BUG CORRIGIDO: Faltas e Atrasos precisam estar como TRUE para abaterem os impostos.
    UPDATE public.payroll_rubrics 
    SET generates_base_inss = true, generates_base_irrf = true, generates_base_fgts = true
    WHERE code IN ('801', '802', '803');

    -- 3. 🟡 EXCEÇÕES LEGAIS ESPECÍFICAS
    
    -- PLR (Participação nos Lucros): Apenas IRRF
    UPDATE public.payroll_rubrics 
    SET generates_base_inss = false, generates_base_irrf = true, generates_base_fgts = false
    WHERE code = '404';

    -- Abono Pecuniário e 1/3 de Férias: NADA INCIDE
    UPDATE public.payroll_rubrics 
    SET generates_base_inss = false, generates_base_irrf = false, generates_base_fgts = false
    WHERE code IN ('503', '504', '508');

    -- Adiantamento 13º (1ª Parcela): APENAS FGTS
    UPDATE public.payroll_rubrics 
    SET generates_base_inss = false, generates_base_irrf = false, generates_base_fgts = true
    WHERE code = '602';

    -- Desconto Adiantamento 13º: NADA INCIDE (Pois os impostos serão cobrados na 601)
    UPDATE public.payroll_rubrics 
    SET generates_base_inss = false, generates_base_irrf = false, generates_base_fgts = false
    WHERE code = '608';

    -- Aviso Prévio Indenizado: IRRF e FGTS (Sem INSS)
    UPDATE public.payroll_rubrics 
    SET generates_base_inss = false, generates_base_irrf = true, generates_base_fgts = true
    WHERE code = '707';

    -- Multa FGTS (40%): NADA INCIDE
    UPDATE public.payroll_rubrics 
    SET generates_base_inss = false, generates_base_irrf = false, generates_base_fgts = false
    WHERE code = '708';

    -- Descontos de Benefícios (VT, VR, Plano de Saúde): NADA INCIDE (Reduzem apenas líquido)
    UPDATE public.payroll_rubrics 
    SET generates_base_inss = false, generates_base_irrf = false, generates_base_fgts = false
    WHERE code IN ('201', '202', '203', '204');

    -- Descontos Próprios de Imposto (INSS, IRRF): NADA INCIDE (Não reduzem suas próprias bases, o motor trata manual)
    UPDATE public.payroll_rubrics 
    SET generates_base_inss = false, generates_base_irrf = false, generates_base_fgts = false
    WHERE code IN ('901', '902');

END $$;
