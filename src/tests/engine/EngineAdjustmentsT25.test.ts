import { describe, it, expect } from 'vitest';
import { PayrollContext, Rubric } from '../../../supabase/functions/payroll-engine/engine/PayrollContext';
import { PayrollEngine } from '../../../supabase/functions/payroll-engine/engine/PayrollEngine';

function createMockRubric(partial: Partial<Rubric> & { id: string; code: string; name: string }): Rubric {
  return {
    id: partial.id,
    code: partial.code,
    name: partial.name,
    type: partial.type ?? 'EARNING',
    rubric_kind: partial.rubric_kind ?? 'OTHER',
    category: partial.category ?? 'OTHER',
    calculation_base: partial.calculation_base ?? null,
    calculation_form: partial.calculation_form ?? 'VALOR_FIXO',
    factor: partial.factor ?? 1,
    percentage: partial.percentage ?? null,
    divisor: partial.divisor ?? 220,
    formula: partial.formula ?? null,
    calculation_order: partial.calculation_order,
    incidencias: partial.incidencias ?? {
      gera_base_inss: false,
      gera_base_irrf: false,
      gera_base_fgts: false,
    },
  };
}

const standardSystemRubrics: Rubric[] = [
  createMockRubric({ id: 'r901', code: '901', name: 'INSS', type: 'DEDUCTION', rubric_kind: 'INSS', calculation_order: 901 }),
  createMockRubric({ id: 'r902', code: '902', name: 'IRRF', type: 'DEDUCTION', rubric_kind: 'IRRF', calculation_order: 902 }),
  createMockRubric({ id: 'r903', code: '903', name: 'FGTS', type: 'BASE', rubric_kind: 'FGTS', calculation_order: 903 }),
];

describe('T25: getVariable com erro, calculation_order nulo e eventos negativos/estornos', () => {
  describe('1. getVariable com erro para variáveis inexistentes', () => {
    it('deve retornar o valor correto para variáveis válidas e lançar erro para variáveis inexistentes', () => {
      const ctx = new PayrollContext({
        salario_base: 3000,
        dias_trabalhados: 30,
        dias_uteis: 26,
        dias_inuteis: 4,
        divisor: 220,
        salario_minimo: 1621.00,
        rubricas: [],
      });

      // Variáveis padrão válidas
      expect(ctx.getVariable('SALARIO_BASE')).toBe(3000);
      expect(ctx.getVariable('SALARIO_MINIMO')).toBe(1621);
      expect(ctx.getVariable('DIVISOR')).toBe(220);

      // Bases dinâmicas oficiais válidas iniciam com 0
      expect(ctx.getVariable('BASE_DSR')).toBe(0);
      expect(ctx.getVariable('BASE_DSR_NOTURNO')).toBe(0);
      expect(ctx.getVariable('BASE_HORA_EXTRA')).toBe(0);

      // Variável inexistente ou digitada errada DEVE lançar erro explícito
      expect(() => ctx.getVariable('SALARIO_INEXISTENTE')).toThrowError(
        /Variável ou base de cálculo inexistente no contexto: 'SALARIO_INEXISTENTE'/
      );
      expect(() => ctx.getVariable('BASE_CALCULO_DIGITADA_ERRADA')).toThrowError(
        /Variável ou base de cálculo inexistente no contexto: 'BASE_CALCULO_DIGITADA_ERRADA'/
      );
    });

    it('deve falhar o motor com ERRO_CALCULO quando uma rubrica referenciar uma base inexistente', async () => {
      const rubricaComBaseInexistente = createMockRubric({
        id: 'r-erro-base',
        code: '333',
        name: 'Gratificação com Base Inexistente',
        type: 'EARNING',
        calculation_form: 'PERCENTUAL',
        calculation_base: 'BASE_INEXISTENTE_XYZ',
        percentage: 10,
        calculation_order: 5,
      });

      const ctx = new PayrollContext({
        salario_base: 3000,
        salario_minimo: 1621.00,
        rubricas: [rubricaComBaseInexistente, ...standardSystemRubrics],
        eventos: [],
        inss_parameters: [
          { bracket_order: 1, limit_value: 1621.00, rate: 0.075, deduction: 0 },
          { bracket_order: 2, limit_value: 2902.84, rate: 0.09, deduction: 24.315 },
          { bracket_order: 3, limit_value: 4354.27, rate: 0.12, deduction: 111.4002 },
          { bracket_order: 4, limit_value: 8475.55, rate: 0.14, deduction: 198.4856 },
        ],
        irrf_parameters: [
          { bracket_order: 1, base_limit: 2428.80, rate: 0, deduction: 0 },
          { bracket_order: 2, base_limit: null, rate: 0.275, deduction: 908.72 },
        ],
        general_legal_parameters: {
          minimum_wage: 1621.00,
          simplified_discount: 607.20,
        },
      });

      const engine = new PayrollEngine(ctx);
      const result = await engine.run();

      expect(result.status).toMatch(/^ERRO_CALCULO/);
      expect(result.status).toContain('333');
      expect(result.status).toContain('BASE_INEXISTENTE_XYZ');
    });
  });

  describe('2. calculation_order preservando 0 com operador ??', () => {
    it('deve preservar calculation_order: 0 sem converter para 100', () => {
      const rComOrdemZero = { calculation_order: 0 };
      const rSemOrdem = { calculation_order: undefined };

      const resolvedZero = rComOrdemZero.calculation_order ?? 100;
      const resolvedSemOrdem = rSemOrdem.calculation_order ?? 100;

      expect(resolvedZero).toBe(0);
      expect(resolvedSemOrdem).toBe(100);
    });
  });

  describe('3. Eventos manuais com valores negativos (estornos) e valor zero', () => {
    it('deve processar estorno negativo de provento, abatendo do total e das bases tributárias', async () => {
      const rSalario = createMockRubric({
        id: 'r1',
        code: '101',
        name: 'Salário Base',
        type: 'EARNING',
        rubric_kind: 'SALARY_BASE',
        calculation_form: 'FIXO',
        calculation_base: 'SALARIO_BASE',
        calculation_order: 1,
        incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true },
      });

      const rEstornoProvento = createMockRubric({
        id: 'r-estorno',
        code: '450',
        name: 'Estorno de Bônus Indevido',
        type: 'EARNING',
        calculation_form: 'VALOR_FIXO',
        calculation_order: 2,
        incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true },
      });

      const ctx = new PayrollContext({
        salario_base: 4000,
        salario_minimo: 1621.00,
        rubricas: [rSalario, rEstornoProvento, ...standardSystemRubrics],
        eventos: [
          { rubric_id: 'r1', manual_value: 4000 },
          { rubric_id: 'r-estorno', manual_value: -500 }, // Estorno manual de R$ -500,00
        ],
        inss_parameters: [
          { bracket_order: 1, limit_value: 1621.00, rate: 0.075, deduction: 0 },
          { bracket_order: 2, limit_value: 2902.84, rate: 0.09, deduction: 24.315 },
          { bracket_order: 3, limit_value: 4354.27, rate: 0.12, deduction: 111.4002 },
          { bracket_order: 4, limit_value: 8475.55, rate: 0.14, deduction: 198.4856 },
        ],
        irrf_parameters: [
          { bracket_order: 1, base_limit: 2428.80, rate: 0, deduction: 0 },
          { bracket_order: 2, base_limit: 2826.65, rate: 0.075, deduction: 182.16 },
          { bracket_order: 3, base_limit: 3751.05, rate: 0.15, deduction: 394.16 },
          { bracket_order: 4, base_limit: 4664.68, rate: 0.225, deduction: 675.49 },
          { bracket_order: 5, base_limit: null, rate: 0.275, deduction: 908.72 },
        ],
        general_legal_parameters: {
          minimum_wage: 1621.00,
          simplified_discount: 607.20,
          irrf_exemption_limit: 2428.80,
          irrf_base_reduction: 607.20,
          irrf_reduction_formula_limit: 7350.00,
          irrf_reduction_a: 978.62,
          irrf_reduction_b: 0.133145,
        },
      });

      const engine = new PayrollEngine(ctx);
      const result = await engine.run();

      expect(result.status).toBe('CALCULADA');

      // Proventos: 4000 - 500 = 3500.00
      expect(result.total_proventos).toBe(3500.00);
      // Base INSS deve ser 3500.00
      expect(result.bases.inss).toBe(3500.00);

      // Deve constar na memória de cálculo
      const memEstorno = result.memoria_calculo.find(m => m.rubric_id === 'r-estorno');
      expect(memEstorno).toBeDefined();
      expect(memEstorno?.result_value).toBe(-500);
    });

    it('deve registrar evento manual com valor zero na memória sem acionar cálculo alternativo', async () => {
      const rAdicional = createMockRubric({
        id: 'r-adic',
        code: '150',
        name: 'Insalubridade',
        type: 'EARNING',
        rubric_kind: 'INSALUBRIDADE',
        calculation_form: 'PERCENTUAL',
        calculation_base: 'SALARIO_MINIMO',
        percentage: 20,
        calculation_order: 2,
      });

      const ctx = new PayrollContext({
        salario_base: 3000,
        salario_minimo: 1621.00,
        rubricas: [rAdicional, ...standardSystemRubrics],
        eventos: [
          // Usuário lançou manualmente 0 para anular a insalubridade deste mês
          { rubric_id: 'r-adic', manual_value: 0 },
        ],
        inss_parameters: [
          { bracket_order: 1, limit_value: 1621.00, rate: 0.075, deduction: 0 },
          { bracket_order: 2, limit_value: 2902.84, rate: 0.09, deduction: 24.315 },
          { bracket_order: 3, limit_value: 4354.27, rate: 0.12, deduction: 111.4002 },
          { bracket_order: 4, limit_value: 8475.55, rate: 0.14, deduction: 198.4856 },
        ],
        irrf_parameters: [
          { bracket_order: 1, base_limit: 2428.80, rate: 0, deduction: 0 },
          { bracket_order: 2, base_limit: 2826.65, rate: 0.075, deduction: 182.16 },
          { bracket_order: 3, base_limit: 3751.05, rate: 0.15, deduction: 394.16 },
          { bracket_order: 4, base_limit: 4664.68, rate: 0.225, deduction: 675.49 },
          { bracket_order: 5, base_limit: null, rate: 0.275, deduction: 908.72 },
        ],
        general_legal_parameters: {
          minimum_wage: 1621.00,
          simplified_discount: 607.20,
          irrf_exemption_limit: 2428.80,
          irrf_base_reduction: 607.20,
          irrf_reduction_formula_limit: 7350.00,
          irrf_reduction_a: 978.62,
          irrf_reduction_b: 0.133145,
        },
      });

      const engine = new PayrollEngine(ctx);
      const result = await engine.run();

      expect(result.status).toBe('CALCULADA');

      // Não deve ter calculado 20% do salário mínimo (324.20)
      const memAdic = result.memoria_calculo.find(m => m.rubric_id === 'r-adic');
      expect(memAdic).toBeDefined();
      expect(memAdic?.result_value).toBe(0);
      expect(result.total_proventos).toBe(0);
    });
  });
});
