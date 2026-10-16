/**
 * TimeBankInitialBalanceTB03.test.ts
 * 
 * Suíte de Testes TDD para a Entrega TB-03:
 * Lançamento Manual e Carga de Saldo Inicial de Banco de Horas (Migração de Sistema Anterior)
 * 
 * Critérios de Aceite:
 * 1. Formatação e parsing de horas (+HH:MM, -HH:MM, horas decimais).
 * 2. Lançamento de saldo inicial individual provisionando conta de banco de horas caso não exista.
 * 3. Lançamento de saldo inicial em conta já existente (ajustando o saldo acumulado).
 * 4. Respeito aos limites legais da CLT (Art. 59 § 5º Acordo Individual máx 6 meses, Art. 59 § 2º CCT máx 12 meses).
 * 5. Parser de arquivo CSV para carga em lote suportando delimitadores (; e ,), datas (DD/MM/AAAA e AAAA-MM-DD).
 * 6. Validação e relatório detalhado de importação em lote (linhas válidas e detecção de falhas).
 * 7. Reflexão da transação INITIAL_BALANCE no extrato gerado do banco de horas.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TimeBankService,
  formatMinutesToHours,
  parseHoursToMinutes,
  type TimeBankAccount,
  type TimeBankTransaction
} from '../../services/timeTracking/timeBankService';
import { TimeManagementService } from '../../services/timeTracking/timeManagementService';
import { supabase } from '../../lib/supabase';

// Mock do cliente Supabase para testes de integração do TimeManagementService
vi.mock('../../lib/supabase', () => {
  return {
    supabase: {
      rpc: vi.fn(),
      from: vi.fn()
    }
  };
});

describe('TB-03: Lançamento Manual e Carga de Saldo Inicial de Banco de Horas (CLT Art. 59)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Parsing e Conversão de Horas e Minutos', () => {
    it('deve converter corretamente strings de horas com sinal (+HH:MM e -HH:MM) para minutos', () => {
      expect(parseHoursToMinutes('+10:30')).toBe(630);
      expect(parseHoursToMinutes('10:30')).toBe(630);
      expect(parseHoursToMinutes('-04:15')).toBe(-255);
      expect(parseHoursToMinutes('+00:45')).toBe(45);
      expect(parseHoursToMinutes('-01:00')).toBe(-60);
      expect(parseHoursToMinutes('00:00')).toBe(0);
    });

    it('deve formatar minutos inteiros para formato padrão (+HH:MM, -HH:MM ou 00:00)', () => {
      expect(formatMinutesToHours(630)).toBe('+10:30');
      expect(formatMinutesToHours(-255)).toBe('-04:15');
      expect(formatMinutesToHours(45)).toBe('+00:45');
      expect(formatMinutesToHours(-60)).toBe('-01:00');
      expect(formatMinutesToHours(0)).toBe('00:00');
    });
  });

  describe('2. TimeBankService.registerInitialBalance (Domínio Puro)', () => {
    it('deve provisionar automaticamente uma nova conta ativa se o colaborador não tiver conta ativa', () => {
      const result = TimeBankService.registerInitialBalance({
        tenant_id: 'tenant-123',
        contract_id: 'contract-456',
        cutoff_date: '2026-01-01',
        minutes: 1200, // +20h 00m
        description: 'Migração de saldo legado - Sistema Secullum',
        policy_type: 'ACORDO_INDIVIDUAL',
        validity_months: 6
      });

      expect(result.isNewAccount).toBe(true);
      expect(result.account.status).toBe('ACTIVE');
      expect(result.account.contract_id).toBe('contract-456');
      expect(result.account.start_date).toBe('2026-01-01');
      expect(result.account.balance_minutes).toBe(1200);
      expect(result.transaction.transaction_type).toBe('INITIAL_BALANCE');
      expect(result.transaction.minutes).toBe(1200);
      expect(result.transaction.date).toBe('2026-01-01');
      expect(result.transaction.description).toContain('Secullum');
    });

    it('deve adicionar transação INITIAL_BALANCE e atualizar saldo em conta ativa pré-existente', () => {
      const existingAccount: TimeBankAccount = {
        id: 'acc-existing-1',
        tenant_id: 'tenant-123',
        contract_id: 'contract-456',
        balance_minutes: 300,
        start_date: '2026-01-01',
        end_date: '2026-06-30',
        status: 'ACTIVE',
        policy_type: 'ACORDO_INDIVIDUAL',
        validity_months: 6,
        expiration_rule: 'PAY_AS_OVERTIME'
      };

      const result = TimeBankService.registerInitialBalance({
        tenant_id: 'tenant-123',
        contract_id: 'contract-456',
        cutoff_date: '2026-01-01',
        minutes: -180, // Saldo inicial devedor de -03:00
        description: 'Ajuste de implantação de saldo devedor legado',
        existingAccount
      });

      expect(result.isNewAccount).toBe(false);
      expect(result.account.id).toBe('acc-existing-1');
      expect(result.account.balance_minutes).toBe(120); // 300 - 180
      expect(result.transaction.transaction_type).toBe('INITIAL_BALANCE');
      expect(result.transaction.minutes).toBe(-180);
    });

    it('deve refletir a transação INITIAL_BALANCE no extrato de banco de horas (generateStatement)', () => {
      const account: TimeBankAccount = {
        id: 'acc-1',
        tenant_id: 'tenant-123',
        contract_id: 'contract-456',
        balance_minutes: 0,
        start_date: '2026-01-01',
        end_date: '2026-06-30',
        status: 'ACTIVE',
        policy_type: 'ACORDO_INDIVIDUAL',
        validity_months: 6,
        expiration_rule: 'PAY_AS_OVERTIME'
      };

      const txInitial: TimeBankTransaction = {
        id: 'tx-init',
        tenant_id: 'tenant-123',
        account_id: 'acc-1',
        date: '2026-01-01',
        minutes: 600, // +10:00
        transaction_type: 'INITIAL_BALANCE',
        description: 'Saldo inicial migrado',
        created_at: '2026-01-01T08:00:00Z'
      };

      const txOvertime: TimeBankTransaction = {
        id: 'tx-ot',
        tenant_id: 'tenant-123',
        account_id: 'acc-1',
        date: '2026-01-10',
        minutes: 120, // +02:00
        transaction_type: 'OVERTIME',
        description: 'Horas extras trabalhadas',
        created_at: '2026-01-10T18:00:00Z'
      };

      const statement = TimeBankService.generateStatement(account, [txInitial, txOvertime]);

      expect(statement.entries.length).toBe(2);
      expect(statement.entries[0].transaction_type).toBe('INITIAL_BALANCE');
      expect(statement.entries[0].running_balance_formatted).toBe('+10:00');
      expect(statement.entries[1].running_balance_formatted).toBe('+12:00');
      expect(statement.final_balance_formatted).toBe('+12:00');
    });
  });

  describe('3. TimeBankService.parseInitialBalancesCsv (Parser de Carga em Lote)', () => {
    it('deve parsear corretamente arquivo CSV com delimitador ponto-e-vírgula e datas no formato AAAA-MM-DD e DD/MM/AAAA', () => {
      const csv = `CPF;DATA_CORTE;SALDO;JUSTIFICATIVA;POLITICA
12345678901;2026-01-01;+15:30;Migração do sistema anterior Secullum;ACORDO_INDIVIDUAL
98765432100;01/01/2026;-04:15;Saldo devedor legado Senior;CCT
11122233344;2026-01-01;08:00;Carga legada;ACORDO_INDIVIDUAL`;

      const parsed = TimeBankService.parseInitialBalancesCsv(csv);

      expect(parsed.totalLines).toBe(3);
      expect(parsed.validRows.length).toBe(3);
      expect(parsed.invalidRows.length).toBe(0);

      // Linha 1
      expect(parsed.validRows[0].identifier).toBe('12345678901');
      expect(parsed.validRows[0].cutoff_date).toBe('2026-01-01');
      expect(parsed.validRows[0].minutes).toBe(930); // 15*60 + 30
      expect(parsed.validRows[0].formatted_hours).toBe('+15:30');
      expect(parsed.validRows[0].policy_type).toBe('ACORDO_INDIVIDUAL');

      // Linha 2
      expect(parsed.validRows[1].identifier).toBe('98765432100');
      expect(parsed.validRows[1].cutoff_date).toBe('2026-01-01'); // Normalizado de 01/01/2026
      expect(parsed.validRows[1].minutes).toBe(-255); // -4*60 - 15
      expect(parsed.validRows[1].formatted_hours).toBe('-04:15');
      expect(parsed.validRows[1].policy_type).toBe('CCT');
      expect(parsed.validRows[1].validity_months).toBe(12);

      // Linha 3
      expect(parsed.validRows[2].identifier).toBe('11122233344');
      expect(parsed.validRows[2].minutes).toBe(480);
      expect(parsed.validRows[2].formatted_hours).toBe('+08:00');
    });

    it('deve identificar e isolar linhas inválidas (formato de hora incorreto, data inválida ou campos insuficientes)', () => {
      const csv = `CPF,DATA_CORTE,SALDO,JUSTIFICATIVA
12345678901,2026-01-01,+10:00,Valido
invalido-sem-data
98765432100,32/13/2026,+05:00,Data Inexistente
11122233344,2026-01-01,horario_invalido,Justificativa`;

      const parsed = TimeBankService.parseInitialBalancesCsv(csv);

      expect(parsed.validRows.length).toBe(1);
      expect(parsed.validRows[0].identifier).toBe('12345678901');
      expect(parsed.invalidRows.length).toBe(3);
      expect(parsed.invalidRows[0].error).toContain('esperadas pelo menos 3 colunas');
      expect(parsed.invalidRows[1].error).toContain('Formato de data inválido');
      expect(parsed.invalidRows[2].error).toContain('Formato de saldo de horas inválido');
    });
  });

  describe('4. TimeManagementService.registerInitialBalance (Persistência e RPC)', () => {
    it('deve chamar a RPC register_time_bank_initial_balance com os parâmetros corretos', async () => {
      const mockRpcResponse = {
        data: [
          {
            account_id: 'acc-uuid-1',
            transaction_id: 'tx-uuid-1',
            final_balance_minutes: 600,
            cutoff_date: '2026-01-01',
            message: 'Saldo inicial lançado com sucesso no banco de horas.'
          }
        ],
        error: null
      };

      (supabase.rpc as any).mockResolvedValueOnce(mockRpcResponse);

      const res = await TimeManagementService.registerInitialBalance({
        tenantId: 'tenant-123',
        contractId: 'contract-456',
        cutoffDate: '2026-01-01',
        minutes: 600,
        justification: 'Migração de saldo legado Totvs',
        policyType: 'ACORDO_INDIVIDUAL',
        validityMonths: 6,
        userName: 'Auditor DP'
      });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'register_time_bank_initial_balance',
        expect.objectContaining({
          p_tenant_id: 'tenant-123',
          p_contract_id: 'contract-456',
          p_cutoff_date: '2026-01-01',
          p_minutes: 600,
          p_policy_type: 'ACORDO_INDIVIDUAL',
          p_validity_months: 6
        })
      );

      expect(res.success).toBe(true);
      expect(res.final_balance_minutes).toBe(600);
      expect(res.account_id).toBe('acc-uuid-1');
    });

    it('deve executar fallback resiliente caso a RPC não esteja disponível', async () => {
      // Mock RPC retornando erro de função inexistente
      (supabase.rpc as any).mockResolvedValueOnce({
        data: null,
        error: { message: 'function register_time_bank_initial_balance does not exist' }
      });

      // Mock da consulta de conta (nenhuma conta ativa existente)
      const mockSelectAccount = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
      });

      // Mock do insert da conta
      const mockInsertAccount = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'new-acc-id', balance_minutes: 0 },
            error: null
          })
        })
      });

      // Mock do insert da transação
      const mockInsertTx = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'new-tx-id' },
            error: null
          })
        })
      });

      // Mock do update da conta
      const mockUpdateAccount = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'time_bank_accounts') {
          return {
            select: mockSelectAccount,
            insert: mockInsertAccount,
            update: mockUpdateAccount
          };
        }
        if (table === 'time_bank_transactions') {
          return {
            insert: mockInsertTx
          };
        }
        return {};
      });

      const res = await TimeManagementService.registerInitialBalance({
        tenantId: 'tenant-123',
        contractId: 'contract-456',
        cutoffDate: '2026-01-01',
        minutes: 480, // +8h
        justification: 'Carga de saldo inicial legado via fallback',
        policyType: 'ACORDO_INDIVIDUAL'
      });

      expect(res.success).toBe(true);
      expect(res.final_balance_minutes).toBe(480);
    });
  });

  describe('5. TimeManagementService.importInitialBalancesBatch (Carga em Lote)', () => {
    it('deve processar lote CSV vinculando colaboradores por CPF e retornando relatório compilado', async () => {
      // Mock da busca de colaboradores
      const mockWorkers: any[] = [
        {
          id: 'w-1',
          pis_pasep: '12345678901',
          people: { id: 'p-1', full_name: 'Carlos Silva', cpf: '12345678901' },
          employment_contracts: [{ id: 'contract-carlos', status: 'ACTIVE' }]
        },
        {
          id: 'w-2',
          pis_pasep: '98765432100',
          people: { id: 'p-2', full_name: 'Ana Souza', cpf: '98765432100' },
          employment_contracts: [{ id: 'contract-ana', status: 'ACTIVE' }]
        }
      ];

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'workers') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: mockWorkers, error: null })
            })
          };
        }
        return {};
      });

      // Mock da RPC de registro bem sucedida
      (supabase.rpc as any).mockImplementation((rpcName: string, params: any) => {
        if (rpcName === 'register_time_bank_initial_balance') {
          return Promise.resolve({
            data: [
              {
                account_id: `acc-${params.p_contract_id}`,
                transaction_id: `tx-${params.p_contract_id}`,
                final_balance_minutes: params.p_minutes,
                cutoff_date: params.p_cutoff_date,
                message: 'Sucesso'
              }
            ],
            error: null
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const csvContent = `CPF;DATA_CORTE;SALDO;JUSTIFICATIVA;POLITICA
12345678901;2026-01-01;+10:30;Migração Totvs;ACORDO_INDIVIDUAL
98765432100;2026-01-01;-02:00;Migração Senior;CCT
99999999999;2026-01-01;+05:00;CPF Inexistente na Base;ACORDO_INDIVIDUAL`;

      const batchResult = await TimeManagementService.importInitialBalancesBatch({
        tenantId: 'tenant-123',
        csvText: csvContent,
        userName: 'Gestor Folha'
      });

      expect(batchResult.totalLines).toBe(3);
      expect(batchResult.successCount).toBe(2);
      expect(batchResult.failureCount).toBe(1);

      // Colaborador Carlos (Sucesso)
      const carlosResult = batchResult.items.find((i) => i.identifier === '12345678901');
      expect(carlosResult).toBeDefined();
      expect(carlosResult?.status).toBe('SUCCESS');
      expect(carlosResult?.name).toBe('Carlos Silva');
      expect(carlosResult?.formatted_hours).toBe('+10:30');

      // Colaborador Ana (Sucesso)
      const anaResult = batchResult.items.find((i) => i.identifier === '98765432100');
      expect(anaResult).toBeDefined();
      expect(anaResult?.status).toBe('SUCCESS');
      expect(anaResult?.name).toBe('Ana Souza');
      expect(anaResult?.formatted_hours).toBe('-02:00');

      // Colaborador Inexistente (Falha)
      const nonExistentResult = batchResult.items.find((i) => i.identifier === '99999999999');
      expect(nonExistentResult).toBeDefined();
      expect(nonExistentResult?.status).toBe('ERROR');
      expect(nonExistentResult?.message).toContain('não localizado');
    });
  });
});
