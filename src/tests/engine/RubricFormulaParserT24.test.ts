import { describe, it, expect } from 'vitest';
import { RubricFormulaParser, FormulaError } from '../../../supabase/functions/payroll-engine/rubrics/RubricFormulaParser';
import { PayrollContext, Rubric } from '../../../supabase/functions/payroll-engine/engine/PayrollContext';
import { PayrollEngine } from '../../../supabase/functions/payroll-engine/engine/PayrollEngine';

describe('T24: RubricFormulaParser — Parser de Fórmulas na AST e Motor', () => {
  describe('1. Resolução de variáveis na AST', () => {
    it('deve avaliar variáveis conhecidas na AST sem substituição textual por regex', () => {
      const parser = new RubricFormulaParser({
        SALARIO_BASE: 3000,
        DIVISOR: 220,
        R101: 3000,
      });

      // Se fizesse replace textual ingênuo de "220" por "DIVISOR" ou vice-versa quebraria
      expect(parser.evaluate('SALARIO_BASE / DIVISOR')).toBeCloseTo(13.64, 2);
      expect(parser.evaluate('R101 * 0.1')).toBe(300);
      expect(parser.evaluate('(220 / DIVISOR) * 100')).toBe(100);
    });

    it('deve lançar FormulaError para variável inexistente', () => {
      const parser = new RubricFormulaParser({
        SALARIO_BASE: 2500,
      });

      expect(() => parser.evaluate('SALARIO_INEXISTENTE * 2')).toThrowError(FormulaError);
      expect(() => parser.evaluate('SALARIO_INEXISTENTE * 2')).toThrowError(
        /Variável 'SALARIO_INEXISTENTE' não encontrada/
      );
    });

    it('deve retornar 0 para rubricas do catálogo que não foram acionadas no mês quando fornecidas em knownRubrics', () => {
      const knownCodes = new Set(['101', '150', '201']);
      const parser = new RubricFormulaParser(
        {
          SALARIO_BASE: 2000,
          R101: 2000,
        },
        knownCodes
      );

      // R150 existe no catálogo mas não foi acionada (está ausente de variables) -> avalia como 0
      expect(parser.evaluate('R150 * 2')).toBe(0);
      expect(parser.evaluate('R101 + R150')).toBe(2000);

      // R999 NÃO existe no catálogo -> erro
      expect(() => parser.evaluate('R999 * 2')).toThrowError(FormulaError);
    });
  });

  describe('2. Tokenizer estrito e rejeição de caracteres inválidos', () => {
    it('deve lançar FormulaError ao encontrar caractere desconhecido ou inválido', () => {
      const parser = new RubricFormulaParser({ SALARIO_BASE: 2000 });

      expect(() => parser.evaluate('SALARIO_BASE @ 10')).toThrowError(FormulaError);
      expect(() => parser.evaluate('SALARIO_BASE # 10')).toThrowError(FormulaError);
      expect(() => parser.evaluate('SALARIO_BASE $ 10')).toThrowError(FormulaError);
      expect(() => parser.evaluate('SALARIO_BASE & 10')).toThrowError(FormulaError);
    });
  });

  describe('3. Comparadores e operadores lógicos', () => {
    it('deve suportar operadores relacionais (==, !=, <, <=, >, >=)', () => {
      const parser = new RubricFormulaParser({ SALARIO_BASE: 3000 });

      expect(parser.evaluate('SALARIO_BASE > 2000')).toBe(1);
      expect(parser.evaluate('SALARIO_BASE > 4000')).toBe(0);
      expect(parser.evaluate('SALARIO_BASE >= 3000')).toBe(1);
      expect(parser.evaluate('SALARIO_BASE <= 3000')).toBe(1);
      expect(parser.evaluate('SALARIO_BASE < 3000')).toBe(0);
      expect(parser.evaluate('SALARIO_BASE == 3000')).toBe(1);
      expect(parser.evaluate('SALARIO_BASE != 3000')).toBe(0);
    });

    it('deve suportar operadores lógicos (&&, ||)', () => {
      const parser = new RubricFormulaParser({ SALARIO_BASE: 3000, DIAS: 30 });

      expect(parser.evaluate('(SALARIO_BASE > 2000) && (DIAS == 30)')).toBe(1);
      expect(parser.evaluate('(SALARIO_BASE > 4000) && (DIAS == 30)')).toBe(0);
      expect(parser.evaluate('(SALARIO_BASE > 4000) || (DIAS == 30)')).toBe(1);
      expect(parser.evaluate('(SALARIO_BASE > 4000) || (DIAS < 20)')).toBe(0);
    });

    it('deve avaliar a função IF com expressões relacionais e lógicas', () => {
      const parser = new RubricFormulaParser({ SALARIO_BASE: 4000 });

      // Se salário > 3000, paga 500, senão 200
      expect(parser.evaluate('IF(SALARIO_BASE > 3000, 500, 200)')).toBe(500);

      const parserBaixo = new RubricFormulaParser({ SALARIO_BASE: 2500 });
      expect(parserBaixo.evaluate('IF(SALARIO_BASE > 3000, 500, 200)')).toBe(200);
    });
  });

  describe('4. Suporte a .5 e vírgula decimal', () => {
    it('deve aceitar literais iniciados por ponto decimal (.5, .25)', () => {
      const parser = new RubricFormulaParser({});

      expect(parser.evaluate('.5 * 100')).toBe(50);
      expect(parser.evaluate('.25 * 200')).toBe(50);
    });

    it('deve aceitar e normalizar vírgula decimal (0,5, 10,25)', () => {
      const parser = new RubricFormulaParser({ SALARIO_BASE: 1000 });

      expect(parser.evaluate('SALARIO_BASE * 0,5')).toBe(500);
      expect(parser.evaluate('SALARIO_BASE * ,5')).toBe(500);
      expect(parser.evaluate('10,5 + 2,25')).toBe(12.75);
    });
  });

  describe('5. Divisão por zero e validação de NaN / infinito', () => {
    it('deve lançar FormulaError em divisão por zero', () => {
      const parser = new RubricFormulaParser({ VALOR: 1000, ZERO: 0 });

      expect(() => parser.evaluate('1000 / 0')).toThrowError(FormulaError);
      expect(() => parser.evaluate('1000 / 0')).toThrowError(/Divisão por zero/);
      expect(() => parser.evaluate('VALOR / ZERO')).toThrowError(FormulaError);
      expect(() => parser.evaluate('VALOR % 0')).toThrowError(FormulaError);
    });
  });

  describe('6. Integração com o PayrollEngine', () => {
    it('não deve registrar variável numérica sem prefixo R e deve registrar R{code} com 0 quando não acionada', async () => {
      const rubricaSalario: Rubric = {
        id: 'r1',
        code: '101',
        name: 'Salário Base',
        type: 'EARNING',
        rubric_kind: 'SALARY_BASE',
        category: 'SALARY',
        calculation_form: 'FIXO',
        calculation_base: 'SALARIO_BASE',
        factor: 1,
        percentage: null,
        divisor: 220,
        formula: null,
        calculation_order: 1,
        incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true },
      };

      const rubricaZerada: Rubric = {
        id: 'r2',
        code: '220', // Código 220 intencional para testar não colisão com constante numérica
        name: 'Gratificação Zerada',
        type: 'EARNING',
        rubric_kind: 'OTHER',
        category: 'OTHER',
        calculation_form: 'VALOR_FIXO',
        calculation_base: null,
        factor: 1,
        percentage: null,
        divisor: 220,
        formula: null,
        calculation_order: 2,
        incidencias: { gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false },
      };

      const rubricaFormula: Rubric = {
        id: 'r3',
        code: '305',
        name: 'Prêmio por Fórmula',
        type: 'EARNING',
        rubric_kind: 'OTHER',
        category: 'OTHER',
        calculation_form: 'FORMULA',
        calculation_base: null,
        factor: 1,
        percentage: null,
        divisor: 220,
        // Testa vírgula decimal, constante 220 e referência a R220 que está zerada
        formula: 'IF(SALARIO_BASE > 2000, (220 / 220) * 150,00 + R220, 50)',
        calculation_order: 3,
        incidencias: { gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false },
      };

      const rubricasSistema: Rubric[] = [
        {
          id: 'r901',
          code: '901',
          name: 'INSS Mensal',
          type: 'DEDUCTION',
          rubric_kind: 'INSS',
          category: 'INSS',
          calculation_form: 'VALOR_FIXO',
          calculation_base: null,
          factor: 1,
          percentage: null,
          divisor: 220,
          formula: null,
          calculation_order: 901,
          incidencias: { gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false },
        },
        {
          id: 'r902',
          code: '902',
          name: 'IRRF Mensal',
          type: 'DEDUCTION',
          rubric_kind: 'IRRF',
          category: 'IRRF',
          calculation_form: 'VALOR_FIXO',
          calculation_base: null,
          factor: 1,
          percentage: null,
          divisor: 220,
          formula: null,
          calculation_order: 902,
          incidencias: { gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false },
        },
        {
          id: 'r903',
          code: '903',
          name: 'FGTS Mensal',
          type: 'BASE',
          rubric_kind: 'FGTS',
          category: 'FGTS',
          calculation_form: 'VALOR_FIXO',
          calculation_base: null,
          factor: 1,
          percentage: null,
          divisor: 220,
          formula: null,
          calculation_order: 903,
          incidencias: { gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false },
        },
      ];

      const ctx = new PayrollContext({
        contrato_id: 'cont-1',
        salario_base: 3000,
        dias_trabalhados: 30,
        dias_uteis: 26,
        dias_inuteis: 4,
        divisor: 220,
        salario_minimo: 1621.00,
        rubricas: [rubricaSalario, rubricaZerada, rubricaFormula, ...rubricasSistema],
        eventos: [
          { rubric_id: 'r1', manual_value: 3000 },
          // r2 não possui evento, resulta em valor 0
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

      // r3 deve calcular 150.00: IF(3000 > 2000, 1 * 150 + 0, 50) = 150.00
      const itemR3 = result.memoria_calculo.find(m => m.rubric_id === 'r3');
      expect(itemR3).toBeDefined();
      expect(itemR3?.result_value).toBe(150.00);

      // Variável R220 deve estar registrada no contexto com valor 0
      expect(ctx.getVariable('R220')).toBe(0);
      // Variável numérica 220 NÃO deve ter sido registrada ou sobrescrita
      expect(ctx.getVariable('220')).toBe(0);
    });
  });
});
