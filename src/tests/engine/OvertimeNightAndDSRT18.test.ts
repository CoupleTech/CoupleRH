import { describe, it, expect } from 'vitest';
import { PayrollEngine } from '../../../supabase/functions/payroll-engine/engine/PayrollEngine';
import { PayrollContext, Rubric } from '../../../supabase/functions/payroll-engine/engine/PayrollContext';
import { testInssBrackets, testIrrfBrackets, testGeneralLegalParameters, standardSystemRubrics } from '../fixtures/legalParameters';
import { calculateReducedNightHours } from '../../../supabase/functions/payroll-engine/legal/NightWorkCalculator';

describe('T18: BASE_HORA_EXTRA (Súmula 264), DSR com Noturno/Variáveis, Hora Noturna Reduzida, DSR s/ Faltas e Fator Obrigatório', () => {

  describe('1. Hora Noturna Reduzida (Art. 73 § 1º da CLT: 52min30s = 60/52.5)', () => {
    it('deve converter horas relógio para horas noturnas reduzidas com fator 60 / 52.5', () => {
      // 7 horas relógio (22h às 05h) = exatamente 8 horas noturnas fictas (7 * 60 / 52.5 = 8.0)
      expect(calculateReducedNightHours(7)).toBe(8.00);

      // 3.5 horas relógio = 4 horas noturnas (3.5 * 60 / 52.5 = 4.0)
      expect(calculateReducedNightHours(3.5)).toBe(4.00);

      // 1 hora relógio = 1.14 horas noturnas (60 / 52.5 = 1.142857 -> 1.14)
      expect(calculateReducedNightHours(1)).toBe(1.14);
    });
  });

  describe('2. BASE_HORA_EXTRA com Adicionais Habituais (Súmula 264 do TST)', () => {
    it('deve compor a BASE_HORA_EXTRA somando Salário Base + Adicional de Periculosidade', async () => {
      // Salário Base: R$ 3.000,00
      // Periculosidade 30%: R$ 900,00
      // BASE_HORA_EXTRA = R$ 3.900,00
      // Divisor: 220 -> Valor da hora base = 3900 / 220 = 17.727272...
      // 10 Horas Extras 50% (fator 1.5): (17.727272 * 1.5) * 10 = 265.91
      const rubricas: Rubric[] = [
        {
          id: 'r-101', code: '101', name: 'Salário Base',
          type: 'EARNING', category: 'SALARY', rubric_kind: 'SALARY_BASE',
          calculation_form: 'DIAS', calculation_base: 'SALARIO_BASE', divisor: 30, calculation_order: 10,
          incidencias: { inss: true, irrf: true, fgts: true, gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
        },
        {
          id: 'r-303', code: '303', name: 'Adicional de Periculosidade 30%',
          type: 'EARNING', category: 'ALLOWANCE', rubric_kind: 'PERICULOSIDADE',
          calculation_form: 'PERCENTUAL', calculation_base: 'SALARIO_BASE', percentage: 30, calculation_order: 20,
          incidencias: { inss: true, irrf: true, fgts: true, gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
        },
        {
          id: 'r-201', code: '201', name: 'Horas Extras 50%',
          type: 'EARNING', category: 'OVERTIME', rubric_kind: 'OVERTIME',
          calculation_form: 'HORAS', calculation_base: 'BASE_HORA_EXTRA', divisor: 220, factor: 1.5, calculation_order: 30,
          incidencias: { inss: true, irrf: true, fgts: true, gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
        },
        ...(standardSystemRubrics as any)
      ];

      const context = new PayrollContext({
        competencia: '2026-03',
        tipo_folha: 'MONTHLY',
        empregado_id: 'emp-1',
        contrato_id: 'ct-1',
        salario_base: 3000.00,
        dias_trabalhados: 30,
        dias_uteis: 26,
        dias_inuteis: 4,
        divisor: 220,
        rubricas,
        eventos: [
          { rubric_id: 'r-101', quantity: 30, manual_value: 0 },
          { rubric_id: 'r-303', quantity: 1, manual_value: 900.00 },
          { rubric_id: 'r-201', quantity: 10 } // 10 HE 50%
        ],
        inss_parameters: testInssBrackets,
        irrf_parameters: testIrrfBrackets,
        general_legal_parameters: testGeneralLegalParameters
      });

      const engine = new PayrollEngine(context);
      const resultado = await engine.run();

      // Periculosidade deve ser 900.00
      const itemPeric = resultado.memoria_calculo.find(m => m.rubric_id === 'r-303');
      expect(itemPeric?.result_value).toBe(900.00);

      // BASE_HORA_EXTRA no contexto deve ser 3900.00
      expect(context.getVariable('BASE_HORA_EXTRA')).toBe(3900.00);

      // Hora extra 50% calculada sobre 3900.00 deve ser 265.91 (e não 204.55 sobre 3000)
      const itemHE = resultado.memoria_calculo.find(m => m.rubric_id === 'r-201');
      expect(itemHE).toBeDefined();
      expect(itemHE?.result_value).toBe(265.91);
      expect(itemHE?.base_value).toBe(3900.00);
    });

    it('Hora extra deve disparar ERRO explícito se o fator não estiver cadastrado (sem fallback silencioso para 1.5)', async () => {
      const rubricas: Rubric[] = [
        {
          id: 'r-101', code: '101', name: 'Salário Base',
          type: 'EARNING', category: 'SALARY', rubric_kind: 'SALARY_BASE',
          calculation_form: 'DIAS', calculation_base: 'SALARIO_BASE', divisor: 30, calculation_order: 10,
          incidencias: { inss: true, irrf: true, fgts: true, gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
        },
        {
          id: 'r-201', code: '201', name: 'Horas Extras Sem Fator',
          type: 'EARNING', category: 'OVERTIME', rubric_kind: 'OVERTIME',
          calculation_form: 'HORAS', calculation_base: 'BASE_HORA_EXTRA', divisor: 220, calculation_order: 30,
          // FATOR E PERCENTAGE NULOS INTENCIONALMENTE
          factor: undefined,
          percentage: undefined,
          incidencias: { inss: true, irrf: true, fgts: true, gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
        },
        ...(standardSystemRubrics as any)
      ];

      const context = new PayrollContext({
        competencia: '2026-03',
        tipo_folha: 'MONTHLY',
        empregado_id: 'emp-1',
        contrato_id: 'ct-1',
        salario_base: 2200.00,
        dias_trabalhados: 30,
        dias_uteis: 26,
        dias_inuteis: 4,
        divisor: 220,
        rubricas,
        eventos: [
          { rubric_id: 'r-101', quantity: 30, manual_value: 0 },
          { rubric_id: 'r-201', quantity: 10 }
        ],
        inss_parameters: testInssBrackets,
        irrf_parameters: testIrrfBrackets,
        general_legal_parameters: testGeneralLegalParameters
      });

      const engine = new PayrollEngine(context);
      const resultado = await engine.run();

      expect(resultado.status).toContain('ERRO_CALCULO');
      expect(resultado.status).toContain('Fator multiplicador obrigatório não configurado');
    });
  });

  describe('3. DSR com Calendário Válido e Integração de Variáveis (integra_dsr)', () => {
    it('DSR deve disparar ERRO explícito se dias_uteis for zero (sem fallback 20%)', async () => {
      const rubricas: Rubric[] = [
        {
          id: 'r-101', code: '101', name: 'Salário Base',
          type: 'EARNING', category: 'SALARY', rubric_kind: 'SALARY_BASE',
          calculation_form: 'DIAS', calculation_base: 'SALARIO_BASE', divisor: 30, calculation_order: 10,
          incidencias: { inss: true, irrf: true, fgts: true, gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
        },
        {
          id: 'r-104', code: '104', name: 'DSR sobre Horas Extras',
          type: 'EARNING', category: 'DSR', rubric_kind: 'DSR',
          calculation_form: 'PERCENTUAL', calculation_base: 'BASE_DSR', calculation_order: 40,
          incidencias: { inss: true, irrf: true, fgts: true, gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
        },
        ...(standardSystemRubrics as any)
      ];

      const context = new PayrollContext({
        competencia: '2026-03',
        tipo_folha: 'MONTHLY',
        empregado_id: 'emp-1',
        contrato_id: 'ct-1',
        salario_base: 2200.00,
        dias_trabalhados: 30,
        dias_uteis: 0, // INVÁLIDO
        dias_inuteis: 4,
        divisor: 220,
        rubricas,
        eventos: [
          { rubric_id: 'r-101', quantity: 30, manual_value: 0 }
        ],
        inss_parameters: testInssBrackets,
        irrf_parameters: testIrrfBrackets,
        general_legal_parameters: testGeneralLegalParameters
      });

      const engine = new PayrollEngine(context);
      const resultado = await engine.run();

      expect(resultado.status).toContain('ERRO_CALCULO');
      expect(resultado.status).toContain('dias úteis');
    });

    it('BASE_DSR deve acumular rubricas com integra_dsr (como comissões e prêmios habituais)', async () => {
      const rubricas: Rubric[] = [
        {
          id: 'r-101', code: '101', name: 'Salário Base',
          type: 'EARNING', category: 'SALARY', rubric_kind: 'SALARY_BASE',
          calculation_form: 'DIAS', calculation_base: 'SALARIO_BASE', divisor: 30, calculation_order: 10,
          incidencias: { inss: true, irrf: true, fgts: true, gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
        },
        {
          id: 'r-401', code: '401', name: 'Prêmio por Desempenho Habitual',
          type: 'EARNING', category: 'OTHER', rubric_kind: 'COMMISSION',
          calculation_form: 'MANUAL', calculation_order: 25,
          incidencias: { inss: true, irrf: true, fgts: true, integra_dsr: true, gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
        },
        {
          id: 'r-104', code: '104', name: 'DSR sobre Variáveis',
          type: 'EARNING', category: 'DSR', rubric_kind: 'DSR',
          calculation_form: 'PERCENTUAL', calculation_base: 'BASE_DSR', calculation_order: 50,
          incidencias: { inss: true, irrf: true, fgts: true, gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
        },
        ...(standardSystemRubrics as any)
      ];

      // Mês com 24 dias úteis e 4 repousos -> percentual DSR = (4 / 24) * 100 = 16.6666...%
      // Prêmio: R$ 600,00 -> DSR = (600 / 24) * 4 = R$ 100,00
      const context = new PayrollContext({
        competencia: '2026-03',
        tipo_folha: 'MONTHLY',
        empregado_id: 'emp-1',
        contrato_id: 'ct-1',
        salario_base: 3000.00,
        dias_trabalhados: 30,
        dias_uteis: 24,
        dias_inuteis: 4,
        divisor: 220,
        rubricas,
        eventos: [
          { rubric_id: 'r-101', quantity: 30, manual_value: 0 },
          { rubric_id: 'r-401', quantity: 1, manual_value: 600.00 }
        ],
        inss_parameters: testInssBrackets,
        irrf_parameters: testIrrfBrackets,
        general_legal_parameters: testGeneralLegalParameters
      });

      const engine = new PayrollEngine(context);
      const resultado = await engine.run();

      expect(context.getVariable('BASE_DSR')).toBe(600.00);

      const itemDsr = resultado.memoria_calculo.find(m => m.rubric_id === 'r-104');
      expect(itemDsr).toBeDefined();
      expect(itemDsr?.result_value).toBe(100.00);
    });
  });

  describe('4. DSR sobre Faltas (rubrica 212 / 803 - Perda de Repouso Semanal)', () => {
    it('deve descontar 1 dia de DSR (salario/30) por repouso perdido por falta injustificada', async () => {
      // Salário R$ 3.000,00 -> 1 dia = R$ 100,00
      // 1 falta injustificada (R$ 100) + 1 perda de DSR semanal (R$ 100)
      const rubricas: Rubric[] = [
        {
          id: 'r-101', code: '101', name: 'Salário Base',
          type: 'EARNING', category: 'SALARY', rubric_kind: 'SALARY_BASE',
          calculation_form: 'DIAS', calculation_base: 'SALARIO_BASE', divisor: 30, calculation_order: 10,
          incidencias: { inss: true, irrf: true, fgts: true, gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
        },
        {
          id: 'r-801', code: '801', name: 'Faltas Injustificadas',
          type: 'DEDUCTION', category: 'OTHER', rubric_kind: 'ABSENCE',
          calculation_form: 'DIAS', calculation_base: 'SALARIO_BASE', divisor: 30, calculation_order: 20,
          incidencias: { inss: true, irrf: true, fgts: true, gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
        },
        {
          id: 'r-212', code: '212', name: 'DSR sobre Faltas',
          type: 'DEDUCTION', category: 'OTHER', rubric_kind: 'ABSENCE',
          calculation_form: 'DIAS', calculation_base: 'SALARIO_BASE', divisor: 30, calculation_order: 25,
          incidencias: { inss: true, irrf: true, fgts: true, gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
        },
        ...(standardSystemRubrics as any)
      ];

      const context = new PayrollContext({
        competencia: '2026-03',
        tipo_folha: 'MONTHLY',
        empregado_id: 'emp-1',
        contrato_id: 'ct-1',
        salario_base: 3000.00,
        dias_trabalhados: 30,
        dias_uteis: 26,
        dias_inuteis: 4,
        divisor: 220,
        rubricas,
        eventos: [
          { rubric_id: 'r-101', quantity: 30, manual_value: 0 },
          { rubric_id: 'r-801', quantity: 1 }, // 1 dia de falta
          { rubric_id: 'r-212', quantity: 1 }  // 1 DSR perdido
        ],
        inss_parameters: testInssBrackets,
        irrf_parameters: testIrrfBrackets,
        general_legal_parameters: testGeneralLegalParameters
      });

      const engine = new PayrollEngine(context);
      const resultado = await engine.run();

      const itemFalta = resultado.memoria_calculo.find(m => m.rubric_id === 'r-801');
      const itemDsrFalta = resultado.memoria_calculo.find(m => m.rubric_id === 'r-212');

      expect(itemFalta?.result_value).toBe(100.00);
      expect(itemDsrFalta?.result_value).toBe(100.00);

      // Base tributária reduzida: 3000 - 100 - 100 = 2800.00
      expect(resultado.bases.inss).toBe(2800.00);
    });
  });

});
