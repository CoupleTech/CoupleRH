import { describe, it, expect } from 'vitest';
import {
  TimesheetPdfService,
  TimesheetReportData,
  TimesheetDailyRow
} from '../../services/timeTracking/timesheetPdfService';
import {
  TimesheetContestService,
  TimesheetRecord,
  TimesheetContest
} from '../../services/timeTracking/timesheetContestService';

describe('FASE P5: PT-08 — Espelho de Ponto Mensal (Portaria MTP 671/2021) e Fluxo de Contestação', () => {
  const mockTenantId = 'tenant-test-111';
  const mockCompanyId = 'company-test-222';
  const mockContractId = 'contract-test-333';
  const mockWorkerId = 'worker-test-444';

  describe('1. Estruturação e Layout do Espelho de Ponto (Portaria MTP 671/2021 Art. 84)', () => {
    const mockDailyRows: TimesheetDailyRow[] = [
      {
        date: '2026-03-02',
        dayOfWeek: 'Seg',
        scheduled_in: '08:00',
        scheduled_break_start: '12:00',
        scheduled_break_end: '13:00',
        scheduled_out: '17:00',
        punches: ['08:02', '12:01', '13:00', '17:05'],
        treated_punches: ['08:02', '12:01', '13:00', '17:05'],
        worked_minutes: 480, // 8h
        overtime_50_minutes: 0,
        overtime_100_minutes: 0,
        night_shift_minutes: 0,
        delay_minutes: 0,
        absence_minutes: 0,
        intrajornada_violation_minutes: 0,
        time_bank_minutes: 0,
        status: 'REGULAR',
        notes: ''
      },
      {
        date: '2026-03-03',
        dayOfWeek: 'Ter',
        scheduled_in: '08:00',
        scheduled_break_start: '12:00',
        scheduled_break_end: '13:00',
        scheduled_out: '17:00',
        punches: ['08:00', '12:00', '13:00', '19:00'],
        treated_punches: ['08:00', '12:00', '13:00', '19:00'],
        worked_minutes: 600, // 10h
        overtime_50_minutes: 120, // 2h extras
        overtime_100_minutes: 0,
        night_shift_minutes: 0,
        delay_minutes: 0,
        absence_minutes: 0,
        intrajornada_violation_minutes: 0,
        time_bank_minutes: 120,
        status: 'REGULAR',
        notes: 'HE autorizada'
      },
      {
        date: '2026-03-04',
        dayOfWeek: 'Qua',
        scheduled_in: '08:00',
        scheduled_break_start: '12:00',
        scheduled_break_end: '13:00',
        scheduled_out: '17:00',
        punches: ['08:30', '12:00', '13:00', '17:00'],
        treated_punches: ['08:30', '12:00', '13:00', '17:00'],
        worked_minutes: 450, // 7h30
        overtime_50_minutes: 0,
        overtime_100_minutes: 0,
        night_shift_minutes: 0,
        delay_minutes: 30, // Atraso de 30 min
        absence_minutes: 0,
        intrajornada_violation_minutes: 0,
        time_bank_minutes: -30,
        status: 'REGULAR',
        notes: ''
      }
    ];

    const mockTimesheetData: TimesheetReportData = {
      tenant_id: mockTenantId,
      company: {
        corporate_name: 'Tech Solutions Brasil Ltda',
        cnpj: '12.345.678/0001-90',
        address: 'Av. Paulista, 1000 - São Paulo, SP'
      },
      employee: {
        worker_id: mockWorkerId,
        full_name: 'Carlos da Silva',
        cpf: '123.456.789-00',
        registration_number: 'MAT-0042',
        position: 'Analista de Sistemas',
        department: 'Engenharia',
        admission_date: '2024-01-15'
      },
      period: {
        month: 3,
        year: 2026,
        start_date: '2026-03-01',
        end_date: '2026-03-31'
      },
      standard_schedule_description: 'Seg a Sex das 08:00 às 17:00 com 01:00 de intervalo',
      daily_rows: mockDailyRows,
      time_bank_summary: {
        previous_balance_minutes: 60,
        credits_minutes: 120,
        debits_minutes: 30,
        current_balance_minutes: 150
      }
    };

    it('deve consolidar corretamente os totalizadores mensais da grade diária', () => {
      const summary = TimesheetPdfService.calculateMonthlyTotals(mockTimesheetData.daily_rows);

      expect(summary.total_worked_minutes).toBe(1530); // 480 + 600 + 450 = 1530 (25h30)
      expect(summary.total_worked_formatted).toBe('25:30');
      expect(summary.total_overtime_50_minutes).toBe(120); // 2h extras
      expect(summary.total_overtime_50_formatted).toBe('02:00');
      expect(summary.total_overtime_100_minutes).toBe(0);
      expect(summary.total_delay_minutes).toBe(30);
      expect(summary.total_delay_formatted).toBe('00:30');
    });

    it('deve calcular o hash de integridade SHA-256 do documento (H1) para garantir imutabilidade', () => {
      const hash1 = TimesheetPdfService.computeDocumentHash(mockTimesheetData);
      expect(hash1).toBeDefined();
      expect(hash1).toHaveLength(64); // SHA-256 hex string

      // Determinismo: o mesmo payload deve gerar exatamente o mesmo hash
      const hash2 = TimesheetPdfService.computeDocumentHash(mockTimesheetData);
      expect(hash1).toBe(hash2);

      // Qualquer adulteração em dado diário deve alterar o hash
      const modifiedData = {
        ...mockTimesheetData,
        daily_rows: [
          ...mockTimesheetData.daily_rows,
          {
            ...mockTimesheetData.daily_rows[0],
            worked_minutes: 500
          }
        ]
      };
      const hash3 = TimesheetPdfService.computeDocumentHash(modifiedData);
      expect(hash1).not.toBe(hash3);
    });

    it('deve gerar o documento PDF do espelho de ponto eletrônico contendo todas as seções obrigatórias', () => {
      const pdfDoc = TimesheetPdfService.generateTimesheetPdf(mockTimesheetData);

      expect(pdfDoc).toBeDefined();
      // O documento deve ser capaz de exportar como buffer ou string base64/arrayBuffer
      const output = pdfDoc.output('arraybuffer');
      expect(output.byteLength).toBeGreaterThan(1000); // PDF gerado com conteúdo real
    });
  });

  describe('2. Fluxo de Contestação do Espelho de Ponto', () => {
    let mockTimesheet: TimesheetRecord;

    beforeEach(() => {
      mockTimesheet = {
        id: 'ts-2026-03-carlos',
        tenant_id: mockTenantId,
        company_id: mockCompanyId,
        contract_id: mockContractId,
        period_start: '2026-03-01',
        period_end: '2026-03-31',
        total_worked_minutes: 10560,
        total_overtime_minutes: 360,
        total_delay_minutes: 60,
        status: 'PENDING_SIGNATURE',
        document_hash: 'abc123sha256hash'
      };
    });

    it('deve permitir que o colaborador abra contestação detalhada sobre o espelho em PENDING_SIGNATURE', () => {
      const result = TimesheetContestService.openContest({
        timesheet: mockTimesheet,
        worker_id: mockWorkerId,
        reason: 'No dia 15/03 trabalhei até 20h em plantão autorizado, mas a batida de saída consta 18h.',
        affected_dates: ['2026-03-15'],
        attachment_url: 'https://storage.couplerh.com/atestados/planta-1503.pdf'
      });

      expect(result.contest).toBeDefined();
      expect(result.contest.status).toBe('PENDING');
      expect(result.contest.reason).toMatch(/plantão autorizado/i);
      expect(result.contest.affected_dates).toContain('2026-03-15');
      expect(result.contest.attachment_url).toBeDefined();

      // O espelho deve mudar de status para CONTESTED
      expect(result.timesheet.status).toBe('CONTESTED');
      expect(result.timesheet.rejection_reason).toBe(result.contest.reason);
      expect(result.timesheet.contested_at).toBeDefined();
    });

    it('deve rejeitar contestação com motivo vazio ou inferior a 10 caracteres', () => {
      expect(() => {
        TimesheetContestService.openContest({
          timesheet: mockTimesheet,
          worker_id: mockWorkerId,
          reason: 'Discordo', // Curto demais
          affected_dates: ['2026-03-15']
        });
      }).toThrow(/Motivo da contestação deve conter no mínimo 10 caracteres/i);
    });

    it('deve impedir contestação sobre espelho já assinado (SIGNED) ou fechado (CLOSED)', () => {
      const signedTimesheet: TimesheetRecord = {
        ...mockTimesheet,
        status: 'SIGNED'
      };

      expect(() => {
        TimesheetContestService.openContest({
          timesheet: signedTimesheet,
          worker_id: mockWorkerId,
          reason: 'Tentei contestar após ter assinado o espelho.',
          affected_dates: ['2026-03-15']
        });
      }).toThrow(/Apenas espelhos pendentes de assinatura podem ser contestados/i);
    });

    it('deve permitir ao gestor deferir (ACCEPT) a contestação, retornando o espelho para DRAFT para tratamento', () => {
      const openResult = TimesheetContestService.openContest({
        timesheet: mockTimesheet,
        worker_id: mockWorkerId,
        reason: 'Esqueci de registrar intervalo do dia 10/03.',
        affected_dates: ['2026-03-10']
      });

      const reviewResult = TimesheetContestService.reviewContest({
        contest: openResult.contest,
        timesheet: openResult.timesheet,
        reviewer_id: 'manager-999',
        decision: 'ACCEPT',
        review_notes: 'Procedente. Solicitação de ajuste de batida aprovada pelo gestor.'
      });

      expect(reviewResult.contest.status).toBe('RESOLVED_ACCEPTED');
      expect(reviewResult.contest.reviewed_by).toBe('manager-999');
      expect(reviewResult.contest.review_notes).toMatch(/Procedente/i);
      expect(reviewResult.contest.reviewed_at).toBeDefined();

      // Ao aceitar, o espelho volta para DRAFT para que o DP possa lançar o ajuste e reprocessar
      expect(reviewResult.timesheet.status).toBe('DRAFT');
    });

    it('deve permitir ao gestor indeferir (REJECT) a contestação com parecer obrigatório, retornando a PENDING_SIGNATURE', () => {
      const openResult = TimesheetContestService.openContest({
        timesheet: mockTimesheet,
        worker_id: mockWorkerId,
        reason: 'Quero receber horas extras sem ter feito registro de ponto.',
        affected_dates: ['2026-03-11']
      });

      // Sem parecer explicativo deve falhar
      expect(() => {
        TimesheetContestService.reviewContest({
          contest: openResult.contest,
          timesheet: openResult.timesheet,
          reviewer_id: 'manager-999',
          decision: 'REJECT',
          review_notes: '' // Em branco
        });
      }).toThrow(/Parecer explicativo é obrigatório ao indeferir uma contestação/i);

      const reviewResult = TimesheetContestService.reviewContest({
        contest: openResult.contest,
        timesheet: openResult.timesheet,
        reviewer_id: 'manager-999',
        decision: 'REJECT',
        review_notes: 'Improcedente. Não houve autorização de horas extras nem comprovação de trabalho extraordinário.'
      });

      expect(reviewResult.contest.status).toBe('REJECTED');
      expect(reviewResult.contest.review_notes).toMatch(/Improcedente/i);

      // Ao rejeitar, o espelho volta para PENDING_SIGNATURE para o colaborador assinar
      expect(reviewResult.timesheet.status).toBe('PENDING_SIGNATURE');
    });
  });
});
