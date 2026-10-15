import { describe, it, expect } from 'vitest';
import {
  TimeManagementService,
  TimeEntryAdjustment,
  TimeBankCompensationRequest
} from '../../services/timeTracking/timeManagementService';
import { TimeDevice, TimeDailySummary } from '../../services/timeTracking/timeTrackingModel';
import { TimesheetContest } from '../../services/timeTracking/timesheetContestService';

describe('FASE P5: PT-11 — Telas DP/Gestor: Dispositivos, Importações, Tratamento, Inconsistências e Aprovações', () => {
  const mockTenantId = 'tenant-test-pt11-001';
  const mockCompanyId = 'company-test-pt11-002';
  const mockContractId = 'contract-test-pt11-003';
  const mockReviewerId = 'reviewer-user-999';

  describe('1. Validação de Parâmetros e Cadastro de Dispositivos (REP-C, REP-P, IMPORT)', () => {
    it('deve aprovar a configuração de um relógio físico REP-C válido (Control iD)', () => {
      const validRepC: Partial<TimeDevice> = {
        name: 'Relógio Entrada Portaria 1',
        kind: 'REP_C',
        vendor: 'Control iD',
        model: 'iDClass',
        serial_number: '0000000000000001',
        host: '192.168.1.200',
        port: 80,
        status: 'ACTIVE'
      };

      const result = TimeManagementService.validateDeviceConfig(validRepC);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('deve rejeitar REP-C sem número de série ou com nome vazio', () => {
      const invalidRepC: Partial<TimeDevice> = {
        name: '   ',
        kind: 'REP_C',
        serial_number: ''
      };

      const result = TimeManagementService.validateDeviceConfig(invalidRepC);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('O nome do dispositivo é obrigatório.');
      expect(result.errors).toContain('Número de série / fabricação é obrigatório para equipamentos físicos REP-C.');
    });

    it('deve rejeitar dispositivo com porta fora do intervalo válido (1-65535)', () => {
      const invalidPortDevice: Partial<TimeDevice> = {
        name: 'Ponto Mobile PWA',
        kind: 'REP_P_MOBILE',
        port: 99999
      };

      const result = TimeManagementService.validateDeviceConfig(invalidPortDevice);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('A porta de comunicação deve estar entre 1 e 65535.');
    });

    it('deve aprovar dispositivo de importação manual de arquivos AFD', () => {
      const importSource: Partial<TimeDevice> = {
        name: 'Canal de Importação AFD Sede',
        kind: 'IMPORT',
        status: 'ACTIVE'
      };

      const result = TimeManagementService.validateDeviceConfig(importSource);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('2. Identificação, Classificação e Filtro de Inconsistências de Jornada', () => {
    it('deve classificar infrações intrajornada (CLT Art. 71) e interjornada (CLT Art. 66)', () => {
      const summaryWithViolations: Partial<TimeDailySummary> = {
        intrajornada_violation_minutes: 30, // 30 min suprimidos
        interjornada_violation_minutes: 120, // 2h a menos de descanso de 11h
        delay_minutes: 5,
        absence_minutes: 0
      };

      const issues = TimeManagementService.classifyInconsistencies(summaryWithViolations);
      expect(issues).toContain('INTRAJORNADA_VIOLATION');
      expect(issues).toContain('INTERJORNADA_VIOLATION');
      expect(issues).not.toContain('EXCESSIVE_DELAY');
      expect(issues).not.toContain('UNJUSTIFIED_ABSENCE');
    });

    it('deve classificar marcações ímpares (MISSING_PUNCH) e faltas injustificadas', () => {
      const summaryMissingPunch: Partial<TimeDailySummary> = {
        inconsistencies: ['MISSING_PUNCH'],
        absence_minutes: 480 // 8h de falta
      };

      const issues = TimeManagementService.classifyInconsistencies(summaryMissingPunch);
      expect(issues).toContain('MISSING_PUNCH');
      expect(issues).toContain('UNJUSTIFIED_ABSENCE');
    });

    it('deve filtrar resumos diários pelo critério selecionado pelo DP', () => {
      const list: TimeDailySummary[] = [
        {
          contract_id: 'c1',
          date: '2026-10-01',
          tenant_id: mockTenantId,
          expected_work_minutes: 480,
          worked_minutes: 480,
          overtime_50_minutes: 0,
          overtime_100_minutes: 0,
          night_shift_minutes: 0,
          night_overtime_minutes: 0,
          delay_minutes: 0,
          absence_minutes: 0,
          break_taken_minutes: 60,
          break_expected_minutes: 60,
          intrajornada_violation_minutes: 0,
          interjornada_violation_minutes: 0,
          time_bank_credited_minutes: 0,
          time_bank_debited_minutes: 0,
          status: 'REGULAR',
          inconsistencies: []
        },
        {
          contract_id: 'c2',
          date: '2026-10-01',
          tenant_id: mockTenantId,
          expected_work_minutes: 480,
          worked_minutes: 240,
          overtime_50_minutes: 0,
          overtime_100_minutes: 0,
          night_shift_minutes: 0,
          night_overtime_minutes: 0,
          delay_minutes: 0,
          absence_minutes: 0,
          break_taken_minutes: 0,
          break_expected_minutes: 60,
          intrajornada_violation_minutes: 0,
          interjornada_violation_minutes: 0,
          time_bank_credited_minutes: 0,
          time_bank_debited_minutes: 0,
          status: 'INCONSISTENT',
          inconsistencies: ['MISSING_PUNCH']
        },
        {
          contract_id: 'c3',
          date: '2026-10-01',
          tenant_id: mockTenantId,
          expected_work_minutes: 480,
          worked_minutes: 480,
          overtime_50_minutes: 0,
          overtime_100_minutes: 0,
          night_shift_minutes: 0,
          night_overtime_minutes: 0,
          delay_minutes: 0,
          absence_minutes: 0,
          break_taken_minutes: 20,
          break_expected_minutes: 60,
          intrajornada_violation_minutes: 40,
          interjornada_violation_minutes: 0,
          time_bank_credited_minutes: 0,
          time_bank_debited_minutes: 0,
          status: 'INCONSISTENT',
          inconsistencies: ['INTRAJORNADA_VIOLATION']
        }
      ];

      const onlyInconsistent = TimeManagementService.filterSummariesByInconsistency(list, 'ONLY_INCONSISTENT');
      expect(onlyInconsistent).toHaveLength(2);

      const missingPunches = TimeManagementService.filterSummariesByInconsistency(list, 'MISSING_PUNCH');
      expect(missingPunches).toHaveLength(1);
      expect(missingPunches[0].contract_id).toBe('c2');

      const intrajornada = TimeManagementService.filterSummariesByInconsistency(list, 'INTRAJORNADA');
      expect(intrajornada).toHaveLength(1);
      expect(intrajornada[0].contract_id).toBe('c3');
    });
  });

  describe('3. Deliberação de Solicitações de Ajuste de Ponto (Gestor / DP)', () => {
    const mockPendingAdjustment: TimeEntryAdjustment = {
      id: 'adj-101',
      tenant_id: mockTenantId,
      contract_id: mockContractId,
      worker_name: 'Maria Oliveira',
      requested_timestamp: '2026-10-05T08:00:00-03:00',
      entry_type: 'IN',
      adjustment_reason: 'Esquecimento de crachá na portaria',
      status: 'PENDING_APPROVAL',
      requested_by: 'worker-user-123'
    };

    it('deve aprovar ajuste com registro do autor da aprovação e parecer', () => {
      const reviewed = TimeManagementService.processAdjustmentReview(
        mockPendingAdjustment,
        true,
        mockReviewerId,
        'Confirmado com a supervisão imediata'
      );

      expect(reviewed.status).toBe('APPROVED');
      expect(reviewed.approved_by).toBe(mockReviewerId);
      expect(reviewed.review_notes).toBe('Confirmado com a supervisão imediata');
      expect(reviewed.updated_at).toBeDefined();
    });

    it('deve rejeitar ajuste exigindo justificativa obrigatória', () => {
      expect(() => {
        TimeManagementService.processAdjustmentReview(
          mockPendingAdjustment,
          false,
          mockReviewerId,
          '' // Justificativa vazia
        );
      }).toThrow('Justificativa é obrigatória para rejeitar um ajuste de ponto.');

      const rejected = TimeManagementService.processAdjustmentReview(
        mockPendingAdjustment,
        false,
        mockReviewerId,
        'Horário divergente da câmera de segurança'
      );
      expect(rejected.status).toBe('REJECTED');
      expect(rejected.review_notes).toBe('Horário divergente da câmera de segurança');
    });
  });

  describe('4. Deliberação de Contestações de Espelho de Ponto (Portaria MTP 671/2021)', () => {
    const mockContest: TimesheetContest = {
      id: 'contest-201',
      tenant_id: mockTenantId,
      timesheet_id: 'timesheet-555',
      contract_id: mockContractId,
      reason: 'Horas extras do dia 12/03 não constam no espelho',
      affected_dates: ['2026-03-12'],
      status: 'PENDING',
      created_at: '2026-03-15T10:00:00Z'
    };

    it('ao deferir a contestação, deve marcar RESOLVED_ACCEPTED e reabrir o espelho para DRAFT', () => {
      const result = TimeManagementService.processContestReview(
        mockContest,
        true,
        mockReviewerId,
        'Deferido. Reabrindo espelho para lançamento do ajuste manual pelo DP.'
      );

      expect(result.contest.status).toBe('RESOLVED_ACCEPTED');
      expect(result.contest.reviewed_by).toBe(mockReviewerId);
      expect(result.timesheetStatus).toBe('DRAFT');
    });

    it('ao indeferir a contestação, deve marcar REJECTED e manter o espelho em PENDING_SIGNATURE', () => {
      const result = TimeManagementService.processContestReview(
        mockContest,
        false,
        mockReviewerId,
        'Indeferido. Ausência de autorização prévia da chefia para horas extras.'
      );

      expect(result.contest.status).toBe('REJECTED');
      expect(result.contest.reviewed_by).toBe(mockReviewerId);
      expect(result.timesheetStatus).toBe('PENDING_SIGNATURE');
    });
  });

  describe('5. Deliberação de Compensações de Banco de Horas', () => {
    it('deve aprovar folga compensatória quando houver saldo suficiente', () => {
      const request: TimeBankCompensationRequest = {
        id: 'comp-301',
        tenant_id: mockTenantId,
        contract_id: mockContractId,
        account_id: 'acc-777',
        date: '2026-10-20',
        minutes: 480, // 8h
        current_balance_minutes: 600, // Saldo de 10h
        status: 'PENDING_APPROVAL',
        requested_by: 'worker-user-123'
      };

      const result = TimeManagementService.processTimeBankCompensationReview(
        request,
        true,
        mockReviewerId,
        'Folga pré-agendada autorizada'
      );

      expect(result.status).toBe('APPROVED');
      expect(result.reviewed_by).toBe(mockReviewerId);
    });

    it('deve rejeitar folga compensatória se saldo for insuficiente', () => {
      const request: TimeBankCompensationRequest = {
        id: 'comp-302',
        tenant_id: mockTenantId,
        contract_id: mockContractId,
        account_id: 'acc-777',
        date: '2026-10-20',
        minutes: 480, // 8h
        current_balance_minutes: 120, // Apenas 2h de saldo!
        status: 'PENDING_APPROVAL',
        requested_by: 'worker-user-123'
      };

      expect(() => {
        TimeManagementService.processTimeBankCompensationReview(
          request,
          true,
          mockReviewerId
        );
      }).toThrow('Saldo de banco de horas insuficiente para compensar a folga solicitada.');
    });
  });
});
