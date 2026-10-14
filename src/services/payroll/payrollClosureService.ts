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
   * 7. Executa o fechamento formal e imutável da folha no Supabase
   */
  public async closePeriod(params: ClosureParams): Promise<{
    success: boolean;
    period_id: string;
    status: string;
    closed_at: string;
    payslips_closed: number;
  }> {
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
