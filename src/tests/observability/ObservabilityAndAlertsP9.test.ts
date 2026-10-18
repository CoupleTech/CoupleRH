import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ObservabilityService,
  sanitizeObservabilityMetadata,
  type PayrollFailureParams,
  type TimeIngestFailureParams
} from '../../services/observability/observabilityService';

// Mock do supabase para os testes de unidade/integração de observabilidade
vi.mock('../../lib/supabase', () => {
  const alertsDb: any[] = [];
  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === 'system_operational_alerts') {
          return {
            insert: vi.fn((payload: any) => ({
              select: vi.fn(() => ({
                single: vi.fn(async () => {
                  const record = {
                    id: `alert-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                    ...payload,
                    created_at: new Date().toISOString()
                  };
                  alertsDb.push(record);
                  return { data: record, error: null };
                })
              }))
            })),
            select: vi.fn(() => {
              let filtered = [...alertsDb];
              const queryObj: any = {
                eq: vi.fn((col: string, val: any) => {
                  filtered = filtered.filter((item) => item[col] === val);
                  return queryObj;
                }),
                order: vi.fn(() => queryObj),
                limit: vi.fn((num: number) => {
                  filtered = filtered.slice(0, num);
                  return queryObj;
                }),
                then: (resolve: any) => resolve({ data: filtered, error: null })
              };
              return queryObj;
            }),
            update: vi.fn((updates: any) => ({
              eq: vi.fn(async (col: string, val: any) => {
                const target = alertsDb.find((item) => item[col] === val);
                if (target) {
                  Object.assign(target, updates);
                }
                return { error: null };
              })
            }))
          };
        }
        return {
          select: vi.fn(() => ({ data: [], error: null }))
        };
      })
    }
  };
});

describe('Fase P9: Observabilidade, Telemetria e Alertas Operacionais', () => {
  beforeEach(() => {
    ObservabilityService.clearBuffer();
    ObservabilityService.init({ enableConsoleLogs: false });
  });

  describe('1. Sanitização de Metadados e LGPD (Art. 11 e 18)', () => {
    it('deve mascarar CPF e PIS de colaboradores em logs de erro', () => {
      const dirty = {
        employee_cpf: '123.456.789-00',
        clean_cpf: '12345678900',
        worker_pis: '123.45678.90-1',
        regular_field: 'Cálculo de Adiantamento'
      };

      const clean = sanitizeObservabilityMetadata(dirty);

      expect(clean.employee_cpf).toBe('***.456.789-**');
      expect(clean.clean_cpf).toBe('***.456.789-**');
      expect(clean.worker_pis).toBe('***.45678.**-*');
      expect(clean.regular_field).toBe('Cálculo de Adiantamento');
    });

    it('deve redactar senhas, tokens, segredos e chaves de certificados', () => {
      const dirty = {
        user_password: 'super_secret_password_123',
        auth_token: 'bearer_token_xyz987',
        certificate_private_key: '-----BEGIN PRIVATE KEY-----...',
        otp_code: '458921'
      };

      const clean = sanitizeObservabilityMetadata(dirty);

      expect(clean.user_password).toBe('[REDACTED_SECRET]');
      expect(clean.auth_token).toBe('[REDACTED_SECRET]');
      expect(clean.certificate_private_key).toBe('[REDACTED_SECRET]');
      expect(clean.otp_code).toBe('[REDACTED_SECRET]');
    });

    it('deve proteger dados médicos confidenciais (CID-10 / diagnósticos)', () => {
      const dirty = {
        cid10_code: 'F32.2',
        diagnostic_notes: 'Transtorno depressivo maior grave',
        medical_eval: 'Atestado de 15 dias concedido'
      };

      const clean = sanitizeObservabilityMetadata(dirty);

      expect(clean.cid10_code).toBe('[CONFIDENTIAL_HEALTH_DATA]');
      expect(clean.diagnostic_notes).toBe('[CONFIDENTIAL_HEALTH_DATA]');
      expect(clean.medical_eval).toBe('[CONFIDENTIAL_HEALTH_DATA]');
    });

    it('deve aplicar sanitização recursivamente em objetos aninhados', () => {
      const complex = {
        contract: {
          id: 'contract-01',
          employee: {
            name: 'João Silva',
            cpf: '111.222.333-44',
            secret_notes: 'senha_acesso_123'
          }
        }
      };

      const clean = sanitizeObservabilityMetadata(complex) as any;

      expect(clean.contract.employee.name).toBe('João Silva');
      expect(clean.contract.employee.cpf).toBe('***.222.333-**');
      expect(clean.contract.employee.secret_notes).toBe('[REDACTED_SECRET]');
    });
  });

  describe('2. Logs Estruturados e Telemetria em Memória', () => {
    it('deve gerar entradas padronizadas com nível, subsistema e timestamp', () => {
      const entry = ObservabilityService.log(
        'ERROR',
        'PAYROLL',
        'Falha no cálculo do holerite',
        { contract_id: 'c1', employee_cpf: '999.888.777-66' },
        'tenant-alpha'
      );

      expect(entry.level).toBe('ERROR');
      expect(entry.subsystem).toBe('PAYROLL');
      expect(entry.tenant_id).toBe('tenant-alpha');
      expect(entry.message).toBe('Falha no cálculo do holerite');
      expect(entry.metadata?.employee_cpf).toBe('***.888.777-**');
      expect(entry.timestamp).toBeDefined();

      const buffer = ObservabilityService.getRecentLogs();
      expect(buffer.length).toBe(1);
      expect(buffer[0]).toEqual(entry);
    });
  });

  describe('3. Alertas de Falha de Folha de Pagamento', () => {
    it('deve classificar NEGATIVE_NET e MATH_INCONSISTENCY com severidade CRITICAL', async () => {
      const params: PayrollFailureParams = {
        tenant_id: 'tenant-01',
        period_id: 'period-2026-10',
        competence: '10/2026',
        payroll_type: 'MONTHLY',
        error_code: 'NEGATIVE_NET',
        message: 'Holerite calculou salário líquido negativo (R$ -150,00)',
        affected_contract_ids: ['contract-123'],
        metadata: {
          employee_cpf: '123.456.789-00',
          total_earnings: 2000,
          total_deductions: 2150
        }
      };

      const alert = await ObservabilityService.notifyPayrollFailure(params);

      expect(alert).not.toBeNull();
      expect(alert?.subsystem).toBe('PAYROLL');
      expect(alert?.severity).toBe('CRITICAL');
      expect(alert?.error_code).toBe('NEGATIVE_NET');
      expect(alert?.metadata?.employee_cpf).toBe('***.456.789-**');
    });

    it('deve classificar erros de contrato com severidade ERROR', async () => {
      const params: PayrollFailureParams = {
        tenant_id: 'tenant-01',
        period_id: 'period-2026-10',
        competence: '10/2026',
        payroll_type: 'ADVANCE',
        error_code: 'CONTRACT_SALARY_MISSING',
        message: 'Contrato ativo sem salário base configurado na tabela',
        affected_contract_ids: ['contract-999']
      };

      const alert = await ObservabilityService.notifyPayrollFailure(params);

      expect(alert?.severity).toBe('ERROR');
      expect(alert?.subsystem).toBe('PAYROLL');
      expect(alert?.resolved).toBe(false);
    });
  });

  describe('4. Alertas de Falha de Ingestão de Ponto Eletrônico', () => {
    it('deve alertar sobre layout AFD inválido ou arquivo corrompido', async () => {
      const params: TimeIngestFailureParams = {
        tenant_id: 'tenant-01',
        source: 'AFD_IMPORT',
        error_code: 'FILE_CORRUPTED',
        message: 'Arquivo AFD com checksum CRC divergente na linha 452',
        file_name: 'AFD_REP_001.txt',
        line_number: 452
      };

      const alert = await ObservabilityService.notifyTimeIngestFailure(params);

      expect(alert).not.toBeNull();
      expect(alert?.subsystem).toBe('TIME_TRACKING');
      expect(alert?.severity).toBe('ERROR');
      expect(alert?.error_code).toBe('FILE_CORRUPTED');
      expect(alert?.metadata?.line_number).toBe(452);
    });

    it('deve alertar com severidade CRITICAL quando houver suspeita de fraude/adulteração', async () => {
      const params: TimeIngestFailureParams = {
        tenant_id: 'tenant-01',
        source: 'REP_COLLECTOR',
        error_code: 'TAMPER_DETECTED',
        message: 'Inconsistência de NSR decrescente detectada na comunicação com o relógio Control iD',
        device_id: 'rep-device-portaria-01'
      };

      const alert = await ObservabilityService.notifyTimeIngestFailure(params);

      expect(alert?.subsystem).toBe('TIME_TRACKING');
      expect(alert?.severity).toBe('CRITICAL');
      expect(alert?.error_code).toBe('TAMPER_DETECTED');
    });
  });

  describe('5. Resolução e Consulta de Alertas Operacionais', () => {
    it('deve permitir listar alertas não resolvidos e marcá-los como resolvidos pelo operador', async () => {
      const tenantId = 'tenant-audit-test';

      // Criar 2 alertas
      const a1 = await ObservabilityService.notifyPayrollFailure({
        tenant_id: tenantId,
        error_code: 'NEGATIVE_NET',
        message: 'Teste de alerta 1'
      });

      const a2 = await ObservabilityService.notifyTimeIngestFailure({
        tenant_id: tenantId,
        source: 'MOBILE_PUNCH',
        error_code: 'GEOFENCE_VIOLATION',
        message: 'Batida registrada a 12km do raio da empresa'
      });

      expect(a1).not.toBeNull();
      expect(a2).not.toBeNull();

      // Listar alertas ativos
      const activeList = await ObservabilityService.listAlerts(tenantId, { resolved: false });
      expect(activeList.length).toBeGreaterThanOrEqual(2);

      // Resolver o primeiro alerta
      const resolveOk = await ObservabilityService.resolveAlert(
        a1!.id,
        'user-operator-123',
        'Lançamento ajustado na folha suplementar'
      );
      expect(resolveOk).toBe(true);

      // Resumo executivo
      const summary = await ObservabilityService.getAlertsSummary(tenantId);
      expect(summary.totalUnresolved).toBeGreaterThanOrEqual(1);
    });
  });
});
