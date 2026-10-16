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
  | 'INITIAL_BALANCE'
  | 'OVERTIME'
  | 'DELAY'
  | 'ABSENCE'
  | 'COMPENSATION_DAY_OFF'
  | 'COMPENSATION_DELAY'
  | 'COMPENSATION_ABSENCE'
  | 'MANUAL_ADJUSTMENT'
  | 'PAYOUT'
  | 'EXPIRATION_PAYOUT';

export interface InitialBalanceCsvRow {
  identifier: string; // CPF, Matrícula ou ID de Contrato
  cutoff_date: string;
  minutes: number;
  formatted_hours: string;
  description: string;
  policy_type?: TimeBankPolicyType;
  validity_months?: number;
  raw_line_number: number;
  error?: string;
}

export interface ParseInitialBalancesResult {
  validRows: InitialBalanceCsvRow[];
  invalidRows: InitialBalanceCsvRow[];
  totalLines: number;
}

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

  /**
   * 8. Abona e compensa ocorrências de atraso ou falta utilizando o saldo positivo do banco de horas (TB-02).
   */
  public static compensateOccurrence(
    account: TimeBankAccount,
    params: {
      date: string;
      occurrenceType: 'DELAY' | 'ABSENCE';
      minutesToCompensate: number;
      description?: string;
      dailySummaryId?: string;
      allowPartial?: boolean;
    }
  ): {
    account: TimeBankAccount;
    transaction: TimeBankTransaction;
    compensatedMinutes: number;
    remainingOccurrenceMinutes: number;
    remainingBalanceMinutes: number;
  } {
    if (params.minutesToCompensate <= 0) {
      throw new Error('A quantidade de minutos a compensar deve ser maior que zero.');
    }

    if (account.balance_minutes <= 0) {
      throw new Error(
        `O colaborador não possui saldo positivo disponível no banco de horas para compensação (saldo atual: ${formatMinutesToHours(
          account.balance_minutes
        )}).`
      );
    }

    const availableBalance = account.balance_minutes;
    const requested = params.minutesToCompensate;

    if (requested > availableBalance && !params.allowPartial) {
      throw new Error(
        `Saldo insuficiente no banco de horas para compensação integral. Solicitado: ${formatMinutesToHours(
          requested
        )}, disponível: ${formatMinutesToHours(availableBalance)}.`
      );
    }

    const compensatedMinutes = Math.min(requested, availableBalance);
    const remainingOccurrenceMinutes = requested - compensatedMinutes;
    const remainingBalanceMinutes = availableBalance - compensatedMinutes;

    const updatedAccount = { ...account, balance_minutes: remainingBalanceMinutes };
    const txType: TimeBankTransactionType =
      params.occurrenceType === 'DELAY' ? 'COMPENSATION_DELAY' : 'COMPENSATION_ABSENCE';

    const defaultDesc =
      params.occurrenceType === 'DELAY'
        ? `Compensação de atraso/saída antecipada via banco de horas (${compensatedMinutes} min)`
        : `Compensação de ausência/falta de jornada via banco de horas (${compensatedMinutes} min)`;

    const transaction: TimeBankTransaction = {
      id: `tx-${Date.now()}-${txType.toLowerCase()}`,
      tenant_id: account.tenant_id,
      account_id: account.id,
      date: params.date,
      minutes: -compensatedMinutes,
      transaction_type: txType,
      description: params.description || defaultDesc,
      daily_summary_id: params.dailySummaryId,
      created_at: new Date().toISOString()
    };

    return {
      account: updatedAccount,
      transaction,
      compensatedMinutes,
      remainingOccurrenceMinutes,
      remainingBalanceMinutes
    };
  }

  /**
   * 9. Lança saldo inicial / legado de migração de sistema anterior (TB-03).
   * Se o colaborador não possuir conta ativa, provisiona uma nova conta com início na data de corte.
   */
  public static registerInitialBalance(params: {
    tenant_id: string;
    contract_id: string;
    cutoff_date: string;
    minutes: number;
    description: string;
    existingAccount?: TimeBankAccount | null;
    policy_type?: TimeBankPolicyType;
    validity_months?: number;
    company_id?: string;
  }): {
    account: TimeBankAccount;
    transaction: TimeBankTransaction;
    isNewAccount: boolean;
  } {
    const policyType = params.policy_type || 'ACORDO_INDIVIDUAL';
    const validityMonths = params.validity_months || (policyType === 'ACORDO_INDIVIDUAL' ? 6 : 12);

    let account: TimeBankAccount;
    let isNewAccount = false;

    if (params.existingAccount && params.existingAccount.status === 'ACTIVE') {
      account = { ...params.existingAccount };
    } else {
      account = this.createAccount({
        tenant_id: params.tenant_id,
        company_id: params.company_id,
        contract_id: params.contract_id,
        policy_type: policyType,
        validity_months: validityMonths,
        start_date: params.cutoff_date
      });
      isNewAccount = true;
    }

    const description = params.description?.trim() || 'Carga de saldo inicial / migração de sistema anterior';
    account.balance_minutes += params.minutes;

    const transaction: TimeBankTransaction = {
      id: `tx-${Date.now()}-init`,
      tenant_id: params.tenant_id,
      account_id: account.id,
      date: params.cutoff_date,
      minutes: params.minutes,
      transaction_type: 'INITIAL_BALANCE',
      description,
      created_at: new Date().toISOString()
    };

    return {
      account,
      transaction,
      isNewAccount
    };
  }

  /**
   * 10. Parser e validador de arquivo CSV/Excel para importação em lote de saldos iniciais legados (TB-03).
   * Suporta separadores por vírgula (,) e ponto-e-vírgula (;).
   * Aceita formatos de data YYYY-MM-DD e DD/MM/YYYY.
   * Aceita saldos nos formatos: +HH:MM, -HH:MM, HH:MM, ou número de minutos/horas.
   */
  public static parseInitialBalancesCsv(csvText: string): ParseInitialBalancesResult {
    const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    const validRows: InitialBalanceCsvRow[] = [];
    const invalidRows: InitialBalanceCsvRow[] = [];

    if (lines.length === 0) {
      return { validRows: [], invalidRows: [], totalLines: 0 };
    }

    // Detectar se a primeira linha é cabeçalho
    const firstLineLower = lines[0].toLowerCase();
    const hasHeader =
      firstLineLower.includes('cpf') ||
      firstLineLower.includes('matricula') ||
      firstLineLower.includes('contrato') ||
      firstLineLower.includes('saldo') ||
      firstLineLower.includes('data');

    const startIndex = hasHeader ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Detectar separador (; ou ,)
      const separator = line.includes(';') ? ';' : ',';
      const parts = line.split(separator).map((p) => p.trim().replace(/^["']|["']$/g, ''));

      if (parts.length < 3) {
        invalidRows.push({
          identifier: parts[0] || '',
          cutoff_date: parts[1] || '',
          minutes: 0,
          formatted_hours: '00:00',
          description: '',
          raw_line_number: lineNum,
          error: `Linha inválida: esperadas pelo menos 3 colunas (Identificador, Data, Saldo). Encontradas: ${parts.length}`
        });
        continue;
      }

      const rawIdentifier = parts[0];
      const rawDate = parts[1];
      const rawBalance = parts[2];
      const rawDesc = parts[3] || 'Migração de saldo legado';
      const rawPolicy = parts[4]?.toUpperCase();

      // Validação do identificador (CPF ou UUID ou Matrícula)
      const cleanId = rawIdentifier.replace(/\D/g, '').length === 11
        ? rawIdentifier.replace(/\D/g, '')
        : rawIdentifier;

      if (!cleanId) {
        invalidRows.push({
          identifier: rawIdentifier,
          cutoff_date: rawDate,
          minutes: 0,
          formatted_hours: '00:00',
          description: rawDesc,
          raw_line_number: lineNum,
          error: 'Identificador (CPF/Matrícula) ausente ou inválido.'
        });
        continue;
      }

      // Normalização e validação estrita de data (DD/MM/YYYY ou YYYY-MM-DD)
      let normalizedDate = '';
      let isValidDate = false;

      if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        const [yStr, mStr, dStr] = rawDate.split('-');
        const y = parseInt(yStr, 10);
        const m = parseInt(mStr, 10);
        const d = parseInt(dStr, 10);
        if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1970 && y <= 2100) {
          const dt = new Date(Date.UTC(y, m - 1, d));
          if (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) {
            normalizedDate = rawDate;
            isValidDate = true;
          }
        }
      } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
        const [dStr, mStr, yStr] = rawDate.split('/');
        const y = parseInt(yStr, 10);
        const m = parseInt(mStr, 10);
        const d = parseInt(dStr, 10);
        if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1970 && y <= 2100) {
          const dt = new Date(Date.UTC(y, m - 1, d));
          if (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) {
            normalizedDate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            isValidDate = true;
          }
        }
      }

      if (!isValidDate) {
        invalidRows.push({
          identifier: cleanId,
          cutoff_date: rawDate,
          minutes: 0,
          formatted_hours: '00:00',
          description: rawDesc,
          raw_line_number: lineNum,
          error: `Formato de data inválido "${rawDate}". Utilize AAAA-MM-DD ou DD/MM/AAAA.`
        });
        continue;
      }

      // Normalização do saldo de horas para minutos
      let minutes = 0;
      if (rawBalance.includes(':')) {
        minutes = parseHoursToMinutes(rawBalance);
      } else if (!isNaN(Number(rawBalance))) {
        // Se for número puro: se for > 500 ou < -500 assumir minutos, senão assumir horas decimais
        const num = Number(rawBalance);
        if (Math.abs(num) >= 60 && Number.isInteger(num)) {
          minutes = num;
        } else {
          minutes = Math.round(num * 60);
        }
      } else {
        invalidRows.push({
          identifier: cleanId,
          cutoff_date: normalizedDate,
          minutes: 0,
          formatted_hours: rawBalance,
          description: rawDesc,
          raw_line_number: lineNum,
          error: `Formato de saldo de horas inválido "${rawBalance}". Utilize +HH:MM ou -HH:MM.`
        });
        continue;
      }

      // Política
      let policy_type: TimeBankPolicyType = 'ACORDO_INDIVIDUAL';
      if (rawPolicy === 'CCT' || rawPolicy === 'ACT') {
        policy_type = rawPolicy as TimeBankPolicyType;
      }

      validRows.push({
        identifier: cleanId,
        cutoff_date: normalizedDate,
        minutes,
        formatted_hours: formatMinutesToHours(minutes),
        description: rawDesc,
        policy_type,
        validity_months: policy_type === 'ACORDO_INDIVIDUAL' ? 6 : 12,
        raw_line_number: lineNum
      });
    }

    return {
      validRows,
      invalidRows,
      totalLines: lines.length - startIndex
    };
  }

  /**
   * TB-04.3: Regra de Teto Mensal de Acúmulo no Banco de Horas com Transbordo para Folha
   * Limita as horas extras creditadas no banco a um teto mensal (ex: 20h/mês)
   * e calcula o transbordo das horas excedentes para pagamento em dinheiro na folha.
   */
  public static calculateMonthlyCapOverflow(params: TimeBankMonthlyCapParams): TimeBankMonthlyCapResult {
    const { overtime50Minutes = 0, overtime100Minutes = 0, monthlyCapHours, isHybrid = false } = params;

    const hasCap = monthlyCapHours !== null && monthlyCapHours !== undefined && monthlyCapHours > 0;
    const capMinutes = hasCap ? Math.round(monthlyCapHours * 60) : Infinity;

    // No regime híbrido, o banco recebe apenas HE 50% (HE 100% já segue para a folha)
    if (isHybrid) {
      const eligible50 = Math.max(0, overtime50Minutes);
      if (!hasCap || eligible50 <= capMinutes) {
        return {
          hasCap,
          capMinutes: hasCap ? capMinutes : 0,
          totalEligibleMinutes: eligible50,
          bankMinutes: eligible50,
          overflowMinutes: 0,
          overflow50Minutes: 0,
          overflow100Minutes: 0,
          overflow50Hours: 0,
          overflow100Hours: 0,
          bankCredited50Minutes: eligible50,
          bankCredited100Minutes: 0
        };
      }

      const bankCredited50 = capMinutes;
      const overflow50 = eligible50 - capMinutes;
      return {
        hasCap: true,
        capMinutes,
        totalEligibleMinutes: eligible50,
        bankMinutes: bankCredited50,
        overflowMinutes: overflow50,
        overflow50Minutes: overflow50,
        overflow100Minutes: 0,
        overflow50Hours: Math.round((overflow50 / 60) * 100) / 100,
        overflow100Hours: 0,
        bankCredited50Minutes: bankCredited50,
        bankCredited100Minutes: 0
      };
    }

    // Regime Banco de Horas Integral (TIME_BANK): tanto 50% quanto 100% são elegíveis ao banco
    const eligible50 = Math.max(0, overtime50Minutes);
    const eligible100 = Math.max(0, overtime100Minutes);
    const totalEligible = eligible50 + eligible100;

    if (!hasCap || totalEligible <= capMinutes) {
      return {
        hasCap,
        capMinutes: hasCap ? capMinutes : 0,
        totalEligibleMinutes: totalEligible,
        bankMinutes: totalEligible,
        overflowMinutes: 0,
        overflow50Minutes: 0,
        overflow100Minutes: 0,
        overflow50Hours: 0,
        overflow100Hours: 0,
        bankCredited50Minutes: eligible50,
        bankCredited100Minutes: eligible100
      };
    }

    // Quando o total excede o teto mensal:
    // O banco absorve primeiro as horas de 50%, e o espaço remanescente é preenchido com horas de 100%.
    // O que sobra vira transbordo para a folha.
    const bankCredited50 = Math.min(eligible50, capMinutes);
    const remainingCap = capMinutes - bankCredited50;
    const bankCredited100 = Math.min(eligible100, remainingCap);
    const totalBankCredited = bankCredited50 + bankCredited100;

    const overflow50 = eligible50 - bankCredited50;
    const overflow100 = eligible100 - bankCredited100;
    const totalOverflow = overflow50 + overflow100;

    return {
      hasCap: true,
      capMinutes,
      totalEligibleMinutes: totalEligible,
      bankMinutes: totalBankCredited,
      overflowMinutes: totalOverflow,
      overflow50Minutes: overflow50,
      overflow100Minutes: overflow100,
      overflow50Hours: Math.round((overflow50 / 60) * 100) / 100,
      overflow100Hours: Math.round((overflow100 / 60) * 100) / 100,
      bankCredited50Minutes: bankCredited50,
      bankCredited100Minutes: bankCredited100
    };
  }
}

export interface TimeBankMonthlyCapParams {
  overtime50Minutes: number;
  overtime100Minutes: number;
  monthlyCapHours?: number | null;
  isHybrid?: boolean;
}

export interface TimeBankMonthlyCapResult {
  hasCap: boolean;
  capMinutes: number;
  totalEligibleMinutes: number;
  bankMinutes: number;
  overflowMinutes: number;
  overflow50Minutes: number;
  overflow100Minutes: number;
  overflow50Hours: number;
  overflow100Hours: number;
  bankCredited50Minutes: number;
  bankCredited100Minutes: number;
}


