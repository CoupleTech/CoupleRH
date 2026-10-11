import { describe, it, expect } from 'vitest';
import { PayrollEngine } from '../../../supabase/functions/payroll-engine/engine/PayrollEngine';
import { PayrollContext } from '../../../supabase/functions/payroll-engine/engine/PayrollContext';

describe('T1: Tabela de Aceite IRRF e Integração Motor (Doc §4)', () => {
  const inssBrackets = [
    { bracket_number: 1, base_limit: 1621.00, aliquot: 7.5 },
    { bracket_number: 2, base_limit: 2902.84, aliquot: 9.0 },
    { bracket_number: 3, base_limit: 4354.27, aliquot: 12.0 },
    { bracket_number: 4, base_limit: 8475.55, aliquot: 14.0 }
  ];

  const irrfBrackets = [
    { bracket_number: 1, base_limit: 2428.80, aliquot: 0, deduction: 0 },
    { bracket_number: 2, base_limit: 2826.65, aliquot: 7.5, deduction: 182.16 },
    { bracket_number: 3, base_limit: 3751.05, aliquot: 15.0, deduction: 394.16 },
    { bracket_number: 4, base_limit: 4664.68, aliquot: 22.5, deduction: 675.49 },
    { bracket_number: 5, base_limit: null, aliquot: 27.5, deduction: 908.73 }
  ];

  const generalParams = {
    minimum_wage: 1621.00,
    dependent_deduction: 189.59,
    simplified_discount: 607.20,
    irrf_reduction_a: 978.62,
    irrf_reduction_b: 0.133145
  };

  const standardRubrics = [
    {
      id: 'r_salario',
      code: '101',
      name: 'Salário Base',
      type: 'EARNING',
      category: 'SALARY',
      calculation_form: 'FIXO',
      calculation_base: 'SALARIO_BASE',
      calculation_order: 10,
      incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
    },
    {
      id: 'r_inss',
      code: '901',
      name: 'Contribuição INSS',
      type: 'DEDUCTION',
      category: 'TAX',
      calculation_form: 'AUTOMATICA',
      calculation_order: 90
    },
    {
      id: 'r_irrf',
      code: '902',
      name: 'IRRF Mensal',
      type: 'DEDUCTION',
      category: 'TAX',
      calculation_form: 'AUTOMATICA',
      calculation_order: 95
    },
    {
      id: 'r_fgts',
      code: '903',
      name: 'FGTS Mensal',
      type: 'BASE',
      category: 'TAX',
      calculation_form: 'AUTOMATICA',
      calculation_order: 99
    }
  ];

  const testCases = [
    { bruto: 5000.00, inssEsperado: 501.51, irrfEsperado: 0.00 },
    { bruto: 5300.00, inssEsperado: 543.51, irrfEsperado: 108.84 },
    { bruto: 6000.00, inssEsperado: 641.51, irrfEsperado: 385.10 },
    { bruto: 7000.00, inssEsperado: 781.51, irrfEsperado: 754.75 },
    { bruto: 7350.00, inssEsperado: 830.51, irrfEsperado: 884.13 },
    { bruto: 12000.00, inssEsperado: 988.09, irrfEsperado: 2119.55 },
  ];

  testCases.forEach(({ bruto, inssEsperado, irrfEsperado }) => {
    it(`deve calcular corretamente para Bruto R$ ${bruto.toFixed(2)} (INSS: ~${inssEsperado}, IRRF: ${irrfEsperado})`, async () => {
      const context = new PayrollContext({
        salario_base: bruto,
        dias_trabalhados: 30,
        rubricas: standardRubrics,
        eventos: [
          { rubric_id: 'r_salario', quantity: 1, origin: 'AUTOMATICA' }
        ],
        inss_parameters: inssBrackets,
        irrf_parameters: irrfBrackets,
        general_legal_parameters: generalParams,
        dependentes: 0
      });

      const engine = new PayrollEngine(context);
      const result = await engine.run();

      expect(result.status).toBe('CALCULADA');
      expect(result.total_proventos).toBe(bruto);

      // INSS conferido com tolerância de até 2 centavos (devido a arredondamentos das faixas progressivas)
      expect(Math.abs(result.total_inss - inssEsperado)).toBeLessThanOrEqual(0.05);

      // IRRF esperado da tabela do Doc §4
      expect(result.total_irrf).toBeCloseTo(irrfEsperado, 2);

      // Memória de cálculo do IRRF deve ter sido registrada
      const irrfMem = result.memoria_calculo.find(m => m.step_name === 'IRRF');
      expect(irrfMem).toBeDefined();
      expect(irrfMem?.result_value).toBeCloseTo(irrfEsperado, 2);

      // A base de IRRF líquida pós deduções (bases.irrf) deve ser estritamente menor que o bruto
      expect(result.bases.irrf).toBeLessThan(bruto);
    });
  });
});
