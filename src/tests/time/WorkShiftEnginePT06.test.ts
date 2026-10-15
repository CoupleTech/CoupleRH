import { describe, it, expect } from 'vitest';
import {
  calculateDailyWorkShift,
  type DailyShiftInput,
  type ShiftSchedule,
} from '../../services/timeTracking/workShiftEngine';

describe('PT-06: Motor de Jornada (Tolerâncias, Noturno, Intervalos, Interjornada, 12x36 e Ponto por Exceção)', () => {
  // Jornada padrão 8h diárias (08:00 às 17:00 com 1h de almoço das 12:00 às 13:00) = 480 minutos trabalhados
  const standardSchedule: ShiftSchedule = {
    schedule_type: 'FIXED',
    expected_in: '08:00',
    expected_break_start: '12:00',
    expected_break_end: '13:00',
    expected_out: '17:00',
    expected_work_minutes: 480,
    expected_break_minutes: 60,
  };

  describe('1. Tolerâncias Legais da CLT (Art. 58 §1º e Súmula 366 TST)', () => {
    it('deve desconsiderar variações de até 5 minutos por batida se o total diário não ultrapassar 10 minutos', () => {
      // Entrou 08:04 (+4m) e saiu 17:05 (+5m). Total de variações = 9 minutos (<= 10 min).
      // Não gera atraso nem hora extra.
      const input: DailyShiftInput = {
        date: '2026-10-14',
        contract_id: 'contract-01',
        tenant_id: 'tenant-01',
        punches: [
          '2026-10-14T08:04:00-03:00', // entrada
          '2026-10-14T12:00:00-03:00', // saída almoço
          '2026-10-14T13:00:00-03:00', // volta almoço
          '2026-10-14T17:05:00-03:00', // saída
        ],
        schedule: standardSchedule,
      };

      const result = calculateDailyWorkShift(input);

      expect(result.worked_minutes).toBe(480);
      expect(result.overtime_50_minutes).toBe(0);
      expect(result.delay_minutes).toBe(0);
      expect(result.status).toBe('REGULAR');
    });

    it('deve computar integralmente como hora extra se a variação diária ultrapassar 10 minutos (Súmula 366 TST)', () => {
      // Entrou 07:50 (10m antes) e saiu 17:05 (5m depois). Variação total = 15 minutos (> 10 min).
      // Computa todos os 15 minutos excedentes como horas extras.
      const input: DailyShiftInput = {
        date: '2026-10-14',
        contract_id: 'contract-01',
        tenant_id: 'tenant-01',
        punches: [
          '2026-10-14T07:50:00-03:00',
          '2026-10-14T12:00:00-03:00',
          '2026-10-14T13:00:00-03:00',
          '2026-10-14T17:05:00-03:00',
        ],
        schedule: standardSchedule,
      };

      const result = calculateDailyWorkShift(input);

      expect(result.worked_minutes).toBe(495); // 480 + 15 min
      expect(result.overtime_50_minutes).toBe(15);
      expect(result.delay_minutes).toBe(0);
    });

    it('deve computar integralmente como atraso se a variação de atraso ultrapassar 10 minutos', () => {
      // Entrou 08:15 (15 min de atraso) e saiu 17:00. Variação = 15 min (> 10 min).
      const input: DailyShiftInput = {
        date: '2026-10-14',
        contract_id: 'contract-01',
        tenant_id: 'tenant-01',
        punches: [
          '2026-10-14T08:15:00-03:00',
          '2026-10-14T12:00:00-03:00',
          '2026-10-14T13:00:00-03:00',
          '2026-10-14T17:00:00-03:00',
        ],
        schedule: standardSchedule,
      };

      const result = calculateDailyWorkShift(input);

      expect(result.worked_minutes).toBe(465); // 480 - 15 min
      expect(result.delay_minutes).toBe(15);
      expect(result.overtime_50_minutes).toBe(0);
    });
  });

  describe('2. Intervalos Intrajornada (Art. 71 CLT) e Interjornada de 11h (Art. 66 CLT)', () => {
    it('deve apurar infração de intervalo intrajornada quando o repouso for menor que 1h', () => {
      // Gozou apenas 30 minutos de almoço (12:00 às 12:30). Suprimiu 30 minutos.
      const input: DailyShiftInput = {
        date: '2026-10-14',
        contract_id: 'contract-01',
        tenant_id: 'tenant-01',
        punches: [
          '2026-10-14T08:00:00-03:00',
          '2026-10-14T12:00:00-03:00',
          '2026-10-14T12:30:00-03:00', // almoço de 30 min
          '2026-10-14T17:00:00-03:00',
        ],
        schedule: standardSchedule,
      };

      const result = calculateDailyWorkShift(input);

      expect(result.break_taken_minutes).toBe(30);
      expect(result.intrajornada_violation_minutes).toBe(30);
      expect(result.inconsistencies).toContain('INTRAJORNADA_VIOLATION');
    });

    it('deve apurar infração de descanso interjornada quando o intervalo entre dias for inferior a 11 horas (660 min)', () => {
      // Saiu ontem às 23:00 e entrou hoje às 07:00 -> Descanso de 8 horas (480 minutos).
      // Violação de 180 minutos (660 - 480).
      const input: DailyShiftInput = {
        date: '2026-10-14',
        contract_id: 'contract-01',
        tenant_id: 'tenant-01',
        previousDayExitTimestamp: '2026-10-13T23:00:00-03:00',
        punches: [
          '2026-10-14T07:00:00-03:00',
          '2026-10-14T12:00:00-03:00',
          '2026-10-14T13:00:00-03:00',
          '2026-10-14T16:00:00-03:00',
        ],
        schedule: standardSchedule,
      };

      const result = calculateDailyWorkShift(input);

      expect(result.interjornada_violation_minutes).toBe(180);
      expect(result.inconsistencies).toContain('INTERJORNADA_VIOLATION');
    });
  });

  describe('3. Adicional Noturno e Hora Noturna Reduzida (Art. 73 CLT)', () => {
    it('deve calcular horas noturnas no período das 22h às 05h aplicando a redução legal (fator 60/52.5)', () => {
      // Jornada das 22:00 às 05:00 com 1h de intervalo (23:00 às 00:00) -> 6 horas de relógio (360 min)
      // Com redução 60/52.5: 360 * (60 / 52.5) = 411.43 -> ~411 minutos noturnos reduzidos
      const nightSchedule: ShiftSchedule = {
        schedule_type: 'FIXED',
        expected_in: '22:00',
        expected_break_start: '23:00',
        expected_break_end: '00:00',
        expected_out: '05:00',
        expected_work_minutes: 360,
        expected_break_minutes: 60,
      };

      const input: DailyShiftInput = {
        date: '2026-10-14',
        contract_id: 'contract-01',
        tenant_id: 'tenant-01',
        punches: [
          '2026-10-14T22:00:00-03:00',
          '2026-10-14T23:00:00-03:00',
          '2026-10-15T00:00:00-03:00',
          '2026-10-15T05:00:00-03:00',
        ],
        schedule: nightSchedule,
      };

      const result = calculateDailyWorkShift(input);

      // 360 min reais convertidos para hora noturna reduzida (fator 8/7)
      expect(result.night_shift_minutes).toBe(411);
    });
  });

  describe('4. Horas Extras 100% em Domingos e Feriados', () => {
    it('deve classificar todo o trabalho em domingo ou feriado (fora de escala) como HE 100%', () => {
      const input: DailyShiftInput = {
        date: '2026-10-18', // Domingo
        contract_id: 'contract-01',
        tenant_id: 'tenant-01',
        isHolidayOrDsr: true,
        punches: [
          '2026-10-18T08:00:00-03:00',
          '2026-10-18T12:00:00-03:00',
        ],
        schedule: {
          schedule_type: 'FIXED',
          expected_work_minutes: 0, // Dia de descanso previsto
        },
      };

      const result = calculateDailyWorkShift(input);

      expect(result.worked_minutes).toBe(240); // 4 horas
      expect(result.overtime_100_minutes).toBe(240);
      expect(result.overtime_50_minutes).toBe(0);
    });
  });

  describe('5. Escala 12x36 (Art. 59-A CLT)', () => {
    it('em escala 12x36, feriados e domingos trabalhados na escala não geram HE 100% adicional', () => {
      // Plantão 12x36 das 07:00 às 19:00 com 1h de almoço (720 min de trabalho) em um domingo
      const schedule12x36: ShiftSchedule = {
        schedule_type: 'SHIFT_12X36',
        expected_in: '07:00',
        expected_out: '19:00',
        expected_work_minutes: 720,
        expected_break_minutes: 60,
      };

      const input: DailyShiftInput = {
        date: '2026-10-18', // Domingo na escala 12x36
        contract_id: 'contract-01',
        tenant_id: 'tenant-01',
        isHolidayOrDsr: true,
        punches: [
          '2026-10-18T07:00:00-03:00',
          '2026-10-18T12:00:00-03:00',
          '2026-10-18T13:00:00-03:00',
          '2026-10-18T19:00:00-03:00',
        ],
        schedule: schedule12x36,
      };

      const result = calculateDailyWorkShift(input);

      expect(result.worked_minutes).toBe(720);
      expect(result.overtime_100_minutes).toBe(0); // Art. 59-A: compensado pela folga de 36h
      expect(result.overtime_50_minutes).toBe(0);
      expect(result.status).toBe('REGULAR');
    });

    it('em escala 12x36, horas que ultrapassarem as 12 horas diárias são apuradas como horas extras', () => {
      const schedule12x36: ShiftSchedule = {
        schedule_type: 'SHIFT_12X36',
        expected_in: '07:00',
        expected_out: '19:00',
        expected_work_minutes: 720,
        expected_break_minutes: 60,
      };

      const input: DailyShiftInput = {
        date: '2026-10-14',
        contract_id: 'contract-01',
        tenant_id: 'tenant-01',
        punches: [
          '2026-10-14T07:00:00-03:00',
          '2026-10-14T12:00:00-03:00',
          '2026-10-14T13:00:00-03:00',
          '2026-10-14T22:00:00-03:00', // Saiu 22:00 (15h permanência - 1h almoço = 14h trabalhadas = 840 min, gerando 120 min de HE)
        ],
        schedule: schedule12x36,
      };

      const result = calculateDailyWorkShift(input);

      expect(result.worked_minutes).toBe(840); // 14h de trabalho efetivo
      expect(result.overtime_50_minutes).toBe(120); // 2 horas extras (120 min) além das 12h
    });
  });

  describe('6. Ponto por Exceção (Art. 74 §4º CLT) e Batidas Ímpares', () => {
    it('deve marcar status REGULAR automaticamente quando a jornada for cumprida sem pendências', () => {
      const input: DailyShiftInput = {
        date: '2026-10-14',
        contract_id: 'contract-01',
        tenant_id: 'tenant-01',
        punches: [
          '2026-10-14T08:00:00-03:00',
          '2026-10-14T12:00:00-03:00',
          '2026-10-14T13:00:00-03:00',
          '2026-10-14T17:00:00-03:00',
        ],
        schedule: standardSchedule,
      };

      const result = calculateDailyWorkShift(input);

      expect(result.status).toBe('REGULAR');
      expect(result.inconsistencies).toHaveLength(0);
    });

    it('deve acusar batida faltante (MISSING_PUNCH) e status INCONSISTENT em caso de número ímpar de batidas', () => {
      const input: DailyShiftInput = {
        date: '2026-10-14',
        contract_id: 'contract-01',
        tenant_id: 'tenant-01',
        punches: [
          '2026-10-14T08:00:00-03:00',
          '2026-10-14T12:00:00-03:00',
          '2026-10-14T13:00:00-03:00',
          // Esqueceu de bater a saída das 17h
        ],
        schedule: standardSchedule,
      };

      const result = calculateDailyWorkShift(input);

      expect(result.status).toBe('INCONSISTENT');
      expect(result.inconsistencies).toContain('MISSING_PUNCH');
    });
  });
});
