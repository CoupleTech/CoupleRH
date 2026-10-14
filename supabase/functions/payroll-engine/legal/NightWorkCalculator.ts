/**
 * NightWorkCalculator.ts
 * Cálculo de trabalho noturno e hora noturna reduzida (Art. 73 da CLT / Súmula 60 TST).
 */

import { round2 } from '../utils/money.ts';

/**
 * Fator legal de redução da hora noturna urbana (Art. 73 § 1º da CLT: 52min30s).
 * 60 minutos / 52.5 minutos = 8 / 7 = 1.1428571428571428...
 */
export const NIGHT_REDUCTION_FACTOR = 60 / 52.5;

/**
 * Converte a quantidade de horas relógio (trabalhadas entre 22h e 05h)
 * para a quantidade correspondente de horas noturnas reduzidas da CLT (fator 60 / 52.5).
 * 
 * Exemplo: 7 horas relógio (22h às 05h) -> 8.00 horas noturnas fictas.
 */
export function calculateReducedNightHours(clockHours: number): number {
  if (!clockHours || clockHours <= 0) return 0;
  return round2(clockHours * NIGHT_REDUCTION_FACTOR);
}

/**
 * Retorna o valor do adicional noturno considerando o valor da hora normal,
 * o percentual de adicional (padrão CLT 20%) e a quantidade de horas (com ou sem redução ficta).
 */
export function calculateNightAllowance(
  hourlyRate: number,
  hours: number,
  aliquot: number = 20,
  applyReduction: boolean = false
): number {
  if (hourlyRate <= 0 || hours <= 0) return 0;
  const effectiveHours = applyReduction ? calculateReducedNightHours(hours) : hours;
  return round2(hourlyRate * (aliquot / 100) * effectiveHours);
}
