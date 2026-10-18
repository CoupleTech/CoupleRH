import { supabase } from '../../lib/supabase';
import { LGPDService } from '../security/lgpdService';

export type AlertSubsystem = 'PAYROLL' | 'TIME_TRACKING' | 'SECURITY' | 'DOCUMENT_SIGNING' | 'GENERAL';
export type AlertSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface SystemOperationalAlert {
  id: string;
  tenant_id: string;
  subsystem: AlertSubsystem;
  severity: AlertSeverity;
  title: string;
  message: string;
  error_code?: string;
  metadata?: Record<string, unknown>;
  resolved: boolean;
  resolved_at?: string;
  resolved_by?: string;
  resolution_notes?: string;
  created_at: string;
}

export interface PayrollFailureParams {
  tenant_id: string;
  period_id?: string;
  competence?: string;
  payroll_type?: string;
  error_code: string;
  message: string;
  error?: Error | unknown;
  affected_contract_ids?: string[];
  metadata?: Record<string, unknown>;
}

export interface TimeIngestFailureParams {
  tenant_id: string;
  source: 'AFD_IMPORT' | 'REP_COLLECTOR' | 'MOBILE_PUNCH' | 'MANUAL_ENTRY';
  error_code: string;
  message: string;
  file_name?: string;
  device_id?: string;
  line_number?: number;
  metadata?: Record<string, unknown>;
}

export interface StructuredLogEntry {
  timestamp: string;
  level: AlertSeverity;
  subsystem: AlertSubsystem;
  tenant_id?: string;
  message: string;
  error_code?: string;
  metadata?: Record<string, unknown>;
}

export interface ObservabilityConfig {
  dsn?: string;
  environment?: string;
  release?: string;
  enableConsoleLogs?: boolean;
}

/**
 * Sanitiza metadados para garantir total conformidade com a LGPD e segurança:
 * - Mascara CPFs e PIS/NIS
 * - Remove senhas, tokens de autenticação, chaves privadas e códigos OTP
 * - Omite dados de saúde / CID-10
 */
export function sanitizeObservabilityMetadata(data?: Record<string, unknown>): Record<string, unknown> {
  if (!data) return {};

  const sanitized: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();

    // 1. Remover segredos e senhas
    if (
      lowerKey.includes('password') ||
      lowerKey.includes('senha') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('token') ||
      lowerKey.includes('otp') ||
      lowerKey.includes('private_key') ||
      lowerKey.includes('privatekey')
    ) {
      sanitized[key] = '[REDACTED_SECRET]';
      continue;
    }

    // 2. Proteger dados médicos / diagnósticos (LGPD Art. 11)
    if (
      lowerKey.includes('cid') ||
      lowerKey.includes('cid10') ||
      lowerKey.includes('diagnostic') ||
      lowerKey.includes('doenca') ||
      lowerKey.includes('medical')
    ) {
      sanitized[key] = '[CONFIDENTIAL_HEALTH_DATA]';
      continue;
    }

    // 3. Mascarar CPFs
    if (lowerKey.includes('cpf') && typeof val === 'string') {
      sanitized[key] = LGPDService.maskCpf(val);
      continue;
    }

    // 4. Mascarar PIS/NIS
    if ((lowerKey.includes('pis') || lowerKey.includes('nis')) && typeof val === 'string') {
      sanitized[key] = LGPDService.maskPis(val);
      continue;
    }

    // 5. Recursão para objetos aninhados
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      sanitized[key] = sanitizeObservabilityMetadata(val as Record<string, unknown>);
      continue;
    }

    sanitized[key] = val;
  }

  return sanitized;
}

/**
 * Serviço canônico de Observabilidade, Telemetria e Alertas Operacionais (Fase P9)
 */
export class ObservabilityService {
  private static config: ObservabilityConfig = {
    dsn: typeof process !== 'undefined' ? process.env?.VITE_SENTRY_DSN : undefined,
    environment: typeof process !== 'undefined' ? process.env?.NODE_ENV : 'production',
    release: '2026.10.0',
    enableConsoleLogs: true
  };

  private static logBuffer: StructuredLogEntry[] = [];
  private static readonly MAX_BUFFER_SIZE = 200;

  /**
   * Inicializa ou reconfigura as opções de observabilidade
   */
  public static init(customConfig?: Partial<ObservabilityConfig>): void {
    ObservabilityService.config = {
      ...ObservabilityService.config,
      ...customConfig
    };
  }

  /**
   * Registra uma entrada de log estruturado em formato JSON padronizado
   */
  public static log(
    level: AlertSeverity,
    subsystem: AlertSubsystem,
    message: string,
    metadata?: Record<string, unknown>,
    tenant_id?: string
  ): StructuredLogEntry {
    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      subsystem,
      tenant_id,
      message,
      metadata: sanitizeObservabilityMetadata(metadata)
    };

    // Manter no buffer em memória para diagnóstico rápido
    ObservabilityService.logBuffer.unshift(entry);
    if (ObservabilityService.logBuffer.length > ObservabilityService.MAX_BUFFER_SIZE) {
      ObservabilityService.logBuffer.pop();
    }

    if (ObservabilityService.config.enableConsoleLogs) {
      const output = `[${entry.timestamp}] [${entry.level}] [${entry.subsystem}] ${entry.message}`;
      if (level === 'CRITICAL' || level === 'ERROR') {
        console.error(output, entry.metadata || '');
      } else if (level === 'WARNING') {
        console.warn(output, entry.metadata || '');
      } else {
        console.info(output, entry.metadata || '');
      }
    }

    return entry;
  }

  /**
   * Captura e despacha alerta de falha no Motor de Folha de Pagamento
   */
  public static async notifyPayrollFailure(
    params: PayrollFailureParams
  ): Promise<SystemOperationalAlert | null> {
    const title = `Falha no Cálculo da Folha: ${params.error_code}`;
    const severity: AlertSeverity =
      params.error_code === 'NEGATIVE_NET' || params.error_code === 'MATH_INCONSISTENCY'
        ? 'CRITICAL'
        : 'ERROR';

    const safeMeta = sanitizeObservabilityMetadata({
      period_id: params.period_id,
      competence: params.competence,
      payroll_type: params.payroll_type,
      affected_contract_ids: params.affected_contract_ids,
      errorMessage: params.error instanceof Error ? params.error.message : String(params.error || ''),
      stack: params.error instanceof Error ? params.error.stack : undefined,
      ...params.metadata
    });

    ObservabilityService.log(
      severity,
      'PAYROLL',
      `[Folha] ${params.message} (Código: ${params.error_code})`,
      safeMeta,
      params.tenant_id
    );

    // Gravar alerta operacional no Supabase
    try {
      const { data, error } = await supabase
        .from('system_operational_alerts')
        .insert({
          tenant_id: params.tenant_id,
          subsystem: 'PAYROLL',
          severity,
          title,
          message: params.message,
          error_code: params.error_code,
          metadata: safeMeta,
          resolved: false
        })
        .select()
        .single();

      if (error) {
        console.warn('Falha ao persistir alerta operacional de folha:', error.message);
        return null;
      }

      return data as SystemOperationalAlert;
    } catch (err) {
      console.warn('Exceção ao persistir alerta operacional de folha:', err);
      return null;
    }
  }

  /**
   * Captura e despacha alerta de falha na Ingestão de Ponto Eletrônico (REP / AFD / Mobile)
   */
  public static async notifyTimeIngestFailure(
    params: TimeIngestFailureParams
  ): Promise<SystemOperationalAlert | null> {
    const title = `Falha na Ingestão de Ponto: ${params.source} (${params.error_code})`;
    const severity: AlertSeverity =
      params.error_code === 'TAMPER_DETECTED' || params.error_code === 'INVALID_CERTIFICATE'
        ? 'CRITICAL'
        : params.error_code === 'FILE_CORRUPTED' || params.error_code === 'NSR_GAP_DETECTED'
        ? 'ERROR'
        : 'WARNING';

    const safeMeta = sanitizeObservabilityMetadata({
      source: params.source,
      file_name: params.file_name,
      device_id: params.device_id,
      line_number: params.line_number,
      ...params.metadata
    });

    ObservabilityService.log(
      severity,
      'TIME_TRACKING',
      `[Ponto] ${params.message} (Origem: ${params.source}, Código: ${params.error_code})`,
      safeMeta,
      params.tenant_id
    );

    // Gravar alerta operacional no Supabase
    try {
      const { data, error } = await supabase
        .from('system_operational_alerts')
        .insert({
          tenant_id: params.tenant_id,
          subsystem: 'TIME_TRACKING',
          severity,
          title,
          message: params.message,
          error_code: params.error_code,
          metadata: safeMeta,
          resolved: false
        })
        .select()
        .single();

      if (error) {
        console.warn('Falha ao persistir alerta operacional de ponto:', error.message);
        return null;
      }

      return data as SystemOperationalAlert;
    } catch (err) {
      console.warn('Exceção ao persistir alerta operacional de ponto:', err);
      return null;
    }
  }

  /**
   * Lista os alertas operacionais de um tenant com filtros de status e subsistema
   */
  public static async listAlerts(
    tenantId: string,
    options?: {
      subsystem?: AlertSubsystem;
      resolved?: boolean;
      limit?: number;
    }
  ): Promise<SystemOperationalAlert[]> {
    try {
      let query = supabase
        .from('system_operational_alerts')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (options?.subsystem) {
        query = query.eq('subsystem', options.subsystem);
      }

      if (typeof options?.resolved === 'boolean') {
        query = query.eq('resolved', options.resolved);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Erro ao consultar alertas operacionais:', error.message);
        return [];
      }

      return (data as SystemOperationalAlert[]) || [];
    } catch (err) {
      console.warn('Exceção ao consultar alertas operacionais:', err);
      return [];
    }
  }

  /**
   * Marca um alerta operacional como resolvido
   */
  public static async resolveAlert(
    alertId: string,
    resolvedByUserId: string,
    notes?: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('system_operational_alerts')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: resolvedByUserId,
          resolution_notes: notes || 'Alerta tratado e resolvido pelo operador.'
        })
        .eq('id', alertId);

      if (error) {
        console.warn('Erro ao resolver alerta operacional:', error.message);
        return false;
      }

      ObservabilityService.log(
        'INFO',
        'GENERAL',
        `Alerta operacional ${alertId} resolvido com sucesso.`,
        { alertId, resolvedByUserId, notes }
      );

      return true;
    } catch (err) {
      console.warn('Exceção ao resolver alerta operacional:', err);
      return false;
    }
  }

  /**
   * Retorna um resumo executivo dos alertas ativos por subsistema
   */
  public static async getAlertsSummary(tenantId: string): Promise<{
    totalUnresolved: number;
    bySubsystem: Record<AlertSubsystem, number>;
    criticalCount: number;
  }> {
    const alerts = await ObservabilityService.listAlerts(tenantId, { resolved: false });

    const summary = {
      totalUnresolved: alerts.length,
      bySubsystem: {
        PAYROLL: 0,
        TIME_TRACKING: 0,
        SECURITY: 0,
        DOCUMENT_SIGNING: 0,
        GENERAL: 0
      } as Record<AlertSubsystem, number>,
      criticalCount: 0
    };

    for (const a of alerts) {
      if (summary.bySubsystem[a.subsystem] !== undefined) {
        summary.bySubsystem[a.subsystem]++;
      }
      if (a.severity === 'CRITICAL') {
        summary.criticalCount++;
      }
    }

    return summary;
  }

  /**
   * Obtém as últimas entradas do buffer de log em memória (útil para auditoria e tela de diagnósticos)
   */
  public static getRecentLogs(): StructuredLogEntry[] {
    return [...ObservabilityService.logBuffer];
  }

  /**
   * Limpa o buffer de logs em memória (para testes)
   */
  public static clearBuffer(): void {
    ObservabilityService.logBuffer = [];
  }
}
