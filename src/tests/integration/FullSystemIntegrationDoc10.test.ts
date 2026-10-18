// src/tests/integration/FullSystemIntegrationDoc10.test.ts
import { describe, it, expect } from 'vitest';
import { PayrollEngine } from '../../../supabase/functions/payroll-engine/engine/PayrollEngine.ts';
import { PayrollContext } from '../../../supabase/functions/payroll-engine/engine/PayrollContext.ts';
import {
  shouldSkipFutureAdmission,
  calculateWorkingDays
} from '../../../supabase/functions/payroll-engine/engine/ContractAdmissionFilter.ts';
import {
  testInssBrackets,
  testIrrfBrackets,
  testGeneralLegalParameters
} from '../fixtures/legalParameters.ts';
import { goldenStandardRubrics } from '../fixtures/goldenPayslipCases.ts';

// Ponto Eletrônico
import {
  calculateDailyWorkShift,
  type DailyShiftInput,
  type ShiftSchedule
} from '../../services/timeTracking/workShiftEngine.ts';
import {
  TimeBankService,
  type TimeBankAccount,
  type TimeDailySummaryInput
} from '../../services/timeTracking/timeBankService.ts';
import {
  TimeExportService,
  type AfdExportParams
} from '../../services/timeTracking/timeExportService.ts';
import type { TimePunchRecord } from '../../services/timeTracking/timeTrackingModel.ts';

// Assinatura Digital
import {
  DocumentGeneratorService,
  type PayslipSnapshot
} from '../../services/documents/documentGeneratorService.ts';
import { DocumentSigningService } from '../../services/documents/documentSigningService.ts';
import { DocumentOtpService } from '../../services/documents/documentOtpService.ts';
import { SignatureCanvasCore } from '../../services/documents/signatureCanvasCore.ts';
import { validateVerificationCode } from '../../services/documents/documentSignatureModel.ts';

/**
 * ============================================================================
 * SUÍTE COMPLETA DE INTEGRAÇÃO DO SISTEMA (DOCUMENTO §10 / FASE P9)
 * ============================================================================
 * Esta suíte consolida a validação ponta a ponta dos 9 testes obrigatórios
 * do Doc §10 e comprova a integração harmônica entre:
 * 1. Motor de Folha e Calculadoras Legais (INSS, IRRF, FGTS, DSR e Proporcionalidade)
 * 2. Ponto Eletrônico (Jornada, Noturno, 12x36, Feriados, Banco de Horas e Portaria 671)
 * 3. Assinatura Digital Avançada (Hash H1, OTP, Rubrica, Manifesto H2 e Tamper Detection)
 */

describe('Fase P9: Suíte de Integração Completa (Doc §10) — Folha, Ponto e Assinaturas', () => {

  // ==========================================================================
  // PARTE 1: MOTOR DE FOLHA E CALCULADORAS LEGAIS CLT 2026
  // ==========================================================================
  describe('1. Integração Motor + Calculadoras Legais (Doc §10)', () => {

    it('1.1 Integração T1: Tabela de Aceite Oficial do IRRF 2026 com Redutor', async () => {
      // Tabela T1 do Doc §4: 6 cenários oficiais
      const t1Cases = [
        { bruto: 5000.00, inss: 501.51, irrf: 0.00 },
        { bruto: 5300.00, inss: 543.51, irrf: 108.84 },
        { bruto: 6000.00, inss: 641.51, irrf: 385.10 },
        { bruto: 7000.00, inss: 781.51, irrf: 754.75 },
        { bruto: 7350.00, inss: 830.51, irrf: 884.13 },
        { bruto: 12000.00, inss: 988.09, irrf: 2119.55 }
      ];

      for (const tc of t1Cases) {
        const context = new PayrollContext({
          competencia: '01/2026',
          tipo_folha: 'MONTHLY',
          salario_base: tc.bruto,
          dias_trabalhados: 30,
          salario_minimo: 1621.00,
          num_dependentes: 0,
          rubricas: goldenStandardRubrics,
          eventos: [{ rubric_id: 'rub-101', quantity: 30, origin: 'AUTOMATICA' }],
          inss_parameters: testInssBrackets,
          irrf_parameters: testIrrfBrackets,
          general_legal_parameters: testGeneralLegalParameters
        });

        const engine = new PayrollEngine(context);
        const res = await engine.run();

        expect(res.status).toBe('CALCULADA');
        expect(res.total_proventos).toBe(tc.bruto);
        expect(res.total_inss).toBeCloseTo(tc.inss, 2);
        expect(res.total_irrf).toBeCloseTo(tc.irrf, 2);
        expect(res.liquido).toBeCloseTo(tc.bruto - (res.total_inss + res.total_irrf), 2);
      }
    });

    it('1.2 INSS nos Limites das Faixas (1.621,00 / 2.902,84 / 4.354,27 / 8.475,55 / > Teto)', async () => {
      const inssLimits = [
        { salario: 1621.00, expectedInss: 121.57, desc: 'Fronteira Faixa 1 (7.5%)' },
        { salario: 2902.84, expectedInss: 236.94, desc: 'Fronteira Faixa 2 (9%)' },
        { salario: 4354.27, expectedInss: 411.11, desc: 'Fronteira Faixa 3 (12%)' },
        { salario: 8475.55, expectedInss: 988.09, desc: 'Teto Previdenciário (14%)' },
        { salario: 15000.00, expectedInss: 988.09, desc: 'Acima do Teto (Retenção Travada)' }
      ];

      for (const limit of inssLimits) {
        const ctx = new PayrollContext({
          competencia: '01/2026',
          tipo_folha: 'MONTHLY',
          salario_base: limit.salario,
          dias_trabalhados: 30,
          salario_minimo: 1621.00,
          num_dependentes: 0,
          rubricas: goldenStandardRubrics,
          eventos: [{ rubric_id: 'rub-101', quantity: 30, origin: 'AUTOMATICA' }],
          inss_parameters: testInssBrackets,
          irrf_parameters: testIrrfBrackets,
          general_legal_parameters: testGeneralLegalParameters
        });

        const res = await new PayrollEngine(ctx).run();
        expect(res.total_inss).toBeCloseTo(limit.expectedInss, 2);
      }
    });

    it('1.3 IRRF nos Pontos Críticos com 0, 1 e 3 Dependentes', async () => {
      // 0 Dependentes
      const ctx0 = new PayrollContext({
        competencia: '01/2026',
        tipo_folha: 'MONTHLY',
        salario_base: 5000.00,
        dias_trabalhados: 30,
        salario_minimo: 1621.00,
        num_dependentes: 0,
        rubricas: goldenStandardRubrics,
        eventos: [{ rubric_id: 'rub-101', quantity: 30, origin: 'AUTOMATICA' }],
        inss_parameters: testInssBrackets,
        irrf_parameters: testIrrfBrackets,
        general_legal_parameters: testGeneralLegalParameters
      });
      const res0 = await new PayrollEngine(ctx0).run();
      expect(res0.total_irrf).toBe(0.00); // Isento pelo redutor

      // 1 Dependente com Salário R$ 5.500,00
      const ctx1 = new PayrollContext({
        competencia: '01/2026',
        tipo_folha: 'MONTHLY',
        salario_base: 5500.00,
        dias_trabalhados: 30,
        salario_minimo: 1621.00,
        num_dependentes: 1,
        rubricas: goldenStandardRubrics,
        eventos: [{ rubric_id: 'rub-101', quantity: 30, origin: 'AUTOMATICA' }],
        inss_parameters: testInssBrackets,
        irrf_parameters: testIrrfBrackets,
        general_legal_parameters: testGeneralLegalParameters
      });
      const res1 = await new PayrollEngine(ctx1).run();
      expect(res1.total_irrf).toBe(148.15);

      // 3 Dependentes com Salário R$ 7.000,00
      const ctx3 = new PayrollContext({
        competencia: '01/2026',
        tipo_folha: 'MONTHLY',
        salario_base: 7000.00,
        dias_trabalhados: 30,
        salario_minimo: 1621.00,
        num_dependentes: 3,
        rubricas: goldenStandardRubrics,
        eventos: [{ rubric_id: 'rub-101', quantity: 30, origin: 'AUTOMATICA' }],
        inss_parameters: testInssBrackets,
        irrf_parameters: testIrrfBrackets,
        general_legal_parameters: testGeneralLegalParameters
      });
      const res3 = await new PayrollEngine(ctx3).run();
      expect(res3.total_irrf).toBe(598.34);
    });

    it('1.4 DSR com Calendário de Dias Úteis Reais (Fevereiro vs Março)', async () => {
      // Fevereiro 2026: 24 dias úteis e 4 domingos/feriados -> 4 / 24 = 16.67%
      const ctxFev = new PayrollContext({
        competencia: '02/2026',
        tipo_folha: 'MONTHLY',
        salario_base: 2200.00,
        dias_trabalhados: 30,
        dias_uteis: 24,
        dias_inuteis: 4,
        divisor: 220,
        salario_minimo: 1621.00,
        rubricas: goldenStandardRubrics,
        eventos: [
          { rubric_id: 'rub-101', quantity: 30, origin: 'AUTOMATICA' },
          { rubric_id: 'rub-150', quantity: 10, origin: 'MANUAL' } // 10 HE 50% = 150,00
        ],
        inss_parameters: testInssBrackets,
        irrf_parameters: testIrrfBrackets,
        general_legal_parameters: testGeneralLegalParameters
      });
      const resFev = await new PayrollEngine(ctxFev).run();
      const dsrItemFev = resFev.memoria_calculo.find(m => m.rubric_id === 'rub-104');
      expect(dsrItemFev?.result_value).toBeCloseTo(25.00, 2);

      // Março 2026: 26 dias úteis e 5 domingos/feriados -> 5 / 26 = 19.23%
      const ctxMar = new PayrollContext({
        competencia: '03/2026',
        tipo_folha: 'MONTHLY',
        salario_base: 2200.00,
        dias_trabalhados: 30,
        dias_uteis: 26,
        dias_inuteis: 5,
        divisor: 220,
        salario_minimo: 1621.00,
        rubricas: goldenStandardRubrics,
        eventos: [
          { rubric_id: 'rub-101', quantity: 30, origin: 'AUTOMATICA' },
          { rubric_id: 'rub-150', quantity: 10, origin: 'MANUAL' } // 10 HE 50% = 150,00
        ],
        inss_parameters: testInssBrackets,
        irrf_parameters: testIrrfBrackets,
        general_legal_parameters: testGeneralLegalParameters
      });
      const resMar = await new PayrollEngine(ctxMar).run();
      const dsrItemMar = resMar.memoria_calculo.find(m => m.rubric_id === 'rub-104');
      expect(dsrItemMar?.result_value).toBeCloseTo(28.85, 2);
    });

    it('1.5 Proporcionalidade: Admissão nos dias 1, 15, 31 e Mês Futuro', () => {
      // Admissão no dia 1: mês integral trabalhado (30 dias)
      expect(calculateWorkingDays('2026-03-01', 2026, 3)).toBe(30);

      // Admissão no dia 15: 30 - 15 + 1 = 16 dias trabalhados
      expect(calculateWorkingDays('2026-03-15', 2026, 3)).toBe(16);

      // Admissão no dia 31: base 30 comercial de DP -> conta como 1 dia trabalhado
      expect(calculateWorkingDays('2026-03-31', 2026, 3)).toBe(1);

      // Admissão em mês futuro: ignorado com 0 dias
      expect(shouldSkipFutureAdmission('2026-04-10', 2026, 3)).toBe(true);
      expect(calculateWorkingDays('2026-04-10', 2026, 3)).toBe(0);
    });

    it('1.6 Duas Folhas Seguidas sem Vazamento de Estado ou Rubricas (T2 Doc §4)', async () => {
      const ctxA = new PayrollContext({
        competencia: '01/2026',
        tipo_folha: 'MONTHLY',
        salario_base: 3000.00,
        dias_trabalhados: 30,
        dias_uteis: 20,
        dias_inuteis: 5,
        divisor: 220,
        salario_minimo: 1621.00,
        rubricas: goldenStandardRubrics,
        eventos: [
          { rubric_id: 'rub-101', quantity: 30, origin: 'AUTOMATICA' },
          { rubric_id: 'rub-150', quantity: 20, origin: 'MANUAL' }
        ],
        inss_parameters: testInssBrackets,
        irrf_parameters: testIrrfBrackets,
        general_legal_parameters: testGeneralLegalParameters
      });

      const ctxB = new PayrollContext({
        competencia: '01/2026',
        tipo_folha: 'MONTHLY',
        salario_base: 2500.00,
        dias_trabalhados: 30,
        dias_uteis: 26,
        dias_inuteis: 4,
        divisor: 220,
        salario_minimo: 1621.00,
        rubricas: goldenStandardRubrics,
        eventos: [
          { rubric_id: 'rub-101', quantity: 30, origin: 'AUTOMATICA' }
        ],
        inss_parameters: testInssBrackets,
        irrf_parameters: testIrrfBrackets,
        general_legal_parameters: testGeneralLegalParameters
      });

      const resA = await new PayrollEngine(ctxA).run();
      const resB = await new PayrollEngine(ctxB).run();

      expect(resA.total_proventos).toBeGreaterThan(3000.00);
      expect(resB.total_proventos).toBe(2500.00);
      expect(resB.memoria_calculo.some(m => m.rubric_id === 'rub-150')).toBe(false);
      expect(resB.memoria_calculo.some(m => m.rubric_id === 'rub-104')).toBe(false);
    });

    it('1.7 Invariantes Contábeis Globais e Idempotência', async () => {
      const makeContext = () => new PayrollContext({
        competencia: '01/2026',
        tipo_folha: 'MONTHLY',
        salario_base: 4500.00,
        dias_trabalhados: 30,
        salario_minimo: 1621.00,
        num_dependentes: 1,
        rubricas: goldenStandardRubrics,
        eventos: [{ rubric_id: 'rub-101', quantity: 30, origin: 'AUTOMATICA' }],
        inss_parameters: testInssBrackets,
        irrf_parameters: testIrrfBrackets,
        general_legal_parameters: testGeneralLegalParameters
      });

      const res1 = await new PayrollEngine(makeContext()).run();
      const res2 = await new PayrollEngine(makeContext()).run();

      // Invariante 1: Equação Contábil
      expect(res1.liquido).toBeCloseTo(res1.total_proventos - res1.total_descontos, 2);

      // Invariante 2: Bases não negativas
      expect(res1.bases.inss).toBeGreaterThanOrEqual(0);
      expect(res1.bases.irrf).toBeGreaterThanOrEqual(0);
      expect(res1.bases.fgts).toBeGreaterThanOrEqual(0);

      // Invariante 3: Idempotência exata entre execuções
      expect(res1.total_proventos).toBe(res2.total_proventos);
      expect(res1.total_descontos).toBe(res2.total_descontos);
      expect(res1.liquido).toBe(res2.liquido);
      expect(res1.total_inss).toBe(res2.total_inss);
      expect(res1.total_irrf).toBe(res2.total_irrf);
      expect(res1.total_fgts).toBe(res2.total_fgts);
    });
  });

  // ==========================================================================
  // PARTE 2: PONTO ELETRÔNICO E JORNADA CLT (PORTARIA MTP 671/2021)
  // ==========================================================================
  describe('2. Ponto Eletrônico e Apuração de Jornada CLT (Doc §10 / Fase P5)', () => {

    it('2.1 Trabalho Noturno com Redução Ficta Legal (Art. 73 CLT: 60/52.5)', () => {
      const nightSchedule: ShiftSchedule = {
        schedule_type: 'FIXED',
        expected_in: '22:00',
        expected_break_start: '01:00',
        expected_break_end: '02:00',
        expected_out: '06:00',
        expected_work_minutes: 420,
        expected_break_minutes: 60
      };

      const input: DailyShiftInput = {
        date: '2026-10-05',
        contract_id: 'contract-noturno',
        tenant_id: 'tenant-1',
        punches: [
          '2026-10-05T22:00:00-03:00',
          '2026-10-06T01:00:00-03:00',
          '2026-10-06T02:00:00-03:00',
          '2026-10-06T06:00:00-03:00'
        ],
        schedule: nightSchedule
      };

      const result = calculateDailyWorkShift(input);
      expect(result.night_shift_minutes).toBeGreaterThan(0);
      expect(result.status).toBe('REGULAR');
    });

    it('2.2 Regime de Escala 12x36 (Art. 59-A da CLT: Feriados na Escala sem HE 100%)', () => {
      const shift12x36Schedule: ShiftSchedule = {
        schedule_type: 'SHIFT_12X36',
        expected_in: '07:00',
        expected_break_start: '12:00',
        expected_break_end: '13:00',
        expected_out: '19:00',
        expected_work_minutes: 660,
        expected_break_minutes: 60
      };

      const input: DailyShiftInput = {
        date: '2026-10-12', // Feriado Nacional de N. Sra. Aparecida
        contract_id: 'contract-12x36',
        tenant_id: 'tenant-1',
        isHolidayOrDsr: true,
        punches: [
          '2026-10-12T07:00:00-03:00',
          '2026-10-12T12:00:00-03:00',
          '2026-10-12T13:00:00-03:00',
          '2026-10-12T19:00:00-03:00'
        ],
        schedule: shift12x36Schedule
      };

      const result = calculateDailyWorkShift(input);
      expect(result.overtime_100_minutes).toBe(0);
      expect(result.worked_minutes).toBe(660);
      expect(result.status).toBe('REGULAR');
    });

    it('2.3 Feriados Trabalhados Fora de Escala Geram HE 100% Obrigatória', () => {
      const standardSchedule: ShiftSchedule = {
        schedule_type: 'FIXED',
        expected_in: '08:00',
        expected_break_start: '12:00',
        expected_break_end: '13:00',
        expected_out: '17:00',
        expected_work_minutes: 0, // Feriado fora de escala: jornada contratual esperada é 0 (dia de descanso)
        expected_break_minutes: 60
      };

      const input: DailyShiftInput = {
        date: '2026-11-02', // Feriado de Finados
        contract_id: 'contract-clt',
        tenant_id: 'tenant-1',
        isHolidayOrDsr: true,
        punches: [
          '2026-11-02T08:00:00-03:00',
          '2026-11-02T12:00:00-03:00',
          '2026-11-02T13:00:00-03:00',
          '2026-11-02T17:00:00-03:00'
        ],
        schedule: standardSchedule
      };

      const result = calculateDailyWorkShift(input);
      expect(result.overtime_100_minutes).toBe(480); // 8h a 100%
    });

    it('2.4 Banco de Horas: Crédito, Débito e Compensação conforme CLT Art. 59', () => {
      const account: TimeBankAccount = {
        id: 'acc-1',
        tenant_id: 'tenant-1',
        company_id: 'comp-1',
        contract_id: 'contract-1',
        policy_type: 'ACORDO_INDIVIDUAL',
        validity_months: 6,
        start_date: '2026-01-01',
        end_date: '2026-06-30',
        balance_minutes: 120, // +2h
        status: 'ACTIVE',
        expiration_rule: 'PAY_AS_OVERTIME'
      };

      // Ingestão de HE do resumo diário
      const dailySummary: TimeDailySummaryInput = {
        date: '2026-01-05',
        overtime_50_minutes: 60, // 1h extra
        overtime_100_minutes: 0,
        delay_minutes: 0,
        absence_minutes: 0
      };

      const processRes = TimeBankService.processDailySummary(account, dailySummary);
      expect(processRes.account.balance_minutes).toBe(180); // 120 + 60 = 180 min

      // Compensação de atraso de 30 min conforme CLT Art. 59
      const compRes = TimeBankService.compensateOccurrence(processRes.account, {
        date: '2026-01-06',
        occurrenceType: 'DELAY',
        minutesToCompensate: 30,
        description: 'Compensação de atraso acordada'
      });

      expect(compRes.compensatedMinutes).toBe(30);
      expect(compRes.remainingBalanceMinutes).toBe(150); // 180 - 30 = 150 min (+2h30)
      expect(compRes.account.balance_minutes).toBe(150);
    });

    it('2.5 Exportação Fiscal AFD e AEJ conforme Portaria MTP 671/2021', () => {
      const mockEmployer = {
        cnpj: '12.345.678/0001-95',
        corporate_name: 'Empresa Teste coupleRH Ltda'
      };

      const mockRecords: TimePunchRecord[] = [
        {
          nsr: 1,
          record_type: 3,
          punched_at: '2026-03-02T08:00:00-03:00',
          cpf: '12345678901',
          pis: '12345678901',
          source: 'REP',
          tenant_id: 't1'
        }
      ];

      const params: AfdExportParams = {
        employer: mockEmployer,
        device_serial: '0000000000000001',
        period_start: '2026-03-01',
        period_end: '2026-03-31',
        generated_at: new Date('2026-04-01T10:00:00'),
        records: mockRecords
      };

      const afdContent = TimeExportService.generateAfd(params);
      expect(afdContent).toBeDefined();
      expect(afdContent).toContain('12345678000195');
    });
  });

  // ==========================================================================
  // PARTE 3: ASSINATURA DIGITAL AVANÇADA (LEI 14.063/2020 E FASE P6)
  // ==========================================================================
  describe('3. Assinatura Digital Avançada e Verificação de Integridade (Doc §10 / Fase P6)', () => {

    const mockCompany = {
      id: 'emp-101',
      corporateName: 'Beta Tecnologia Ltda',
      cnpj: '98.765.432/0001-10'
    };

    const mockWorker = {
      id: 'work-303',
      fullName: 'Carolina Silva Ramos',
      cpf: '321.654.987-12',
      admissionDate: '01/02/2021',
      positionTitle: 'Coordenadora de Recursos Humanos',
      baseSalary: 8500.00
    };

    const mockSignaturePng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    it('3.1 Geração de Snapshot Imutável de Holerite Fechado com Hash H1 SHA-256', async () => {
      const snapshot: PayslipSnapshot = {
        payslipId: 'ps-integration-2026',
        company: mockCompany,
        worker: mockWorker,
        periodMonth: 10,
        periodYear: 2026,
        periodType: 'MONTHLY',
        calculationDate: '2026-10-17',
        items: [
          { code: '101', name: 'Salário Base', type: 'EARNING', amount: 8500.00 },
          { code: '901', name: 'INSS Folha', type: 'DEDUCTION', amount: 988.09 },
          { code: '902', name: 'IRRF Folha', type: 'DEDUCTION', amount: 1157.06 }
        ],
        totalEarnings: 8500.00,
        totalDeductions: 2145.15,
        netSalary: 6354.85,
        baseInss: 8475.55,
        baseFgts: 8500.00,
        fgtsMonth: 680.00,
        baseIrrf: 7511.91
      };

      const doc = await DocumentGeneratorService.generatePayslipPdf(snapshot);

      expect(doc.pdfBytes).toBeInstanceOf(Uint8Array);
      expect(doc.hashH1).toMatch(/^[a-f0-9]{64}$/);
      expect(validateVerificationCode(doc.verificationCode)).toBe(true);
    });

    it('3.2 Validação de Traçado de Rubrica em Tela (AS-03) e Desafio OTP (AS-06)', async () => {
      // 1. Rubrica com traçado vetorial contínuo
      const strokes = [
        Array.from({ length: 20 }, (_, i) => ({ x: 10 + i * 5, y: 30 + (i % 2) * 4, time: 500 + i * 20 }))
      ];
      const strokeValidation = SignatureCanvasCore.validateStrokes(strokes);
      expect(strokeValidation.valid).toBe(true);

      // 2. Desafio OTP
      const docId = 'doc-integ-p9';
      const secret = 'salt-cpf-worker';
      const otp = await DocumentOtpService.generateOtp(docId, secret);

      expect(otp.code).toMatch(/^\d{6}$/);
      const otpRes = await DocumentOtpService.verifyOtp(otp.code, docId, secret, otp.otpHash, otp.expiresAt, 0);
      expect(otpRes.success).toBe(true);
    });

    it('3.3 Estampagem de Rubrica, Folha de Manifesto Forense e Hash Final H2 (AS-05)', async () => {
      const snapshot: PayslipSnapshot = {
        payslipId: 'ps-manifest-2026',
        company: mockCompany,
        worker: mockWorker,
        periodMonth: 10,
        periodYear: 2026,
        periodType: 'MONTHLY',
        calculationDate: '2026-10-17',
        items: [
          { code: '101', name: 'Salário Base', type: 'EARNING', amount: 5000.00 },
          { code: '901', name: 'INSS Folha', type: 'DEDUCTION', amount: 501.51 }
        ],
        totalEarnings: 5000.00,
        totalDeductions: 501.51,
        netSalary: 4498.49,
        baseInss: 5000.00,
        baseFgts: 5000.00,
        fgtsMonth: 400.00,
        baseIrrf: 4498.49
      };

      const original = await DocumentGeneratorService.generatePayslipPdf(snapshot);

      // Estampa rubrica e anexa folha de manifesto
      const signed = await DocumentSigningService.stampSignatureAndManifest({
        originalPdfBytes: original.pdfBytes,
        expectedHashH1: original.hashH1,
        signaturePngBase64: mockSignaturePng,
        signer: {
          name: mockWorker.fullName,
          cpf: mockWorker.cpf,
          role: mockWorker.positionTitle,
          companyName: mockCompany.corporateName,
          companyCnpj: mockCompany.cnpj
        },
        audit: {
          ip: '189.120.45.67',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          signedAt: new Date(),
          authMethod: 'SESSION_OTP'
        },
        verificationCode: original.verificationCode,
        documentTitle: 'Holerite Mensal 10/2026'
      });

      expect(signed.signedPdfBytes.length).toBeGreaterThan(original.pdfBytes.length);
      expect(signed.hashH1).toBe(original.hashH1);
      expect(signed.hashH2).toMatch(/^[a-f0-9]{64}$/);
      expect(signed.hashH2).not.toBe(original.hashH1);
      expect(signed.manifestData.signerName).toBe('Carolina Silva Ramos');
    });

    it('3.4 Detecção de Adulteração (Tamper Detection) — Rejeição de Documento Modificado', async () => {
      const snapshot: PayslipSnapshot = {
        payslipId: 'ps-tamper-test',
        company: mockCompany,
        worker: mockWorker,
        periodMonth: 10,
        periodYear: 2026,
        periodType: 'MONTHLY',
        calculationDate: '2026-10-17',
        items: [
          { code: '101', name: 'Salário Base', type: 'EARNING', amount: 3000.00 },
          { code: '901', name: 'INSS', type: 'DEDUCTION', amount: 248.60 }
        ],
        totalEarnings: 3000.00,
        totalDeductions: 248.60,
        netSalary: 2751.40,
        baseInss: 3000.00,
        baseFgts: 3000.00,
        fgtsMonth: 240.00,
        baseIrrf: 2751.40
      };

      const original = await DocumentGeneratorService.generatePayslipPdf(snapshot);

      const signed = await DocumentSigningService.stampSignatureAndManifest({
        originalPdfBytes: original.pdfBytes,
        expectedHashH1: original.hashH1,
        signaturePngBase64: mockSignaturePng,
        signer: {
          name: mockWorker.fullName,
          cpf: mockWorker.cpf,
          role: mockWorker.positionTitle,
          companyName: mockCompany.corporateName,
          companyCnpj: mockCompany.cnpj
        },
        audit: {
          ip: '201.55.33.11',
          userAgent: 'Chrome/120.0',
          signedAt: new Date(),
          authMethod: 'SESSION_OTP'
        },
        verificationCode: original.verificationCode,
        documentTitle: 'Holerite Mensal'
      });

      // 1. Verificação do documento íntegro -> VÁLIDO
      const isValid = await DocumentSigningService.verifySignedDocumentIntegrity(signed.signedPdfBytes, signed.hashH2);
      expect(isValid).toBe(true);

      // 2. Simulação de adulteração maliciosa (modifica 1 byte)
      const tamperedBytes = new Uint8Array(signed.signedPdfBytes);
      tamperedBytes[tamperedBytes.length - 20] ^= 0xFF;

      // 3. Verificação do documento adulterado -> REJEITADO
      const isTamperedValid = await DocumentSigningService.verifySignedDocumentIntegrity(tamperedBytes, signed.hashH2);
      expect(isTamperedValid).toBe(false);
    });
  });
});
