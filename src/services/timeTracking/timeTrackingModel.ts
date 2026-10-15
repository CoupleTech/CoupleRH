/**
 * Modelo de Dados e Regras de Negócio do Módulo de Ponto Eletrônico (PT-01)
 * Em conformidade com a CLT e Portaria MTP 671/2021 (REP-C, REP-P e importação AFD).
 */

export type TimeDeviceKind = 'REP_C' | 'REP_P_MOBILE' | 'IMPORT';
export type TimeDeviceStatus = 'ACTIVE' | 'INACTIVE' | 'OFFLINE' | 'MAINTENANCE';

export interface TimeDevice {
  id?: string;
  tenant_id: string;
  company_id?: string;
  name: string;
  kind: TimeDeviceKind;
  vendor?: string;
  model?: string;
  serial_number?: string;
  host?: string;
  port?: number;
  last_nsr?: number;
  last_sync_at?: string;
  status: TimeDeviceStatus;
  api_key_hash?: string;
  created_at?: string;
  updated_at?: string;
}

export type TimePunchSource = 'REP' | 'MOBILE' | 'IMPORT' | 'MANUAL';

export interface TimePunchRecord {
  id?: string;
  tenant_id: string;
  company_id?: string;
  device_id?: string;
  nsr: number;
  record_type: number; // 3 = batida Portaria 671
  punched_at: string;
  cpf?: string;
  pis?: string;
  worker_id?: string;
  contract_id?: string;
  source: TimePunchSource;
  geo?: {
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    address?: string;
  };
  ip?: string;
  device_fingerprint?: string;
  receipt_code?: string;
  raw_line?: string;
  crc_ok?: boolean;
  created_at?: string;
}

export type TimeBankPolicyType = 'ACORDO_INDIVIDUAL' | 'CCT' | 'ACT';
export type TimeBankExpirationRule = 'PAY_AS_OVERTIME' | 'FORFEIT' | 'EXTEND';

export interface TimeBankPolicy {
  policy_type: TimeBankPolicyType;
  validity_months: number;
  expiration_rule: TimeBankExpirationRule;
  max_positive_balance_minutes?: number;
}

export type TimeDailyStatus =
  | 'REGULAR'
  | 'PENDING_APPROVAL'
  | 'JUSTIFIED'
  | 'INCONSISTENT'
  | 'DAY_OFF'
  | 'HOLIDAY'
  | 'LEAVE'
  | 'VACATION';

export interface TimeDailySummary {
  id?: string;
  tenant_id: string;
  company_id?: string;
  contract_id: string;
  date: string;
  expected_work_minutes: number;
  worked_minutes: number;
  overtime_50_minutes: number;
  overtime_100_minutes: number;
  night_shift_minutes: number;
  night_overtime_minutes: number;
  delay_minutes: number;
  absence_minutes: number;
  break_taken_minutes: number;
  break_expected_minutes: number;
  intrajornada_violation_minutes: number;
  interjornada_violation_minutes: number;
  time_bank_credited_minutes: number;
  time_bank_debited_minutes: number;
  status: TimeDailyStatus;
  inconsistencies: string[];
  interjornada_rest_minutes?: number;
  approved_by?: string;
  approved_at?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Validação de cadastro de dispositivo de ponto
 */
export function validateTimeDevice(device: Partial<TimeDevice>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const validKinds: TimeDeviceKind[] = ['REP_C', 'REP_P_MOBILE', 'IMPORT'];

  if (!device.name || device.name.trim() === '') {
    errors.push('Nome do dispositivo é obrigatório.');
  }

  if (!device.kind || !validKinds.includes(device.kind)) {
    errors.push('Tipo de dispositivo inválido. Deve ser REP_C, REP_P_MOBILE ou IMPORT.');
  }

  if (device.kind === 'REP_C' && !device.serial_number) {
    // Relógio físico deve ter número de série
    errors.push('Número de série é obrigatório para REP_C.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validação de Imutabilidade do Registro de Ponto (Portaria 671 / CLT art. 74)
 * Lança erro explícito se houver qualquer tentativa de UPDATE ou DELETE na batida original
 */
export function validateTimePunchRecordMutation(
  action: 'INSERT' | 'UPDATE' | 'DELETE',
  originalRecord: TimePunchRecord,
  mutationData?: Partial<TimePunchRecord>
): void {
  if (action === 'UPDATE' || action === 'DELETE') {
    throw new Error(
      `Operação ${action} proibida: A trilha de registros originais de ponto (time_punch_records) é estritamente imutável por determinação legal da CLT e Portaria MTP 671/2021. Ajustes devem ser registrados exclusivamente como solicitações de ajuste em time_entry_adjustments.`
    );
  }
}

/**
 * Validação de Política de Banco de Horas
 * - Acordo Individual: limite de 6 meses (CLT art. 59 §5º)
 * - CCT / ACT: limite de 12 meses (CLT art. 59 §2º)
 */
export function validateTimeBankPolicy(policy: TimeBankPolicy): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (policy.policy_type === 'ACORDO_INDIVIDUAL') {
    if (policy.validity_months > 6) {
      errors.push(
        'Pela CLT (art. 59 §5º), o Banco de Horas por Acordo Individual não pode exceder 6 meses de vigência.'
      );
    }
  } else if (policy.policy_type === 'CCT' || policy.policy_type === 'ACT') {
    if (policy.validity_months > 12) {
      errors.push(
        'Pela CLT (art. 59 §2º), o Banco de Horas por CCT/ACT não pode exceder 12 meses de vigência.'
      );
    }
  }

  if (policy.validity_months <= 0) {
    errors.push('A vigência em meses deve ser maior que zero.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Cálculo de Violações Legais Diárias de Jornada (CLT arts. 66 e 71)
 */
export function calculateDailyViolations(summary: Partial<TimeDailySummary>): {
  intrajornada_violation_minutes: number;
  interjornada_violation_minutes: number;
  inconsistencies: string[];
} {
  let intrajornadaViolation = 0;
  let interjornadaViolation = 0;
  const inconsistencies: string[] = [];

  // 1. Intrajornada (Art. 71 CLT): se jornada exigia intervalo e foi gozado menos
  const expectedBreak = summary.break_expected_minutes ?? 0;
  const takenBreak = summary.break_taken_minutes ?? 0;
  if (expectedBreak > 0 && takenBreak < expectedBreak) {
    intrajornadaViolation = expectedBreak - takenBreak;
    inconsistencies.push('INTRAJORNADA_VIOLATION');
  }

  // 2. Interjornada (Art. 66 CLT): intervalo obrigatório de 11h (660 minutos) entre jornadas
  if (summary.interjornada_rest_minutes !== undefined) {
    const requiredRestMinutes = 11 * 60; // 660 min
    if (summary.interjornada_rest_minutes < requiredRestMinutes) {
      interjornadaViolation = requiredRestMinutes - summary.interjornada_rest_minutes;
      inconsistencies.push('INTERJORNADA_VIOLATION');
    }
  }

  return {
    intrajornada_violation_minutes: intrajornadaViolation,
    interjornada_violation_minutes: interjornadaViolation,
    inconsistencies,
  };
}
