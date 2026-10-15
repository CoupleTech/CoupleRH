import type { TimeDailySummary, TimeDailyStatus } from './timeTrackingModel';

export interface ShiftSchedule {
  schedule_type: 'FIXED' | 'FLEXIBLE' | 'SHIFT_12X36' | 'SCALE';
  expected_in?: string; // HH:mm
  expected_break_start?: string; // HH:mm
  expected_break_end?: string; // HH:mm
  expected_out?: string; // HH:mm
  expected_work_minutes: number;
  expected_break_minutes?: number;
}

export interface DailyShiftInput {
  date: string; // YYYY-MM-DD
  contract_id: string;
  tenant_id: string;
  company_id?: string;
  punches: string[]; // Timestamps ISO das batidas do dia ordenadas ou não
  schedule: ShiftSchedule;
  isHolidayOrDsr?: boolean;
  previousDayExitTimestamp?: string; // Timestamp ISO da última saída do dia anterior
}

/**
 * Converte data ISO para minutos decorridos a partir da meia-noite (0 a 1439...)
 */
function getMinutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Calcula a intersecção de minutos de um intervalo [start, end] com a faixa noturna (22:00 às 05:00)
 */
function calculateNightMinutes(startTime: Date, endTime: Date): number {
  let nightMinutes = 0;
  const current = new Date(startTime.getTime());

  // Percorre minuto a minuto ou por blocos (para performance de turno, avançamos em minutos)
  while (current < endTime) {
    const hour = current.getHours();
    // Faixa noturna: 22h às 23h59 e 00h às 04h59
    if (hour >= 22 || hour < 5) {
      nightMinutes++;
    }
    current.setMinutes(current.getMinutes() + 1);
  }

  return nightMinutes;
}

/**
 * Motor de Cálculo e Processamento de Jornada de Trabalho (Portaria MTP 671 / CLT)
 */
export function calculateDailyWorkShift(input: DailyShiftInput): TimeDailySummary {
  const inconsistencies: string[] = [];

  // 1. Ordenar as batidas cronologicamente
  const sortedPunches = [...input.punches]
    .map((p) => new Date(p))
    .sort((a, b) => a.getTime() - b.getTime());

  // 2. Verificar batidas ímpares (esquecimento de batida)
  let hasMissingPunch = false;
  if (sortedPunches.length % 2 !== 0) {
    hasMissingPunch = true;
    inconsistencies.push('MISSING_PUNCH');
  }

  // 3. Montar pares de entrada e saída
  let rawWorkedMinutes = 0;
  let totalBreakMinutes = 0;
  let rawNightMinutes = 0;

  const pairsCount = Math.floor(sortedPunches.length / 2);
  for (let i = 0; i < pairsCount; i++) {
    const inTime = sortedPunches[i * 2];
    const outTime = sortedPunches[i * 2 + 1];

    const workedPart = Math.max(0, Math.round((outTime.getTime() - inTime.getTime()) / (1000 * 60)));
    rawWorkedMinutes += workedPart;

    // Calcular minutos noturnos neste período
    rawNightMinutes += calculateNightMinutes(inTime, outTime);

    // Calcular intervalo entre turnos
    if (i > 0) {
      const prevOutTime = sortedPunches[i * 2 - 1];
      const breakPart = Math.max(0, Math.round((inTime.getTime() - prevOutTime.getTime()) / (1000 * 60)));
      totalBreakMinutes += breakPart;
    }
  }

  const expectedWork = input.schedule.expected_work_minutes;
  const expectedBreak = input.schedule.expected_break_minutes ?? 60;

  // 4. Tolerâncias Legais da CLT (Art. 58 §1º e Súmula 366 TST)
  // Variações de até 5 minutos por marcação, no limite máximo de 10 minutos diários
  let workedMinutes = rawWorkedMinutes;
  let overtime50 = 0;
  let overtime100 = 0;
  let delayMinutes = 0;

  // Se a jornada esperada for zero (dia de folga / DSR / feriado)
  if (expectedWork === 0) {
    if (rawWorkedMinutes > 0) {
      // Todo o trabalho em DSR/Feriado fora de escala é HE 100%
      overtime100 = rawWorkedMinutes;
    }
  } else if (!hasMissingPunch && sortedPunches.length >= 2) {
    const firstIn = sortedPunches[0];
    const lastOut = sortedPunches[sortedPunches.length - 1];

    let totalVariation = 0;
    let inVariation = 0;
    let outVariation = 0;

    if (input.schedule.expected_in) {
      const [expInH, expInM] = input.schedule.expected_in.split(':').map(Number);
      const inMinutes = getMinutesFromMidnight(firstIn);
      const expectedInMinutes = expInH * 60 + expInM;
      inVariation = inMinutes - expectedInMinutes; // negativo = adiantou, positivo = atrasou
      totalVariation += Math.abs(inVariation);
    }

    if (input.schedule.expected_out) {
      const [expOutH, expOutM] = input.schedule.expected_out.split(':').map(Number);
      const outMinutes = getMinutesFromMidnight(lastOut);
      const expectedOutMinutes = expOutH * 60 + expOutM;
      outVariation = outMinutes - expectedOutMinutes; // positivo = saiu mais tarde, negativo = saiu mais cedo
      totalVariation += Math.abs(outVariation);
    }

    // Regra da CLT Art. 58 §1º: variações de até 5 min, limite de 10 min no dia
    const withinTolerance =
      Math.abs(inVariation) <= 5 &&
      Math.abs(outVariation) <= 5 &&
      totalVariation <= 10;

    if (withinTolerance) {
      // Desconsidera as pequenas variações: mantém a jornada prevista
      workedMinutes = expectedWork;
      overtime50 = 0;
      delayMinutes = 0;
    } else {
      // Ultrapassou a tolerância: computa o tempo real integralmente (Súmula 366 TST)
      if (rawWorkedMinutes > expectedWork) {
        const excessMinutes = rawWorkedMinutes - expectedWork;
        if (input.isHolidayOrDsr && input.schedule.schedule_type !== 'SHIFT_12X36') {
          overtime100 = excessMinutes;
        } else {
          overtime50 = excessMinutes;
        }
      } else if (rawWorkedMinutes < expectedWork) {
        delayMinutes = expectedWork - rawWorkedMinutes;
      }
    }
  }

  // 5. Escala 12x36 (Art. 59-A CLT)
  if (input.schedule.schedule_type === 'SHIFT_12X36') {
    // Na escala 12x36, feriados e domingos trabalhados na escala não geram HE 100% adicional
    overtime100 = 0;
    if (rawWorkedMinutes > 720) {
      overtime50 = rawWorkedMinutes - 720;
    } else {
      overtime50 = 0;
    }
  }

  // 6. Adicional Noturno com Hora Reduzida (Art. 73 CLT: fator 60/52.5 = 8/7)
  const nightShiftMinutes = Math.round((rawNightMinutes * 8) / 7);

  // 7. Intervalo Intrajornada (Art. 71 CLT)
  let intrajornadaViolation = 0;
  if (expectedWork > 360 && expectedBreak > 0) {
    if (totalBreakMinutes < expectedBreak) {
      intrajornadaViolation = expectedBreak - totalBreakMinutes;
      inconsistencies.push('INTRAJORNADA_VIOLATION');
    }
  } else if (expectedWork > 240 && expectedWork <= 360) {
    // 4h a 6h -> intervalo mínimo de 15 minutos
    if (totalBreakMinutes < 15) {
      intrajornadaViolation = 15 - totalBreakMinutes;
      inconsistencies.push('INTRAJORNADA_VIOLATION');
    }
  }

  // 8. Intervalo Interjornada de 11h (Art. 66 CLT - 660 minutos)
  let interjornadaViolation = 0;
  if (input.previousDayExitTimestamp && sortedPunches.length > 0) {
    const prevExit = new Date(input.previousDayExitTimestamp).getTime();
    const currentFirstIn = sortedPunches[0].getTime();
    const restMinutes = Math.round((currentFirstIn - prevExit) / (1000 * 60));

    if (restMinutes < 660) {
      interjornadaViolation = 660 - restMinutes;
      inconsistencies.push('INTERJORNADA_VIOLATION');
    }
  }

  // 9. Ponto por Exceção (Art. 74 §4º CLT) e Definição do Status
  let status: TimeDailyStatus = 'REGULAR';
  if (hasMissingPunch || intrajornadaViolation > 0 || interjornadaViolation > 0) {
    status = 'INCONSISTENT';
  } else if (overtime50 > 0 || overtime100 > 0 || delayMinutes > 0) {
    status = 'PENDING_APPROVAL';
  }

  return {
    tenant_id: input.tenant_id,
    company_id: input.company_id,
    contract_id: input.contract_id,
    date: input.date,
    expected_work_minutes: expectedWork,
    worked_minutes: workedMinutes,
    overtime_50_minutes: overtime50,
    overtime_100_minutes: overtime100,
    night_shift_minutes: nightShiftMinutes,
    night_overtime_minutes: 0,
    delay_minutes: delayMinutes,
    absence_minutes: 0,
    break_taken_minutes: totalBreakMinutes,
    break_expected_minutes: expectedBreak,
    intrajornada_violation_minutes: intrajornadaViolation,
    interjornada_violation_minutes: interjornadaViolation,
    time_bank_credited_minutes: 0,
    time_bank_debited_minutes: 0,
    status,
    inconsistencies,
  };
}
