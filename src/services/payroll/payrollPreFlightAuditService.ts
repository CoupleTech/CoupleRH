import { supabase } from '../../lib/supabase';

export type PreFlightFindingSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export type PreFlightFindingCategory =
  | 'NET_VARIATION'
  | 'ZERO_BASE'
  | 'DEPENDENTS_CHANGED'
  | 'NEW_RUBRIC'
  | 'PENDING_TIME_PUNCH';

export interface PreFlightFinding {
  id: string;
  contract_id: string;
  employee_name: string;
  category: PreFlightFindingCategory;
  severity: PreFlightFindingSeverity;
  title: string;
  description: string;
  current_value?: string | number;
  previous_value?: string | number;
  metadata?: Record<string, any>;
}

export interface PreFlightAuditSummary {
  total_findings: number;
  critical_count: number;
  warning_count: number;
  info_count: number;
  can_proceed_to_closure: boolean;
  findings_by_category: Record<PreFlightFindingCategory, number>;
}

export interface PreFlightAuditResult {
  period_id: string;
  audited_at: string;
  summary: PreFlightAuditSummary;
  findings: PreFlightFinding[];
}

export interface PayslipItemData {
  id?: string;
  rubric_code?: string;
  rubric_name: string;
  reference?: string;
  amount: number;
  type: string; // 'EARNING' | 'DEDUCTION' | 'BASE'
}

export interface PayslipAuditData {
  id?: string;
  contract_id: string;
  employee_name: string;
  net_salary: number;
  total_earnings: number;
  total_deductions: number;
  base_inss?: number;
  base_fgts?: number;
  base_irrf?: number;
  items?: PayslipItemData[];
}

export interface TimeTrackingAuditData {
  missing_punches_count: number;
  pending_adjustments_count: number;
  contested_timesheets_count: number;
  timesheet_status?: string;
}

export interface PreFlightAuditParams {
  period_id: string;
  current_payslips: PayslipAuditData[];
  previous_payslips?: PayslipAuditData[];
  dependents_data?: Record<string, { current: number; previous: number }>;
  time_tracking_data?: Record<string, TimeTrackingAuditData>;
  leaves_data?: Record<string, boolean>; // contract_id -> hasActiveLeave
}

export class PayrollPreFlightAuditService {
  /**
   * 1. Verifica variações do salário líquido entre a competência atual e anterior
   */
  public checkNetSalaryVariation(
    current: PayslipAuditData,
    previous: PayslipAuditData | null | undefined,
    employeeName: string
  ): PreFlightFinding[] {
    const findings: PreFlightFinding[] = [];

    // Salário líquido zerado ou negativo na folha mensal
    if (current.net_salary <= 0) {
      findings.push({
        id: `net-zero-${current.contract_id}`,
        contract_id: current.contract_id,
        employee_name: employeeName,
        category: 'NET_VARIATION',
        severity: 'CRITICAL',
        title: 'Salário líquido zerado ou negativo',
        description: `O colaborador está com salário líquido apurado de R$ ${current.net_salary.toFixed(2)}. Pela CLT (Art. 462), a soma dos descontos não pode suprimir integralmente a remuneração.`,
        current_value: current.net_salary,
        previous_value: previous ? previous.net_salary : undefined,
      });
      return findings;
    }

    if (!previous || previous.net_salary <= 0) {
      return findings;
    }

    const diff = current.net_salary - previous.net_salary;
    const absDiff = Math.abs(diff);
    const ratio = diff / previous.net_salary;

    // Queda brusca >= 20% e diferença monetária >= R$ 200,00
    if (ratio <= -0.20 && absDiff >= 200) {
      const percentStr = (ratio * 100).toFixed(1);
      findings.push({
        id: `net-drop-${current.contract_id}`,
        contract_id: current.contract_id,
        employee_name: employeeName,
        category: 'NET_VARIATION',
        severity: 'WARNING',
        title: `Queda de salário líquido (${percentStr}%)`,
        description: `O salário líquido caiu de R$ ${previous.net_salary.toFixed(2)} para R$ ${current.net_salary.toFixed(2)} (${percentStr}% / -R$ ${absDiff.toFixed(2)}). Verifique se há descontos novos, faltas ou faltou lançamento de verbas habituais.`,
        current_value: current.net_salary,
        previous_value: previous.net_salary,
      });
    }
    // Aumento significativo >= 50%
    else if (ratio >= 0.50 && absDiff >= 200) {
      const percentStr = (ratio * 100).toFixed(1);
      findings.push({
        id: `net-jump-${current.contract_id}`,
        contract_id: current.contract_id,
        employee_name: employeeName,
        category: 'NET_VARIATION',
        severity: 'WARNING',
        title: `Aumento expressivo no salário líquido (+${percentStr}%)`,
        description: `O salário líquido aumentou de R$ ${previous.net_salary.toFixed(2)} para R$ ${current.net_salary.toFixed(2)} (+${percentStr}% / +R$ ${absDiff.toFixed(2)}). Verifique a consistência de horas extras, adicionais ou gratificações.`,
        current_value: current.net_salary,
        previous_value: previous.net_salary,
      });
    }
    // Aumento moderado >= 20%
    else if (ratio >= 0.20 && absDiff >= 200) {
      const percentStr = (ratio * 100).toFixed(1);
      findings.push({
        id: `net-inc-${current.contract_id}`,
        contract_id: current.contract_id,
        employee_name: employeeName,
        category: 'NET_VARIATION',
        severity: 'INFO',
        title: `Aumento no salário líquido (+${percentStr}%)`,
        description: `O salário líquido teve acréscimo de R$ ${absDiff.toFixed(2)} (+${percentStr}%) em relação ao mês anterior.`,
        current_value: current.net_salary,
        previous_value: previous.net_salary,
      });
    }

    return findings;
  }

  /**
   * 2. Verifica bases zeradas de tributos (INSS/FGTS) e proventos nulos
   */
  public checkZeroBases(
    current: PayslipAuditData,
    employeeName: string,
    hasLeave = false
  ): PreFlightFinding[] {
    const findings: PreFlightFinding[] = [];

    // Proventos zerados sem afastamento
    if (current.total_earnings <= 0 && !hasLeave) {
      findings.push({
        id: `zero-earnings-${current.contract_id}`,
        contract_id: current.contract_id,
        employee_name: employeeName,
        category: 'ZERO_BASE',
        severity: 'WARNING',
        title: 'Proventos zerados sem afastamento registrado',
        description: `O colaborador não possui proventos calculados no período e não há licença/afastamento cadastrado. Verifique se o contrato está ativo ou se faltaram lançamentos.`,
        current_value: current.total_earnings,
      });
    }

    // Base de INSS zerada com proventos > 0
    if (current.total_earnings > 0 && (!current.base_inss || current.base_inss <= 0)) {
      findings.push({
        id: `zero-inss-${current.contract_id}`,
        contract_id: current.contract_id,
        employee_name: employeeName,
        category: 'ZERO_BASE',
        severity: 'CRITICAL',
        title: 'Base de INSS zerada com proventos devidos',
        description: `O colaborador possui R$ ${current.total_earnings.toFixed(2)} em proventos, mas a Base de INSS está zerada (R$ 0,00). Risco de não recolhimento de contribuição previdenciária e inconsistência no eSocial.`,
        current_value: current.base_inss || 0,
      });
    }

    // Base de FGTS zerada com proventos > 0
    if (current.total_earnings > 0 && (!current.base_fgts || current.base_fgts <= 0)) {
      findings.push({
        id: `zero-fgts-${current.contract_id}`,
        contract_id: current.contract_id,
        employee_name: employeeName,
        category: 'ZERO_BASE',
        severity: 'CRITICAL',
        title: 'Base de FGTS zerada com proventos devidos',
        description: `O colaborador possui R$ ${current.total_earnings.toFixed(2)} em proventos, mas a Base de FGTS está zerada (R$ 0,00). Risco de infração à Lei 8.036/90 e divergência no FGTS Digital.`,
        current_value: current.base_fgts || 0,
      });
    }

    return findings;
  }

  /**
   * 3. Verifica alterações no número de dependentes cadastrados
   */
  public checkDependentsChanges(
    contractId: string,
    employeeName: string,
    currentCount: number,
    previousCount: number
  ): PreFlightFinding[] {
    const findings: PreFlightFinding[] = [];

    if (currentCount < previousCount) {
      findings.push({
        id: `dep-reduced-${contractId}`,
        contract_id: contractId,
        employee_name: employeeName,
        category: 'DEPENDENTS_CHANGED',
        severity: 'WARNING',
        title: 'Redução de dependentes para fins legais',
        description: `O número de dependentes cadastrados reduziu de ${previousCount} para ${currentCount}. Isso reduz a dedução da base de IRRF (R$ 189,59/dependente). Confirme se o dependente atingiu a maioridade fiscal (21 anos).`,
        current_value: currentCount,
        previous_value: previousCount,
      });
    } else if (currentCount > previousCount) {
      findings.push({
        id: `dep-increased-${contractId}`,
        contract_id: contractId,
        employee_name: employeeName,
        category: 'DEPENDENTS_CHANGED',
        severity: 'INFO',
        title: 'Novo dependente adicionado',
        description: `O número de dependentes cadastrados aumentou de ${previousCount} para ${currentCount}, ampliando a dedução do IRRF e elegibilidade a salário-família.`,
        current_value: currentCount,
        previous_value: previousCount,
      });
    }

    return findings;
  }

  /**
   * 4. Identifica rubricas novas no holerite do mês
   */
  public checkNewRubrics(
    currentItems: PayslipItemData[],
    previousItems: PayslipItemData[] = [],
    employeeName: string,
    contractId: string
  ): PreFlightFinding[] {
    const findings: PreFlightFinding[] = [];
    const prevCodes = new Set(previousItems.map(i => i.rubric_code || i.rubric_name));

    // Rubricas automáticas padrão que não precisam de alerta como "novas"
    const standardAutoCodes = new Set(['901', '902', '903']);

    for (const item of currentItems) {
      const codeOrName = item.rubric_code || item.rubric_name;
      if (!prevCodes.has(codeOrName) && !standardAutoCodes.has(item.rubric_code || '')) {
        const isHighImpactDeduction = item.type === 'DEDUCTION' && item.amount >= 300;
        const codeDisplay = item.rubric_code ? `[${item.rubric_code} - ${item.rubric_name}]` : `[${item.rubric_name}]`;

        findings.push({
          id: `new-rubric-${contractId}-${item.rubric_code || item.rubric_name}`,
          contract_id: contractId,
          employee_name: employeeName,
          category: 'NEW_RUBRIC',
          severity: isHighImpactDeduction ? 'WARNING' : 'INFO',
          title: `Nova rubrica no mês: ${codeDisplay}`,
          description: `O colaborador não possuía este evento no mês anterior. Tipo: ${item.type === 'EARNING' ? 'Provento' : 'Desconto'}, Valor apurado: R$ ${item.amount.toFixed(2)}.`,
          current_value: item.amount,
        });
      }
    }

    return findings;
  }

  /**
   * 5. Verifica pendências de Ponto Eletrônico
   */
  public checkPendingTimeTracking(
    contractId: string,
    employeeName: string,
    timeData: TimeTrackingAuditData
  ): PreFlightFinding[] {
    const findings: PreFlightFinding[] = [];

    // Batidas ímpares não tratadas
    if (timeData.missing_punches_count > 0) {
      findings.push({
        id: `time-missing-${contractId}`,
        contract_id: contractId,
        employee_name: employeeName,
        category: 'PENDING_TIME_PUNCH',
        severity: 'CRITICAL',
        title: 'Batidas de ponto ímpares não tratadas',
        description: `O colaborador possui ${timeData.missing_punches_count} marcação(ões) pendente(s) de ajuste na competência. O fechamento sem tratamento de marcações ímpares distorce horas extras e faltas.`,
        current_value: timeData.missing_punches_count,
      });
    }

    // Espelho de ponto em contestação
    if (timeData.contested_timesheets_count > 0 || timeData.timesheet_status === 'CONTESTED') {
      findings.push({
        id: `time-contested-${contractId}`,
        contract_id: contractId,
        employee_name: employeeName,
        category: 'PENDING_TIME_PUNCH',
        severity: 'CRITICAL',
        title: 'Espelho de ponto em contestação pelo trabalhador',
        description: `Existe contestação ativa no espelho de ponto do colaborador. É mandatório deferir ou indeferir a solicitação antes do fechamento oficial da folha.`,
        current_value: timeData.timesheet_status,
      });
    }

    // Ajustes de batidas pendentes de aprovação pelo gestor
    if (timeData.pending_adjustments_count > 0) {
      findings.push({
        id: `time-adj-${contractId}`,
        contract_id: contractId,
        employee_name: employeeName,
        category: 'PENDING_TIME_PUNCH',
        severity: 'WARNING',
        title: 'Ajustes de ponto pendentes de aprovação',
        description: `Há ${timeData.pending_adjustments_count} solicitação(ões) de inclusão ou ajuste de batida pendente(s) na Central de Aprovações.`,
        current_value: timeData.pending_adjustments_count,
      });
    }

    return findings;
  }

  /**
   * Consolida a auditoria completa da pré-folha
   */
  public auditPrePayroll(params: PreFlightAuditParams): PreFlightAuditResult {
    const findings: PreFlightFinding[] = [];
    const prevMap = new Map<string, PayslipAuditData>();

    if (params.previous_payslips) {
      for (const p of params.previous_payslips) {
        prevMap.set(p.contract_id, p);
      }
    }

    for (const current of params.current_payslips) {
      const prev = prevMap.get(current.contract_id);
      const employeeName = current.employee_name;

      // 1. Variação de líquido
      const netFindings = this.checkNetSalaryVariation(current, prev, employeeName);
      findings.push(...netFindings);

      // 2. Bases zeradas
      const hasLeave = params.leaves_data ? !!params.leaves_data[current.contract_id] : false;
      const baseFindings = this.checkZeroBases(current, employeeName, hasLeave);
      findings.push(...baseFindings);

      // 3. Dependentes alterados
      if (params.dependents_data && params.dependents_data[current.contract_id]) {
        const depInfo = params.dependents_data[current.contract_id];
        const depFindings = this.checkDependentsChanges(
          current.contract_id,
          employeeName,
          depInfo.current,
          depInfo.previous
        );
        findings.push(...depFindings);
      }

      // 4. Rubricas novas
      if (current.items && current.items.length > 0) {
        const prevItems = prev?.items || [];
        const rubricFindings = this.checkNewRubrics(current.items, prevItems, employeeName, current.contract_id);
        findings.push(...rubricFindings);
      }

      // 5. Ponto pendente
      if (params.time_tracking_data && params.time_tracking_data[current.contract_id]) {
        const timeData = params.time_tracking_data[current.contract_id];
        const timeFindings = this.checkPendingTimeTracking(current.contract_id, employeeName, timeData);
        findings.push(...timeFindings);
      }
    }

    // Sumário
    let criticalCount = 0;
    let warningCount = 0;
    let infoCount = 0;

    const findingsByCategory: Record<PreFlightFindingCategory, number> = {
      NET_VARIATION: 0,
      ZERO_BASE: 0,
      DEPENDENTS_CHANGED: 0,
      NEW_RUBRIC: 0,
      PENDING_TIME_PUNCH: 0,
    };

    for (const f of findings) {
      if (f.severity === 'CRITICAL') criticalCount++;
      else if (f.severity === 'WARNING') warningCount++;
      else if (f.severity === 'INFO') infoCount++;

      findingsByCategory[f.category] = (findingsByCategory[f.category] || 0) + 1;
    }

    return {
      period_id: params.period_id,
      audited_at: new Date().toISOString(),
      summary: {
        total_findings: findings.length,
        critical_count: criticalCount,
        warning_count: warningCount,
        info_count: infoCount,
        can_proceed_to_closure: criticalCount === 0,
        findings_by_category: findingsByCategory,
      },
      findings,
    };
  }

  /**
   * Executa a auditoria completa diretamente no banco de dados para uma competência
   */
  public async runPrePayrollAudit(periodId: string, companyId?: string): Promise<PreFlightAuditResult> {
    // 1. Obter período atual
    const { data: period, error: periodErr } = await supabase
      .from('payroll_periods')
      .select('id, month, year, type, tenant_id, company_id')
      .eq('id', periodId)
      .single();

    if (periodErr || !period) {
      throw new Error(`Período de folha não localizado: ${periodErr?.message || 'ID inválido'}`);
    }

    const currentMonth = period.month;
    const currentYear = period.year;

    // Calcular mês/ano anterior
    let prevMonth = currentMonth - 1;
    let prevYear = currentYear;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = currentYear - 1;
    }

    // 2. Buscar período anterior
    const { data: prevPeriod } = await supabase
      .from('payroll_periods')
      .select('id')
      .eq('tenant_id', period.tenant_id)
      .eq('month', prevMonth)
      .eq('year', prevYear)
      .eq('type', period.type)
      .maybeSingle();

    // 3. Buscar holerites e itens do período atual
    const { data: currentPayslipsRaw } = await supabase
      .from('payslips')
      .select(`
        id, contract_id, total_earnings, total_deductions, net_salary,
        base_inss, base_irrf, base_fgts,
        employment_contracts (
          id,
          workers (
            people ( full_name )
          )
        ),
        payslip_items (
          id, reference, amount, type,
          payroll_rubrics!payslip_items_rubric_id_fkey ( code, name )
        )
      `)
      .eq('period_id', periodId);

    const currentPayslips: PayslipAuditData[] = (currentPayslipsRaw || []).map((p: any) => ({
      id: p.id,
      contract_id: p.contract_id,
      employee_name: p.employment_contracts?.workers?.people?.full_name || 'Colaborador',
      net_salary: Number(p.net_salary || 0),
      total_earnings: Number(p.total_earnings || 0),
      total_deductions: Number(p.total_deductions || 0),
      base_inss: Number(p.base_inss || 0),
      base_fgts: Number(p.base_fgts || 0),
      base_irrf: Number(p.base_irrf || 0),
      items: (p.payslip_items || []).map((item: any) => ({
        id: item.id,
        rubric_code: item.payroll_rubrics?.code,
        rubric_name: item.payroll_rubrics?.name || 'Rubrica',
        reference: item.reference,
        amount: Number(item.amount || 0),
        type: item.type,
      })),
    }));

    // 4. Buscar holerites e itens do período anterior (se existir)
    let previousPayslips: PayslipAuditData[] = [];
    if (prevPeriod) {
      const { data: prevPayslipsRaw } = await supabase
        .from('payslips')
        .select(`
          id, contract_id, total_earnings, total_deductions, net_salary,
          base_inss, base_irrf, base_fgts,
          employment_contracts (
            id,
            workers (
              people ( full_name )
            )
          ),
          payslip_items (
            id, reference, amount, type,
            payroll_rubrics!payslip_items_rubric_id_fkey ( code, name )
          )
        `)
        .eq('period_id', prevPeriod.id);

      previousPayslips = (prevPayslipsRaw || []).map((p: any) => ({
        id: p.id,
        contract_id: p.contract_id,
        employee_name: p.employment_contracts?.workers?.people?.full_name || 'Colaborador',
        net_salary: Number(p.net_salary || 0),
        total_earnings: Number(p.total_earnings || 0),
        total_deductions: Number(p.total_deductions || 0),
        base_inss: Number(p.base_inss || 0),
        base_fgts: Number(p.base_fgts || 0),
        base_irrf: Number(p.base_irrf || 0),
        items: (p.payslip_items || []).map((item: any) => ({
          id: item.id,
          rubric_code: item.payroll_rubrics?.code,
          rubric_name: item.payroll_rubrics?.name || 'Rubrica',
          reference: item.reference,
          amount: Number(item.amount || 0),
          type: item.type,
        })),
      }));
    }

    // 5. Buscar contagem de dependentes atuais por contrato
    const dependentsData: Record<string, { current: number; previous: number }> = {};
    const contractIds = currentPayslips.map(p => p.contract_id);

    if (contractIds.length > 0) {
      const { data: depsRaw } = await supabase
        .from('dependents')
        .select('id, person_id, is_irrf_dependent, workers!inner(employment_contracts(id))')
        .eq('is_irrf_dependent', true);

      if (depsRaw) {
        for (const d of depsRaw as any[]) {
          const contracts = d.workers?.employment_contracts;
          if (Array.isArray(contracts)) {
            for (const c of contracts) {
              if (contractIds.includes(c.id)) {
                if (!dependentsData[c.id]) {
                  dependentsData[c.id] = { current: 0, previous: 0 };
                }
                dependentsData[c.id].current++;
              }
            }
          }
        }
      }
    }

    // 6. Buscar inconsistências de ponto eletrônico na competência
    const timeTrackingData: Record<string, TimeTrackingAuditData> = {};
    const startOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const endOfMonth = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];

    // Checar resumos com MISSING_PUNCH ou inconsistências
    const { data: summariesRaw } = await supabase
      .from('time_daily_summary')
      .select('contract_id, status')
      .gte('date', startOfMonth)
      .lte('date', endOfMonth)
      .eq('status', 'INCONSISTENT');

    if (summariesRaw) {
      for (const s of summariesRaw) {
        if (!timeTrackingData[s.contract_id]) {
          timeTrackingData[s.contract_id] = {
            missing_punches_count: 0,
            pending_adjustments_count: 0,
            contested_timesheets_count: 0,
          };
        }
        timeTrackingData[s.contract_id].missing_punches_count++;
      }
    }

    // Checar espelhos contestados
    const { data: timesheetsRaw } = await supabase
      .from('timesheets')
      .select('contract_id, status')
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .eq('status', 'CONTESTED');

    if (timesheetsRaw) {
      for (const t of timesheetsRaw) {
        if (!timeTrackingData[t.contract_id]) {
          timeTrackingData[t.contract_id] = {
            missing_punches_count: 0,
            pending_adjustments_count: 0,
            contested_timesheets_count: 0,
          };
        }
        timeTrackingData[t.contract_id].contested_timesheets_count++;
        timeTrackingData[t.contract_id].timesheet_status = 'CONTESTED';
      }
    }

    // 7. Checar afastamentos ativos
    const leavesData: Record<string, boolean> = {};
    const { data: leavesRaw } = await supabase
      .from('employee_leaves')
      .select('contract_id, start_date, end_date')
      .lte('start_date', endOfMonth)
      .or(`end_date.is.null,end_date.gte.${startOfMonth}`);

    if (leavesRaw) {
      for (const l of leavesRaw) {
        leavesData[l.contract_id] = true;
      }
    }

    // Executar auditoria pura consolidada
    return this.auditPrePayroll({
      period_id: periodId,
      current_payslips: currentPayslips,
      previous_payslips: previousPayslips,
      dependents_data: dependentsData,
      time_tracking_data: timeTrackingData,
      leaves_data: leavesData,
    });
  }
}

export const payrollPreFlightAuditService = new PayrollPreFlightAuditService();
