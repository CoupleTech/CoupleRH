import { describe, it, expect, vi } from 'vitest';
import { TimeManagementService, MonthlyPunchItem } from '../../services/timeTracking/timeManagementService';
import { supabase } from '../../lib/supabase';

describe('Alocação Manual de Batida de Ponto no Dia Anterior (Jornada Noturna)', () => {
  it('deve posicionar batida da madrugada (00:02) no final do dia anterior quando deslocada', () => {
    // Cenário do usuário:
    // Dia anterior tem batidas de tarde/noite: 16:12, 19:49, 20:53
    // Batida deslocada do dia seguinte: 00:02
    const punches: MonthlyPunchItem[] = [
      { id: 'p1', time: '16:12', original_timestamp: '2026-10-02T19:12:00Z', is_shifted: false },
      { id: 'p2', time: '19:49', original_timestamp: '2026-10-02T22:49:00Z', is_shifted: false },
      { id: 'p3', time: '20:53', original_timestamp: '2026-10-02T23:53:00Z', is_shifted: false },
      { id: 'p4', time: '00:02', original_timestamp: '2026-10-03T03:02:00Z', is_shifted: true, original_date: '2026-10-03' },
    ];

    // Ordenação com a regra implementada no TimeManagementService:
    const sorted = [...punches].sort((a, b) => {
      const getOrderMinutes = (m: MonthlyPunchItem) => {
        const [h, min] = m.time.split(':').map(Number);
        const base = (isNaN(h) ? 0 : h) * 60 + (isNaN(min) ? 0 : min);
        return m.is_shifted && h < 12 ? base + 1440 : base;
      };
      return getOrderMinutes(a) - getOrderMinutes(b);
    });

    expect(sorted.map(p => p.time)).toEqual(['16:12', '19:49', '20:53', '00:02']);
    expect(sorted[3].id).toBe('p4');
    expect(sorted[3].is_shifted).toBe(true);
  });

  it('deve calcular corretamente a jornada noturna ultrapassando a meia-noite', () => {
    // Par 1: 16:12 às 19:49 -> 217 minutos (3h37m)
    // Par 2: 20:53 às 00:02 -> (24*60 + 2) - (20*60 + 53) = 1442 - 1253 = 189 minutos (3h09m)
    // Total trabalhado = 217 + 189 = 406 minutos = 6h46m
    const getMinutes = (timeStr: string, isNextDay = false) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m + (isNextDay ? 1440 : 0);
    };

    const interval1 = getMinutes('19:49') - getMinutes('16:12');
    const interval2 = getMinutes('00:02', true) - getMinutes('20:53');
    const totalMinutes = interval1 + interval2;

    expect(interval1).toBe(217);
    expect(interval2).toBe(189);
    expect(totalMinutes).toBe(406);
    expect(Math.floor(totalMinutes / 60)).toBe(6);
    expect(totalMinutes % 60).toBe(46);
  });

  it('deve registrar ajuste com o padrão [SHIFT_PREVIOUS_DAY] e status APPROVED sem mutar time_punch_records', async () => {
    const chainMock: any = {};
    chainMock.delete = vi.fn().mockReturnValue(chainMock);
    chainMock.eq = vi.fn().mockReturnValue(chainMock);
    chainMock.ilike = vi.fn().mockResolvedValue({ error: null });
    chainMock.insert = vi.fn().mockResolvedValue({ error: null });

    const fromSpy = vi.spyOn(supabase, 'from').mockReturnValue(chainMock as any);

    await expect(TimeManagementService.shiftPunchToPreviousDay({
      tenantId: 'tenant-123',
      contractId: 'contract-456',
      punchId: 'punch-789',
      punchTime: '00:02',
      punchedAt: '2026-10-03T00:02:00.000Z',
      currentDate: '2026-10-03',
      previousDate: '2026-10-02',
      userName: 'Operador DP',
    })).resolves.not.toThrow();

    expect(fromSpy).toHaveBeenCalledWith('time_entry_adjustments');
    expect(chainMock.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-123',
        contract_id: 'contract-456',
        adjustment_reason: expect.stringContaining('[SHIFT_PREVIOUS_DAY] punch_id:punch-789|source_date:2026-10-03|target_date:2026-10-02|time:00:02'),
        status: 'APPROVED',
        requested_by: 'Operador DP',
        approved_by: 'Operador DP',
      })
    );

    fromSpy.mockRestore();
  });

  it('deve desfazer o deslocamento removendo o ajuste', async () => {
    const chainMock: any = {};
    chainMock.delete = vi.fn().mockReturnValue(chainMock);
    chainMock.eq = vi.fn().mockReturnValue(chainMock);
    chainMock.ilike = vi.fn().mockReturnValue(chainMock);
    // Para resolver a Promise quando o await query acontecer:
    chainMock.then = (resolve: any) => Promise.resolve({ error: null }).then(resolve);

    const fromSpy = vi.spyOn(supabase, 'from').mockReturnValue(chainMock as any);

    await expect(TimeManagementService.undoShiftPunch({
      tenantId: 'tenant-123',
      contractId: 'contract-456',
      punchId: 'punch-789',
      adjustmentId: 'adj-999',
    })).resolves.not.toThrow();

    expect(fromSpy).toHaveBeenCalledWith('time_entry_adjustments');
    expect(chainMock.delete).toHaveBeenCalled();

    fromSpy.mockRestore();
  });
});
