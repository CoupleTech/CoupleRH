import { addMoney } from "../utils/money.ts";
import {
  EmployerTaxesCalculator,
  LaborConfig,
} from "../legal/EmployerTaxesCalculator.ts";
import { CompanyTaxItem } from "./AtomicPersistence.ts";

export interface ExistingPayslipBase {
  contract_id: string;
  company_id: string;
  base_inss: number;
  base_fgts: number;
}

export interface CalculatedPayslipForTax {
  contract_id: string;
  base_inss: number;
  base_fgts: number;
}

export interface CompanyInfo {
  id: string;
  labor_config?: LaborConfig;
}

/**
 * Agrega as bases de INSS e FGTS por empresa a partir de todos os holerites do período (T10).
 * No recálculo de contrato individual, soma os holerites dos outros contratos existentes
 * no banco de dados com o novo holerite recém-calculado.
 */
export function aggregateCompanyBases(params: {
  calculatedPayslips: CalculatedPayslipForTax[];
  existingPayslips?: ExistingPayslipBase[];
  contractCompanyMap: Record<string, string>;
}): Record<string, { base_inss: number; base_fgts: number }> {
  const { calculatedPayslips, existingPayslips = [], contractCompanyMap } = params;
  const totals: Record<string, { base_inss: number; base_fgts: number }> = {};

  const calculatedContractIds = new Set<string>();

  // 1. Processa holerites calculados nesta execução
  for (const p of calculatedPayslips) {
    calculatedContractIds.add(p.contract_id);
    const companyId = contractCompanyMap[p.contract_id];
    if (!companyId) continue;

    if (!totals[companyId]) {
      totals[companyId] = { base_inss: 0, base_fgts: 0 };
    }

    totals[companyId].base_inss = addMoney(totals[companyId].base_inss, p.base_inss);
    totals[companyId].base_fgts = addMoney(totals[companyId].base_fgts, p.base_fgts);
  }

  // 2. Processa holerites existentes dos demais contratos do período (não recalculados nesta rodada)
  for (const ep of existingPayslips) {
    if (calculatedContractIds.has(ep.contract_id)) {
      // Ignora versão antiga do contrato se ele já foi recalculado nesta rodada
      continue;
    }

    const companyId = ep.company_id;
    if (!companyId) continue;

    if (!totals[companyId]) {
      totals[companyId] = { base_inss: 0, base_fgts: 0 };
    }

    totals[companyId].base_inss = addMoney(totals[companyId].base_inss, ep.base_inss);
    totals[companyId].base_fgts = addMoney(totals[companyId].base_fgts, ep.base_fgts);
  }

  return totals;
}

/**
 * Calcula os tributos patronais consolidados para cada empresa com base nos totais agregados (T10).
 */
export function calculateConsolidatedEmployerTaxes(params: {
  tenant_id: string;
  period_id: string;
  companyTotals: Record<string, { base_inss: number; base_fgts: number }>;
  companies: CompanyInfo[];
}): CompanyTaxItem[] {
  const { tenant_id, period_id, companyTotals, companies } = params;
  const result: CompanyTaxItem[] = [];

  for (const companyId of Object.keys(companyTotals)) {
    const totals = companyTotals[companyId];
    const comp = companies.find((c) => c.id === companyId);
    const laborConfig = comp?.labor_config;

    const taxes = EmployerTaxesCalculator.calculate(
      totals.base_inss,
      totals.base_fgts,
      laborConfig
    );

    result.push({
      tenant_id,
      period_id,
      company_id: companyId,
      total_base_inss: totals.base_inss,
      total_base_fgts: totals.base_fgts,
      inss_patronal: taxes.inss_patronal,
      rat_adjusted: taxes.rat_adjusted,
      terceiros: taxes.terceiros,
      fgts_patronal: taxes.fgts_patronal,
      total_taxes: taxes.total,
    });
  }

  return result;
}
