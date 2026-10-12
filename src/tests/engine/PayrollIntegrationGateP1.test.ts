import { describe, it, expect } from 'vitest';
import { PayrollEngine } from '../../../supabase/functions/payroll-engine/engine/PayrollEngine';
import { PayrollContext } from '../../../supabase/functions/payroll-engine/engine/PayrollContext';
import {
  testInssBrackets,
  testIrrfBrackets,
  testGeneralLegalParameters,
  standardSystemRubrics,
  defaultTestContextData
} from '../fixtures/legalParameters';

describe('Gate P1: Teste de Integração Motor + Calculadoras (INSS, IRRF nos Limites e Dependentes)', () => {
  const salarioRubric = {
    id: 'rubric-salario-101',
    code: '101',
    name: 'Salário Base',
    type: 'EARNING' as const,
    category: 'SALARY',
    calculation_form: 'FIXO',
    calculation_base: 'SALARIO_BASE',
    calculation_order: 10,
    incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
  };

  const rubricas = [salarioRubric, ...standardSystemRubrics];

  describe('Cenários com 0 Dependentes', () => {
    it('1. Salário R$ 3.000,00 (0 dep): INSS na 3ª faixa, IRRF isento pelo redutor 2026', async () => {
      const context = new PayrollContext({
        ...defaultTestContextData,
        salario_base: 3000.00,
        dias_trabalhados: 30,
        num_dependentes: 0,
        rubricas,
        eventos: [{ rubric_id: 'rubric-salario-101', quantity: 1, origin: 'AUTOMATICA' }]
      });

      const engine = new PayrollEngine(context);
      const result = await engine.run();

      expect(result.status).toBe('CALCULADA');
      expect(result.total_proventos).toBe(3000.00);

      // INSS progressivo 2026 para R$ 3.000:
      // Faixa 1 (1621.00 * 7.5% = 121.575)
      // Faixa 2 ((2902.84 - 1621.00) * 9% = 1281.84 * 9% = 115.3656)
      // Faixa 3 ((3000.00 - 2902.84) * 12% = 97.16 * 12% = 11.6592)
      // Total INSS ~ 248.60
      expect(result.total_inss).toBeCloseTo(248.60, 2);

      // IRRF para R$ 3.000 em 2026: Bruto <= 5000 -> Redutor zera o IRRF
      expect(result.total_irrf).toBe(0.00);

      // Total descontos deve ser apenas o INSS
      expect(result.total_descontos).toBeCloseTo(result.total_inss, 2);
      expect(result.liquido).toBeCloseTo(result.total_proventos - result.total_descontos, 2);

      // FGTS: 8% de 3000 = 240.00 (tipo BASE, não desconta)
      expect(result.total_fgts).toBe(240.00);
    });

    it('2. Salário R$ 5.000,00 (0 dep): Limite exato de isenção do redutor 2026 (Doc §4)', async () => {
      const context = new PayrollContext({
        ...defaultTestContextData,
        salario_base: 5000.00,
        dias_trabalhados: 30,
        num_dependentes: 0,
        rubricas,
        eventos: [{ rubric_id: 'rubric-salario-101', quantity: 1, origin: 'AUTOMATICA' }]
      });

      const engine = new PayrollEngine(context);
      const result = await engine.run();

      expect(result.status).toBe('CALCULADA');
      expect(result.total_proventos).toBe(5000.00);

      // INSS sobre 5000 (faixa 4): ~501.51
      expect(result.total_inss).toBeCloseTo(501.51, 2);

      // IRRF em R$ 5.000,00 bruto: Redutor de 2026 zera o IRRF (Doc §4 Cenário 3)
      expect(result.total_irrf).toBe(0.00);

      expect(result.liquido).toBeCloseTo(5000.00 - result.total_inss, 2);
    });

    it('3. Salário R$ 6.000,00 (0 dep): Zona de transição do redutor 2026 (Doc §4)', async () => {
      const context = new PayrollContext({
        ...defaultTestContextData,
        salario_base: 6000.00,
        dias_trabalhados: 30,
        num_dependentes: 0,
        rubricas,
        eventos: [{ rubric_id: 'rubric-salario-101', quantity: 1, origin: 'AUTOMATICA' }]
      });

      const engine = new PayrollEngine(context);
      const result = await engine.run();

      expect(result.status).toBe('CALCULADA');
      expect(result.total_proventos).toBe(6000.00);

      // INSS sobre 6000: ~641.51
      expect(result.total_inss).toBeCloseTo(641.51, 2);

      // IRRF esperado com redutor 2026 (Doc §4 Cenário 4): ~R$ 385,10
      expect(result.total_irrf).toBeCloseTo(385.10, 1);

      // Invariante de itens
      expect(result.total_descontos).toBeCloseTo(result.total_inss + result.total_irrf, 2);
      expect(result.liquido).toBeCloseTo(result.total_proventos - result.total_descontos, 2);
    });

    it('4. Salário R$ 10.000,00 (0 dep): Acima do teto do INSS (R$ 8.475,55) e acima da faixa de transição do IRRF', async () => {
      const context = new PayrollContext({
        ...defaultTestContextData,
        salario_base: 10000.00,
        dias_trabalhados: 30,
        num_dependentes: 0,
        rubricas,
        eventos: [{ rubric_id: 'rubric-salario-101', quantity: 1, origin: 'AUTOMATICA' }]
      });

      const engine = new PayrollEngine(context);
      const result = await engine.run();

      expect(result.status).toBe('CALCULADA');

      // Teto do INSS em 2026: R$ 988,09 (teto máximo da faixa 4)
      expect(result.total_inss).toBeCloseTo(988.09, 2);
      expect(result.bases.inss).toBe(10000.00); // Base acumulada dos proventos tributáveis

      // IRRF sobre R$ 10.000 (acima de 7.350, redutor = 0, alíquota de 27.5%):
      // Base legal = 10000 - 988.09 = 9011.91 (dedução simplificada = 607.20, então dedução legal é mais vantajosa)
      // Imposto bruto = 9011.91 * 27.5% - 908.73 = 2478.28 - 908.73 = 1569.55
      expect(result.total_irrf).toBeCloseTo(1569.55, 2);

      expect(result.total_descontos).toBeCloseTo(result.total_inss + result.total_irrf, 2);
      expect(result.liquido).toBeCloseTo(10000.00 - result.total_descontos, 2);
    });
  });

  describe('Cenários com 1 e 3 Dependentes', () => {
    it('5. Salário R$ 6.000,00 com 1 Dependente (R$ 189,59 de dedução legal)', async () => {
      const context = new PayrollContext({
        ...defaultTestContextData,
        salario_base: 6000.00,
        dias_trabalhados: 30,
        num_dependentes: 1,
        rubricas,
        eventos: [{ rubric_id: 'rubric-salario-101', quantity: 1, origin: 'AUTOMATICA' }]
      });

      const engine = new PayrollEngine(context);
      const result = await engine.run();

      expect(result.status).toBe('CALCULADA');

      // INSS não é afetado por dependentes
      expect(result.total_inss).toBeCloseTo(641.51, 2);

      // Com 1 dependente:
      // Deduções legais: INSS (641.51) + 1 dep (189.59) = 831.10 > simplificada (607.20)
      // Base IRRF = 6000 - 831.29 = 5168.71
      // O IRRF com 1 dependente deve ser estritamente menor do que com 0 dependentes (R$ 385.10)
      expect(result.total_irrf).toBeLessThan(385.10);
      expect(result.total_irrf).toBeGreaterThan(0);
    });

    it('6. Salário R$ 6.000,00 com 3 Dependentes (3 × R$ 189,59 = R$ 568,77 de dedução legal)', async () => {
      const context = new PayrollContext({
        ...defaultTestContextData,
        salario_base: 6000.00,
        dias_trabalhados: 30,
        num_dependentes: 3,
        rubricas,
        eventos: [{ rubric_id: 'rubric-salario-101', quantity: 1, origin: 'AUTOMATICA' }]
      });

      const engine = new PayrollEngine(context);
      const result = await engine.run();

      expect(result.status).toBe('CALCULADA');

      // INSS inalterado
      expect(result.total_inss).toBeCloseTo(641.51, 2);

      // Com 3 dependentes: Dedução total = 641.51 + 568.77 = 1210.28
      // IRRF com 3 dependentes deve ser significativamente menor do que com 1 dependente
      expect(result.total_irrf).toBeLessThan(340.00);
      expect(result.liquido).toBeGreaterThan(6000.00 - 641.51 - 340.00);
    });
  });

  describe('Validação do Gate de P1', () => {
    it('7. Dois contratos executados em sequência não compartilham nem vazam estado', async () => {
      const contextA = new PayrollContext({
        ...defaultTestContextData,
        salario_base: 10000.00,
        dias_trabalhados: 30,
        num_dependentes: 0,
        rubricas,
        eventos: [{ rubric_id: 'rubric-salario-101', quantity: 1, origin: 'AUTOMATICA' }]
      });

      const contextB = new PayrollContext({
        ...defaultTestContextData,
        salario_base: 3000.00,
        dias_trabalhados: 30,
        num_dependentes: 3,
        rubricas,
        eventos: [{ rubric_id: 'rubric-salario-101', quantity: 1, origin: 'AUTOMATICA' }]
      });

      const engineA = new PayrollEngine(contextA);
      const resA = await engineA.run();

      const engineB = new PayrollEngine(contextB);
      const resB = await engineB.run();

      // Contrato A: Salário 10.000, INSS no teto
      expect(resA.total_proventos).toBe(10000.00);
      expect(resA.total_inss).toBeCloseTo(988.09, 2);

      // Contrato B: Salário 3.000, INSS normal ~248.60 e IRRF 0.00
      expect(resB.total_proventos).toBe(3000.00);
      expect(resB.total_inss).toBeCloseTo(248.60, 2);
      expect(resB.total_irrf).toBe(0.00);
    });
  });
});
