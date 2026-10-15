import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimeManagementService } from '../../services/timeTracking/timeManagementService';
import { supabase } from '../../lib/supabase';

describe('Integração de Ponto com Folha de Pagamento e Banco de Horas', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('deve registrar inclusão de marcação manual pelo analista de DP por motivo de queda de energia no REP', async () => {
    const chainMock: any = {};
    chainMock.select = vi.fn().mockReturnValue(chainMock);
    chainMock.eq = vi.fn().mockReturnValue(chainMock);
    chainMock.order = vi.fn().mockReturnValue(chainMock);
    chainMock.limit = vi.fn().mockReturnValue(chainMock);
    chainMock.maybeSingle = vi.fn().mockResolvedValue({ data: { nsr: 90050 } });
    chainMock.single = vi.fn().mockResolvedValue({ data: { id: 'punch-new-1' }, error: null });
    chainMock.insert = vi.fn().mockReturnValue(chainMock);

    const fromSpy = vi.spyOn(supabase, 'from').mockReturnValue(chainMock as any);

    await expect(
      TimeManagementService.addManualPunch({
        tenantId: 'tenant-123',
        companyId: 'company-456',
        workerId: 'worker-789',
        contractId: 'contract-abc',
        date: '2026-10-15',
        time: '12:00',
        entryType: 'IN',
        reason: 'Queda de energia no estabelecimento / Relógio parou de funcionar',
        userName: 'Analista DP'
      })
    ).resolves.not.toThrow();

    expect(fromSpy).toHaveBeenCalledWith('time_punch_records');
    expect(chainMock.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-123',
        worker_id: 'worker-789',
        source: 'MANUAL',
        nsr: 90051,
        raw_line: expect.stringContaining('Queda de energia no estabelecimento / Relógio parou de funcionar')
      })
    );

    fromSpy.mockRestore();
  });

  it('deve converter horas extras apuradas em eventos de folha no modo PAYROLL_ONLY com rubricas 150 e 160', async () => {
    vi.spyOn(TimeManagementService, 'fetchWorkersForTimeManagement').mockResolvedValue([
      {
        worker_id: 'w1',
        contract_id: 'c1',
        full_name: 'João Silva',
        position_title: 'Operador'
      }
    ]);

    vi.spyOn(TimeManagementService, 'fetchMonthlyTimesheet').mockResolvedValue({
      worker_id: 'w1',
      worker_name: 'João Silva',
      contract_id: 'c1',
      position_title: 'Operador',
      year: 2026,
      month: 10,
      month_label: 'Outubro de 2026',
      total_worked_minutes: 10800,
      total_expected_minutes: 9600,
      total_overtime_50_minutes: 120, // 2h
      total_overtime_100_minutes: 60,  // 1h
      total_delay_minutes: 0,
      total_absence_minutes: 0,
      total_justified_minutes: 0,
      time_bank_balance_minutes: 0,
      days: [
        {
          date: '2026-10-02',
          dayOfMonth: 2,
          dayOfWeek: 'Sex',
          dayOfWeekFull: 'Sexta-feira',
          isWeekend: false,
          expected_schedule: '8h',
          expected_minutes: 480,
          punches: [
            { id: 'p1', time: '22:30', source: 'REP', punched_at: '2026-10-02T22:30:00Z' }
          ],
          worked_minutes: 500,
          break_minutes: 60,
          overtime_50_minutes: 20,
          overtime_100_minutes: 0,
          night_shift_minutes: 60,
          delay_minutes: 0,
          absence_minutes: 0,
          balance_minutes: 20,
          status: 'REGULAR'
        }
      ]
    });

    const chainMock: any = {};
    chainMock.select = vi.fn().mockReturnValue(chainMock);
    chainMock.eq = vi.fn().mockReturnValue(chainMock);
    chainMock.ilike = vi.fn().mockResolvedValue({ error: null });
    chainMock.delete = vi.fn().mockReturnValue(chainMock);
    chainMock.insert = vi.fn().mockResolvedValue({ error: null });
    chainMock.maybeSingle = vi.fn().mockResolvedValue({ data: null });
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
      payrollPeriodId: 'period-oct-2026',
      destiny: 'PAYROLL_ONLY',
      userName: 'Analista DP'
    });

    expect(result.success).toBe(true);
    expect(result.total_contracts_processed).toBe(1);
    expect(result.total_payroll_he_hours).toBe(3); // 2h + 1h
    expect(result.total_night_shift_hours).toBeGreaterThan(0);
    expect(result.total_bank_credits_minutes).toBe(0);

    fromSpy.mockRestore();
  });

  it('deve creditar horas extras no Banco de Horas no modo BANK_ONLY preservando Adicional Noturno na folha', async () => {
    vi.spyOn(TimeManagementService, 'fetchWorkersForTimeManagement').mockResolvedValue([
      {
        worker_id: 'w2',
        contract_id: 'c2',
        full_name: 'Maria Souza',
        position_title: 'Analista'
      }
    ]);

    vi.spyOn(TimeManagementService, 'fetchMonthlyTimesheet').mockResolvedValue({
      worker_id: 'w2',
      worker_name: 'Maria Souza',
      contract_id: 'c2',
      position_title: 'Analista',
      year: 2026,
      month: 10,
      month_label: 'Outubro de 2026',
      total_worked_minutes: 11000,
      total_expected_minutes: 9600,
      total_overtime_50_minutes: 180, // 3h = 180 min
      total_overtime_100_minutes: 0,
      total_delay_minutes: 0,
      total_absence_minutes: 0,
      total_justified_minutes: 0,
      time_bank_balance_minutes: 60,
      days: [
        {
          date: '2026-10-05',
          dayOfMonth: 5,
          dayOfWeek: 'Seg',
          dayOfWeekFull: 'Segunda-feira',
          isWeekend: false,
          expected_schedule: '8h',
          expected_minutes: 480,
          punches: [
            { id: 'p2', time: '23:00', source: 'REP', punched_at: '2026-10-05T23:00:00Z' }
          ],
          worked_minutes: 500,
          break_minutes: 60,
          overtime_50_minutes: 20,
          overtime_100_minutes: 0,
          night_shift_minutes: 60,
          delay_minutes: 0,
          absence_minutes: 0,
          balance_minutes: 20,
          status: 'REGULAR'
        }
      ]
    });

    const chainMock: any = {};
    chainMock.select = vi.fn().mockReturnValue(chainMock);
    chainMock.eq = vi.fn().mockReturnValue(chainMock);
    chainMock.ilike = vi.fn().mockResolvedValue({ error: null });
    chainMock.delete = vi.fn().mockReturnValue(chainMock);
    chainMock.update = vi.fn().mockReturnValue(chainMock);
    chainMock.insert = vi.fn().mockResolvedValue({ error: null });
    chainMock.maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'bank-acc-1', balance_minutes: 60, status: 'ACTIVE' }
    });
    chainMock.then = (resolve: any) => Promise.resolve({ data: [{ id: 'period-oct-2026' }], error: null }).then(resolve);

    const fromSpy = vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'payroll_rubrics') {
        const rMock: any = {};
        rMock.select = vi.fn().mockReturnValue(rMock);
        rMock.eq = vi.fn().mockReturnValue(rMock);
        rMock.then = (resolve: any) => Promise.resolve({
          data: [
            { id: 'rub-150', code: '150', name: 'Hora Extra 50%', type: 'EARNING' },
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
      destiny: 'BANK_ONLY',
      userName: 'Analista DP'
    });

    expect(result.success).toBe(true);
    expect(result.total_bank_credits_minutes).toBe(180); // 180 min creditados no banco
    expect(result.total_payroll_he_hours).toBe(0); // Nenhuma HE enviada em dinheiro
    expect(result.total_night_shift_hours).toBeGreaterThan(0); // Noturno SEMPRE vai para folha (Súmula 60 TST)

    fromSpy.mockRestore();
  });
});
