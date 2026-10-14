/**
 * VacationOverlapCalculator.ts
 * 
 * Módulo de apuração de sobreposição de férias, múltiplas solicitações e dias comerciais (T15).
 * Atende às especificações do DOCUMENTO_MELHORIAS_PRODUCAO_COUPLERH.md (§4) e CLT Art. 142.
 */

export interface VacationRequestItem {
  id?: string;
  contract_id: string;
  start_date: string;
  end_date: string;
  days_taken: number;
  cash_allowance_days?: number;
  advance_13th_salary?: boolean;
  status?: string;
}

export interface VacationCalculationResult {
  vacationCommercialDays: number;
  remainingWorkedDays: number;
  totalCalendarOverlapDays: number;
  vacationsApplied: VacationRequestItem[];
}

/**
 * Converte string 'YYYY-MM-DD' em componentes numéricos sem risco de fuso horário.
 */
export function parseDateParts(dateStr: string): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length < 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return { year, month, day };
}

/**
 * Formata ano, mês e dia em string 'YYYY-MM-DD'.
 */
export function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Retorna o número de dias calendário do mês especificado.
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Calcula a diferença inclusiva em dias entre duas datas 'YYYY-MM-DD' usando UTC puro.
 */
export function diffDaysInclusive(startDateStr: string, endDateStr: string): number {
  const p1 = parseDateParts(startDateStr);
  const p2 = parseDateParts(endDateStr);
  if (!p1 || !p2) return 0;

  const utc1 = Date.UTC(p1.year, p1.month - 1, p1.day);
  const utc2 = Date.UTC(p2.year, p2.month - 1, p2.day);

  if (utc2 < utc1) return 0;
  return Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Verifica se o período de férias cruza com a competência especificada.
 * Regra: start_date <= fimDoMes AND end_date >= inicioDoMes
 */
export function isVacationCrossingMonth(
  startDate: string,
  endDate: string,
  periodYear: number,
  periodMonth: number
): boolean {
  if (!startDate || !endDate) return false;
  const startOfMonth = formatDate(periodYear, periodMonth, 1);
  const endOfMonth = formatDate(periodYear, periodMonth, getDaysInMonth(periodYear, periodMonth));

  return startDate <= endOfMonth && endDate >= startOfMonth;
}

/**
 * Apura os dias de férias sobrepostos na competência e os dias trabalhados comerciais (base 30).
 * Soma todas as solicitações ativas do colaborador que cruzam com o mês.
 */
export function calculateVacationDaysInMonth(
  vacations: VacationRequestItem[],
  periodYear: number,
  periodMonth: number,
  workingDaysBase: number = 30
): VacationCalculationResult {
  const startOfMonth = formatDate(periodYear, periodMonth, 1);
  const daysInCalMonth = getDaysInMonth(periodYear, periodMonth);
  const endOfMonth = formatDate(periodYear, periodMonth, daysInCalMonth);

  const eligibleVacations = (vacations || []).filter((v) => {
    if (!v.start_date || !v.end_date) return false;
    // Se vier com status, deve ser um status homologado
    if (v.status && !['APPROVED_DP', 'PAID', 'TAKEN'].includes(v.status)) {
      return false;
    }
    return isVacationCrossingMonth(v.start_date, v.end_date, periodYear, periodMonth);
  });

  if (eligibleVacations.length === 0) {
    return {
      vacationCommercialDays: 0,
      remainingWorkedDays: workingDaysBase,
      totalCalendarOverlapDays: 0,
      vacationsApplied: [],
    };
  }

  let totalCalendarOverlapDays = 0;
  let coversStartOfMonth = false;
  let coversEndOfMonth = false;

  for (const v of eligibleVacations) {
    const overlapStart = v.start_date < startOfMonth ? startOfMonth : v.start_date;
    const overlapEnd = v.end_date > endOfMonth ? endOfMonth : v.end_date;

    if (overlapStart === startOfMonth) coversStartOfMonth = true;
    if (overlapEnd === endOfMonth) coversEndOfMonth = true;

    const days = diffDaysInclusive(overlapStart, overlapEnd);
    totalCalendarOverlapDays += days;
  }

  // Regra comercial de Departamento Pessoal (base 30 CLT):
  // 1. Se cobrir o mês inteiro (início ao fim do mês) ou sobrepor >= 30 dias:
  //    colaborador não tem saldo de salário no mês (0 dias trabalhados)
  const isEntireMonth = (coversStartOfMonth && coversEndOfMonth) || totalCalendarOverlapDays >= 30;

  let vacationCommercialDays: number;
  let remainingWorkedDays: number;

  if (isEntireMonth) {
    vacationCommercialDays = 30;
    remainingWorkedDays = 0;
  } else {
    vacationCommercialDays = Math.min(30, totalCalendarOverlapDays);
    remainingWorkedDays = Math.max(0, workingDaysBase - vacationCommercialDays);
  }

  return {
    vacationCommercialDays,
    remainingWorkedDays,
    totalCalendarOverlapDays,
    vacationsApplied: eligibleVacations,
  };
}
