import { describe, it, expect } from 'vitest';
import { PayrollContext } from '../../../supabase/functions/payroll-engine/engine/PayrollContext';
import { INSSCalculator } from '../../../supabase/functions/payroll-engine/legal/INSSCalculator';
import { IRRFCalculator } from '../../../supabase/functions/payroll-engine/legal/IRRFCalculator';

describe('T3: Parâmetros Legais, Salário Mínimo e Remoção de Fallbacks (Doc §4)', () => {
  const validInssBrackets = [
    { bracket_number: 1, base_limit: 1621.00, aliquot: 7.5, deduction: 0 },
    { bracket_number: 2, base_limit: 2902.84, aliquot: 9.0, deduction: 0 },
    { bracket_number: 3, base_limit: 4354.27, aliquot: 12.0, deduction: 0 },
    { bracket_number: 4, base_limit: 8475.55, aliquot: 14.0, deduction: 0 }
  ];

  const validIrrfBrackets = [
    { bracket_number: 1, base_limit: 2428.80, aliquot: 0, deduction: 0 },
    { bracket_number: 2, base_limit: 2826.65, aliquot: 7.5, deduction: 182.16 },
    { bracket_number: 3, base_limit: 3751.05, aliquot: 15.0, deduction: 394.16 },
    { bracket_number: 4, base_limit: 4664.68, aliquot: 22.5, deduction: 675.49 },
    { bracket_number: 5, base_limit: null, aliquot: 27.5, deduction: 908.73 }
  ];

  const validGeneralParams = {
    minimum_wage: 1621.00,
    dependent_deduction: 189.59,
    simplified_discount: 607.20,
    irrf_reduction_a: 978.62,
    irrf_reduction_b: 0.133145
  };

  it('1. Deve lançar erro se salario_minimo estiver ausente no PayrollContext (sem fallback 1621)', () => {
    expect(() => {
      new PayrollContext({
        competencia: '01/2026',
        tipo_folha: 'MONTHLY',
        empregado_id: 'emp-1',
        contrato_id: 'ct-1',
        salario_base: 3000,
        // salario_minimo omitido propositalmente
        rubricas: [],
        eventos: []
      });
    }).toThrow(/salario_minimo/i);
  });

  it('2. Deve vincular HORAS_TRABALHADAS ao divisor especificado (não fixar em 220)', () => {
    const context180 = new PayrollContext({
      competencia: '01/2026',
      tipo_folha: 'MONTHLY',
      empregado_id: 'emp-1',
      contrato_id: 'ct-1',
      salario_base: 3000,
      salario_minimo: 1621,
      divisor: 180,
      dias_uteis: 22,
      dias_inuteis: 8,
      rubricas: [],
      eventos: []
    });

    expect(context180.getVariable('HORAS_TRABALHADAS')).toBe(180);
    expect(context180.getVariable('DIVISOR')).toBe(180);
    expect(context180.getVariable('DIAS_UTEIS')).toBe(22);
    expect(context180.getVariable('DIAS_INUTEIS')).toBe(8);
  });

  it('3. INSSCalculator deve lançar erro se faixas estiverem vazias ou ausentes (sem fallback)', () => {
    expect(() => {
      INSSCalculator.calculate(3000, []);
    }).toThrow(/INSS/i);

    expect(() => {
      INSSCalculator.calculate(3000, undefined as any);
    }).toThrow(/INSS/i);
  });

  it('4. IRRFCalculator deve lançar erro se faixas estiverem vazias ou ausentes (sem fallback)', () => {
    expect(() => {
      IRRFCalculator.calculate(5000, 501.51, 0, [], validGeneralParams);
    }).toThrow(/IRRF/i);

    expect(() => {
      IRRFCalculator.calculate(5000, 501.51, 0, undefined as any, validGeneralParams);
    }).toThrow(/IRRF/i);
  });

  it('5. IRRFCalculator deve lançar erro se general_legal_parameters for ausente ou sem simplified_discount', () => {
    expect(() => {
      IRRFCalculator.calculate(5000, 501.51, 0, validIrrfBrackets, undefined as any);
    }).toThrow(/parâmetros legais gerais/i);

    expect(() => {
      IRRFCalculator.calculate(5000, 501.51, 0, validIrrfBrackets, { minimum_wage: 1621 } as any);
    }).toThrow(/simplified_discount/i);
  });

  it('6. IRRFCalculator deve respeitar parâmetros dinâmicos irrf_reduction_a e irrf_reduction_b da migration 00068', () => {
    // Rendimento bruto 6.000,00
    // Com parametros padrão (a=978.62, b=0.133145)
    // Redutor = 978.62 - (0.133145 * 6000) = 978.62 - 798.87 = 179.75
    // Com parametros customizados (ex: a=1000.00, b=0.10)
    // Redutor = 1000.00 - (0.10 * 6000) = 400.00
    const customParams = {
      ...validGeneralParams,
      irrf_reduction_a: 1000.00,
      irrf_reduction_b: 0.10
    };

    const res = IRRFCalculator.calculate(6000, 641.51, 0, validIrrfBrackets, customParams);
    expect(res.reductionAmount).toBe(400.00);
  });
});
