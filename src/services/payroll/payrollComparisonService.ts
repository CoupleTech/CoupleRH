import { supabase } from '../../lib/supabase';

export interface RawPayslipComparisonData {
  id?: string;
  contract_id: string;
  employee_name: string;
  cpf?: string;
  position_title?: string;
  department_name?: string;
  cost_center_id?: string;
  cost_center_code?: string;
  cost_center_name: string;
  total_earnings: number;
  total_deductions: number;
  net_salary: number;
  base_inss?: number;
  base_fgts?: number;
  base_irrf?: number;
  fgts_month?: number;
  estimated_taxes?: number; // Cota patronal + RAT + Terceiros + FGTS
}

export type EmployeeComparisonStatus = 'ACTIVE' | 'NEW' | 'TERMINATED';

export interface EmployeeComparisonItem {
  contract_id: string;
  employee_name: string;
  cpf?: string;
  position_title?: string;
  department_name?: string;
  cost_center_id?: string;
  cost_center_code?: string;
  cost_center_name: string;
  status: EmployeeComparisonStatus;
  current_earnings: number;
  previous_earnings: number;
  diff_earnings: number;
  percent_earnings: number;
  current_deductions: number;
  previous_deductions: number;
  diff_deductions: number;
  current_net: number;
  previous_net: number;
  diff_net: number;
  percent_net: number;
  current_taxes: number;
  previous_taxes: number;
  diff_taxes: number;
  current_total_cost: number;
  previous_total_cost: number;
  diff_total_cost: number;
}

export interface CostCenterComparisonItem {
  cost_center_id: string;
  cost_center_code: string;
  cost_center_name: string;
  current_headcount: number;
  previous_headcount: number;
  diff_headcount: number;
  current_earnings: number;
  previous_earnings: number;
  diff_earnings: number;
  percent_earnings: number;
  current_deductions: number;
  previous_deductions: number;
  diff_deductions: number;
  current_net: number;
  previous_net: number;
  diff_net: number;
  percent_net: number;
  current_taxes: number;
  previous_taxes: number;
  diff_taxes: number;
  current_total_cost: number;
  previous_total_cost: number;
  diff_total_cost: number;
  percent_of_total_company_cost: number;
}

export interface PayrollComparisonSummary {
  current_headcount: number;
  previous_headcount: number;
  diff_headcount: number;
  current_earnings: number;
  previous_earnings: number;
  diff_earnings: number;
  percent_earnings: number;
  current_deductions: number;
  previous_deductions: number;
  diff_deductions: number;
  current_net: number;
  previous_net: number;
  diff_net: number;
  percent_net: number;
  current_taxes: number;
  previous_taxes: number;
  diff_taxes: number;
  current_total_cost: number;
  previous_total_cost: number;
  diff_total_cost: number;
  percent_total_cost: number;
}

export interface PayrollComparisonReport {
  current_period_id: string;
  previous_period_id: string;
  current_label: string;
  previous_label: string;
  summary: PayrollComparisonSummary;
  by_employee: EmployeeComparisonItem[];
  by_cost_center: CostCenterComparisonItem[];
}

export class PayrollComparisonService {
  /**
   * Calcula o percentual de variação seguro (evitando divisão por zero)
   */
  private calculatePercentDiff(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    if (current === 0) {
      return -100;
    }
    return ((current - previous) / previous) * 100;
  }

  /**
   * 1. Compara a folha colaborador por colaborador
   */
  public computeEmployeeComparison(
    currentPayslips: RawPayslipComparisonData[],
    previousPayslips: RawPayslipComparisonData[] = []
  ): EmployeeComparisonItem[] {
    const prevMap = new Map<string, RawPayslipComparisonData>();
    for (const p of previousPayslips) {
      prevMap.set(p.contract_id, p);
    }

    const currentMap = new Map<string, RawPayslipComparisonData>();
    for (const p of currentPayslips) {
      currentMap.set(p.contract_id, p);
    }

    const allContractIds = new Set([
      ...currentPayslips.map(p => p.contract_id),
      ...previousPayslips.map(p => p.contract_id),
    ]);

    const result: EmployeeComparisonItem[] = [];

    for (const contractId of allContractIds) {
      const curr = currentMap.get(contractId);
      const prev = prevMap.get(contractId);

      const refData = curr || prev!;
      const employeeName = refData.employee_name;
      const cpf = refData.cpf;
      const positionTitle = refData.position_title;
      const departmentName = refData.department_name;
      const costCenterId = refData.cost_center_id || 'default-cc';
      const costCenterCode = refData.cost_center_code || '00.00';
      const costCenterName = refData.cost_center_name || 'Geral';

      let status: EmployeeComparisonStatus = 'ACTIVE';
      if (!prev && curr) {
        status = 'NEW';
      } else if (prev && !curr) {
        status = 'TERMINATED';
      }

      const currEarnings = curr ? Number(curr.total_earnings) || 0 : 0;
      const prevEarnings = prev ? Number(prev.total_earnings) || 0 : 0;
      const diffEarnings = currEarnings - prevEarnings;
      const percentEarnings = this.calculatePercentDiff(currEarnings, prevEarnings);

      const currDeductions = curr ? Number(curr.total_deductions) || 0 : 0;
      const prevDeductions = prev ? Number(prev.total_deductions) || 0 : 0;
      const diffDeductions = currDeductions - prevDeductions;

      const currNet = curr ? Number(curr.net_salary) || 0 : 0;
      const prevNet = prev ? Number(prev.net_salary) || 0 : 0;
      const diffNet = currNet - prevNet;
      const percentNet = this.calculatePercentDiff(currNet, prevNet);

      // Encargos (Patronal + RAT + Terceiros + FGTS)
      const currTaxes = curr ? Number(curr.estimated_taxes ?? ((curr.total_earnings || 0) * 0.28)) : 0;
      const prevTaxes = prev ? Number(prev.estimated_taxes ?? ((prev.total_earnings || 0) * 0.28)) : 0;
      const diffTaxes = currTaxes - prevTaxes;

      const currTotalCost = currEarnings + currTaxes;
      const prevTotalCost = prevEarnings + prevTaxes;
      const diffTotalCost = currTotalCost - prevTotalCost;

      result.push({
        contract_id: contractId,
        employee_name: employeeName,
        cpf,
        position_title: positionTitle,
        department_name: departmentName,
        cost_center_id: costCenterId,
        cost_center_code: costCenterCode,
        cost_center_name: costCenterName,
        status,
        current_earnings: currEarnings,
        previous_earnings: prevEarnings,
        diff_earnings: diffEarnings,
        percent_earnings: percentEarnings,
        current_deductions: currDeductions,
        previous_deductions: prevDeductions,
        diff_deductions: diffDeductions,
        current_net: currNet,
        previous_net: prevNet,
        diff_net: diffNet,
        percent_net: percentNet,
        current_taxes: currTaxes,
        previous_taxes: prevTaxes,
        diff_taxes: diffTaxes,
        current_total_cost: currTotalCost,
        previous_total_cost: prevTotalCost,
        diff_total_cost: diffTotalCost,
      });
    }

    // Ordenar colaboradores por nome
    return result.sort((a, b) => a.employee_name.localeCompare(b.employee_name));
  }

  /**
   * 2. Agrupa o comparativo por Centro de Custo
   */
  public computeCostCenterComparison(
    employeeItems: EmployeeComparisonItem[],
    totalCurrentCost: number
  ): CostCenterComparisonItem[] {
    const groups = new Map<string, {
      id: string;
      code: string;
      name: string;
      currentHeadcount: number;
      previousHeadcount: number;
      currentEarnings: number;
      previousEarnings: number;
      currentDeductions: number;
      previousDeductions: number;
      currentNet: number;
      previousNet: number;
      currentTaxes: number;
      previousTaxes: number;
      currentTotalCost: number;
      previousTotalCost: number;
    }>();

    for (const emp of employeeItems) {
      const key = emp.cost_center_name || 'Geral';
      if (!groups.has(key)) {
        groups.set(key, {
          id: emp.cost_center_id || 'default-cc',
          code: emp.cost_center_code || '00.00',
          name: key,
          currentHeadcount: 0,
          previousHeadcount: 0,
          currentEarnings: 0,
          previousEarnings: 0,
          currentDeductions: 0,
          previousDeductions: 0,
          currentNet: 0,
          previousNet: 0,
          currentTaxes: 0,
          previousTaxes: 0,
          currentTotalCost: 0,
          previousTotalCost: 0,
        });
      }

      const g = groups.get(key)!;
      if (emp.current_earnings > 0 || emp.status === 'NEW' || emp.status === 'ACTIVE') {
        if (emp.current_earnings > 0) g.currentHeadcount++;
      }
      if (emp.previous_earnings > 0 || emp.status === 'TERMINATED') {
        if (emp.previous_earnings > 0) g.previousHeadcount++;
      }

      g.currentEarnings += emp.current_earnings;
      g.previousEarnings += emp.previous_earnings;
      g.currentDeductions += emp.current_deductions;
      g.previousDeductions += emp.previous_deductions;
      g.currentNet += emp.current_net;
      g.previousNet += emp.previous_net;
      g.currentTaxes += emp.current_taxes;
      g.previousTaxes += emp.previous_taxes;
      g.currentTotalCost += emp.current_total_cost;
      g.previousTotalCost += emp.previous_total_cost;
    }

    const result: CostCenterComparisonItem[] = [];

    for (const g of groups.values()) {
      const diffEarnings = g.currentEarnings - g.previousEarnings;
      const percentEarnings = this.calculatePercentDiff(g.currentEarnings, g.previousEarnings);

      const diffDeductions = g.currentDeductions - g.previousDeductions;

      const diffNet = g.currentNet - g.previousNet;
      const percentNet = this.calculatePercentDiff(g.currentNet, g.previousNet);

      const diffTaxes = g.currentTaxes - g.previousTaxes;
      const diffTotalCost = g.currentTotalCost - g.previousTotalCost;

      const percentOfTotal = totalCurrentCost > 0
        ? (g.currentTotalCost / totalCurrentCost) * 100
        : 0;

      result.push({
        cost_center_id: g.id,
        cost_center_code: g.code,
        cost_center_name: g.name,
        current_headcount: g.currentHeadcount,
        previous_headcount: g.previousHeadcount,
        diff_headcount: g.currentHeadcount - g.previousHeadcount,
        current_earnings: g.currentEarnings,
        previous_earnings: g.previousEarnings,
        diff_earnings: diffEarnings,
        percent_earnings: percentEarnings,
        current_deductions: g.currentDeductions,
        previous_deductions: g.previousDeductions,
        diff_deductions: diffDeductions,
        current_net: g.currentNet,
        previous_net: g.previousNet,
        diff_net: diffNet,
        percent_net: percentNet,
        current_taxes: g.currentTaxes,
        previous_taxes: g.previousTaxes,
        diff_taxes: diffTaxes,
        current_total_cost: g.currentTotalCost,
        previous_total_cost: g.previousTotalCost,
        diff_total_cost: diffTotalCost,
        percent_of_total_company_cost: percentOfTotal,
      });
    }

    // Ordenar centros de custo por maior custo atual
    return result.sort((a, b) => b.current_total_cost - a.current_total_cost);
  }

  /**
   * 3. Gera o relatório consolidado completo
   */
  public generateComparisonReport(
    currentPayslips: RawPayslipComparisonData[],
    previousPayslips: RawPayslipComparisonData[] = [],
    currentPeriod: { id: string; month: number; year: number; type: string },
    prevPeriod?: { id: string; month: number; year: number; type: string }
  ): PayrollComparisonReport {
    const byEmployee = this.computeEmployeeComparison(currentPayslips, previousPayslips);

    const currentHeadcount = currentPayslips.filter(p => p.total_earnings > 0).length;
    const previousHeadcount = previousPayslips.filter(p => p.total_earnings > 0).length;
    const diffHeadcount = currentHeadcount - previousHeadcount;

    const currentEarnings = currentPayslips.reduce((acc, p) => acc + (Number(p.total_earnings) || 0), 0);
    const previousEarnings = previousPayslips.reduce((acc, p) => acc + (Number(p.total_earnings) || 0), 0);
    const diffEarnings = currentEarnings - previousEarnings;
    const percentEarnings = this.calculatePercentDiff(currentEarnings, previousEarnings);

    const currentDeductions = currentPayslips.reduce((acc, p) => acc + (Number(p.total_deductions) || 0), 0);
    const previousDeductions = previousPayslips.reduce((acc, p) => acc + (Number(p.total_deductions) || 0), 0);
    const diffDeductions = currentDeductions - previousDeductions;

    const currentNet = currentPayslips.reduce((acc, p) => acc + (Number(p.net_salary) || 0), 0);
    const previousNet = previousPayslips.reduce((acc, p) => acc + (Number(p.net_salary) || 0), 0);
    const diffNet = currentNet - previousNet;
    const percentNet = this.calculatePercentDiff(currentNet, previousNet);

    const currentTaxes = byEmployee.reduce((acc, e) => acc + e.current_taxes, 0);
    const previousTaxes = byEmployee.reduce((acc, e) => acc + e.previous_taxes, 0);
    const diffTaxes = currentTaxes - previousTaxes;

    const currentTotalCost = currentEarnings + currentTaxes;
    const previousTotalCost = previousEarnings + previousTaxes;
    const diffTotalCost = currentTotalCost - previousTotalCost;
    const percentTotalCost = this.calculatePercentDiff(currentTotalCost, previousTotalCost);

    const byCostCenter = this.computeCostCenterComparison(byEmployee, currentTotalCost);

    const currentLabel = `${String(currentPeriod.month).padStart(2, '0')}/${currentPeriod.year}`;
    const previousLabel = prevPeriod
      ? `${String(prevPeriod.month).padStart(2, '0')}/${prevPeriod.year}`
      : 'Competência Anterior';

    return {
      current_period_id: currentPeriod.id,
      previous_period_id: prevPeriod?.id || '',
      current_label: currentLabel,
      previous_label: previousLabel,
      summary: {
        current_headcount: currentHeadcount,
        previous_headcount: previousHeadcount,
        diff_headcount: diffHeadcount,
        current_earnings: currentEarnings,
        previous_earnings: previousEarnings,
        diff_earnings: diffEarnings,
        percent_earnings: percentEarnings,
        current_deductions: currentDeductions,
        previous_deductions: previousDeductions,
        diff_deductions: diffDeductions,
        current_net: currentNet,
        previous_net: previousNet,
        diff_net: diffNet,
        percent_net: percentNet,
        current_taxes: currentTaxes,
        previous_taxes: previousTaxes,
        diff_taxes: diffTaxes,
        current_total_cost: currentTotalCost,
        previous_total_cost: previousTotalCost,
        diff_total_cost: diffTotalCost,
        percent_total_cost: percentTotalCost,
      },
      by_employee: byEmployee,
      by_cost_center: byCostCenter,
    };
  }

  /**
   * 4. Executa a extração e consolidação diretamente do banco Supabase
   */
  public async fetchPayrollComparison(periodId: string): Promise<PayrollComparisonReport> {
    // Buscar período atual
    const { data: period, error: pErr } = await supabase
      .from('payroll_periods')
      .select('id, month, year, type, tenant_id, company_id')
      .eq('id', periodId)
      .single();

    if (pErr || !period) {
      throw new Error(`Período de folha não localizado: ${pErr?.message || 'ID inválido'}`);
    }

    let prevMonth = period.month - 1;
    let prevYear = period.year;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = period.year - 1;
    }

    // Buscar período anterior
    const { data: prevPeriod } = await supabase
      .from('payroll_periods')
      .select('id, month, year, type')
      .eq('tenant_id', period.tenant_id)
      .eq('month', prevMonth)
      .eq('year', prevYear)
      .eq('type', period.type)
      .maybeSingle();

    // Query para buscar holerites detalhados
    const fetchPayslips = async (pId: string): Promise<RawPayslipComparisonData[]> => {
      const { data: rawPayslips, error } = await supabase
        .from('payslips')
        .select(`
          id, contract_id, total_earnings, total_deductions, net_salary,
          base_inss, base_irrf, base_fgts, fgts_month,
          employment_contracts (
            id,
            cost_centers ( id, code, name ),
            departments ( name ),
            positions ( title ),
            workers (
              people ( full_name, cpf )
            )
          )
        `)
        .eq('period_id', pId);

      if (error || !rawPayslips) return [];

      return rawPayslips.map((p: any) => {
        const contract = p.employment_contracts;
        const worker = contract?.workers;
        const person = worker?.people;
        const cc = contract?.cost_centers;

        const earnings = Number(p.total_earnings) || 0;
        const fgts = Number(p.fgts_month) || (Number(p.base_fgts) || earnings) * 0.08;
        const patronalTaxes = earnings * 0.20; // 20% patronal aproximado padrão CLT

        return {
          id: p.id,
          contract_id: p.contract_id,
          employee_name: person?.full_name || 'Colaborador',
          cpf: person?.cpf,
          position_title: contract?.positions?.title || '-',
          department_name: contract?.departments?.name || '-',
          cost_center_id: cc?.id || 'default-cc',
          cost_center_code: cc?.code || '00.00',
          cost_center_name: cc?.name || 'Geral',
          total_earnings: earnings,
          total_deductions: Number(p.total_deductions) || 0,
          net_salary: Number(p.net_salary) || 0,
          base_inss: Number(p.base_inss) || 0,
          base_fgts: Number(p.base_fgts) || 0,
          base_irrf: Number(p.base_irrf) || 0,
          fgts_month: fgts,
          estimated_taxes: patronalTaxes + fgts,
        };
      });
    };

    const currentPayslips = await fetchPayslips(period.id);
    const previousPayslips = prevPeriod ? await fetchPayslips(prevPeriod.id) : [];

    return this.generateComparisonReport(
      currentPayslips,
      previousPayslips,
      period,
      prevPeriod || undefined
    );
  }
}

export const payrollComparisonService = new PayrollComparisonService();
