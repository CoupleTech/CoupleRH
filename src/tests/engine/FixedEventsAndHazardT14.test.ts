import { describe, it, expect } from 'vitest';
import { PayrollEngine } from '../../../supabase/functions/payroll-engine/engine/PayrollEngine';
import { PayrollContext, Rubric } from '../../../supabase/functions/payroll-engine/engine/PayrollContext';
import { testInssBrackets, testIrrfBrackets, testGeneralLegalParameters } from '../fixtures/legalParameters';

describe('T14: Eventos Fixos (value_type) e Não Cumulatividade de Insalubridade/Periculosidade', () => {
  const createBaseRubrics = (): Map<string, Rubric> => {
    const rubricsMap = new Map<string, Rubric>();

    rubricsMap.set('101', {
      id: 'rub-101',
      code: '101',
      name: 'Salário Base',
      type: 'EARNING',
      category: 'SALARY',
      rubric_kind: 'SALARY_BASE',
      calculation_form: 'FIXO',
      calculation_order: 10,
      incidencias: {
        inss: true,
        irrf: true,
        fgts: true,
        inss_patronal: true,
        rat: true,
        terceiros: true,
        gera_base_inss: true,
        gera_base_irrf: true,
        gera_base_fgts: true,
      },
    });

    rubricsMap.set('302', {
      id: 'rub-302',
      code: '302',
      name: 'Adicional de Insalubridade',
      type: 'EARNING',
      category: 'ALLOWANCE',
      rubric_kind: 'INSALUBRIDADE',
      calculation_form: 'PERCENTUAL',
      calculation_base: 'SALARIO_MINIMO',
      percentage: 20,
      calculation_order: 20,
      incidencias: {
        inss: true,
        irrf: true,
        fgts: true,
        inss_patronal: true,
        rat: true,
        terceiros: true,
        gera_base_inss: true,
        gera_base_irrf: true,
        gera_base_fgts: true,
      },
    });

    rubricsMap.set('303', {
      id: 'rub-303',
      code: '303',
      name: 'Adicional de Periculosidade',
      type: 'EARNING',
      category: 'ALLOWANCE',
      rubric_kind: 'PERICULOSIDADE',
      calculation_form: 'PERCENTUAL',
      calculation_base: 'SALARIO_BASE',
      percentage: 30,
      calculation_order: 20,
      incidencias: {
        inss: true,
        irrf: true,
        fgts: true,
        inss_patronal: true,
        rat: true,
        terceiros: true,
        gera_base_inss: true,
        gera_base_irrf: true,
        gera_base_fgts: true,
      },
    });

    rubricsMap.set('901', {
      id: 'rub-901',
      code: '901',
      name: 'INSS',
      type: 'DEDUCTION',
      category: 'TAX',
      rubric_kind: 'INSS',
      calculation_form: 'AUTOMATICA',
      calculation_order: 90,
      incidencias: {
        inss: false,
        irrf: false,
        fgts: false,
        inss_patronal: false,
        rat: false,
        terceiros: false,
        gera_base_inss: false,
        gera_base_irrf: false,
        gera_base_fgts: false,
      },
    });

    rubricsMap.set('902', {
      id: 'rub-902',
      code: '902',
      name: 'IRRF',
      type: 'DEDUCTION',
      category: 'TAX',
      rubric_kind: 'IRRF',
      calculation_form: 'AUTOMATICA',
      calculation_order: 91,
      incidencias: {
        inss: false,
        irrf: false,
        fgts: false,
        inss_patronal: false,
        rat: false,
        terceiros: false,
        gera_base_inss: false,
        gera_base_irrf: false,
        gera_base_fgts: false,
      },
    });

    rubricsMap.set('903', {
      id: 'rub-903',
      code: '903',
      name: 'FGTS',
      type: 'NEUTRAL',
      category: 'TAX',
      rubric_kind: 'FGTS',
      calculation_form: 'AUTOMATICA',
      calculation_order: 92,
      incidencias: {
        inss: false,
        irrf: false,
        fgts: false,
        inss_patronal: false,
        rat: false,
        terceiros: false,
        gera_base_inss: false,
        gera_base_irrf: false,
        gera_base_fgts: false,
      },
    });

    return rubricsMap;
  };

  describe('1. Suporte a value_type em Eventos Fixos', () => {
    it('deve calcular Insalubridade como percentual sobre o salário mínimo quando value_type for PERCENT', async () => {
      const rubrics = createBaseRubrics();
      const context = new PayrollContext({
        contrato_id: 'contract-1',
        salario_base: 3000.0,
        dias_trabalhados: 30,
        rubricas: Array.from(rubrics.values()),
        eventos: [
          { rubric_id: 'rub-101', quantity: 30, manual_value: 0 },
          {
            rubric_id: 'rub-302',
            quantity: 1,
            manual_value: 20, // valor digitado
            percentage: 20,
            value_type: 'PERCENT',
          },
        ],
        salario_minimo: 1621.0,
        inss_parameters: testInssBrackets,
        irrf_parameters: testIrrfBrackets,
        general_legal_parameters: testGeneralLegalParameters,
      });

      const engine = new PayrollEngine(context);
      const result = await engine.run();

      // Salário Base: R$ 3000.00
      // Insalubridade 20% sobre Salário Mínimo R$ 1621.00 = R$ 324.20 (e NÃO R$ 20.00 fixos!)
      const insalubridadeMem = result.memoria_calculo.find((m) => m.rubric_id === 'rub-302');
      expect(insalubridadeMem).toBeDefined();
      expect(insalubridadeMem?.result_value).toBe(324.2);

      expect(result.total_proventos).toBe(3324.2);
    });

    it('deve aplicar valor monetário em reais quando value_type for AMOUNT', async () => {
      const rubrics = createBaseRubrics();
      rubrics.set('150', {
        id: 'rub-150',
        code: '150',
        name: 'Gratificação Fixa',
        type: 'EARNING',
        category: 'ALLOWANCE',
        rubric_kind: 'OTHER',
        calculation_form: 'FIXO',
        calculation_order: 25,
        incidencias: {
          inss: true,
          irrf: true,
          fgts: true,
          inss_patronal: true,
          rat: true,
          terceiros: true,
          gera_base_inss: true,
          gera_base_irrf: true,
          gera_base_fgts: true,
        },
      });

      const context = new PayrollContext({
        contrato_id: 'contract-1',
        salario_base: 3000.0,
        dias_trabalhados: 30,
        rubricas: Array.from(rubrics.values()),
        eventos: [
          { rubric_id: 'rub-101', quantity: 30, manual_value: 0 },
          {
            rubric_id: 'rub-150',
            quantity: 1,
            manual_value: 450.0,
            value_type: 'AMOUNT',
          },
        ],
        salario_minimo: 1621.0,
        inss_parameters: testInssBrackets,
        irrf_parameters: testIrrfBrackets,
        general_legal_parameters: testGeneralLegalParameters,
      });

      const engine = new PayrollEngine(context);
      const result = await engine.run();

      const itemGratificacao = result.memoria_calculo.find((m) => m.rubric_id === 'rub-150');
      expect(itemGratificacao?.result_value).toBe(450.0);
      expect(result.total_proventos).toBe(3450.0);
    });
  });

  describe('2. Não Cumulatividade de Insalubridade e Periculosidade (CLT art. 193 §2º)', () => {
    it('quando Periculosidade for maior que Insalubridade, deve pagar a Periculosidade e zerar a Insalubridade', async () => {
      const rubrics = createBaseRubrics();
      // Salário Base = R$ 3.000,00 -> Periculosidade 30% = R$ 900,00
      // Salário Mínimo = R$ 1.621,00 -> Insalubridade 20% = R$ 324,20
      // 900.00 > 324.20 -> Deve aplicar Periculosidade
      const context = new PayrollContext({
        contrato_id: 'contract-1',
        salario_base: 3000.0,
        dias_trabalhados: 30,
        rubricas: Array.from(rubrics.values()),
        eventos: [
          { rubric_id: 'rub-101', quantity: 30, manual_value: 0 },
          { rubric_id: 'rub-302', quantity: 1, percentage: 20, value_type: 'PERCENT' },
          { rubric_id: 'rub-303', quantity: 1, percentage: 30, value_type: 'PERCENT' },
        ],
        salario_minimo: 1621.0,
        inss_parameters: testInssBrackets,
        irrf_parameters: testIrrfBrackets,
        general_legal_parameters: testGeneralLegalParameters,
      });

      const engine = new PayrollEngine(context);
      const result = await engine.run();

      const periculosidadeItem = result.memoria_calculo.find((m) => m.rubric_id === 'rub-303');
      expect(periculosidadeItem).toBeDefined();
      expect(periculosidadeItem?.result_value).toBe(900.0);

      const insalubridadeItem = result.memoria_calculo.find((m) => m.rubric_id === 'rub-302');
      // Deve estar zerada
      expect(insalubridadeItem?.result_value || 0).toBe(0);

      // Memória de cálculo deve registrar o motivo legal
      expect(insalubridadeItem?.parsed_formula).toContain('CLT art. 193');

      // Total de proventos = 3000 (salário) + 900 (periculosidade) = 3900.00 (sem somar 324.20 da insalubridade)
      expect(result.total_proventos).toBe(3900.0);
    });

    it('quando Insalubridade for maior que Periculosidade, deve pagar a Insalubridade e zerar a Periculosidade', async () => {
      const rubrics = createBaseRubrics();
      // Salário Base = R$ 1.500,00 -> Periculosidade 30% = R$ 450,00
      // Salário Mínimo = R$ 1.621,00 -> Insalubridade 40% (grau máximo) = R$ 648,40
      // 648.40 > 450.00 -> Deve aplicar Insalubridade
      const context = new PayrollContext({
        contrato_id: 'contract-1',
        salario_base: 1500.0,
        dias_trabalhados: 30,
        rubricas: Array.from(rubrics.values()),
        eventos: [
          { rubric_id: 'rub-101', quantity: 30, manual_value: 0 },
          { rubric_id: 'rub-302', quantity: 1, percentage: 40, value_type: 'PERCENT' },
          { rubric_id: 'rub-303', quantity: 1, percentage: 30, value_type: 'PERCENT' },
        ],
        salario_minimo: 1621.0,
        inss_parameters: testInssBrackets,
        irrf_parameters: testIrrfBrackets,
        general_legal_parameters: testGeneralLegalParameters,
      });

      const engine = new PayrollEngine(context);
      const result = await engine.run();

      const insalubridadeItem = result.memoria_calculo.find((m) => m.rubric_id === 'rub-302');
      expect(insalubridadeItem).toBeDefined();
      expect(insalubridadeItem?.result_value).toBe(648.4);

      const periculosidadeItem = result.memoria_calculo.find((m) => m.rubric_id === 'rub-303');
      expect(periculosidadeItem?.result_value || 0).toBe(0);
      expect(periculosidadeItem?.parsed_formula).toContain('CLT art. 193');

      // Total = 1500 + 648.40 = 2148.40
      expect(result.total_proventos).toBe(2148.4);
    });

    it('deve permitir cumulatividade excepcional quando allow_cumulative_hazard_allowances for true (CCT)', async () => {
      const rubrics = createBaseRubrics();
      const context = new PayrollContext({
        contrato_id: 'contract-1',
        salario_base: 3000.0,
        dias_trabalhados: 30,
        rubricas: Array.from(rubrics.values()),
        eventos: [
          { rubric_id: 'rub-101', quantity: 30, manual_value: 0 },
          { rubric_id: 'rub-302', quantity: 1, percentage: 20, value_type: 'PERCENT' },
          { rubric_id: 'rub-303', quantity: 1, percentage: 30, value_type: 'PERCENT' },
        ],
        salario_minimo: 1621.0,
        inss_parameters: testInssBrackets,
        irrf_parameters: testIrrfBrackets,
        general_legal_parameters: testGeneralLegalParameters,
        allow_cumulative_hazard_allowances: true,
      });

      const engine = new PayrollEngine(context);
      const result = await engine.run();

      const insalubridadeItem = result.memoria_calculo.find((m) => m.rubric_id === 'rub-302');
      const periculosidadeItem = result.memoria_calculo.find((m) => m.rubric_id === 'rub-303');

      expect(insalubridadeItem?.result_value).toBe(324.2);
      expect(periculosidadeItem?.result_value).toBe(900.0);

      // Soma ambos: 3000 + 324.20 + 900.00 = 4224.20
      expect(result.total_proventos).toBe(4224.2);
    });
  });
});
