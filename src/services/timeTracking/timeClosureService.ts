/**
 * timeClosureService.ts
 * 
 * Serviço de Fechamento de Ponto Eletrônico e Integração Automática com a Folha:
 * - Substitui completamente o lançamento manual de eventos variáveis de ponto.
 * - Converte as horas apuradas pelo motor de jornada (workShiftEngine) e banco de horas
 *   em lançamentos de folha de pagamento (payroll_variable_events).
 * - Discriminação automática de verbas:
 *   - HE 50% (código 150) e HE 100% (código 160) para colaboradores sem banco de horas.
 *   - Excedente de banco de horas (acima do teto pactuado) direcionado à folha.
 *   - Adicional Noturno (código 301) em horas noturnas reduzidas legais (Art. 73 CLT).
 *   - Atrasos (código 802) e Faltas injustificadas (código 801).
 *   - DSR sobre faltas injustificadas (código 803 / 212).
 *   - Indenização de intervalo intrajornada suprimido (código 105 - Art. 71 CLT).
 * - Idempotência estrita: substitui lançamentos com origin = 'TIME_TRACKING' sem afetar
 *   lançamentos manuais do DP (premiações, comissões, bônus com origin = 'MANUAL').
 * - Rastreabilidade completa com vínculo de time_period_closure_id.
 */

export interface ContractTimeSummaryInput {
  contract_id: string;
  has_active_time_bank: boolean;
  total_worked_minutes: number;
  overtime_50_minutes: number;
  overtime_100_minutes: number;
  excess_overtime_minutes?: number;
  night_shift_minutes: number;
  delay_minutes: number;
  absence_minutes: number;
  has_dsr_loss?: boolean;
  intrajornada_violation_minutes?: number;
}

export interface RubricCatalogItem {
  id: string;
  code: string;
  name: string;
  type: 'EARNING' | 'DEDUCTION' | 'BASE';
}

export interface VariableEventPayload {
  id?: string;
  tenant_id: string;
  period_id: string;
  contract_id: string;
  rubric_id: string;
  rubric_code?: string;
  quantity: number;
  amount: number;
  origin: 'MANUAL' | 'TIME_TRACKING' | 'IMPORT' | 'SYSTEM';
  reference: string;
  time_period_closure_id?: string;
  description?: string;
}

export interface TimePeriodClosureRecord {
  id: string;
  tenant_id: string;
  company_id?: string;
  payroll_period_id: string;
  period_start: string;
  period_end: string;
  status: 'OPEN' | 'PROCESSING' | 'CLOSED' | 'REOPENED';
  total_contracts: number;
  total_events_generated: number;
  summary: {
    total_overtime_50_hours: number;
    total_overtime_100_hours: number;
    total_night_hours: number;
    total_delay_hours: number;
    total_absence_days: number;
    total_intrajornada_hours: number;
  };
  events: VariableEventPayload[];
  closed_by?: string;
  closed_at?: string;
  reopened_by?: string;
  reopened_at?: string;
  reopen_reason?: string;
  created_at: string;
  updated_at: string;
}

export class TimeClosureService {
  /**
   * 1. Gera os eventos variáveis de ponto para um contrato específico.
   */
  public static generateContractVariableEvents(params: {
    tenant_id: string;
    period_id: string;
    closure_id?: string;
    contractSummary: ContractTimeSummaryInput;
    rubrics: RubricCatalogItem[];
  }): VariableEventPayload[] {
    const { tenant_id, period_id, closure_id, contractSummary, rubrics } = params;
    const events: VariableEventPayload[] = [];

    const findRubric = (code: string) => rubrics.find((r) => r.code === code);

    // 1. Horas Extras (50% e 100%)
    if (!contractSummary.has_active_time_bank) {
      if (contractSummary.overtime_50_minutes > 0) {
        const rub = findRubric('150');
        if (rub) {
          const hours = Math.round((contractSummary.overtime_50_minutes / 60) * 100) / 100;
          events.push({
            tenant_id,
            period_id,
            contract_id: contractSummary.contract_id,
            rubric_id: rub.id,
            rubric_code: rub.code,
            quantity: hours,
            amount: 0,
            origin: 'TIME_TRACKING',
            reference: 'FECHAMENTO_PONTO',
            time_period_closure_id: closure_id,
            description: `Horas Extras 50% (${hours}h)`
          });
        }
      }

      if (contractSummary.overtime_100_minutes > 0) {
        const rub = findRubric('160');
        if (rub) {
          const hours = Math.round((contractSummary.overtime_100_minutes / 60) * 100) / 100;
          events.push({
            tenant_id,
            period_id,
            contract_id: contractSummary.contract_id,
            rubric_id: rub.id,
            rubric_code: rub.code,
            quantity: hours,
            amount: 0,
            origin: 'TIME_TRACKING',
            reference: 'FECHAMENTO_PONTO',
            time_period_closure_id: closure_id,
            description: `Horas Extras 100% (${hours}h)`
          });
        }
      }
    } else if (contractSummary.excess_overtime_minutes && contractSummary.excess_overtime_minutes > 0) {
      // Colaborador com banco de horas, mas que excedeu o teto
      const rub = findRubric('150');
      if (rub) {
        const hours = Math.round((contractSummary.excess_overtime_minutes / 60) * 100) / 100;
        events.push({
          tenant_id,
          period_id,
          contract_id: contractSummary.contract_id,
          rubric_id: rub.id,
          rubric_code: rub.code,
          quantity: hours,
          amount: 0,
          origin: 'TIME_TRACKING',
          reference: 'FECHAMENTO_PONTO_EXCESSO_BANCO',
          time_period_closure_id: closure_id,
          description: `Horas Extras excedentes ao teto do banco (${hours}h)`
        });
      }
    }

    // 2. Adicional Noturno (código 301) — SEMPRE pago em folha, não acumula em banco de horas
    if (contractSummary.night_shift_minutes > 0) {
      const rub = findRubric('301');
      if (rub) {
        const hours = Math.round((contractSummary.night_shift_minutes / 60) * 100) / 100;
        events.push({
          tenant_id,
          period_id,
          contract_id: contractSummary.contract_id,
          rubric_id: rub.id,
          rubric_code: rub.code,
          quantity: hours,
          amount: 0,
          origin: 'TIME_TRACKING',
          reference: 'FECHAMENTO_PONTO',
          time_period_closure_id: closure_id,
          description: `Adicional Noturno (${hours}h noturnas reduzidas)`
        });
      }
    }

    // 3. Atrasos e Saídas Antecipadas (código 802)
    if (contractSummary.delay_minutes > 0) {
      const rub = findRubric('802');
      if (rub) {
        const hours = Math.round((contractSummary.delay_minutes / 60) * 100) / 100;
        events.push({
          tenant_id,
          period_id,
          contract_id: contractSummary.contract_id,
          rubric_id: rub.id,
          rubric_code: rub.code,
          quantity: hours,
          amount: 0,
          origin: 'TIME_TRACKING',
          reference: 'FECHAMENTO_PONTO',
          time_period_closure_id: closure_id,
          description: `Atrasos apurados (${hours}h)`
        });
      }
    }

    // 4. Faltas Injustificadas (código 801)
    if (contractSummary.absence_minutes > 0) {
      const rub = findRubric('801');
      if (rub) {
        // Converte minutos para dias de falta (jornada padrão de 8h = 480 min por dia)
        const days = Math.max(1, Math.round(contractSummary.absence_minutes / 480));
        events.push({
          tenant_id,
          period_id,
          contract_id: contractSummary.contract_id,
          rubric_id: rub.id,
          rubric_code: rub.code,
          quantity: days,
          amount: 0,
          origin: 'TIME_TRACKING',
          reference: 'FECHAMENTO_PONTO',
          time_period_closure_id: closure_id,
          description: `Faltas Injustificadas (${days} dias)`
        });
      }
    }

    // 5. DSR sobre Faltas (código 803)
    if (contractSummary.has_dsr_loss) {
      const rub = findRubric('803');
      if (rub) {
        events.push({
          tenant_id,
          period_id,
          contract_id: contractSummary.contract_id,
          rubric_id: rub.id,
          rubric_code: rub.code,
          quantity: 1, // 1 dia de repouso semanal remunerado
          amount: 0,
          origin: 'TIME_TRACKING',
          reference: 'FECHAMENTO_PONTO',
          time_period_closure_id: closure_id,
          description: 'Perda do DSR por faltas injustificadas'
        });
      }
    }

    // 6. Indenização de Intervalo Intrajornada (código 105 - Art. 71 CLT)
    if (contractSummary.intrajornada_violation_minutes && contractSummary.intrajornada_violation_minutes > 0) {
      const rub = findRubric('105');
      if (rub) {
        const hours = Math.round((contractSummary.intrajornada_violation_minutes / 60) * 100) / 100;
        events.push({
          tenant_id,
          period_id,
          contract_id: contractSummary.contract_id,
          rubric_id: rub.id,
          rubric_code: rub.code,
          quantity: hours,
          amount: 0,
          origin: 'TIME_TRACKING',
          reference: 'FECHAMENTO_PONTO',
          time_period_closure_id: closure_id,
          description: `Indenização de Intervalo Intrajornada (${hours}h)`
        });
      }
    }

    return events;
  }

  /**
   * 2. Reconciliação com idempotência: preserva lançamentos manuais e substitui apenas TIME_TRACKING.
   */
  public static reconcileVariableEvents(params: {
    existingEvents: VariableEventPayload[];
    newTimeEvents: VariableEventPayload[];
  }): {
    toKeep: VariableEventPayload[];
    idsToDelete: string[];
    toInsert: VariableEventPayload[];
  } {
    const toKeep: VariableEventPayload[] = [];
    const idsToDelete: string[] = [];

    for (const ev of params.existingEvents) {
      if (ev.origin === 'MANUAL') {
        toKeep.push(ev);
      } else if (ev.origin === 'TIME_TRACKING') {
        if (ev.id) {
          idsToDelete.push(ev.id);
        }
      } else {
        toKeep.push(ev);
      }
    }

    return {
      toKeep,
      idsToDelete,
      toInsert: params.newTimeEvents
    };
  }

  /**
   * 3. Executa fechamento do período de ponto em lote para uma empresa.
   */
  public static executeTimePeriodClosure(params: {
    tenant_id: string;
    company_id?: string;
    period_id: string;
    period_start: string;
    period_end: string;
    closed_by?: string;
    contracts: ContractTimeSummaryInput[];
    rubrics: RubricCatalogItem[];
  }): TimePeriodClosureRecord {
    const closureId = `tpc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const allEvents: VariableEventPayload[] = [];

    let totalHe50 = 0;
    let totalHe100 = 0;
    let totalNight = 0;
    let totalDelay = 0;
    let totalAbsence = 0;
    let totalIntra = 0;

    for (const contract of params.contracts) {
      const contractEvents = this.generateContractVariableEvents({
        tenant_id: params.tenant_id,
        period_id: params.period_id,
        closure_id: closureId,
        contractSummary: contract,
        rubrics: params.rubrics
      });

      allEvents.push(...contractEvents);

      for (const ev of contractEvents) {
        if (ev.rubric_code === '150') totalHe50 += ev.quantity;
        if (ev.rubric_code === '160') totalHe100 += ev.quantity;
        if (ev.rubric_code === '301') totalNight += ev.quantity;
        if (ev.rubric_code === '802') totalDelay += ev.quantity;
        if (ev.rubric_code === '801') totalAbsence += ev.quantity;
        if (ev.rubric_code === '105') totalIntra += ev.quantity;
      }
    }

    const now = new Date().toISOString();

    return {
      id: closureId,
      tenant_id: params.tenant_id,
      company_id: params.company_id,
      payroll_period_id: params.period_id,
      period_start: params.period_start,
      period_end: params.period_end,
      status: 'CLOSED',
      total_contracts: params.contracts.length,
      total_events_generated: allEvents.length,
      summary: {
        total_overtime_50_hours: Math.round(totalHe50 * 100) / 100,
        total_overtime_100_hours: Math.round(totalHe100 * 100) / 100,
        total_night_hours: Math.round(totalNight * 100) / 100,
        total_delay_hours: Math.round(totalDelay * 100) / 100,
        total_absence_days: totalAbsence,
        total_intrajornada_hours: Math.round(totalIntra * 100) / 100
      },
      events: allEvents,
      closed_by: params.closed_by,
      closed_at: now,
      created_at: now,
      updated_at: now
    };
  }

  /**
   * 4. Reabre o fechamento de ponto com justificativa obrigatória.
   */
  public static reopenTimePeriodClosure(params: {
    closure: TimePeriodClosureRecord;
    reopened_by: string;
    reopen_reason: string;
  }): TimePeriodClosureRecord {
    if (!params.reopen_reason || params.reopen_reason.trim() === '') {
      throw new Error('Justificativa é obrigatória para reabrir o fechamento de ponto.');
    }

    const now = new Date().toISOString();

    return {
      ...params.closure,
      status: 'REOPENED',
      reopened_by: params.reopened_by,
      reopen_reason: params.reopen_reason.trim(),
      reopened_at: now,
      updated_at: now
    };
  }
}
