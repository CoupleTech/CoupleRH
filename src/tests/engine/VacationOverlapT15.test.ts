import { describe, it, expect } from 'vitest';
import {
  parseDateParts,
  isVacationCrossingMonth,
  calculateVacationDaysInMonth,
  VacationRequestItem,
} from '../../../supabase/functions/payroll-engine/engine/VacationOverlapCalculator';
import { PayrollEngine } from '../../../supabase/functions/payroll-engine/engine/PayrollEngine';
import { PayrollContext, Rubric } from '../../../supabase/functions/payroll-engine/engine/PayrollContext';
import { testInssBrackets, testIrrfBrackets, testGeneralLegalParameters } from '../fixtures/legalParameters';

describe('T15: Férias que Atravessam o Mês, Múltiplas Solicitações e Dias Comerciais', () => {
  describe('1. Parsing de Datas e Detecção de Sobreposição (imune a fuso horário UTC)', () => {
    it('deve extrair ano, mês e dia corretamente sem desvio de timezone', () => {
      const parts = parseDateParts('2026-02-01');
      expect(parts).toEqual({ year: 2026, month: 2, day: 1 });

      const partsEnd = parseDateParts('2026-03-31');
      expect(partsEnd).toEqual({ year: 2026, month: 3, day: 31 });
    });

    it('deve detectar corretamente férias que atravessam a competência', () => {
      // Competência: Fevereiro/2026 (01/02/2026 a 28/02/2026)
      // Caso 1: Férias iniciadas em janeiro e terminadas em fevereiro (20/01 a 08/02)
      expect(isVacationCrossingMonth('2026-01-20', '2026-02-08', 2026, 2)).toBe(true);

      // Caso 2: Férias iniciadas em fevereiro e terminadas em março (20/02 a 11/03)
      expect(isVacationCrossingMonth('2026-02-20', '2026-03-11', 2026, 2)).toBe(true);

      // Caso 3: Férias inteiramente contidas em janeiro (não cruza fevereiro)
      expect(isVacationCrossingMonth('2026-01-05', '2026-01-24', 2026, 2)).toBe(false);

      // Caso 4: Férias inteiramente contidas em março (não cruza fevereiro)
      expect(isVacationCrossingMonth('2026-03-01', '2026-03-30', 2026, 2)).toBe(false);

      // Caso 5: Férias que englobam o mês inteiro de fevereiro (15/01 a 15/03)
      expect(isVacationCrossingMonth('2026-01-15', '2026-03-15', 2026, 2)).toBe(true);
    });
  });

  describe('2. Apuração de Dias de Férias e Dias Trabalhados Comerciais (Base 30)', () => {
    it('Cenário 1: Férias iniciadas no mês anterior e terminadas no corrente (20/01 a 08/02 em Fev/2026)', () => {
      const vacations: VacationRequestItem[] = [
        {
          id: 'vac-1',
          contract_id: 'contract-1',
          start_date: '2026-01-20',
          end_date: '2026-02-08',
          days_taken: 20,
        },
      ];

      // Em Fev/2026: sobreposição de 01/02 a 08/02 = 8 dias de férias
      // Dias trabalhados: 30 - 8 = 22 dias
      const result = calculateVacationDaysInMonth(vacations, 2026, 2, 30);
      expect(result.vacationCommercialDays).toBe(8);
      expect(result.remainingWorkedDays).toBe(22);
      expect(result.totalCalendarOverlapDays).toBe(8);
      expect(result.vacationsApplied).toHaveLength(1);
    });

    it('Cenário 2: Férias iniciadas no mês corrente e terminadas no mês seguinte (20/02 a 11/03)', () => {
      const vacations: VacationRequestItem[] = [
        {
          id: 'vac-2',
          contract_id: 'contract-1',
          start_date: '2026-02-20',
          end_date: '2026-03-11',
          days_taken: 20,
        },
      ];

      // Em Fev/2026 (28 dias): sobreposição de 20/02 a 28/02 = 9 dias de férias
      // Dias trabalhados: 30 - 9 = 21 dias
      const fevResult = calculateVacationDaysInMonth(vacations, 2026, 2, 30);
      expect(fevResult.vacationCommercialDays).toBe(9);
      expect(fevResult.remainingWorkedDays).toBe(21);
      expect(fevResult.totalCalendarOverlapDays).toBe(9);

      // Em Mar/2026 (31 dias): sobreposição de 01/03 a 11/03 = 11 dias de férias
      // Dias trabalhados: 30 - 11 = 19 dias
      const marResult = calculateVacationDaysInMonth(vacations, 2026, 3, 30);
      expect(marResult.vacationCommercialDays).toBe(11);
      expect(marResult.remainingWorkedDays).toBe(19);
      expect(marResult.totalCalendarOverlapDays).toBe(11);
    });

    it('Cenário 3: Múltiplas solicitações de férias no mesmo mês (férias fracionadas)', () => {
      // Colaborador tira 5 dias de férias no início de Maio/2026 e 10 dias no final de Maio/2026
      const vacations: VacationRequestItem[] = [
        {
          id: 'vac-part-1',
          contract_id: 'contract-1',
          start_date: '2026-05-01',
          end_date: '2026-05-05',
          days_taken: 5,
        },
        {
          id: 'vac-part-2',
          contract_id: 'contract-1',
          start_date: '2026-05-20',
          end_date: '2026-05-29',
          days_taken: 10,
        },
      ];

      // Em Maio/2026: deve somar AMBAS as solicitações: 5 + 10 = 15 dias de férias
      // Dias trabalhados: 30 - 15 = 15 dias
      const result = calculateVacationDaysInMonth(vacations, 2026, 5, 30);
      expect(result.vacationCommercialDays).toBe(15);
      expect(result.remainingWorkedDays).toBe(15);
      expect(result.totalCalendarOverlapDays).toBe(15);
      expect(result.vacationsApplied).toHaveLength(2);
    });

    it('Cenário 4: Férias de 30 dias em mês de 31 dias (Março)', () => {
      const vacations: VacationRequestItem[] = [
        {
          id: 'vac-30d',
          contract_id: 'contract-1',
          start_date: '2026-03-01',
          end_date: '2026-03-30',
          days_taken: 30,
        },
      ];

      // 30 dias de férias em mês de 31 dias: dias trabalhados = 0 (não paga dia 31 de saldo de salário)
      const result = calculateVacationDaysInMonth(vacations, 2026, 3, 30);
      expect(result.vacationCommercialDays).toBe(30);
      expect(result.remainingWorkedDays).toBe(0);
    });

    it('Cenário 5: Férias integrais em Fevereiro (28 dias cobrindo o mês inteiro)', () => {
      const vacations: VacationRequestItem[] = [
        {
          id: 'vac-fev-full',
          contract_id: 'contract-1',
          start_date: '2026-02-01',
          end_date: '2026-02-28',
          days_taken: 28,
        },
      ];

      // Férias cobrindo todo o mês de fevereiro: dias trabalhados = 0 (não sobra 2 dias)
      const result = calculateVacationDaysInMonth(vacations, 2026, 2, 30);
      expect(result.vacationCommercialDays).toBe(30);
      expect(result.remainingWorkedDays).toBe(0);
    });
  });

  describe('3. Integração com o PayrollEngine e Saldo de Salário Mensal', () => {
    const createTestRubrics = (): Rubric[] => [
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
        id: 'rub-550',
        code: '550',
        name: 'Líquido de Férias (Adiantamento)',
        type: 'DEDUCTION',
        category: 'DEDUCTION',
        rubric_kind: 'OTHER',
        calculation_form: 'MANUAL',
        calculation_order: 80,
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

    it('deve pagar salário proporcional a 22 dias quando colaborador tem 8 dias de férias em fevereiro', async () => {
      const rubricas = createTestRubrics();
      const salarioBase = 3000.0;

      // 8 dias de férias -> 22 dias trabalhados
      // Salário proporcional = 3000 * (22 / 30) = 2200.00
      const context = new PayrollContext({
        contrato_id: 'contract-1',
        salario_base: salarioBase,
        dias_trabalhados: 22,
        rubricas,
        eventos: [{ rubric_id: 'rub-101', quantity: 22, manual_value: 0 }],
        salario_minimo: 1621.0,
        inss_parameters: testInssBrackets,
        irrf_parameters: testIrrfBrackets,
        general_legal_parameters: testGeneralLegalParameters,
      });

      const engine = new PayrollEngine(context);
      const result = await engine.run();

      expect(result.total_proventos).toBe(2200.0);
      const itemSalario = result.memoria_calculo.find((m) => m.rubric_id === 'rub-101');
      expect(itemSalario?.result_value).toBe(2200.0);
    });

    it('deve pagar 0 de salário base quando o colaborador goza férias durante todo o mês comercial', async () => {
      const rubricas = createTestRubrics();
      const salarioBase = 3000.0;

      // 30 dias de férias -> 0 dias trabalhados
      const context = new PayrollContext({
        contrato_id: 'contract-1',
        salario_base: salarioBase,
        dias_trabalhados: 0,
        rubricas,
        eventos: [{ rubric_id: 'rub-101', quantity: 0, manual_value: 0 }],
        salario_minimo: 1621.0,
        inss_parameters: testInssBrackets,
        irrf_parameters: testIrrfBrackets,
        general_legal_parameters: testGeneralLegalParameters,
      });

      const engine = new PayrollEngine(context);
      const result = await engine.run();

      expect(result.total_proventos).toBe(0);
      const itemSalario = result.memoria_calculo.find((m) => m.rubric_id === 'rub-101');
      expect(itemSalario?.result_value || 0).toBe(0);
    });
  });
});
