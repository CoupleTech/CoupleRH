import { describe, it, expect } from 'vitest';
import { 
  isDeductionEligibleForPeriod, 
  calculateDeductionAmount, 
  EmployeeDeductionItem 
} from '../../../supabase/functions/payroll-engine/engine/DeductionEligibility';
import { PayrollEngine } from '../../../supabase/functions/payroll-engine/engine/PayrollEngine';
import { PayrollContext, Rubric } from '../../../supabase/functions/payroll-engine/engine/PayrollContext';
import { testInssBrackets, testIrrfBrackets, testGeneralLegalParameters } from '../fixtures/legalParameters';

describe('T17: Descontos Fixos por Tipo de Folha (apply_on_types) e Regra de Pensão Alimentícia', () => {

  describe('1. Elegibilidade de Descontos por Tipo de Folha e Vigência (DeductionEligibility)', () => {
    
    it('Desconto padrão (apply_on_types nulo): aplica apenas em MONTHLY e não vaza para VACATION ou THIRTEENTH', () => {
      const deduction: EmployeeDeductionItem = {
        id: 'ded-1',
        contract_id: 'c-1',
        rubric_id: 'rub-plano',
        deduction_type: 'OTHER',
        amount_type: 'FIXED',
        value: 150.00,
        start_date: '2026-01-01',
        is_active: true,
        deduct_on_advance: false,
        apply_on_types: null
      };

      // Elegível em folha MENSAL
      expect(isDeductionEligibleForPeriod(deduction, 'MONTHLY', 2026, 3)).toBe(true);

      // Bloqueado em Adiantamento (pois deduct_on_advance é false)
      expect(isDeductionEligibleForPeriod(deduction, 'ADVANCE', 2026, 3)).toBe(false);

      // Bloqueado em Férias e 13º (regra T17: não vaza sem autorização expressa)
      expect(isDeductionEligibleForPeriod(deduction, 'VACATION', 2026, 3)).toBe(false);
      expect(isDeductionEligibleForPeriod(deduction, 'THIRTEENTH_1', 2026, 11)).toBe(false);
      expect(isDeductionEligibleForPeriod(deduction, 'THIRTEENTH_2', 2026, 12)).toBe(false);
      expect(isDeductionEligibleForPeriod(deduction, 'COMPLEMENTARY', 2026, 3)).toBe(false);
    });

    it('Desconto configurado com deduct_on_advance = true: aplica em ADVANCE e não em MONTHLY nem Férias', () => {
      const deduction: EmployeeDeductionItem = {
        id: 'ded-vale',
        contract_id: 'c-1',
        rubric_id: 'rub-vale',
        deduction_type: 'ADVANCE',
        amount_type: 'FIXED',
        value: 200.00,
        start_date: '2026-01-01',
        is_active: true,
        deduct_on_advance: true,
        apply_on_types: null
      };

      expect(isDeductionEligibleForPeriod(deduction, 'ADVANCE', 2026, 3)).toBe(true);
      expect(isDeductionEligibleForPeriod(deduction, 'MONTHLY', 2026, 3)).toBe(false);
      expect(isDeductionEligibleForPeriod(deduction, 'VACATION', 2026, 3)).toBe(false);
    });

    it('Desconto com apply_on_types explícito: aplica estritamente nos tipos permitidos', () => {
      // Pensão alimentícia que incide em Mensal, Férias e 2ª parcela do 13º
      const alimony: EmployeeDeductionItem = {
        id: 'ded-pensao',
        contract_id: 'c-1',
        rubric_id: 'rub-804',
        deduction_type: 'ALIMONY',
        amount_type: 'FIXED',
        value: 500.00,
        start_date: '2026-01-01',
        is_active: true,
        apply_on_types: ['MONTHLY', 'VACATION', 'THIRTEENTH_2']
      };

      expect(isDeductionEligibleForPeriod(alimony, 'MONTHLY', 2026, 3)).toBe(true);
      expect(isDeductionEligibleForPeriod(alimony, 'VACATION', 2026, 3)).toBe(true);
      expect(isDeductionEligibleForPeriod(alimony, 'THIRTEENTH_2', 2026, 12)).toBe(true);
      
      // Não incide em Adiantamento nem na 1ª parcela do 13º
      expect(isDeductionEligibleForPeriod(alimony, 'ADVANCE', 2026, 3)).toBe(false);
      expect(isDeductionEligibleForPeriod(alimony, 'THIRTEENTH_1', 2026, 11)).toBe(false);
      expect(isDeductionEligibleForPeriod(alimony, 'COMPLEMENTARY', 2026, 3)).toBe(false);
    });

    it('Desconto bloqueado fora da vigência temporal (start_date e end_date)', () => {
      const deductionFutura: EmployeeDeductionItem = {
        id: 'ded-futura',
        contract_id: 'c-1',
        start_date: '2026-05-01',
        is_active: true,
        apply_on_types: ['MONTHLY']
      };
      // Competência Março/2026 ainda não iniciou
      expect(isDeductionEligibleForPeriod(deductionFutura, 'MONTHLY', 2026, 3)).toBe(false);

      const deductionExpirada: EmployeeDeductionItem = {
        id: 'ded-expirada',
        contract_id: 'c-1',
        start_date: '2025-01-01',
        end_date: '2026-02-28',
        is_active: true,
        apply_on_types: ['MONTHLY']
      };
      // Competência Março/2026 já expirou
      expect(isDeductionEligibleForPeriod(deductionExpirada, 'MONTHLY', 2026, 3)).toBe(false);
    });

    it('calculateDeductionAmount apura valores fixos, percentuais e respeita limite total', () => {
      // 1. Fixo
      expect(calculateDeductionAmount({ amount_type: 'FIXED', value: 250.50 }, 3000)).toBe(250.50);

      // 2. Percentual (10% de R$ 4.000 = R$ 400)
      expect(calculateDeductionAmount({ amount_type: 'PERCENTAGE', value: 10 }, 4000)).toBe(400.00);

      // 3. Com teto total (calcularia 500, mas teto é 350)
      expect(calculateDeductionAmount({ amount_type: 'FIXED', value: 500, total_limit: 350 }, 4000)).toBe(350.00);
    });
  });

  describe('2. Pensão Alimentícia no Motor e Dedução da Base de IRRF (Doc §4 / Lei 9.250/95)', () => {
    
    // Rubricas de catálogo padrão para os testes do motor
    const rubricasPadrao: Rubric[] = [
      {
        id: 'r-101',
        code: '101',
        name: 'Salário Base',
        type: 'EARNING',
        category: 'SALARY',
        rubric_kind: 'SALARY_BASE',
        calculation_form: 'DIAS',
        calculation_order: 10,
        incidencias: {
          inss: true,
          irrf: true,
          fgts: true,
          gera_base_inss: true,
          gera_base_irrf: true,
          gera_base_fgts: true
        }
      },
      {
        id: 'r-804',
        code: '804',
        name: 'Pensão Alimentícia',
        type: 'DEDUCTION',
        category: 'OTHER',
        rubric_kind: 'ALIMONY',
        calculation_form: 'MANUAL',
        calculation_order: 85,
        incidencias: {
          inss: false,
          irrf: false, // Não gera base tributável, abate no cálculo da dedução legal de IRRF
          fgts: false,
          gera_base_inss: false,
          gera_base_irrf: false,
          gera_base_fgts: false
        }
      },
      {
        id: 'r-901',
        code: '901',
        name: 'Contribuição INSS',
        type: 'DEDUCTION',
        category: 'OTHER',
        rubric_kind: 'INSS',
        calculation_form: 'AUTOMATICA',
        calculation_order: 90,
        incidencias: { inss: false, irrf: false, fgts: false, gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
      },
      {
        id: 'r-902',
        code: '902',
        name: 'IRRF Mensal',
        type: 'DEDUCTION',
        category: 'OTHER',
        rubric_kind: 'IRRF',
        calculation_form: 'AUTOMATICA',
        calculation_order: 95,
        incidencias: { inss: false, irrf: false, fgts: false, gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
      },
      {
        id: 'r-903',
        code: '903',
        name: 'FGTS Mensal (Depósito)',
        type: 'BASE',
        category: 'OTHER',
        rubric_kind: 'FGTS',
        calculation_form: 'AUTOMATICA',
        calculation_order: 99,
        incidencias: { inss: false, irrf: false, fgts: false, gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
      }
    ];

    it('Pensão Alimentícia abate da base legal de IRRF (Art. 4º Lei 9.250/95)', async () => {
      // Salário de R$ 6.000,00:
      // INSS 2026 sobre R$ 6.000,00: ~R$ 641,51 (7,5% a 14%)
      // Sem pensão:
      //   Dedução Simplificada: R$ 607,20 -> Base Simpl = R$ 5.392,80
      //   Dedução Legal: INSS R$ 641,51 -> Base Legal = R$ 5.358,49 (menor que a simplificada!)
      // Agora adicionando Pensão Alimentícia de R$ 1.000,00:
      //   Base Legal passa a ser: R$ 6.000,00 - R$ 641,51 - R$ 1.000,00 = R$ 4.358,49
      //   Essa redução na base legal diminui substancialmente o IRRF devido!
      
      const contextSemPensao = new PayrollContext({
        competencia: '2026-03',
        tipo_folha: 'MONTHLY',
        empregado_id: 'emp-1',
        contrato_id: 'ct-1',
        salario_base: 6000.00,
        dias_trabalhados: 30,
        dias_uteis: 26,
        dias_inuteis: 4,
        divisor: 220,
        rubricas: rubricasPadrao,
        eventos: [
          { rubric_id: 'r-101', manual_value: 0, quantity: 30 }
        ],
        inss_parameters: testInssBrackets,
        irrf_parameters: testIrrfBrackets,
        general_legal_parameters: testGeneralLegalParameters
      });

      const engineSemPensao = new PayrollEngine(contextSemPensao);
      const resultadoSemPensao = await engineSemPensao.run();

      const contextComPensao = new PayrollContext({
        competencia: '2026-03',
        tipo_folha: 'MONTHLY',
        empregado_id: 'emp-1',
        contrato_id: 'ct-1',
        salario_base: 6000.00,
        dias_trabalhados: 30,
        dias_uteis: 26,
        dias_inuteis: 4,
        divisor: 220,
        rubricas: rubricasPadrao,
        eventos: [
          { rubric_id: 'r-101', manual_value: 0, quantity: 30 },
          { rubric_id: 'r-804', manual_value: 1000.00, quantity: 1 }
        ],
        inss_parameters: testInssBrackets,
        irrf_parameters: testIrrfBrackets,
        general_legal_parameters: testGeneralLegalParameters
      });

      const engineComPensao = new PayrollEngine(contextComPensao);
      const resultadoComPensao = await engineComPensao.run();

      // 1. O desconto da pensão consta no total de descontos
      const itemPensao = resultadoComPensao.memoria_calculo.find(m => m.rubric_id === 'r-804');
      expect(itemPensao).toBeDefined();
      expect(itemPensao?.result_value).toBe(1000.00);

      // 2. O IRRF com pensão deve ser estritamente menor do que sem pensão
      expect(resultadoComPensao.total_irrf).toBeLessThan(resultadoSemPensao.total_irrf);

      // 3. A base legal do IRRF calculada na memória deve abater os R$ 1.000 de pensão
      const memIrrf = resultadoComPensao.memoria_calculo.find(m => m.rubric_id === 'r-902');
      expect(memIrrf).toBeDefined();
      expect(memIrrf?.parsed_formula).toContain('Pensão Alimentícia: R$ 1000.00');

      // 4. Verificação contábil exata da base de IRRF:
      // Base legal = 6000 - INSS(641.51) - 1000 = 4358.49
      const expectedLegalBase = Math.round((6000.00 - resultadoComPensao.total_inss - 1000.00) * 100) / 100;
      expect(resultadoComPensao.bases.irrf).toBe(expectedLegalBase);
    });

    it('Pensão Alimentícia em percentual sobre o Salário Base (T17)', async () => {
      // Salário R$ 5.000,00 e Pensão de 20% = R$ 1.000,00
      const context = new PayrollContext({
        competencia: '2026-03',
        tipo_folha: 'MONTHLY',
        empregado_id: 'emp-1',
        contrato_id: 'ct-1',
        salario_base: 5000.00,
        dias_trabalhados: 30,
        dias_uteis: 26,
        dias_inuteis: 4,
        divisor: 220,
        rubricas: rubricasPadrao,
        eventos: [
          { rubric_id: 'r-101', manual_value: 0, quantity: 30 },
          { rubric_id: 'r-804', percentage: 20, value_type: 'PERCENT', quantity: 1 }
        ],
        inss_parameters: testInssBrackets,
        irrf_parameters: testIrrfBrackets,
        general_legal_parameters: testGeneralLegalParameters
      });

      const engine = new PayrollEngine(context);
      const resultado = await engine.run();

      const itemPensao = resultado.memoria_calculo.find(m => m.rubric_id === 'r-804');
      expect(itemPensao).toBeDefined();
      expect(itemPensao?.result_value).toBe(1000.00); // 20% de 5000
      expect(context.total_alimony).toBe(1000.00);
    });

  });

});
