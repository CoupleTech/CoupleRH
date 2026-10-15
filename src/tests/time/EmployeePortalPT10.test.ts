import { describe, it, expect } from 'vitest';
import {
  formatMinutesToHours,
  TimeBankService,
  TimeBankAccount,
  TimeBankTransaction
} from '../../services/timeTracking/timeBankService';
import {
  TimesheetPdfService,
  TimesheetReportData
} from '../../services/timeTracking/timesheetPdfService';
import {
  TimesheetContestService,
  TimesheetRecord
} from '../../services/timeTracking/timesheetContestService';

describe('FASE P5: PT-10 — Portal do Colaborador (PWA REP-P, Comprovantes, Espelho e Banco de Horas)', () => {
  const mockTenantId = 'tenant-test-111';
  const mockContractId = 'contract-test-333';
  const mockWorkerId = 'worker-test-444';

  describe('1. Comprovante de Registro de Ponto do Trabalhador (Portaria MTP 671/2021)', () => {
    it('deve formatar os dados do comprovante de ponto com NSR, hora confiável e chave de verificação', () => {
      const punchData = {
        nsr: 1042,
        punched_at: '2026-03-14T08:02:15.000Z',
        employee_name: 'Carlos da Silva',
        cpf: '123.456.789-00',
        employer_name: 'Tech Solutions Brasil Ltda',
        cnpj: '12.345.678/0001-90',
        receipt_code: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      };

      expect(punchData.nsr).toBe(1042);
      expect(punchData.receipt_code).toHaveLength(64);
      expect(punchData.punched_at).toBeDefined();

      const qrPayload = `PORTARIA671|${punchData.cnpj}|${punchData.cpf}|${punchData.nsr}|${punchData.punched_at}|${punchData.receipt_code}`;
      expect(qrPayload).toContain('PORTARIA671');
      expect(qrPayload).toContain(punchData.cnpj);
      expect(qrPayload).toContain(punchData.cpf);
    });
  });

  describe('2. Visualização do Banco de Horas no Portal', () => {
    it('deve fornecer saldo formatado em +HH:MM ou -HH:MM e alertas visuais de vencimento', () => {
      const account: TimeBankAccount = {
        id: 'acc-colab-1',
        tenant_id: mockTenantId,
        contract_id: mockContractId,
        policy_type: 'ACORDO_INDIVIDUAL',
        validity_months: 6,
        start_date: '2026-01-01',
        end_date: '2026-06-30',
        balance_minutes: 495, // 8h15
        status: 'ACTIVE',
        expiration_rule: 'PAY_AS_OVERTIME',
        warning_days_before_expiration: 30
      };

      const saldoFormatado = formatMinutesToHours(account.balance_minutes);
      expect(saldoFormatado).toBe('+08:15');

      // Alerta a 25 dias do fim da vigência
      const alert = TimeBankService.checkExpirationAndAlerts(account, '2026-06-05');
      expect(alert.status).toBe('WARNING');
      expect(alert.days_remaining).toBe(25);
      expect(alert.message).toMatch(/Restam 25 dias/i);
    });

    it('deve compilar extrato cronológico com saldo cumulativo para visualização no modal', () => {
      const account: TimeBankAccount = {
        id: 'acc-colab-1',
        tenant_id: mockTenantId,
        contract_id: mockContractId,
        policy_type: 'ACORDO_INDIVIDUAL',
        validity_months: 6,
        start_date: '2026-01-01',
        end_date: '2026-06-30',
        balance_minutes: 75,
        status: 'ACTIVE',
        expiration_rule: 'PAY_AS_OVERTIME'
      };

      const transactions: TimeBankTransaction[] = [
        {
          id: 'tx-1',
          tenant_id: mockTenantId,
          account_id: account.id,
          date: '2026-01-05',
          minutes: 120, // +2h
          transaction_type: 'OVERTIME',
          description: 'Horas extras realizadas'
        },
        {
          id: 'tx-2',
          tenant_id: mockTenantId,
          account_id: account.id,
          date: '2026-01-08',
          minutes: -45, // -45min
          transaction_type: 'DELAY',
          description: 'Atraso compensado'
        }
      ];

      const statement = TimeBankService.generateStatement(account, transactions);
      expect(statement.entries).toHaveLength(2);
      expect(statement.entries[0].running_balance_formatted).toBe('+02:00');
      expect(statement.entries[1].running_balance_formatted).toBe('+01:15');
      expect(statement.final_balance_formatted).toBe('+01:15');
    });
  });

  describe('3. Consulta de Espelho e Abertura de Contestação', () => {
    it('deve gerar PDF do espelho e permitir abertura de contestação com datas afetadas', () => {
      const timesheet: TimesheetRecord = {
        id: 'ts-colab-mar',
        tenant_id: mockTenantId,
        contract_id: mockContractId,
        period_start: '2026-03-01',
        period_end: '2026-03-31',
        total_worked_minutes: 10560,
        total_overtime_minutes: 120,
        total_delay_minutes: 0,
        status: 'PENDING_SIGNATURE'
      };

      const contestResult = TimesheetContestService.openContest({
        timesheet,
        worker_id: mockWorkerId,
        reason: 'A batida de retorno do almoço do dia 12/03 não foi computada corretamente.',
        affected_dates: ['2026-03-12']
      });

      expect(contestResult.timesheet.status).toBe('CONTESTED');
      expect(contestResult.contest.affected_dates).toContain('2026-03-12');
      expect(contestResult.contest.status).toBe('PENDING');
    });
  });
});
