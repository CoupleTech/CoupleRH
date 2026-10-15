import { describe, it, expect } from 'vitest';
import {
  TimeClosureService,
  ContractTimeSummaryInput,
  RubricCatalogItem,
  VariableEventPayload
} from '../../services/timeTracking/timeClosureService';

describe('FASE P5: PT-09 — Fechamento do Ponto e Geração Automática de Eventos para Folha', () => {
  const mockTenantId = 'tenant-test-111';
  const mockCompanyId = 'company-test-222';
  const mockPeriodId = 'period-test-2026-03';
  const mockClosureId = 'closure-test-999';

  const mockRubrics: RubricCatalogItem[] = [
    { id: 'rub-150', code: '150', name: 'Horas Extras 50%', type: 'EARNING' },
    { id: 'rub-160', code: '160', name: 'Horas Extras 100%', type: 'EARNING' },
    { id: 'rub-301', code: '301', name: 'Adicional Noturno', type: 'EARNING' },
    { id: 'rub-801', code: '801', name: 'Faltas Injustificadas', type: 'DEDUCTION' },
    { id: 'rub-802', code: '802', name: 'Atrasos e Saídas Antecipadas', type: 'DEDUCTION' },
    { id: 'rub-803', code: '803', name: 'DSR sobre Faltas', type: 'DEDUCTION' },
    { id: 'rub-105', code: '105', name: 'Intervalo Intrajornada Indenizado', type: 'EARNING' }
  ];

  describe('1. Geração de Eventos por Tipo de Regime (Com e Sem Banco de Horas)', () => {
    it('deve gerar eventos de HE 50% e HE 100% para colaborador sem banco de horas', () => {
      const contractSummary: ContractTimeSummaryInput = {
        contract_id: 'contract-sem-banco',
        has_active_time_bank: false,
        total_worked_minutes: 10560,
        overtime_50_minutes: 150, // 2h30 = 2.5h
        overtime_100_minutes: 120, // 2h
        night_shift_minutes: 0,
        delay_minutes: 0,
        absence_minutes: 0,
        intrajornada_violation_minutes: 0
      };

      const events = TimeClosureService.generateContractVariableEvents({
        tenant_id: mockTenantId,
        period_id: mockPeriodId,
        closure_id: mockClosureId,
        contractSummary,
        rubrics: mockRubrics
      });

      expect(events).toHaveLength(2);

      const he50 = events.find((e) => e.rubric_code === '150');
      expect(he50).toBeDefined();
      expect(he50?.quantity).toBe(2.5); // 150 / 60
      expect(he50?.origin).toBe('TIME_TRACKING');
      expect(he50?.time_period_closure_id).toBe(mockClosureId);

      const he100 = events.find((e) => e.rubric_code === '160');
      expect(he100).toBeDefined();
      expect(he100?.quantity).toBe(2.0); // 120 / 60
      expect(he100?.origin).toBe('TIME_TRACKING');
    });

    it('deve ignorar horas extras para colaborador com banco de horas ativo, pois foram para compensação', () => {
      const contractSummary: ContractTimeSummaryInput = {
        contract_id: 'contract-com-banco',
        has_active_time_bank: true, // Banco ativo
        total_worked_minutes: 10560,
        overtime_50_minutes: 180, // Foram para o banco!
        overtime_100_minutes: 0,
        night_shift_minutes: 60, // 1h noturna
        delay_minutes: 0,
        absence_minutes: 0,
        intrajornada_violation_minutes: 0
      };

      const events = TimeClosureService.generateContractVariableEvents({
        tenant_id: mockTenantId,
        period_id: mockPeriodId,
        closure_id: mockClosureId,
        contractSummary,
        rubrics: mockRubrics
      });

      // Não deve gerar HE 50%
      const he50 = events.find((e) => e.rubric_code === '150');
      expect(he50).toBeUndefined();

      // Mas o adicional noturno SEMPRE é pago na folha (não entra em banco de horas!)
      const noturno = events.find((e) => e.rubric_code === '301');
      expect(noturno).toBeDefined();
      expect(noturno?.quantity).toBe(1.0);
    });

    it('deve pagar em folha as horas extras que excederam o teto de banco de horas', () => {
      const contractSummary: ContractTimeSummaryInput = {
        contract_id: 'contract-teto-banco',
        has_active_time_bank: true,
        total_worked_minutes: 11000,
        overtime_50_minutes: 240, // 4h totais
        excess_overtime_minutes: 90, // 1h30 (90 min) excedeu o teto do banco e deve ir para a folha!
        overtime_100_minutes: 0,
        night_shift_minutes: 0,
        delay_minutes: 0,
        absence_minutes: 0,
        intrajornada_violation_minutes: 0
      };

      const events = TimeClosureService.generateContractVariableEvents({
        tenant_id: mockTenantId,
        period_id: mockPeriodId,
        closure_id: mockClosureId,
        contractSummary,
        rubrics: mockRubrics
      });

      const he50 = events.find((e) => e.rubric_code === '150');
      expect(he50).toBeDefined();
      expect(he50?.quantity).toBe(1.5); // 90 min / 60 = 1.5 horas
    });
  });

  describe('2. Apuração de Adicional Noturno, Atrasos, Faltas e Violações', () => {
    it('deve gerar eventos de atrasos (802), faltas (801) e DSR sobre faltas (803)', () => {
      const contractSummary: ContractTimeSummaryInput = {
        contract_id: 'contract-atrasos-faltas',
        has_active_time_bank: false,
        total_worked_minutes: 8000,
        overtime_50_minutes: 0,
        overtime_100_minutes: 0,
        night_shift_minutes: 0,
        delay_minutes: 45, // 0.75h de atraso
        absence_minutes: 480, // 1 dia inteiro de falta (8h = 1 falta injustificada)
        has_dsr_loss: true, // Perdeu DSR da semana
        intrajornada_violation_minutes: 0
      };

      const events = TimeClosureService.generateContractVariableEvents({
        tenant_id: mockTenantId,
        period_id: mockPeriodId,
        closure_id: mockClosureId,
        contractSummary,
        rubrics: mockRubrics
      });

      const atraso = events.find((e) => e.rubric_code === '802');
      expect(atraso).toBeDefined();
      expect(atraso?.quantity).toBe(0.75); // 45 / 60

      const falta = events.find((e) => e.rubric_code === '801');
      expect(falta).toBeDefined();
      expect(falta?.quantity).toBe(1); // 1 dia de falta

      const dsr = events.find((e) => e.rubric_code === '803');
      expect(dsr).toBeDefined();
      expect(dsr?.quantity).toBe(1); // 1 dia de DSR descontado
    });

    it('deve gerar indenização de intervalo intrajornada suprimido (Art. 71 CLT)', () => {
      const contractSummary: ContractTimeSummaryInput = {
        contract_id: 'contract-intervalo',
        has_active_time_bank: false,
        total_worked_minutes: 9000,
        overtime_50_minutes: 0,
        overtime_100_minutes: 0,
        night_shift_minutes: 0,
        delay_minutes: 0,
        absence_minutes: 0,
        intrajornada_violation_minutes: 60 // 1 hora de intervalo suprimido
      };

      const events = TimeClosureService.generateContractVariableEvents({
        tenant_id: mockTenantId,
        period_id: mockPeriodId,
        closure_id: mockClosureId,
        contractSummary,
        rubrics: mockRubrics
      });

      const intra = events.find((e) => e.rubric_code === '105');
      expect(intra).toBeDefined();
      expect(intra?.quantity).toBe(1.0);
    });
  });

  describe('3. Idempotência e Preservação de Lançamentos Manuais', () => {
    it('deve isolar e substituir apenas eventos de TIME_TRACKING, preservando eventos manuais (MANUAL)', () => {
      const existingEvents: VariableEventPayload[] = [
        {
          id: 'ev-manual-bonus',
          tenant_id: mockTenantId,
          period_id: mockPeriodId,
          contract_id: 'contract-1',
          rubric_id: 'rub-bonus',
          rubric_code: '250',
          quantity: 1,
          amount: 500,
          origin: 'MANUAL', // Lançamento manual do DP (ex: premiação)
          reference: 'BONUS_METAS'
        },
        {
          id: 'ev-time-antigo',
          tenant_id: mockTenantId,
          period_id: mockPeriodId,
          contract_id: 'contract-1',
          rubric_id: 'rub-150',
          rubric_code: '150',
          quantity: 1.0,
          amount: 0,
          origin: 'TIME_TRACKING', // Fechamento anterior a ser substituído
          reference: 'FECHAMENTO_PONTO'
        }
      ];

      const newTimeEvents: VariableEventPayload[] = [
        {
          tenant_id: mockTenantId,
          period_id: mockPeriodId,
          contract_id: 'contract-1',
          rubric_id: 'rub-150',
          rubric_code: '150',
          quantity: 3.5, // Novo valor apurado após ajuste
          amount: 0,
          origin: 'TIME_TRACKING',
          reference: 'FECHAMENTO_PONTO'
        }
      ];

      const reconciled = TimeClosureService.reconcileVariableEvents({
        existingEvents,
        newTimeEvents
      });

      // O evento manual deve permanecer intacto
      const manualBonus = reconciled.toKeep.find((e) => e.origin === 'MANUAL');
      expect(manualBonus).toBeDefined();
      expect(manualBonus?.id).toBe('ev-manual-bonus');

      // O evento antigo do ponto deve ser marcado para deleção
      expect(reconciled.idsToDelete).toContain('ev-time-antigo');

      // O novo evento do ponto deve ser inserido
      expect(reconciled.toInsert).toHaveLength(1);
      expect(reconciled.toInsert[0].quantity).toBe(3.5);
    });
  });

  describe('4. Fechamento e Reabertura do Período de Ponto', () => {
    it('deve processar o lote de contratos emitindo resumo quantitativo', () => {
      const contracts: ContractTimeSummaryInput[] = [
        {
          contract_id: 'c-1',
          has_active_time_bank: false,
          total_worked_minutes: 10000,
          overtime_50_minutes: 120, // 2h
          overtime_100_minutes: 0,
          night_shift_minutes: 60, // 1h
          delay_minutes: 0,
          absence_minutes: 0,
          intrajornada_violation_minutes: 0
        },
        {
          contract_id: 'c-2',
          has_active_time_bank: false,
          total_worked_minutes: 9500,
          overtime_50_minutes: 60, // 1h
          overtime_100_minutes: 60, // 1h
          night_shift_minutes: 0,
          delay_minutes: 30, // 0.5h
          absence_minutes: 0,
          intrajornada_violation_minutes: 0
        }
      ];

      const closure = TimeClosureService.executeTimePeriodClosure({
        tenant_id: mockTenantId,
        company_id: mockCompanyId,
        period_id: mockPeriodId,
        period_start: '2026-03-01',
        period_end: '2026-03-31',
        closed_by: 'user-dp-1',
        contracts,
        rubrics: mockRubrics
      });

      expect(closure.status).toBe('CLOSED');
      expect(closure.total_contracts).toBe(2);
      expect(closure.total_events_generated).toBe(5); // c-1: 2 eventos (HE50, Noturno); c-2: 3 eventos (HE50, HE100, Atraso)
      expect(closure.summary.total_overtime_50_hours).toBe(3.0); // 2 + 1
      expect(closure.summary.total_overtime_100_hours).toBe(1.0);
      expect(closure.summary.total_night_hours).toBe(1.0);
      expect(closure.summary.total_delay_hours).toBe(0.5);
    });

    it('deve permitir reabrir o período de ponto somente com justificativa obrigatória', () => {
      const closure = TimeClosureService.executeTimePeriodClosure({
        tenant_id: mockTenantId,
        company_id: mockCompanyId,
        period_id: mockPeriodId,
        period_start: '2026-03-01',
        period_end: '2026-03-31',
        closed_by: 'user-dp-1',
        contracts: [],
        rubrics: mockRubrics
      });

      expect(() => {
        TimeClosureService.reopenTimePeriodClosure({
          closure,
          reopened_by: 'user-dp-1',
          reopen_reason: '' // Vazio
        });
      }).toThrow(/Justificativa é obrigatória para reabrir o fechamento de ponto/i);

      const reopened = TimeClosureService.reopenTimePeriodClosure({
        closure,
        reopened_by: 'user-dp-1',
        reopen_reason: 'Ajuste de atestado médico entregue com atraso pelo colaborador'
      });

      expect(reopened.status).toBe('REOPENED');
      expect(reopened.reopened_by).toBe('user-dp-1');
      expect(reopened.reopen_reason).toMatch(/Ajuste de atestado médico/i);
      expect(reopened.reopened_at).toBeDefined();
    });
  });
});
