import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateDailyWorkShift } from '../../services/timeTracking/workShiftEngine';
import { TimeManagementService } from '../../services/timeTracking/timeManagementService';
import { supabase } from '../../lib/supabase';

describe('TB-01: Regime de Compensação no Contrato de Trabalho (overtime_regime)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('workShiftEngine com overtime_regime', () => {
    it('deve direcionar horas extras e atrasos para o Banco de Horas no regime TIME_BANK', () => {
      // Entrada às 08:00, Saída às 12:00, Retorno às 13:00, Saída às 18:00 (9h trabalhadas em escala padrão de 8h = 60 min HE 50%)
      const summary = calculateDailyWorkShift({
        date: '2026-10-15',
        contract_id: 'contract-timebank',
        tenant_id: 'tenant-1',
        overtime_regime: 'TIME_BANK',
        schedule: {
          schedule_type: 'FIXED',
          expected_in: '08:00',
          expected_out: '17:00',
          expected_work_minutes: 480,
          expected_break_minutes: 60
        },
        punches: [
          '2026-10-15T08:00:00Z',
          '2026-10-15T12:00:00Z',
          '2026-10-15T13:00:00Z',
          '2026-10-15T18:00:00Z'
        ]
      });

      expect(summary.worked_minutes).toBe(540); // 9h
      expect(summary.overtime_50_minutes).toBe(60);
      expect(summary.time_bank_credited_minutes).toBe(60);
      expect(summary.time_bank_debited_minutes).toBe(0);
    });

    it('deve manter horas extras para a Folha sem creditar no banco no regime OVERTIME_PAYROLL', () => {
      const summary = calculateDailyWorkShift({
        date: '2026-10-15',
        contract_id: 'contract-payroll',
        tenant_id: 'tenant-1',
        overtime_regime: 'OVERTIME_PAYROLL',
        schedule: {
          schedule_type: 'FIXED',
          expected_in: '08:00',
          expected_out: '17:00',
          expected_work_minutes: 480,
          expected_break_minutes: 60
        },
        punches: [
          '2026-10-15T08:00:00Z',
          '2026-10-15T12:00:00Z',
          '2026-10-15T13:00:00Z',
          '2026-10-15T18:00:00Z'
        ]
      });

      expect(summary.worked_minutes).toBe(540);
      expect(summary.overtime_50_minutes).toBe(60);
      expect(summary.time_bank_credited_minutes).toBe(0); // Zero crédito no banco
      expect(summary.time_bank_debited_minutes).toBe(0);
    });

    it('deve direcionar HE 50% para banco e manter HE 100% no regime HYBRID', () => {
      // Domingo ou feriado (expected_work_minutes: 0) -> HE 100%
      const summaryHoliday = calculateDailyWorkShift({
        date: '2026-10-18',
        contract_id: 'contract-hybrid',
        tenant_id: 'tenant-1',
        overtime_regime: 'HYBRID',
        isHolidayOrDsr: true,
        schedule: {
          schedule_type: 'FIXED',
          expected_work_minutes: 0
        },
        punches: [
          '2026-10-18T08:00:00Z',
          '2026-10-18T12:00:00Z'
        ]
      });

      expect(summaryHoliday.overtime_100_minutes).toBe(240); // 4h
      expect(summaryHoliday.time_bank_credited_minutes).toBe(0); // HE 100% não vai para o banco no regime híbrido (remunerada na folha)
    });
  });

  describe('integrateTimesheetToPayrollAndBank respeitando o contrato individual', () => {
    it('deve integrar múltiplos contratos respeitando o overtime_regime de cada um', async () => {
      // Dois colaboradores na mesma empresa:
      // Worker 1: OVERTIME_PAYROLL -> HE vai para folha
      // Worker 2: TIME_BANK -> HE vai para banco
      vi.spyOn(TimeManagementService, 'fetchWorkersForTimeManagement').mockResolvedValue([
        {
          worker_id: 'w-payroll',
          contract_id: 'c-payroll',
          full_name: 'Colaborador CLT Horas Extras',
          position_title: 'Técnico',
          overtime_regime: 'OVERTIME_PAYROLL'
        },
        {
          worker_id: 'w-bank',
          contract_id: 'c-bank',
          full_name: 'Colaborador CLT Banco de Horas',
          position_title: 'Analista',
          overtime_regime: 'TIME_BANK'
        }
      ]);

      vi.spyOn(TimeManagementService, 'fetchMonthlyTimesheet').mockImplementation(async (params: any) => {
        if (params.contractId === 'c-payroll') {
          return {
            worker_id: 'w-payroll',
            worker_name: 'Colaborador CLT Horas Extras',
            contract_id: 'c-payroll',
            position_title: 'Técnico',
            year: 2026,
            month: 10,
            month_label: 'Outubro de 2026',
            total_worked_minutes: 10800,
            total_expected_minutes: 9600,
            total_overtime_50_minutes: 120, // 2h
            total_overtime_100_minutes: 0,
            total_delay_minutes: 0,
            total_absence_minutes: 0,
            total_justified_minutes: 0,
            time_bank_balance_minutes: 0,
            days: []
          };
        } else {
          return {
            worker_id: 'w-bank',
            worker_name: 'Colaborador CLT Banco de Horas',
            contract_id: 'c-bank',
            position_title: 'Analista',
            year: 2026,
            month: 10,
            month_label: 'Outubro de 2026',
            total_worked_minutes: 10800,
            total_expected_minutes: 9600,
            total_overtime_50_minutes: 180, // 3h
            total_overtime_100_minutes: 0,
            total_delay_minutes: 0,
            total_absence_minutes: 0,
            total_justified_minutes: 0,
            time_bank_balance_minutes: 60,
            days: []
          };
        }
      });

      const insertedEvents: any[] = [];
      const insertedBankTransactions: any[] = [];

      const chainMock: any = {};
      chainMock.select = vi.fn().mockReturnValue(chainMock);
      chainMock.eq = vi.fn().mockReturnValue(chainMock);
      chainMock.ilike = vi.fn().mockResolvedValue({ error: null });
      chainMock.delete = vi.fn().mockReturnValue(chainMock);
      chainMock.update = vi.fn().mockReturnValue(chainMock);
      chainMock.insert = vi.fn().mockImplementation((payload: any) => {
        if (Array.isArray(payload)) {
          insertedEvents.push(...payload);
        } else {
          insertedBankTransactions.push(payload);
        }
        return Promise.resolve({ error: null });
      });
      chainMock.maybeSingle = vi.fn().mockImplementation(async () => ({
        data: { id: 'bank-acc-target', balance_minutes: 60, status: 'ACTIVE' }
      }));
      chainMock.then = (resolve: any) => Promise.resolve({ data: [{ id: 'period-oct-2026' }], error: null }).then(resolve);

      const fromSpy = vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
        if (table === 'payroll_rubrics') {
          const rMock: any = {};
          rMock.select = vi.fn().mockReturnValue(rMock);
          rMock.eq = vi.fn().mockReturnValue(rMock);
          rMock.then = (resolve: any) => Promise.resolve({
            data: [
              { id: 'rub-150', code: '150', name: 'Hora Extra 50%', type: 'EARNING' },
              { id: 'rub-160', code: '160', name: 'Hora Extra 100%', type: 'EARNING' },
              { id: 'rub-301', code: '301', name: 'Adicional Noturno', type: 'EARNING' }
            ],
            error: null
          }).then(resolve);
          return rMock;
        }
        return chainMock;
      });

      const result = await TimeManagementService.integrateTimesheetToPayrollAndBank({
        tenantId: 'tenant-123',
        companyId: 'company-456',
        year: 2026,
        month: 10,
        userName: 'Analista DP'
      });

      expect(result.success).toBe(true);
      expect(result.total_contracts_processed).toBe(2);

      // Colaborador OVERTIME_PAYROLL gerou 2h em folha
      expect(result.total_payroll_he_hours).toBe(2);

      // Colaborador TIME_BANK gerou 180 min de crédito no banco
      expect(result.total_bank_credits_minutes).toBe(180);

      // O evento de folha (rubrica 150) foi gerado exclusivamente para o c-payroll
      const payrollEvents = insertedEvents.filter(e => e.contract_id === 'c-payroll');
      expect(payrollEvents.length).toBeGreaterThan(0);
      expect(payrollEvents[0].rubric_id).toBe('rub-150');
      expect(payrollEvents[0].quantity).toBe(2);

      // Não deve ter evento de HE para o c-bank na folha
      const bankWorkerPayrollEvents = insertedEvents.filter(e => e.contract_id === 'c-bank' && e.rubric_id === 'rub-150');
      expect(bankWorkerPayrollEvents.length).toBe(0);

      fromSpy.mockRestore();
    });
  });
});
