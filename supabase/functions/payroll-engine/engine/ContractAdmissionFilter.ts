/**
 * Filtro e cálculo de dias trabalhados para admissão de colaboradores (T11).
 * Implementa as regras estritas da tarefa T11 (Doc §4 e Instruções de Correção).
 */

export function shouldSkipFutureAdmission(
  admissionDate: string | null | undefined,
  periodYear: number,
  periodMonth: number
): boolean {
  if (!admissionDate) return false;

  const parts = admissionDate.split('-');
  if (parts.length < 3) return false;

  const admYear = parseInt(parts[0], 10);
  const admMonth = parseInt(parts[1], 10);

  if (admYear > periodYear) return true;
  if (admYear === periodYear && admMonth > periodMonth) return true;

  return false;
}

export function calculateWorkingDays(
  admissionDate: string | null | undefined,
  periodYear: number,
  periodMonth: number
): number {
  if (!admissionDate) return 30;

  const parts = admissionDate.split('-');
  if (parts.length < 3) return 30;

  const admYear = parseInt(parts[0], 10);
  const admMonth = parseInt(parts[1], 10);
  const admDay = parseInt(parts[2], 10);

  // Se admitido em ano/mês anterior: mês integral trabalhado (30 dias)
  if (admYear < periodYear || (admYear === periodYear && admMonth < periodMonth)) {
    return 30;
  }

  // Se admitido em ano/mês futuro: 0 dias trabalhados
  if (admYear > periodYear || (admYear === periodYear && admMonth > periodMonth)) {
    return 0;
  }

  // Admitido neste mesmo mês da competência
  // Regra padrão de DP (base 30 comercial):
  // Em meses de 31 dias, admissão no dia 31 conta como 1 dia trabalhado
  const effectiveDay = Math.min(admDay, 30);
  let dias = 30 - effectiveDay + 1;

  if (dias > 30) dias = 30;
  if (dias < 0) dias = 0;

  return dias;
}
