import { describe, it, expect } from 'vitest';
import {
  TimeBankService,
  TimeBankAccount,
  TimeBankTransaction,
  TimeDailySummaryInput,
  formatMinutesToHours,
  parseHoursToMinutes
} from '../../services/timeTracking/timeBankService';

describe('FASE P5: PT-07 — Banco de Horas (CLT Art. 59, Extrato, Vencimentos, Alertas e HE)', () => {
  const mockTenantId = 'tenant-test-111';
  const mockCompanyId = 'company-test-222';
  const mockContractId = 'contract-test-333';

  describe('1. Validação de Políticas de Vigência (CLT Art. 59 §§ 2º e 5º)', () => {
    it('deve criar conta com Acordo Individual respeitando prazo máximo legal de 6 meses', () => {
      const account = TimeBankService.createAccount({
        tenant_id: mockTenantId,
        company_id: mockCompanyId,
        contract_id: mockContractId,
        policy_type: 'ACORDO_INDIVIDUAL',
        validity_months: 6,
        start_date: '2026-01-01',
        expiration_rule: 'PAY_AS_OVERTIME'
      });

      expect(account.policy_type).toBe('ACORDO_INDIVIDUAL');
      expect(account.validity_months).toBe(6);
      expect(account.start_date).toBe('2026-01-01');
      expect(account.end_date).toBe('2026-06-30');
      expect(account.balance_minutes).toBe(0);
      expect(account.status).toBe('ACTIVE');
    });

    it('deve rejeitar Acordo Individual com vigência superior a 6 meses conforme CLT art. 59 §5º', () => {
      expect(() => {
        TimeBankService.createAccount({
          tenant_id: mockTenantId,
          company_id: mockCompanyId,
          contract_id: mockContractId,
          policy_type: 'ACORDO_INDIVIDUAL',
          validity_months: 12, // Ilegal para acordo individual!
          start_date: '2026-01-01'
        });
      }).toThrow(/Acordo Individual não pode exceder 6 meses/i);
    });

    it('deve permitir vigência de até 12 meses quando pactuado via CCT ou ACT (CLT art. 59 §2º)', () => {
      const account = TimeBankService.createAccount({
        tenant_id: mockTenantId,
        company_id: mockCompanyId,
        contract_id: mockContractId,
        policy_type: 'CCT',
        validity_months: 12,
        start_date: '2026-01-01'
      });

      expect(account.policy_type).toBe('CCT');
      expect(account.validity_months).toBe(12);
      expect(account.end_date).toBe('2026-12-31');
    });

    it('deve rejeitar vigência superior a 12 meses mesmo para CCT/ACT', () => {
      expect(() => {
        TimeBankService.createAccount({
          tenant_id: mockTenantId,
          company_id: mockCompanyId,
          contract_id: mockContractId,
          policy_type: 'CCT',
          validity_months: 18,
          start_date: '2026-01-01'
        });
      }).toThrow(/CCT\/ACT não pode exceder 12 meses/i);
    });
  });

  describe('2. Créditos e Débitos Diários do Motor de Jornada', () => {
    it('deve creditar horas extras apuradas no dia na conta de banco de horas', () => {
      let account: TimeBankAccount = {
        id: 'acc-1',
        tenant_id: mockTenantId,
        company_id: mockCompanyId,
        contract_id: mockContractId,
        policy_type: 'ACORDO_INDIVIDUAL',
        validity_months: 6,
        start_date: '2026-01-01',
        end_date: '2026-06-30',
        balance_minutes: 0,
        status: 'ACTIVE',
        expiration_rule: 'PAY_AS_OVERTIME',
        warning_days_before_expiration: 30
      };

      const dailySummary: TimeDailySummaryInput = {
        date: '2026-01-05',
        overtime_50_minutes: 90, // 1h30 extra
        overtime_100_minutes: 0,
        delay_minutes: 0,
        absence_minutes: 0
      };

      const result = TimeBankService.processDailySummary(account, dailySummary);

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].transaction_type).toBe('OVERTIME');
      expect(result.transactions[0].minutes).toBe(90);
      expect(result.account.balance_minutes).toBe(90);
      expect(result.excessOvertimeToPayroll).toBe(0);
    });

    it('deve respeitar teto de saldo (max_positive_balance_minutes) direcionando o excedente para folha', () => {
      const account: TimeBankAccount = {
        id: 'acc-1',
        tenant_id: mockTenantId,
        company_id: mockCompanyId,
        contract_id: mockContractId,
        policy_type: 'ACORDO_INDIVIDUAL',
        validity_months: 6,
        start_date: '2026-01-01',
        end_date: '2026-06-30',
        balance_minutes: 1150, // Quase no teto de 1200 min (20h)
        max_positive_balance_minutes: 1200,
        status: 'ACTIVE',
        expiration_rule: 'PAY_AS_OVERTIME',
        warning_days_before_expiration: 30
      };

      const dailySummary: TimeDailySummaryInput = {
        date: '2026-01-10',
        overtime_50_minutes: 120, // 2h extras (só cabem 50 min no banco; 70 min vão para folha)
        overtime_100_minutes: 0,
        delay_minutes: 0,
        absence_minutes: 0
      };

      const result = TimeBankService.processDailySummary(account, dailySummary);

      expect(result.account.balance_minutes).toBe(1200);
      expect(result.transactions[0].minutes).toBe(50);
      expect(result.excessOvertimeToPayroll).toBe(70); // 70 min pagos como HE direta na folha
    });

    it('deve debitar atrasos do banco de horas quando configurado', () => {
      const account: TimeBankAccount = {
        id: 'acc-1',
        tenant_id: mockTenantId,
        company_id: mockCompanyId,
        contract_id: mockContractId,
        policy_type: 'ACORDO_INDIVIDUAL',
        validity_months: 6,
        start_date: '2026-01-01',
        end_date: '2026-06-30',
        balance_minutes: 180, // Saldo positivo de 3h
        status: 'ACTIVE',
        expiration_rule: 'PAY_AS_OVERTIME',
        warning_days_before_expiration: 30
      };

      const dailySummary: TimeDailySummaryInput = {
        date: '2026-01-12',
        overtime_50_minutes: 0,
        overtime_100_minutes: 0,
        delay_minutes: 45, // Atraso de 45 min
        absence_minutes: 0
      };

      const result = TimeBankService.processDailySummary(account, dailySummary);

      expect(result.transactions[0].transaction_type).toBe('DELAY');
      expect(result.transactions[0].minutes).toBe(-45);
      expect(result.account.balance_minutes).toBe(135); // 180 - 45 = 135 min (2h15)
    });
  });

  describe('3. Concessão de Folga Compensatória e Ajustes Manuais', () => {
    it('deve conceder folga compensatória debitando do saldo disponível', () => {
      const account: TimeBankAccount = {
        id: 'acc-1',
        tenant_id: mockTenantId,
        company_id: mockCompanyId,
        contract_id: mockContractId,
        policy_type: 'ACORDO_INDIVIDUAL',
        validity_months: 6,
        start_date: '2026-01-01',
        end_date: '2026-06-30',
        balance_minutes: 600, // 10 horas acumuladas
        status: 'ACTIVE',
        expiration_rule: 'PAY_AS_OVERTIME',
        warning_days_before_expiration: 30
      };

      // Colaborador folga um dia inteiro de 8 horas (480 minutos)
      const result = TimeBankService.requestCompensationDayOff(account, {
        date: '2026-02-20',
        minutes: 480,
        description: 'Folga compensatória de Carnaval'
      });

      expect(result.transaction.transaction_type).toBe('COMPENSATION_DAY_OFF');
      expect(result.transaction.minutes).toBe(-480);
      expect(result.account.balance_minutes).toBe(120); // Sobram 2h
    });

    it('deve lançar ajuste manual com justificativa obrigatória', () => {
      const account: TimeBankAccount = {
        id: 'acc-1',
        tenant_id: mockTenantId,
        company_id: mockCompanyId,
        contract_id: mockContractId,
        policy_type: 'ACORDO_INDIVIDUAL',
        validity_months: 6,
        start_date: '2026-01-01',
        end_date: '2026-06-30',
        balance_minutes: 100,
        status: 'ACTIVE',
        expiration_rule: 'PAY_AS_OVERTIME',
        warning_days_before_expiration: 30
      };

      expect(() => {
        TimeBankService.addManualAdjustment(account, {
          date: '2026-03-01',
          minutes: 60,
          description: '' // Sem descrição = erro!
        });
      }).toThrow(/Justificativa é obrigatória/i);

      const result = TimeBankService.addManualAdjustment(account, {
        date: '2026-03-01',
        minutes: 60,
        description: 'Compensação autorizada por gerência referente a treinamento'
      });

      expect(result.transaction.transaction_type).toBe('MANUAL_ADJUSTMENT');
      expect(result.transaction.minutes).toBe(60);
      expect(result.account.balance_minutes).toBe(160);
    });
  });

  describe('4. Extrato Cronológico e Saldo Progressivo', () => {
    it('deve emitir extrato com saldo anterior, transações em ordem cronológica e saldo acumulado a cada linha', () => {
      const account: TimeBankAccount = {
        id: 'acc-1',
        tenant_id: mockTenantId,
        company_id: mockCompanyId,
        contract_id: mockContractId,
        policy_type: 'ACORDO_INDIVIDUAL',
        validity_months: 6,
        start_date: '2026-01-01',
        end_date: '2026-06-30',
        balance_minutes: 195,
        status: 'ACTIVE',
        expiration_rule: 'PAY_AS_OVERTIME',
        warning_days_before_expiration: 30
      };

      const transactions: TimeBankTransaction[] = [
        {
          id: 'tx-2',
          tenant_id: mockTenantId,
          account_id: account.id,
          date: '2026-01-10',
          minutes: -45,
          transaction_type: 'DELAY',
          description: 'Atraso 45 min',
          created_at: '2026-01-10T18:00:00Z'
        },
        {
          id: 'tx-1',
          tenant_id: mockTenantId,
          account_id: account.id,
          date: '2026-01-05',
          minutes: 120,
          transaction_type: 'OVERTIME',
          description: 'HE 50%',
          created_at: '2026-01-05T18:00:00Z'
        },
        {
          id: 'tx-3',
          tenant_id: mockTenantId,
          account_id: account.id,
          date: '2026-01-15',
          minutes: 120,
          transaction_type: 'OVERTIME',
          description: 'HE 50%',
          created_at: '2026-01-15T18:00:00Z'
        }
      ];

      const statement = TimeBankService.generateStatement(account, transactions);

      expect(statement.entries).toHaveLength(3);
      // Deve ordenar por data ASC
      expect(statement.entries[0].date).toBe('2026-01-05');
      expect(statement.entries[0].minutes).toBe(120);
      expect(statement.entries[0].running_balance_minutes).toBe(120);
      expect(statement.entries[0].running_balance_formatted).toBe('+02:00');

      expect(statement.entries[1].date).toBe('2026-01-10');
      expect(statement.entries[1].minutes).toBe(-45);
      expect(statement.entries[1].running_balance_minutes).toBe(75);
      expect(statement.entries[1].running_balance_formatted).toBe('+01:15');

      expect(statement.entries[2].date).toBe('2026-01-15');
      expect(statement.entries[2].minutes).toBe(120);
      expect(statement.entries[2].running_balance_minutes).toBe(195);
      expect(statement.entries[2].running_balance_formatted).toBe('+03:15');

      expect(statement.total_credits_minutes).toBe(240);
      expect(statement.total_debits_minutes).toBe(45);
      expect(statement.final_balance_minutes).toBe(195);
      expect(statement.final_balance_formatted).toBe('+03:15');
    });

    it('deve formatar minutos corretamente para +HH:MM e -HH:MM', () => {
      expect(formatMinutesToHours(0)).toBe('00:00');
      expect(formatMinutesToHours(60)).toBe('+01:00');
      expect(formatMinutesToHours(125)).toBe('+02:05');
      expect(formatMinutesToHours(-45)).toBe('-00:45');
      expect(formatMinutesToHours(-130)).toBe('-02:10');

      expect(parseHoursToMinutes('02:05')).toBe(125);
      expect(parseHoursToMinutes('+02:05')).toBe(125);
      expect(parseHoursToMinutes('-02:10')).toBe(-130);
    });
  });

  describe('5. Monitoramento de Vencimentos e Alertas de Expiração', () => {
    it('deve indicar status NORMAL quando distante do vencimento', () => {
      const account: TimeBankAccount = {
        id: 'acc-1',
        tenant_id: mockTenantId,
        company_id: mockCompanyId,
        contract_id: mockContractId,
        policy_type: 'ACORDO_INDIVIDUAL',
        validity_months: 6,
        start_date: '2026-01-01',
        end_date: '2026-06-30',
        balance_minutes: 300,
        status: 'ACTIVE',
        expiration_rule: 'PAY_AS_OVERTIME',
        warning_days_before_expiration: 30
      };

      const alert = TimeBankService.checkExpirationAndAlerts(account, '2026-03-01');
      expect(alert.status).toBe('NORMAL');
      expect(alert.days_remaining).toBe(121);
    });

    it('deve disparar alerta WARNING quando a menos de 30 dias do vencimento com saldo positivo', () => {
      const account: TimeBankAccount = {
        id: 'acc-1',
        tenant_id: mockTenantId,
        company_id: mockCompanyId,
        contract_id: mockContractId,
        policy_type: 'ACORDO_INDIVIDUAL',
        validity_months: 6,
        start_date: '2026-01-01',
        end_date: '2026-06-30',
        balance_minutes: 480, // 8h pendentes
        status: 'ACTIVE',
        expiration_rule: 'PAY_AS_OVERTIME',
        warning_days_before_expiration: 30
      };

      const alert = TimeBankService.checkExpirationAndAlerts(account, '2026-06-10');
      expect(alert.status).toBe('WARNING');
      expect(alert.days_remaining).toBe(20);
      expect(alert.action_recommended).toBe('SCHEDULE_TIME_OFF');
      expect(alert.message).toMatch(/restam 20 dias/i);
    });

    it('deve disparar alerta CRITICAL quando a 7 dias ou menos do vencimento', () => {
      const account: TimeBankAccount = {
        id: 'acc-1',
        tenant_id: mockTenantId,
        company_id: mockCompanyId,
        contract_id: mockContractId,
        policy_type: 'ACORDO_INDIVIDUAL',
        validity_months: 6,
        start_date: '2026-01-01',
        end_date: '2026-06-30',
        balance_minutes: 480,
        status: 'ACTIVE',
        expiration_rule: 'PAY_AS_OVERTIME',
        warning_days_before_expiration: 30
      };

      const alert = TimeBankService.checkExpirationAndAlerts(account, '2026-06-25');
      expect(alert.status).toBe('CRITICAL');
      expect(alert.days_remaining).toBe(5);
      expect(alert.action_recommended).toBe('IMMEDIATE_COMPENSATION_OR_PREPARE_PAYOUT');
    });

    it('deve disparar alerta EXPIRED quando atingir ou ultrapassar a data limite com saldo positivo', () => {
      const account: TimeBankAccount = {
        id: 'acc-1',
        tenant_id: mockTenantId,
        company_id: mockCompanyId,
        contract_id: mockContractId,
        policy_type: 'ACORDO_INDIVIDUAL',
        validity_months: 6,
        start_date: '2026-01-01',
        end_date: '2026-06-30',
        balance_minutes: 600, // 10h não compensadas
        status: 'ACTIVE',
        expiration_rule: 'PAY_AS_OVERTIME',
        warning_days_before_expiration: 30
      };

      const alert = TimeBankService.checkExpirationAndAlerts(account, '2026-07-01');
      expect(alert.status).toBe('EXPIRED');
      expect(alert.days_remaining).toBeLessThan(0);
      expect(alert.action_recommended).toBe('PAY_AS_OVERTIME');
    });
  });

  describe('6. Fechamento e Pagamento do Saldo Vencido como HE (CLT Art. 59 §3º)', () => {
    it('deve fechar conta vencida gerando proposta de pagamento como HE (rubrica 152) e zerar o saldo', () => {
      const account: TimeBankAccount = {
        id: 'acc-1',
        tenant_id: mockTenantId,
        company_id: mockCompanyId,
        contract_id: mockContractId,
        policy_type: 'ACORDO_INDIVIDUAL',
        validity_months: 6,
        start_date: '2026-01-01',
        end_date: '2026-06-30',
        balance_minutes: 630, // 10h30 = 10.5 horas
        status: 'ACTIVE',
        expiration_rule: 'PAY_AS_OVERTIME',
        warning_days_before_expiration: 30
      };

      const closure = TimeBankService.closeAndPayoutAccount(account, {
        closure_date: '2026-07-01',
        reason: 'EXPIRATION',
        overtime_factor: 1.5,
        rubric_code: '152'
      });

      expect(closure.account.status).toBe('PAID_OUT');
      expect(closure.account.balance_minutes).toBe(0);
      expect(closure.account.closure_date).toBe('2026-07-01');

      // Transação de quitação no extrato
      expect(closure.payoutTransaction.transaction_type).toBe('EXPIRATION_PAYOUT');
      expect(closure.payoutTransaction.minutes).toBe(-630);
      expect(closure.payoutTransaction.description).toMatch(/Liquidação de banco de horas vencido/i);

      // Proposta de evento para a folha
      expect(closure.payoutProposal.rubric_code).toBe('152');
      expect(closure.payoutProposal.hours).toBe(10.5);
      expect(closure.payoutProposal.factor).toBe(1.5);
      expect(closure.payoutProposal.contract_id).toBe(mockContractId);
    });

    it('deve fechar normalmente conta com saldo zero sem gerar pagamento', () => {
      const account: TimeBankAccount = {
        id: 'acc-1',
        tenant_id: mockTenantId,
        company_id: mockCompanyId,
        contract_id: mockContractId,
        policy_type: 'ACORDO_INDIVIDUAL',
        validity_months: 6,
        start_date: '2026-01-01',
        end_date: '2026-06-30',
        balance_minutes: 0,
        status: 'ACTIVE',
        expiration_rule: 'PAY_AS_OVERTIME',
        warning_days_before_expiration: 30
      };

      const closure = TimeBankService.closeAndPayoutAccount(account, {
        closure_date: '2026-07-01',
        reason: 'EXPIRATION'
      });

      expect(closure.account.status).toBe('CLOSED');
      expect(closure.account.balance_minutes).toBe(0);
      expect(closure.payoutTransaction).toBeNull();
      expect(closure.payoutProposal).toBeNull();
    });
  });

  describe('7. Rescisão Contratual com Banco de Horas (CLT Art. 59 §3º)', () => {
    it('deve pagar saldo remanescente na rescisão mesmo que a vigência não tenha expirado', () => {
      const account: TimeBankAccount = {
        id: 'acc-1',
        tenant_id: mockTenantId,
        company_id: mockCompanyId,
        contract_id: mockContractId,
        policy_type: 'ACORDO_INDIVIDUAL',
        validity_months: 6,
        start_date: '2026-01-01',
        end_date: '2026-06-30',
        balance_minutes: 480, // 8h acumuladas
        status: 'ACTIVE',
        expiration_rule: 'PAY_AS_OVERTIME',
        warning_days_before_expiration: 30
      };

      // Demissão em 15/03/2026 (antes de expirar em 30/06)
      const closure = TimeBankService.closeAndPayoutAccount(account, {
        closure_date: '2026-03-15',
        reason: 'TERMINATION',
        overtime_factor: 1.5,
        rubric_code: '152'
      });

      expect(closure.account.status).toBe('PAID_OUT');
      expect(closure.payoutProposal).not.toBeNull();
      expect(closure.payoutProposal?.hours).toBe(8);
      expect(closure.payoutProposal?.reason).toBe('TERMINATION');
      expect(closure.payoutTransaction?.transaction_type).toBe('PAYOUT');
    });
  });
});
