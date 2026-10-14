/**
 * DeductionEligibility.ts
 * Regras de elegibilidade e filtragem de descontos fixos de colaboradores (T17).
 * Garante que descontos só incidam nas folhas autorizadas e não vazem para férias ou 13º.
 */

export interface EmployeeDeductionItem {
  id?: string;
  contract_id?: string;
  rubric_id?: string;
  deduction_type?: string;
  amount_type?: string;
  value?: number;
  total_limit?: number | null;
  start_date?: string;
  end_date?: string | null;
  deduct_on_advance?: boolean;
  apply_on_types?: string[] | null;
  is_active?: boolean;
  notes?: string | null;
}

/**
 * Retorna o último dia de um mês no ano civil
 */
export function getDaysInPeriodMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Valida se um desconto de colaborador está vigente e elegível para ser lançado
 * no tipo e competência de folha informados (T17 / Doc §4).
 */
export function isDeductionEligibleForPeriod(
  deduction: EmployeeDeductionItem,
  periodType: string,
  periodYear: number,
  periodMonth: number
): boolean {
  // 1. Status ativo
  if (deduction.is_active === false) {
    return false;
  }

  // 2. Vigência temporal
  const lastDay = getDaysInPeriodMonth(periodYear, periodMonth);
  const startOfPeriodStr = `${periodYear}-${String(periodMonth).padStart(2, '0')}-01`;
  const endOfPeriodStr = `${periodYear}-${String(periodMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  if (deduction.start_date && deduction.start_date > endOfPeriodStr) {
    return false; // Ainda não entrou em vigência nesta competência
  }

  if (deduction.end_date && deduction.end_date < startOfPeriodStr) {
    return false; // Já expirou antes do início da competência
  }

  // 3. Regra por tipo de folha (T17)
  const allowedTypes = deduction.apply_on_types;

  if (Array.isArray(allowedTypes) && allowedTypes.length > 0) {
    // Configuração explícita: só entra se o tipo da folha estiver expressamente listado
    return allowedTypes.includes(periodType);
  }

  // 4. Comportamento Padrão (quando apply_on_types for nulo ou vazio):
  // Entra somente em MONTHLY ou ADVANCE. Demais folhas (VACATION, THIRTEENTH_*, COMPLEMENTARY) NÃO recebem por padrão.
  if (periodType === 'ADVANCE') {
    return deduction.deduct_on_advance === true;
  }

  if (periodType === 'MONTHLY') {
    return deduction.deduct_on_advance !== true;
  }

  // Folhas VACATION, THIRTEENTH_1, THIRTEENTH_2, COMPLEMENTARY, etc.
  // Sem autorização explícita em apply_on_types, são bloqueadas.
  return false;
}

/**
 * Calcula o valor nominal do desconto a ser lançado na folha,
 * suportando valores fixos e percentuais sobre base de cálculo (ex: salário base ou mínimo).
 */
export function calculateDeductionAmount(
  deduction: EmployeeDeductionItem,
  baseCalculation: number
): number {
  const rawValue = Number(deduction.value) || 0;
  if (rawValue <= 0) return 0;

  let calculated = rawValue;

  if (deduction.amount_type === 'PERCENTAGE') {
    calculated = (baseCalculation * rawValue) / 100;
  }

  // Aplica teto total se houver limite remanescente
  if (deduction.total_limit !== null && deduction.total_limit !== undefined && deduction.total_limit > 0) {
    if (calculated > deduction.total_limit) {
      calculated = deduction.total_limit;
    }
  }

  return Math.round((calculated + Number.EPSILON) * 100) / 100;
}
