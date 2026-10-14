import { describe, it, expect } from 'vitest';
import { INSSCalculator } from '../../../supabase/functions/payroll-engine/legal/INSSCalculator';
import { PayrollEngine } from '../../../supabase/functions/payroll-engine/engine/PayrollEngine';
import { PayrollContext, Rubric } from '../../../supabase/functions/payroll-engine/engine/PayrollContext';
import { testInssBrackets, testIrrfBrackets, testGeneralLegalParameters } from '../fixtures/legalParameters';

describe('T16: INSS Consolidado por Competência entre Folhas (Doc §4 e CLT)', () => {
  describe('1. INSSCalculator - Consolidação com base já tributada', () => {
    it('Cenário 1: Sem base já tributada anterior (cálculo padrão)', () => {
      // Base: R$ 3.000,00
      // Faixa 1 (7,5% até 1621): 121.58
      // Faixa 2 (9% de 1621 até 2902.84 = 1281.84): 115.37
      // Faixa 3 (12% de 2902.84 até 3000 = 97.16): 11.66
      // Total esperado: 121.575 + 115.3656 + 11.6592 = 248.5998 -> 248.60
      const res = INSSCalculator.calculate(3000.0, testInssBrackets, 0);
      expect(res.value).toBe(248.6);
      expect(res.alreadyTaxedValue).toBe(0);
      expect(res.totalCalculated).toBe(248.6);
    });

    it('Cenário 2: Base anterior e atual ambas dentro da 1ª faixa (progressão contínua)', () => {
      // Folha 1 (férias parciais): base R$ 1.000,00 -> INSS = 75,00
      // Folha 2 (mensal): base R$ 500,00
      // Soma: R$ 1.500,00 <= 1621 (ambas na faixa de 7,5%)
      // INSS total sobre 1500 = 112,50
      // INSS folha atual = 112,50 - 75,00 = 37,50
      const res = INSSCalculator.calculate(500.0, testInssBrackets, 1000.0);
      expect(res.value).toBe(37.5);
      expect(res.alreadyTaxedValue).toBe(75.0);
      expect(res.totalCalculated).toBe(112.5);
    });

    it('Cenário 3: Base anterior consumiu a 1ª faixa, base atual incide na 2ª faixa', () => {
      // Folha 1: base R$ 1.621,00 (teto da faixa 1) -> INSS = 121,58
      // Folha 2: base R$ 1.000,00
      // Soma: R$ 2.621,00 (entra direto na faixa 2 de 9%)
      // Não pode dar novo benefício de 7,5% para os R$ 1.000!
      // INSS sobre 1000 a 9% = R$ 90,01 (diferença entre totais arredondados 211.59 - 121.58)
      const res = INSSCalculator.calculate(1000.0, testInssBrackets, 1621.0);
      expect(res.value).toBe(90.01);
      expect(res.alreadyTaxedValue).toBe(121.57);
      expect(res.totalCalculated).toBe(211.58);
    });

    it('Cenário 4: Alcance do teto na segunda folha (respeito estrito ao limite previdenciário)', () => {
      // Teto INSS 2026: R$ 8.475,55 -> INSS Máximo: R$ 988,09
      // Folha 1 (férias): base R$ 5.000,00 -> INSS nas férias = R$ 501,51
      // Folha 2 (mensal): base R$ 5.000,00 (soma = R$ 10.000,00 > Teto)
      // INSS total consolidado = R$ 988,09 (teto)
      // INSS folha mensal = 988,09 - 501,51 = R$ 486,58
      const res = INSSCalculator.calculate(5000.0, testInssBrackets, 5000.0);
      expect(res.value).toBe(486.58);
      expect(res.alreadyTaxedValue).toBe(501.51);
      expect(res.totalCalculated).toBe(988.09);
    });

    it('Cenário 5: Teto já atingido integralmente na primeira folha (segunda folha com INSS zerado)', () => {
      // Folha 1 já tributou até o teto (ou acima, ex: R$ 9.000,00)
      // Folha 2 tem base R$ 3.000,00
      // INSS da folha 2 deve ser R$ 0,00 (teto já recolhido no mês)
      const res = INSSCalculator.calculate(3000.0, testInssBrackets, 8475.55);
      expect(res.value).toBe(0.0);
      expect(res.alreadyTaxedValue).toBe(988.09);
      expect(res.totalCalculated).toBe(988.09);
    });

    it('Cenário 6: Base anterior excedendo o teto mantém INSS da folha atual rigorosamente zerado', () => {
      const res = INSSCalculator.calculate(2500.0, testInssBrackets, 12000.0);
      expect(res.value).toBe(0.0);
      expect(res.alreadyTaxedValue).toBe(988.09);
      expect(res.totalCalculated).toBe(988.09);
    });
  });

  describe('2. PayrollEngine - Integração com base já tributada na competência', () => {
    const createBaseRubrics = (): Rubric[] => [
      {
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
      },
      {
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
      },
      {
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
      },
      {
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
      },
    ];

    it('deve descontar apenas o INSS remanescente até o teto quando houver base de férias anterior no mês', async () => {
      const rubricas = createBaseRubrics();
      // Colaborador já teve R$ 5.000,00 tributados nas férias
      // Na folha mensal, tem salário base R$ 5.000,00
      // INSS devido na folha mensal = 988.09 - 501.52 = 486.57
      const context = new PayrollContext({
        contrato_id: 'contract-1',
        salario_base: 5000.0,
        dias_trabalhados: 30,
        base_inss_already_taxed: 5000.0,
        rubricas,
        eventos: [{ rubric_id: 'rub-101', quantity: 30, manual_value: 0 }],
        salario_minimo: 1621.0,
        inss_parameters: testInssBrackets,
        irrf_parameters: testIrrfBrackets,
        general_legal_parameters: testGeneralLegalParameters,
      });

      const engine = new PayrollEngine(context);
      const result = await engine.run();

      const inssItem = result.memoria_calculo.find((m) => m.rubric_id === 'rub-901');
      expect(inssItem).toBeDefined();
      expect(inssItem?.result_value).toBe(486.58);

      // Memória de cálculo deve registrar a consolidação
      expect(inssItem?.parsed_formula).toContain('INSS_CONSOLIDADO');

      // Total de descontos contém o INSS consolidado de 486.58
      expect(result.total_descontos).toBeGreaterThanOrEqual(486.58);
    });

    it('deve zerar o desconto de INSS na folha mensal se as férias do mês já recolheram no teto', async () => {
      const rubricas = createBaseRubrics();
      // Colaborador com férias que recolheram no teto (R$ 8.500,00)
      // Folha mensal tem salário base R$ 3.000,00
      const context = new PayrollContext({
        contrato_id: 'contract-1',
        salario_base: 3000.0,
        dias_trabalhados: 30,
        base_inss_already_taxed: 8500.0,
        rubricas,
        eventos: [{ rubric_id: 'rub-101', quantity: 30, manual_value: 0 }],
        salario_minimo: 1621.0,
        inss_parameters: testInssBrackets,
        irrf_parameters: testIrrfBrackets,
        general_legal_parameters: testGeneralLegalParameters,
      });

      const engine = new PayrollEngine(context);
      const result = await engine.run();

      const inssItem = result.memoria_calculo.find((m) => m.rubric_id === 'rub-901');
      // Quando zerado pelo teto já atingido, não desconta INSS
      expect(inssItem?.result_value || 0).toBe(0);
      expect(inssItem?.parsed_formula).toContain('INSS_CONSOLIDADO');
    });
  });
});
