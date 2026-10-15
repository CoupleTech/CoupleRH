/**
 * timeBankService.ts
 * 
 * Módulo de Gestão de Banco de Horas em estrita conformidade com a CLT:
 * - CLT Art. 59 § 2º: Banco de horas via CCT/ACT (vigência máxima de 1 ano / 12 meses).
 * - CLT Art. 59 § 3º: Quitação/pagamento na rescisão ou após expiração sem compensação.
 * - CLT Art. 59 § 5º: Banco de horas via Acordo Individual escrito (vigência máxima de 6 meses).
 * - CLT Art. 59 § 6º: Compensação no mesmo mês (regime tácito ou escrito).
 * 
 * Funcionalidades:
 * - Abertura e validação legal de contas de banco de horas.
 * - Ingestão de créditos/débitos a partir do resumo diário da jornada (time_daily_summary).
 * - Controle de teto de saldo (max_positive_balance_minutes) com direcionamento de excedente à folha.
 * - Agendamento e concessão de folga compensatória.
 * - Ajustes manuais com justificativa obrigatória.
 * - Emissão de extrato cronológico com saldo cumulativo linha a linha.
 * - Monitoramento contínuo de vencimentos com níveis de alerta (NORMAL, WARNING, CRITICAL, EXPIRED).
 * - Fechamento e liquidação para pagamento como horas extras na folha (rubrica 152 / fator legal).
 */

export type TimeBankPolicyType = 'ACORDO_INDIVIDUAL' | 'CCT' | 'ACT';
export type TimeBankExpirationRule = 'PAY_AS_OVERTIME' | 'FORFEIT' | 'EXTEND';
export type TimeBankStatus = 'ACTIVE' | 'CLOSED' | 'PAID_OUT';
export type TimeBankTransactionType =
  | 'OVERTIME'
  | 'DELAY'
  | 'ABSENCE'
  | 'COMPENSATION_DAY_OFF'
  | 'MANUAL_ADJUSTMENT'
  | 'PAYOUT'
  | 'EXPIRATION_PAYOUT';

export interface TimeBankAccount {
  id: string;
  tenant_id: string;
  company_id?: string;
  contract_id: string;
  balance_minutes: number;
  start_date: string;
  end_date: string;
  status: TimeBankStatus;
  policy_type: TimeBankPolicyType;
  validity_months: number;
  expiration_rule: TimeBankExpirationRule;
  max_positive_balance_minutes?: number;
  closure_date?: string;
  warning_days_before_expiration?: number;
  payout_rubric_code?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TimeBankTransaction {
  id?: string;
  tenant_id: string;
  account_id: string;
  date: string;
  minutes: number;
  transaction_type: TimeBankTransactionType;
  description?: string;
  daily_summary_id?: string;
  payroll_period_id?: string;
  created_at?: string;
}

export interface TimeDailySummaryInput {
  date: string;
  daily_summary_id?: string;
  overtime_50_minutes?: number;
  overtime_100_minutes?: number;
  delay_minutes?: number;
  absence_minutes?: number;
}

export interface TimeBankStatementEntry {
  id?: string;
  date: string;
  transaction_type: TimeBankTransactionType;
  description: string;
  minutes: number;
  minutes_formatted: string;
  running_balance_minutes: number;
  running_balance_formatted: string;
}

export interface TimeBankStatement {
  account_id: string;
  contract_id: string;
  policy_type: TimeBankPolicyType;
  start_date: string;
  end_date: string;
  total_credits_minutes: number;
  total_credits_formatted: string;
  total_debits_minutes: number;
  total_debits_formatted: string;
  final_balance_minutes: number;
  final_balance_formatted: string;
  entries: TimeBankStatementEntry[];
}

export type TimeBankAlertStatus = 'NORMAL' | 'WARNING' | 'CRITICAL' | 'EXPIRED';

export interface TimeBankAlert {
  status: TimeBankAlertStatus;
  days_remaining: number;
  message: string;
  action_recommended?: 'SCHEDULE_TIME_OFF' | 'IMMEDIATE_COMPENSATION_OR_PREPARE_PAYOUT' | 'PAY_AS_OVERTIME' | 'NONE';
}

export interface TimeBankPayoutProposal {
  contract_id: string;
  rubric_code: string;
  hours: number;
  factor: number;
  reason: 'EXPIRATION' | 'TERMINATION' | 'MANUAL';
  description: string;
}

export interface TimeBankClosureResult {
  account: TimeBankAccount;
  payoutTransaction: TimeBankTransaction | null;
  payoutProposal: TimeBankPayoutProposal | null;
}

/**
 * Converte minutos inteiros para formato de horas e minutos com sinal:
 * +HH:MM, -HH:MM ou 00:00.
 */
export function formatMinutesToHours(minutes: number): string {
  if (minutes === 0) return '00:00';
  const sign = minutes > 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  return `${sign}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/**
 * Converte string no formato [+/-]HH:MM para minutos inteiros.
 */
export function parseHoursToMinutes(formatted: string): number {
  const trimmed = formatted.trim();
  let sign = 1;
  let timeStr = trimmed;
  if (trimmed.startsWith('-')) {
    sign = -1;
    timeStr = trimmed.substring(1);
  } else if (trimmed.startsWith('+')) {
    timeStr = trimmed.substring(1);
  }

  const parts = timeStr.split(':');
  if (parts.length !== 2) return 0;
  const hours = parseInt(parts[0], 10) || 0;
  const mins = parseInt(parts[1], 10) || 0;
  return sign * (hours * 60 + mins);
}

/**
 * Calcula a data final do ciclo de banco de horas somando os meses de vigência.
 */
function calculateEndDate(startDateStr: string, validityMonths: number): string {
  const [yearStr, monthStr, dayStr] = startDateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-12
  const day = parseInt(dayStr, 10);

  // Data base no primeiro dia do mês de início
  const targetMonthIndex = (month - 1) + validityMonths; // 0-based
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const finalMonth = (targetMonthIndex % 12) + 1;

  // Último dia do mês alvo
  const lastDayOfMonth = new Date(Date.UTC(targetYear, finalMonth, 0)).getUTCDate();
  const adjustedDay = Math.min(day, lastDayOfMonth);

  // Subtrai 1 dia do ciclo completo se iniciado no dia 1
  if (day === 1) {
    const prevDate = new Date(Date.UTC(targetYear, finalMonth - 1, 0));
    const resY = prevDate.getUTCFullYear();
    const resM = String(prevDate.getUTCMonth() + 1).padStart(2, '0');
    const resD = String(prevDate.getUTCDate()).padStart(2, '0');
    return `${resY}-${resM}-${resD}`;
  }

  return `${targetYear}-${String(finalMonth).padStart(2, '0')}-${String(adjustedDay).padStart(2, '0')}`;
}

/**
 * Calcula a diferença em dias entre duas datas (YYYY-MM-DD).
 * Positivo se targetDate > refDate, negativo se refDate > targetDate.
 */
function differenceInDays(targetDateStr: string, refDateStr: string): number {
  const [tY, tM, tD] = targetDateStr.split('-').map(Number);
  const [rY, rM, rD] = refDateStr.split('-').map(Number);
  const targetUtc = Date.UTC(tY, tM - 1, tD);
  const refUtc = Date.UTC(rY, rM - 1, rD);
  const diffMs = targetUtc - refUtc;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export class TimeBankService {
  /**
   * 1. Cria e valida uma nova conta de banco de horas respeitando as limitações legais da CLT.
   */
  public static createAccount(params: {
    tenant_id: string;
    company_id?: string;
    contract_id: string;
    policy_type: TimeBankPolicyType;
    validity_months: number;
    start_date: string;
    end_date?: string;
    expiration_rule?: TimeBankExpirationRule;
    max_positive_balance_minutes?: number;
    warning_days_before_expiration?: number;
  }): TimeBankAccount {
    // Validação legal CLT Art. 59 § 5º: Acordo Individual máximo de 6 meses
    if (params.policy_type === 'ACORDO_INDIVIDUAL' && params.validity_months > 6) {
      throw new Error(
        'Violação da CLT (Art. 59 § 5º): O banco de horas pactuado por Acordo Individual não pode exceder 6 meses de vigência.'
      );
    }

    // Validação legal CLT Art. 59 § 2º: CCT/ACT máximo de 12 meses (1 ano)
    if ((params.policy_type === 'CCT' || params.policy_type === 'ACT') && params.validity_months > 12) {
      throw new Error(
        'Violação da CLT (Art. 59 § 2º): O banco de horas pactuado por CCT/ACT não pode exceder 12 meses de vigência.'
      );
    }

    const endDate = params.end_date || calculateEndDate(params.start_date, params.validity_months);

    return {
      id: `tb-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenant_id: params.tenant_id,
      company_id: params.company_id,
      contract_id: params.contract_id,
      policy_type: params.policy_type,
      validity_months: params.validity_months,
      start_date: params.start_date,
      end_date: endDate,
      balance_minutes: 0,
      status: 'ACTIVE',
      expiration_rule: params.expiration_rule || 'PAY_AS_OVERTIME',
      max_positive_balance_minutes: params.max_positive_balance_minutes,
      warning_days_before_expiration: params.warning_days_before_expiration || 30,
      payout_rubric_code: '152'
    };
  }

  /**
   * 2. Processa resumo diário de jornada (time_daily_summary) creditando horas extras
   * e debitando atrasos/faltas, respeitando o teto de saldo acumulado.
   */
  public static processDailySummary(
    account: TimeBankAccount,
    summary: TimeDailySummaryInput
  ): {
    account: TimeBankAccount;
    transactions: TimeBankTransaction[];
    excessOvertimeToPayroll: number;
  } {
    const updatedAccount = { ...account };
    const transactions: TimeBankTransaction[] = [];
    let excessOvertimeToPayroll = 0;

    const overtimeMinutes = (summary.overtime_50_minutes || 0) + (summary.overtime_100_minutes || 0);

    // Crédito de Horas Extras
    if (overtimeMinutes > 0) {
      let creditMinutes = overtimeMinutes;

      if (updatedAccount.max_positive_balance_minutes !== undefined) {
        const availableSpace = Math.max(0, updatedAccount.max_positive_balance_minutes - updatedAccount.balance_minutes);
        creditMinutes = Math.min(overtimeMinutes, availableSpace);
        excessOvertimeToPayroll = overtimeMinutes - creditMinutes;
      }

      if (creditMinutes > 0) {
        transactions.push({
          id: `tx-${Date.now()}-ot`,
          tenant_id: account.tenant_id,
          account_id: account.id,
          date: summary.date,
          minutes: creditMinutes,
          transaction_type: 'OVERTIME',
          description: `Crédito de HE apurada na jornada (${creditMinutes} min)`,
          daily_summary_id: summary.daily_summary_id,
          created_at: new Date().toISOString()
        });
        updatedAccount.balance_minutes += creditMinutes;
      }
    }

    // Débito de Atrasos
    if (summary.delay_minutes && summary.delay_minutes > 0) {
      transactions.push({
        id: `tx-${Date.now()}-dl`,
        tenant_id: account.tenant_id,
        account_id: account.id,
        date: summary.date,
        minutes: -summary.delay_minutes,
        transaction_type: 'DELAY',
        description: `Débito de atraso na jornada (${summary.delay_minutes} min)`,
        daily_summary_id: summary.daily_summary_id,
        created_at: new Date().toISOString()
      });
      updatedAccount.balance_minutes -= summary.delay_minutes;
    }

    // Débito de Faltas parciais ou justificadas para compensação
    if (summary.absence_minutes && summary.absence_minutes > 0) {
      transactions.push({
        id: `tx-${Date.now()}-ab`,
        tenant_id: account.tenant_id,
        account_id: account.id,
        date: summary.date,
        minutes: -summary.absence_minutes,
        transaction_type: 'ABSENCE',
        description: `Débito de ausência a compensar (${summary.absence_minutes} min)`,
        daily_summary_id: summary.daily_summary_id,
        created_at: new Date().toISOString()
      });
      updatedAccount.balance_minutes -= summary.absence_minutes;
    }

    return {
      account: updatedAccount,
      transactions,
      excessOvertimeToPayroll
    };
  }

  /**
   * 3. Registra concessão de folga compensatória debitando do saldo.
   */
  public static requestCompensationDayOff(
    account: TimeBankAccount,
    params: {
      date: string;
      minutes: number;
      description?: string;
    }
  ): {
    account: TimeBankAccount;
    transaction: TimeBankTransaction;
  } {
    if (params.minutes <= 0) {
      throw new Error('A quantidade de minutos para folga compensatória deve ser positiva.');
    }

    const updatedAccount = { ...account };
    const debit = params.minutes;
    updatedAccount.balance_minutes -= debit;

    const transaction: TimeBankTransaction = {
      id: `tx-${Date.now()}-comp`,
      tenant_id: account.tenant_id,
      account_id: account.id,
      date: params.date,
      minutes: -debit,
      transaction_type: 'COMPENSATION_DAY_OFF',
      description: params.description || `Folga compensatória (${debit} min)`,
      created_at: new Date().toISOString()
    };

    return {
      account: updatedAccount,
      transaction
    };
  }

  /**
   * 4. Lança ajuste manual de crédito ou débito com justificativa obrigatória.
   */
  public static addManualAdjustment(
    account: TimeBankAccount,
    params: {
      date: string;
      minutes: number;
      description: string;
    }
  ): {
    account: TimeBankAccount;
    transaction: TimeBankTransaction;
  } {
    if (!params.description || params.description.trim() === '') {
      throw new Error('Justificativa é obrigatória para lançar ajuste manual no banco de horas.');
    }

    const updatedAccount = { ...account };
    updatedAccount.balance_minutes += params.minutes;

    const transaction: TimeBankTransaction = {
      id: `tx-${Date.now()}-man`,
      tenant_id: account.tenant_id,
      account_id: account.id,
      date: params.date,
      minutes: params.minutes,
      transaction_type: 'MANUAL_ADJUSTMENT',
      description: params.description.trim(),
      created_at: new Date().toISOString()
    };

    return {
      account: updatedAccount,
      transaction
    };
  }

  /**
   * 5. Emite extrato cronológico com saldo acumulado progressivo.
   */
  public static generateStatement(
    account: TimeBankAccount,
    transactions: TimeBankTransaction[]
  ): TimeBankStatement {
    // Ordenar cronologicamente por data ASC e created_at ASC
    const sorted = [...transactions].sort((a, b) => {
      const cmpDate = a.date.localeCompare(b.date);
      if (cmpDate !== 0) return cmpDate;
      return (a.created_at || '').localeCompare(b.created_at || '');
    });

    let currentBalance = 0;
    let totalCredits = 0;
    let totalDebits = 0;

    const entries: TimeBankStatementEntry[] = sorted.map((tx) => {
      if (tx.minutes > 0) {
        totalCredits += tx.minutes;
      } else {
        totalDebits += Math.abs(tx.minutes);
      }

      currentBalance += tx.minutes;

      return {
        id: tx.id,
        date: tx.date,
        transaction_type: tx.transaction_type,
        description: tx.description || tx.transaction_type,
        minutes: tx.minutes,
        minutes_formatted: formatMinutesToHours(tx.minutes),
        running_balance_minutes: currentBalance,
        running_balance_formatted: formatMinutesToHours(currentBalance)
      };
    });

    return {
      account_id: account.id,
      contract_id: account.contract_id,
      policy_type: account.policy_type,
      start_date: account.start_date,
      end_date: account.end_date,
      total_credits_minutes: totalCredits,
      total_credits_formatted: formatMinutesToHours(totalCredits),
      total_debits_minutes: totalDebits,
      total_debits_formatted: formatMinutesToHours(totalDebits),
      final_balance_minutes: currentBalance,
      final_balance_formatted: formatMinutesToHours(currentBalance),
      entries
    };
  }

  /**
   * 6. Avalia proximidade do vencimento e emite alertas com ações recomendadas.
   */
  public static checkExpirationAndAlerts(
    account: TimeBankAccount,
    referenceDateStr: string
  ): TimeBankAlert {
    const daysRemaining = differenceInDays(account.end_date, referenceDateStr);
    const warningDays = account.warning_days_before_expiration ?? 30;

    if (daysRemaining < 0) {
      if (account.balance_minutes > 0) {
        return {
          status: 'EXPIRED',
          days_remaining: daysRemaining,
          message: `O banco de horas expirou em ${account.end_date} com saldo positivo de ${formatMinutesToHours(
            account.balance_minutes
          )}. Conforme Art. 59 §3º da CLT, o saldo deve ser pago como horas extras na folha.`,
          action_recommended: 'PAY_AS_OVERTIME'
        };
      }
      return {
        status: 'NORMAL',
        days_remaining: daysRemaining,
        message: 'Período do banco de horas encerrado.',
        action_recommended: 'NONE'
      };
    }

    if (daysRemaining <= 7 && account.balance_minutes > 0) {
      return {
        status: 'CRITICAL',
        days_remaining: daysRemaining,
        message: `ATENÇÃO CRÍTICA: Restam apenas ${daysRemaining} dias para o encerramento do banco de horas em ${account.end_date}. Saldo pendente: ${formatMinutesToHours(
          account.balance_minutes
        )}. Agende folga imediatamente ou prepare quitação em folha.`,
        action_recommended: 'IMMEDIATE_COMPENSATION_OR_PREPARE_PAYOUT'
      };
    }

    if (daysRemaining <= warningDays && account.balance_minutes > 0) {
      return {
        status: 'WARNING',
        days_remaining: daysRemaining,
        message: `Aviso de vencimento: Restam ${daysRemaining} dias para a expiração do banco de horas (${account.end_date}). Saldo a compensar: ${formatMinutesToHours(
          account.balance_minutes
        )}.`,
        action_recommended: 'SCHEDULE_TIME_OFF'
      };
    }

    return {
      status: 'NORMAL',
      days_remaining: daysRemaining,
      message: `Banco de horas regular. Vencimento em ${account.end_date} (${daysRemaining} dias restantes).`,
      action_recommended: 'NONE'
    };
  }

  /**
   * 7. Fecha a conta de banco de horas (por término de vigência ou na rescisão)
   * e gera a quitação/pagamento na folha conforme CLT Art. 59 § 3º.
   */
  public static closeAndPayoutAccount(
    account: TimeBankAccount,
    params: {
      closure_date: string;
      reason: 'EXPIRATION' | 'TERMINATION' | 'MANUAL';
      overtime_factor?: number;
      rubric_code?: string;
      payroll_period_id?: string;
    }
  ): TimeBankClosureResult {
    const updatedAccount = { ...account };
    const rubricCode = params.rubric_code || account.payout_rubric_code || '152';
    const factor = params.overtime_factor || 1.5;

    // Se o saldo for estritamente positivo, gera proposta de pagamento como HE
    if (updatedAccount.balance_minutes > 0) {
      const balance = updatedAccount.balance_minutes;
      const hours = Math.round((balance / 60) * 100) / 100;
      const txType: TimeBankTransactionType = params.reason === 'EXPIRATION' ? 'EXPIRATION_PAYOUT' : 'PAYOUT';
      const desc =
        params.reason === 'EXPIRATION'
          ? `Liquidação de banco de horas vencido para pagamento em folha (Art. 59 §3º CLT) — ${hours}h`
          : `Liquidação rescisória de banco de horas para pagamento em folha (Art. 59 §3º CLT) — ${hours}h`;

      const payoutTransaction: TimeBankTransaction = {
        id: `tx-${Date.now()}-payout`,
        tenant_id: account.tenant_id,
        account_id: account.id,
        date: params.closure_date,
        minutes: -balance,
        transaction_type: txType,
        description: desc,
        payroll_period_id: params.payroll_period_id,
        created_at: new Date().toISOString()
      };

      const payoutProposal: TimeBankPayoutProposal = {
        contract_id: account.contract_id,
        rubric_code: rubricCode,
        hours: hours,
        factor: factor,
        reason: params.reason,
        description: desc
      };

      updatedAccount.balance_minutes = 0;
      updatedAccount.status = 'PAID_OUT';
      updatedAccount.closure_date = params.closure_date;

      return {
        account: updatedAccount,
        payoutTransaction,
        payoutProposal
      };
    }

    // Saldo zerado ou devedor: fecha a conta sem pagamento
    updatedAccount.status = 'CLOSED';
    updatedAccount.closure_date = params.closure_date;

    return {
      account: updatedAccount,
      payoutTransaction: null,
      payoutProposal: null
    };
  }
}
