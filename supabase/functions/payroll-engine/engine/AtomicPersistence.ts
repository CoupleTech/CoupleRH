export interface RawPayslipItem {
  rubric_id: string;
  reference: string | null;
  amount: number;
  type: string;
}

export interface RawPayrollMemory {
  step_name: string;
  base_value: number;
  quantity_used: number;
  percentage_used: number;
  parsed_formula: string;
  result_value: number;
  origin?: string;
  engine_version?: string;
}

export interface RawCalculatedPayslip {
  contract_id: string;
  total_earnings: number;
  total_deductions: number;
  net_salary: number;
  base_inss: number;
  base_irrf: number;
  base_fgts: number;
  fgts_month: number;
  status?: string;
  engine_version?: string;
  rubrics_version?: string;
  rules_version?: string;
  inss_table_version?: string;
  irrf_table_version?: string;
  fgts_table_version?: string;
  items: RawPayslipItem[];
  memory: RawPayrollMemory[];
}

export interface CompanyTaxItem {
  tenant_id: string;
  company_id: string;
  total_base_inss: number;
  total_base_fgts: number;
  inss_patronal: number;
  rat_adjusted: number;
  terceiros: number;
  fgts_patronal: number;
  total_taxes: number;
}

export interface AtomicPayrollPayload {
  contract_id_filter: string | null;
  payslips: Array<{
    tenant_id: string;
    contract_id: string;
    total_earnings: number;
    total_deductions: number;
    net_salary: number;
    base_inss: number;
    base_irrf: number;
    base_fgts: number;
    fgts_month: number;
    status: string;
    engine_version: string;
    rubrics_version: string;
    rules_version: string;
    inss_table_version: string;
    irrf_table_version: string;
    fgts_table_version: string;
    items: Array<{
      tenant_id: string;
      rubric_id: string;
      reference: string | null;
      amount: number;
      type: string;
    }>;
    memory: Array<{
      tenant_id: string;
      step_name: string;
      base_value: number;
      quantity_used: number;
      percentage_used: number;
      parsed_formula: string;
      result_value: number;
      origin: string;
      engine_version: string;
    }>;
  }>;
  company_taxes: CompanyTaxItem[];
}

export interface StatusValidationResult {
  canCalculate: boolean;
  httpStatus?: number;
  error?: string;
}

/**
 * Valida se o status da folha permite cálculo ou se deve ser bloqueado por concorrência ou imutabilidade (T9).
 */
export function validatePeriodStatusForCalculation(status: string): StatusValidationResult {
  if (status === 'CALCULATING') {
    return {
      canCalculate: false,
      httpStatus: 409,
      error: 'Cálculo concorrente detectado: o cálculo da folha já está em andamento para este período.',
    };
  }

  if (status === 'CLOSED') {
    return {
      canCalculate: false,
      httpStatus: 422,
      error: 'A folha está fechada (status CLOSED) e não pode ser recalculada. Por favor, solicite a reabertura formal se precisar alterar.',
    };
  }

  if (['CONFERENCE', 'CANCELED'].includes(status)) {
    return {
      canCalculate: false,
      httpStatus: 422,
      error: `A folha está no status ${status} e não pode ser recalculada. Por favor, volte o status para rascunho (reabrir) se precisar alterar.`,
    };
  }

  if (['DRAFT', 'CALCULATED', 'REOPENED'].includes(status)) {
    return {
      canCalculate: true,
    };
  }

  return {
    canCalculate: false,
    httpStatus: 400,
    error: `Status '${status}' desconhecido ou inválido para cálculo da folha.`,
  };
}

/**
 * Monta o payload estruturado completo para envio à RPC PostgreSQL save_payroll_period (T9).
 */
export function buildAtomicPayrollPayload(params: {
  tenant_id: string;
  period_id: string;
  contract_id_filter: string | null;
  payslips: RawCalculatedPayslip[];
  company_taxes: CompanyTaxItem[];
}): AtomicPayrollPayload {
  const { tenant_id, contract_id_filter, payslips, company_taxes } = params;

  return {
    contract_id_filter: contract_id_filter || null,
    payslips: payslips.map((p) => ({
      tenant_id,
      contract_id: p.contract_id,
      total_earnings: p.total_earnings,
      total_deductions: p.total_deductions,
      net_salary: p.net_salary,
      base_inss: p.base_inss,
      base_irrf: p.base_irrf,
      base_fgts: p.base_fgts,
      fgts_month: p.fgts_month,
      status: p.status || 'CALCULATED',
      engine_version: p.engine_version || '1.0.0',
      rubrics_version: p.rubrics_version || '1.0.0',
      rules_version: p.rules_version || '1.0.0',
      inss_table_version: p.inss_table_version || '2026.1',
      irrf_table_version: p.irrf_table_version || '2026.1',
      fgts_table_version: p.fgts_table_version || '1.0.0',
      items: (p.items || []).map((it) => ({
        tenant_id,
        rubric_id: it.rubric_id,
        reference: it.reference,
        amount: it.amount,
        type: it.type,
      })),
      memory: (p.memory || []).map((m) => ({
        tenant_id,
        step_name: m.step_name,
        base_value: m.base_value,
        quantity_used: m.quantity_used,
        percentage_used: m.percentage_used,
        parsed_formula: m.parsed_formula,
        result_value: m.result_value,
        origin: m.origin || 'AUTOMATICA',
        engine_version: m.engine_version || '1.0.0',
      })),
    })),
    company_taxes: (company_taxes || []).map((t) => ({
      tenant_id: t.tenant_id,
      company_id: t.company_id,
      total_base_inss: t.total_base_inss,
      total_base_fgts: t.total_base_fgts,
      inss_patronal: t.inss_patronal,
      rat_adjusted: t.rat_adjusted,
      terceiros: t.terceiros,
      fgts_patronal: t.fgts_patronal,
      total_taxes: t.total_taxes,
    })),
  };
}
