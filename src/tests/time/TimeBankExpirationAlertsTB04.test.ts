/**
 * TimeBankExpirationAlertsTB04.test.ts
 * 
 * Suíte de Testes TDD para a Entrega TB-04 (Item 1):
 * Painel de Alertas de Vencimento de Banco de Horas (CLT Art. 59 §§ 2º, 3º e 5º)
 * 
 * Critérios de Aceite:
 * 1. Monitoramento contínuo da data final de vigência (end_date) de contas ativas.
 * 2. Classificação precisa dos níveis de urgência:
 *    - EXPIRED: vencido com saldo positivo pendente (ação legal: pagar como HE em folha - Art. 59 § 3º CLT).
 *    - CRITICAL: restando 7 dias ou menos (ação: agendamento emergencial de folga compensatória ou preparar quitação).
 *    - WARNING: restando entre 8 e 30 dias (ação: programar folga compensatória).
 *    - NORMAL: vigência regular (> 30 dias).
 * 3. Totalização de indicadores executivos: contagem de contas por severidade e saldo de horas em risco.
 * 4. Ordenação por nível de risco e dias restantes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TimeBankService,
  type TimeBankAccount,
  formatMinutesToHours
} from '../../services/timeTracking/timeBankService';
import { TimeManagementService } from '../../services/timeTracking/timeManagementService';
import { supabase } from '../../lib/supabase';

// Mock do Supabase
vi.mock('../../lib/supabase', () => {
  return {
    supabase: {
      from: vi.fn(),
      rpc: vi.fn()
    }
  };
});

describe('TB-04 (Item 1): Painel de Alertas de Vencimento de Banco de Horas (CLT Art. 59)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Avaliação de Alertas no Domínio Puro (TimeBankService.checkExpirationAndAlerts)', () => {
    it('deve marcar como EXPIRED quando a data de referência ultrapassar o fim da vigência com saldo positivo', () => {
      const account: TimeBankAccount = {
        id: 'acc-exp',
        tenant_id: 'tenant-1',
        contract_id: 'contract-1',
        balance_minutes: 600, // +10h
        start_date: '2025-07-01',
        end_date: '2025-12-31',
        status: 'ACTIVE',
        policy_type: 'ACORDO_INDIVIDUAL',
        validity_months: 6,
        expiration_rule: 'PAY_AS_OVERTIME'
      };

      const alert = TimeBankService.checkExpirationAndAlerts(account, '2026-01-05');

      expect(alert.status).toBe('EXPIRED');
      expect(alert.days_remaining).toBeLessThan(0);
      expect(alert.action_recommended).toBe('PAY_AS_OVERTIME');
      expect(alert.message).toContain('Art. 59 §3º da CLT');
    });

    it('deve marcar como CRITICAL quando restarem 7 dias ou menos para a expiração do banco com saldo positivo', () => {
      const account: TimeBankAccount = {
        id: 'acc-crit',
        tenant_id: 'tenant-1',
        contract_id: 'contract-2',
        balance_minutes: 900, // +15h
        start_date: '2026-01-01',
        end_date: '2026-06-30',
        status: 'ACTIVE',
        policy_type: 'ACORDO_INDIVIDUAL',
        validity_months: 6,
        expiration_rule: 'PAY_AS_OVERTIME'
      };

      const alert = TimeBankService.checkExpirationAndAlerts(account, '2026-06-25');

      expect(alert.status).toBe('CRITICAL');
      expect(alert.days_remaining).toBe(5);
      expect(alert.action_recommended).toBe('IMMEDIATE_COMPENSATION_OR_PREPARE_PAYOUT');
      expect(alert.message).toContain('ATENÇÃO CRÍTICA');
    });

    it('deve marcar como WARNING quando restarem entre 8 e 30 dias para a expiração com saldo positivo', () => {
      const account: TimeBankAccount = {
        id: 'acc-warn',
        tenant_id: 'tenant-1',
        contract_id: 'contract-3',
        balance_minutes: 480, // +8h
        start_date: '2026-01-01',
        end_date: '2026-06-30',
        status: 'ACTIVE',
        policy_type: 'ACORDO_INDIVIDUAL',
        validity_months: 6,
        expiration_rule: 'PAY_AS_OVERTIME',
        warning_days_before_expiration: 30
      };

      const alert = TimeBankService.checkExpirationAndAlerts(account, '2026-06-10');

      expect(alert.status).toBe('WARNING');
      expect(alert.days_remaining).toBe(20);
      expect(alert.action_recommended).toBe('SCHEDULE_TIME_OFF');
    });

    it('deve marcar como NORMAL quando restarem mais de 30 dias para o vencimento', () => {
      const account: TimeBankAccount = {
        id: 'acc-norm',
        tenant_id: 'tenant-1',
        contract_id: 'contract-4',
        balance_minutes: 300,
        start_date: '2026-01-01',
        end_date: '2026-06-30',
        status: 'ACTIVE',
        policy_type: 'ACORDO_INDIVIDUAL',
        validity_months: 6,
        expiration_rule: 'PAY_AS_OVERTIME'
      };

      const alert = TimeBankService.checkExpirationAndAlerts(account, '2026-03-01');

      expect(alert.status).toBe('NORMAL');
      expect(alert.days_remaining).toBeGreaterThan(30);
      expect(alert.action_recommended).toBe('NONE');
    });
  });

  describe('2. TimeManagementService.fetchTimeBankExpirationAlerts (Consolidação e Painel)', () => {
    it('deve buscar contas ativas, calcular alertas, totalizadores e ordenar por nível de urgência', async () => {
      const mockAccounts = [
        {
          id: 'acc-1',
          tenant_id: 'tenant-100',
          contract_id: 'contract-1',
          balance_minutes: 600, // +10h vencido
          start_date: '2025-07-01',
          end_date: '2025-12-31',
          status: 'ACTIVE',
          policy_type: 'ACORDO_INDIVIDUAL',
          validity_months: 6,
          warning_days_before_expiration: 30,
          employment_contracts: {
            id: 'contract-1',
            worker_id: 'w-1',
            company_id: 'comp-1',
            workers: {
              id: 'w-1',
              people: { full_name: 'Bruno Lima', cpf: '11122233344' }
            },
            positions: { title: 'Analista' }
          }
        },
        {
          id: 'acc-2',
          tenant_id: 'tenant-100',
          contract_id: 'contract-2',
          balance_minutes: 360, // +6h crítico (faltam 4 dias)
          start_date: '2026-01-01',
          end_date: '2026-06-30',
          status: 'ACTIVE',
          policy_type: 'ACORDO_INDIVIDUAL',
          validity_months: 6,
          warning_days_before_expiration: 30,
          employment_contracts: {
            id: 'contract-2',
            worker_id: 'w-2',
            company_id: 'comp-1',
            workers: {
              id: 'w-2',
              people: { full_name: 'Carla Dias', cpf: '22233344455' }
            },
            positions: { title: 'Assistente' }
          }
        },
        {
          id: 'acc-3',
          tenant_id: 'tenant-100',
          contract_id: 'contract-3',
          balance_minutes: 120, // +2h em aviso (faltam 20 dias)
          start_date: '2026-01-01',
          end_date: '2026-07-15',
          status: 'ACTIVE',
          policy_type: 'CCT',
          validity_months: 12,
          warning_days_before_expiration: 30,
          employment_contracts: {
            id: 'contract-3',
            worker_id: 'w-3',
            company_id: 'comp-1',
            workers: {
              id: 'w-3',
              people: { full_name: 'Diego Souza', cpf: '33344455566' }
            },
            positions: { title: 'Coordenador' }
          }
        },
        {
          id: 'acc-4',
          tenant_id: 'tenant-100',
          contract_id: 'contract-4',
          balance_minutes: 0, // Saldo zerado (não deve contar como risco)
          start_date: '2026-01-01',
          end_date: '2026-06-30',
          status: 'ACTIVE',
          policy_type: 'ACORDO_INDIVIDUAL',
          validity_months: 6,
          warning_days_before_expiration: 30,
          employment_contracts: {
            id: 'contract-4',
            worker_id: 'w-4',
            company_id: 'comp-1',
            workers: {
              id: 'w-4',
              people: { full_name: 'Eduardo Paz', cpf: '44455566677' }
            },
            positions: { title: 'Estagiário' }
          }
        }
      ];

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'time_bank_accounts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: mockAccounts, error: null })
              })
            })
          };
        }
        return {};
      });

      // Data de referência: 2026-06-26
      const panel = await TimeManagementService.fetchTimeBankExpirationAlerts({
        tenantId: 'tenant-100',
        companyId: 'comp-1',
        referenceDate: '2026-06-26'
      });

      // Indicadores
      expect(panel.totalAccountsMonitored).toBe(4);
      expect(panel.expiredCount).toBe(1); // Bruno (venceu em 2025-12-31)
      expect(panel.criticalCount).toBe(1); // Carla (vence em 4 dias - 2026-06-30)
      expect(panel.warningCount).toBe(1); // Diego (vence em 19 dias - 2026-07-15)
      expect(panel.totalPositiveHoursAtRisk).toBe(18); // 10h + 6h + 2h = 18h

      // Ordenação: EXPIRED primeiro, depois CRITICAL, depois WARNING
      expect(panel.alerts.length).toBe(3); // Apenas as com saldo positivo em alerta/expiração
      expect(panel.alerts[0].status).toBe('EXPIRED');
      expect(panel.alerts[0].worker_name).toBe('Bruno Lima');
      expect(panel.alerts[1].status).toBe('CRITICAL');
      expect(panel.alerts[1].worker_name).toBe('Carla Dias');
      expect(panel.alerts[2].status).toBe('WARNING');
      expect(panel.alerts[2].worker_name).toBe('Diego Souza');
    });
  });
});
