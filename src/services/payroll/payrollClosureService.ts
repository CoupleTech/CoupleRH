import { supabase } from '../../lib/supabase';
import { sha256Sync } from '../../utils/sha256';

export interface ClosureParams {
  period_id: string;
  notes?: string;
}

export interface ReopenParams {
  period_id: string;
  reason: string;
}

export interface ReopeningRecord {
  id: string;
  tenant_id: string;
  period_id: string;
  reopened_by: string;
  reopened_at: string;
  reason: string;
  previous_closed_at?: string;
  previous_version: number;
  new_version: number;
  user_name?: string;
}

export interface PayslipItemValidation {
  type: 'EARNING' | 'DEDUCTION' | string;
  amount: number;
}

export interface PayslipForValidation {
  id?: string;
  contract_id: string;
  employee_name?: string;
  employee_cpf?: string;
  status: string;
  calculation_error?: string;
  total_earnings: number;
  total_deductions: number;
  net_salary: number;
  items?: PayslipItemValidation[];
}

export type ClosureErrorCategory =
  | 'CALCULATION_ERROR'
  | 'NEGATIVE_NET'
  | 'INCOMPLETE_DATA'
  | 'MATH_INCONSISTENCY'
  | 'EMPTY_PERIOD';

export interface ClosureErrorDetail {
  payslip_id?: string;
  contract_id: string;
  employee_name: string;
  employee_cpf?: string;
  reason: string;
  category: ClosureErrorCategory;
}

export interface ClosureValidationResult {
  canClose: boolean;
  blockingErrorsCount: number;
  errorDetails: ClosureErrorDetail[];
  warningCount: number;
  warnings?: string[];
}

export class PayrollClosureService {
  /**
   * Perfis autorizados a executar reabertura formal de folha fechada
   */
  private readonly AUTHORIZED_REOPEN_ROLES = new Set([
    'system_admin',
    'tenant_admin',
    'dp_manager',
  ]);

  /**
   * Valida se uma lista de holerites está íntegra e sem colaboradores em erro para permitir o fechamento
   */
  public validatePayslipsForClosure(payslips: PayslipForValidation[]): ClosureValidationResult {
    const errorDetails: ClosureErrorDetail[] = [];

    if (!payslips || payslips.length === 0) {
      errorDetails.push({
        contract_id: '',
        employee_name: 'Período sem holerites',
        reason: 'Nenhum holerite foi gerado ou processado para este período de folha.',
        category: 'EMPTY_PERIOD',
      });
      return {
        canClose: false,
        blockingErrorsCount: 1,
        errorDetails,
        warningCount: 0,
        warnings: [],
      };
    }

    for (const p of payslips) {
      const statusUpper = (p.status || '').toUpperCase();
      const empName = p.employee_name || `Contrato ${p.contract_id.substring(0, 8)}...`;
      const net = Number(p.net_salary || 0);
      const earnings = Number(p.total_earnings || 0);
      const deductions = Number(p.total_deductions || 0);

      // 1. Status de erro explícito
      if (
        statusUpper === 'ERROR' ||
        statusUpper.includes('ERROR') ||
        statusUpper === 'ERRO_CALCULO' ||
        Boolean(p.calculation_error)
      ) {
        errorDetails.push({
          payslip_id: p.id,
          contract_id: p.contract_id,
          employee_name: empName,
          employee_cpf: p.employee_cpf,
          category: 'CALCULATION_ERROR',
          reason:
            p.calculation_error ||
            'O cálculo deste colaborador falhou durante o processamento da folha.',
        });
        continue;
      }

      // 2. Salário líquido negativo (vedado pelo Art. 462 da CLT)
      if (net < 0) {
        errorDetails.push({
          payslip_id: p.id,
          contract_id: p.contract_id,
          employee_name: empName,
          employee_cpf: p.employee_cpf,
          category: 'NEGATIVE_NET',
          reason: `Salário líquido negativo (R$ ${net.toFixed(2)}). A legislação trabalhista veda que descontos excedam a remuneração integral do empregado sem saldo devedor acordado.`,
        });
        continue;
      }

      // 3. Invariante Matemática T6: Itens vs Totais
      if (p.items && p.items.length > 0) {
        const sumEarnings = p.items
          .filter((i) => i.type === 'EARNING')
          .reduce((acc, i) => acc + Number(i.amount || 0), 0);
        const sumDeductions = p.items
          .filter((i) => i.type === 'DEDUCTION')
          .reduce((acc, i) => acc + Number(i.amount || 0), 0);

        if (
          Math.abs(sumEarnings - earnings) > 0.01 ||
          Math.abs(sumDeductions - deductions) > 0.01
        ) {
          errorDetails.push({
            payslip_id: p.id,
            contract_id: p.contract_id,
            employee_name: empName,
            employee_cpf: p.employee_cpf,
            category: 'MATH_INCONSISTENCY',
            reason: `Inconsistência matemática (T6): A soma dos itens discriminados diverge dos totais do cabeçalho do holerite (divergência proventos/descontos).`,
          });
          continue;
        }
      }

      // 4. Invariante Líquido = Proventos - Descontos
      if (Math.abs(net - (earnings - deductions)) > 0.01) {
        errorDetails.push({
          payslip_id: p.id,
          contract_id: p.contract_id,
          employee_name: empName,
          employee_cpf: p.employee_cpf,
          category: 'MATH_INCONSISTENCY',
          reason: `Inconsistência matemática: O salário líquido apurado (R$ ${net.toFixed(2)}) não bate com a equação Proventos (R$ ${earnings.toFixed(2)}) menos Descontos (R$ ${deductions.toFixed(2)}).`,
        });
        continue;
      }
    }

    return {
      canClose: errorDetails.length === 0,
      blockingErrorsCount: errorDetails.length,
      errorDetails,
      warningCount: 0,
      warnings: [],
    };
  }

  /**
   * Lança exceção se houver impedimentos para o fechamento
   */
  public assertCanClosePeriod(payslips: PayslipForValidation[]): void {
    const result = this.validatePayslipsForClosure(payslips);
    if (!result.canClose) {
      const errCount = result.blockingErrorsCount;
      throw new Error(
        `Fechamento de folha bloqueado (CLT/Compliance): Existem ${errCount} colaborador(es) em erro ou inconsistência impeditiva no período. Regularize os cálculos antes de fechar a folha.`
      );
    }
  }

  /**
   * 1. Valida se a role informada possui permissão de reabertura
   */
  public isRoleAuthorizedToReopen(role?: string): boolean {
    if (!role) return false;
    return this.AUTHORIZED_REOPEN_ROLES.has(role);
  }

  /**
   * 2. Valida a justificativa obrigatória de reabertura (mínimo 15 caracteres)
   */
  public validateReopenReason(reason: string): { isValid: boolean; error?: string } {
    const trimmed = (reason || '').trim();
    if (!trimmed) {
      return { isValid: false, error: 'A justificativa de reabertura é obrigatória para auditoria.' };
    }
    if (trimmed.length < 15) {
      return {
        isValid: false,
        error: `A justificativa deve conter no mínimo 15 caracteres (você digitou ${trimmed.length}).`,
      };
    }
    return { isValid: true };
  }

  /**
   * 3. Verifica se o período é imutável (CLOSED)
   */
  public isPeriodImmutable(status: string): boolean {
    return status === 'CLOSED';
  }

  /**
   * 4. Calcula próxima versão incremental do holerite
   */
  public calculateNextVersion(currentVersion = 1): number {
    return (currentVersion || 1) + 1;
  }

  /**
   * 5. Prepara cópias versionadas de holerites para reabertura
   */
  public prepareReopenedPayslips(payslips: any[], newVersion: number): any[] {
    const now = new Date().toISOString();
    return payslips.map(p => ({
      ...p,
      version: newVersion,
      status: 'DRAFT',
      is_latest: true,
      superseded_at: now,
    }));
  }

  /**
   * 6. Gera Hash SHA-256 canônico de fechamento do holerite
   */
  public computeClosureHash(payslip: {
    contract_id: string;
    period_id: string;
    total_earnings: number;
    total_deductions: number;
    net_salary: number;
    version?: number;
  }): string {
    const canonicalPayload = [
      payslip.contract_id,
      payslip.period_id,
      Number(payslip.total_earnings).toFixed(2),
      Number(payslip.total_deductions).toFixed(2),
      Number(payslip.net_salary).toFixed(2),
      String(payslip.version || 1),
    ].join('|');

    return sha256Sync(canonicalPayload);
  }

  /**
   * Consulta os holerites do período no Supabase e valida se existem colaboradores em erro antes de fechar
   */
  public async validatePeriodBeforeClosure(periodId: string): Promise<ClosureValidationResult> {
    const { data, error } = await supabase
      .from('payslips')
      .select(`
        id,
        contract_id,
        status,
        total_earnings,
        total_deductions,
        net_salary,
        payslip_items (
          type,
          amount
        ),
        employment_contracts (
          persons (
            name,
            cpf
          )
        )
      `)
      .eq('period_id', periodId);

    if (error) {
      console.error('Erro ao consultar holerites para validação de fechamento:', error);
      throw new Error(`Erro ao validar holerites do período: ${error.message}`);
    }

    const payslipsForValidation: PayslipForValidation[] = (data || []).map((row: any) => {
      const person = row.employment_contracts?.persons;
      const items: PayslipItemValidation[] = (row.payslip_items || []).map((item: any) => ({
        type: item.type,
        amount: Number(item.amount) || 0,
      }));

      return {
        id: row.id,
        contract_id: row.contract_id,
        employee_name: person?.name || `Contrato ${String(row.contract_id).substring(0, 8)}`,
        employee_cpf: person?.cpf,
        status: row.status,
        total_earnings: Number(row.total_earnings) || 0,
        total_deductions: Number(row.total_deductions) || 0,
        net_salary: Number(row.net_salary) || 0,
        items,
      };
    });

    return this.validatePayslipsForClosure(payslipsForValidation);
  }

  /**
   * 7. Executa o fechamento formal e imutável da folha no Supabase com bloqueio por colaboradores em erro
   */
  public async closePeriod(params: ClosureParams): Promise<{
    success: boolean;
    period_id: string;
    status: string;
    closed_at: string;
    payslips_closed: number;
  }> {
    // 1. Validação client-side de integridade antes do fechamento
    const validation = await this.validatePeriodBeforeClosure(params.period_id);
    if (!validation.canClose) {
      const firstError = validation.errorDetails[0];
      throw new Error(
        `Fechamento bloqueado: Existem ${validation.blockingErrorsCount} colaborador(es) com pendências ou erros no cálculo da folha. Exemplo: ${firstError.employee_name} (${firstError.reason})`
      );
    }

    // Tenta executar via RPC close_payroll_period se disponível no banco
    const { data: rpcData, error: rpcError } = await supabase.rpc('close_payroll_period', {
      p_period_id: params.period_id,
      p_notes: params.notes || null,
    });

    if (!rpcError && rpcData) {
      return rpcData as any;
    }

    // Fallback via client com RLS seguro
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      throw new Error('Usuário não autenticado.');
    }

    const closedAt = new Date().toISOString();

    // Atualiza payroll_periods
    const { error: periodError } = await supabase
      .from('payroll_periods')
      .update({
        status: 'CLOSED',
        closed_at: closedAt,
        closed_by: userData.user.id,
        closure_notes: params.notes || null,
      })
      .eq('id', params.period_id);

    if (periodError) {
      throw new Error(`Falha ao fechar período: ${periodError.message}`);
    }

    // Atualiza payslips com status CLOSED
    const { error: payslipError } = await supabase
      .from('payslips')
      .update({
        status: 'CLOSED',
      })
      .eq('period_id', params.period_id);

    if (payslipError) {
      throw new Error(`Falha ao atualizar holerites: ${payslipError.message}`);
    }

    return {
      success: true,
      period_id: params.period_id,
      status: 'CLOSED',
      closed_at: closedAt,
      payslips_closed: 0,
    };
  }

  /**
   * 8. Executa a reabertura controlada da folha fechada no Supabase
   */
  public async reopenPeriod(params: ReopenParams): Promise<{
    success: boolean;
    period_id: string;
    status: string;
    new_version: number;
    reopened_at: string;
  }> {
    const reasonValidation = this.validateReopenReason(params.reason);
    if (!reasonValidation.isValid) {
      throw new Error(reasonValidation.error);
    }

    // Tenta executar via RPC reopen_payroll_period se disponível
    const { data: rpcData, error: rpcError } = await supabase.rpc('reopen_payroll_period', {
      p_period_id: params.period_id,
      p_reason: params.reason.trim(),
    });

    if (!rpcError && rpcData) {
      return rpcData as any;
    }

    // Fallback transacional no client
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      throw new Error('Usuário não autenticado.');
    }

    // 1. Obter período atual
    const { data: period, error: pErr } = await supabase
      .from('payroll_periods')
      .select('id, tenant_id, status, current_version, closed_at, closed_by')
      .eq('id', params.period_id)
      .single();

    if (pErr || !period) {
      throw new Error('Período de folha não localizado.');
    }

    if (period.status !== 'CLOSED') {
      throw new Error('Apenas períodos com status CLOSED podem ser reabertos formalmente.');
    }

    // 2. Checar permissão do usuário
    const { data: tenantUser } = await supabase
      .from('tenant_users')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('tenant_id', period.tenant_id)
      .maybeSingle();

    if (!this.isRoleAuthorizedToReopen(tenantUser?.role)) {
      throw new Error(
        `Acesso negado: Perfil "${tenantUser?.role || 'operador'}" não possui permissão para reabrir folha fechada. Somente administradores ou gestores de DP (dp_manager) têm essa autorização.`
      );
    }

    const prevVersion = period.current_version || 1;
    const nextVersion = prevVersion + 1;
    const reopenedAt = new Date().toISOString();

    // 3. Registrar na tabela de reaberturas
    await supabase.from('payroll_period_reopenings').insert({
      tenant_id: period.tenant_id,
      period_id: params.period_id,
      reopened_by: userData.user.id,
      reopened_at: reopenedAt,
      reason: params.reason.trim(),
      previous_closed_at: period.closed_at,
      previous_closed_by: period.closed_by,
      previous_version: prevVersion,
      new_version: nextVersion,
    });

    // 4. Atualizar período
    const { error: updErr } = await supabase
      .from('payroll_periods')
      .update({
        status: 'REOPENED',
        current_version: nextVersion,
        closed_at: null,
        closed_by: null,
      })
      .eq('id', params.period_id);

    if (updErr) {
      throw new Error(`Falha ao reabrir período: ${updErr.message}`);
    }

    // 5. Atualizar holerites para DRAFT e versionar
    await supabase
      .from('payslips')
      .update({
        status: 'DRAFT',
        version: nextVersion,
        superseded_at: reopenedAt,
      })
      .eq('period_id', params.period_id);

    return {
      success: true,
      period_id: params.period_id,
      status: 'REOPENED',
      new_version: nextVersion,
      reopened_at: reopenedAt,
    };
  }

  /**
   * 9. Busca histórico de reaberturas de um período para auditoria
   */
  public async fetchReopenHistory(periodId: string): Promise<ReopeningRecord[]> {
    const { data, error } = await supabase
      .from('payroll_period_reopenings')
      .select(`
        id, tenant_id, period_id, reopened_by, reopened_at, reason,
        previous_closed_at, previous_version, new_version
      `)
      .eq('period_id', periodId)
      .order('reopened_at', { ascending: false });

    if (error || !data) return [];

    return data as ReopeningRecord[];
  }

  /**
   * 10. Verifica se o usuário atual tem permissão para reabrir no tenant
   */
  public async checkCurrentUserReopenPermission(tenantId: string): Promise<{
    authorized: boolean;
    role?: string;
  }> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { authorized: false };

    const { data } = await supabase
      .from('tenant_users')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const role = data?.role;
    return {
      authorized: this.isRoleAuthorizedToReopen(role),
      role,
    };
  }
}

export const payrollClosureService = new PayrollClosureService();
