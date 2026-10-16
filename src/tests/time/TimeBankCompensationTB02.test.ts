import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimeBankService } from '../../services/timeTracking/timeBankService';
import { TimeManagementService } from '../../services/timeTracking/timeManagementService';
import { supabase } from '../../lib/supabase';

describe('TB-02: Abono e Compensação de Atrasos/Faltas com Banco de Horas', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('TimeBankService.compensateOccurrence (Regras Puras)', () => {
    const baseAccount: any = {
      id: 'tb-acc-1',
      tenant_id: 'tenant-123',
      contract_id: 'contract-456',
      balance_minutes: 180, // Saldo de 3h (+180 min)
      status: 'ACTIVE',
      policy_type: 'ACORDO_INDIVIDUAL',
      validity_months: 6,
      start_date: '2026-10-01',
      end_date: '2027-03-31'
    };

    it('deve compensar integralmente um atraso gerando transação COMPENSATION_DELAY', () => {
      const result = TimeBankService.compensateOccurrence(baseAccount, {
        date: '2026-10-14',
        occurrenceType: 'DELAY',
        minutesToCompensate: 45,
        description: 'Compensação de atraso de 45 min no trânsito'
      });

      expect(result.compensatedMinutes).toBe(45);
      expect(result.remainingOccurrenceMinutes).toBe(0);
      expect(result.remainingBalanceMinutes).toBe(135);
      expect(result.account.balance_minutes).toBe(135);
      expect(result.transaction.transaction_type).toBe('COMPENSATION_DELAY');
      expect(result.transaction.minutes).toBe(-45);
      expect(result.transaction.description).toContain('Compensação de atraso');
    });

    it('deve compensar uma falta gerando transação COMPENSATION_ABSENCE', () => {
      const bigAccount = { ...baseAccount, balance_minutes: 600 };
      const result = TimeBankService.compensateOccurrence(bigAccount, {
        date: '2026-10-10',
        occurrenceType: 'ABSENCE',
        minutesToCompensate: 480, // 8h
        description: 'Compensação de ausência integral com saldo acumulado'
      });

      expect(result.compensatedMinutes).toBe(480);
      expect(result.remainingOccurrenceMinutes).toBe(0);
      expect(result.remainingBalanceMinutes).toBe(120);
      expect(result.account.balance_minutes).toBe(120);
      expect(result.transaction.transaction_type).toBe('COMPENSATION_ABSENCE');
      expect(result.transaction.minutes).toBe(-480);
    });

    it('deve permitir compensação parcial quando allowPartial for true', () => {
      // Saldo de 60 min, mas atraso de 90 min
      const shortAccount = { ...baseAccount, balance_minutes: 60 };
      const result = TimeBankService.compensateOccurrence(shortAccount, {
        date: '2026-10-14',
        occurrenceType: 'DELAY',
        minutesToCompensate: 90,
        allowPartial: true
      });

      expect(result.compensatedMinutes).toBe(60);
      expect(result.remainingOccurrenceMinutes).toBe(30); // 30 min ainda ficam pendentes
      expect(result.remainingBalanceMinutes).toBe(0);
      expect(result.account.balance_minutes).toBe(0);
      expect(result.transaction.minutes).toBe(-60);
    });

    it('deve lançar erro se o saldo for insuficiente e allowPartial for false', () => {
      const shortAccount = { ...baseAccount, balance_minutes: 60 };
      expect(() => {
        TimeBankService.compensateOccurrence(shortAccount, {
          date: '2026-10-14',
          occurrenceType: 'DELAY',
          minutesToCompensate: 90,
          allowPartial: false
        });
      }).toThrow(/Saldo insuficiente no banco de horas/i);
    });

    it('deve lançar erro se o saldo da conta for zero ou devedor', () => {
      const zeroAccount = { ...baseAccount, balance_minutes: 0 };
      expect(() => {
        TimeBankService.compensateOccurrence(zeroAccount, {
          date: '2026-10-14',
          occurrenceType: 'DELAY',
          minutesToCompensate: 30
        });
      }).toThrow(/não possui saldo positivo disponível/i);
    });
  });

  describe('TimeManagementService.compensateTimesheetOccurrence (Integração e Auditoria)', () => {
    it('deve registrar compensação no Supabase e atualizar time_daily_summary', async () => {
      const chainMock: any = {};
      chainMock.select = vi.fn().mockReturnValue(chainMock);
      chainMock.eq = vi.fn().mockReturnValue(chainMock);
      chainMock.update = vi.fn().mockReturnValue(chainMock);
      chainMock.insert = vi.fn().mockReturnValue(chainMock);
      chainMock.maybeSingle = vi.fn().mockImplementation(async () => ({
        data: {
          id: 'acc-real-1',
          tenant_id: 'tenant-123',
          contract_id: 'c-1',
          balance_minutes: 120,
          status: 'ACTIVE'
        },
        error: null
      }));
      chainMock.single = vi.fn().mockImplementation(async () => ({
        data: {
          id: 'summary-1',
          delay_minutes: 45,
          absence_minutes: 0,
          status: 'PENDING_APPROVAL'
        },
        error: null
      }));

      const fromSpy = vi.spyOn(supabase, 'from').mockReturnValue(chainMock as any);

      const res = await TimeManagementService.compensateTimesheetOccurrence({
        tenantId: 'tenant-123',
        contractId: 'c-1',
        date: '2026-10-14',
        occurrenceType: 'DELAY',
        minutes: 45,
        justification: 'Compensação aprovada pelo gestor',
        userName: 'Gestor DP'
      });

      expect(res.success).toBe(true);
      expect(res.compensated_minutes).toBe(45);
      expect(res.remaining_balance_minutes).toBe(75);

      // Verificou inserção na tabela time_bank_transactions
      expect(fromSpy).toHaveBeenCalledWith('time_bank_transactions');
      expect(chainMock.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction_type: 'COMPENSATION_DELAY',
          minutes: -45,
          description: expect.stringContaining('Compensação aprovada pelo gestor')
        })
      );

      fromSpy.mockRestore();
    });
  });
});
