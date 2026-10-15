/**
 * timesheetContestService.ts
 * 
 * Serviço de Gestão e Tratamento de Contestações do Espelho de Ponto Eletrônico:
 * - Permite ao colaborador contestar marcações, ausências ou cálculos antes de assinar.
 * - Registra as datas afetadas, motivo detalhado e comprovantes/anexos.
 * - Altera o status do espelho para 'CONTESTED'.
 * - Fluxo de deliberação do gestor/DP:
 *   - DEFERIR (ACCEPT): acolhe a contestação, retorna o espelho para 'DRAFT' e permite os ajustes.
 *   - INDEFERIR (REJECT): rejeita com parecer obrigatório e retorna o espelho para 'PENDING_SIGNATURE'.
 * - Trilha completa de auditoria com pareceres e carimbos de tempo.
 */

export type TimesheetStatus = 'DRAFT' | 'PENDING_SIGNATURE' | 'SIGNED' | 'CONTESTED' | 'CLOSED';
export type TimesheetContestStatus = 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED_ACCEPTED' | 'REJECTED';

export interface TimesheetRecord {
  id: string;
  tenant_id: string;
  company_id?: string;
  contract_id: string;
  period_start: string;
  period_end: string;
  total_worked_minutes: number;
  total_overtime_minutes: number;
  total_delay_minutes: number;
  status: TimesheetStatus;
  document_hash?: string;
  rejection_reason?: string;
  contested_at?: string;
}

export interface TimesheetContest {
  id: string;
  tenant_id: string;
  timesheet_id: string;
  contract_id: string;
  worker_id: string;
  reason: string;
  affected_dates: string[];
  attachment_url?: string;
  status: TimesheetContestStatus;
  reviewed_by?: string;
  review_notes?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
}

export class TimesheetContestService {
  /**
   * 1. Abre contestação formal sobre o espelho de ponto eletrônico.
   */
  public static openContest(params: {
    timesheet: TimesheetRecord;
    worker_id: string;
    reason: string;
    affected_dates: string[];
    attachment_url?: string;
  }): {
    timesheet: TimesheetRecord;
    contest: TimesheetContest;
  } {
    if (params.timesheet.status !== 'PENDING_SIGNATURE') {
      throw new Error(
        `Apenas espelhos pendentes de assinatura podem ser contestados. Status atual: ${params.timesheet.status}`
      );
    }

    if (!params.reason || params.reason.trim().length < 10) {
      throw new Error('Motivo da contestação deve conter no mínimo 10 caracteres explicativos.');
    }

    const now = new Date().toISOString();

    const contest: TimesheetContest = {
      id: `tc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tenant_id: params.timesheet.tenant_id,
      timesheet_id: params.timesheet.id,
      contract_id: params.timesheet.contract_id,
      worker_id: params.worker_id,
      reason: params.reason.trim(),
      affected_dates: params.affected_dates || [],
      attachment_url: params.attachment_url,
      status: 'PENDING',
      created_at: now,
      updated_at: now
    };

    const updatedTimesheet: TimesheetRecord = {
      ...params.timesheet,
      status: 'CONTESTED',
      rejection_reason: params.reason.trim(),
      contested_at: now
    };

    return {
      timesheet: updatedTimesheet,
      contest
    };
  }

  /**
   * 2. Avalia a contestação (Gestor ou Analista de DP).
   */
  public static reviewContest(params: {
    contest: TimesheetContest;
    timesheet: TimesheetRecord;
    reviewer_id: string;
    decision: 'ACCEPT' | 'REJECT';
    review_notes: string;
  }): {
    timesheet: TimesheetRecord;
    contest: TimesheetContest;
  } {
    if (!params.review_notes || params.review_notes.trim() === '') {
      if (params.decision === 'REJECT') {
        throw new Error('Parecer explicativo é obrigatório ao indeferir uma contestação.');
      }
      throw new Error('Parecer explicativo é obrigatório ao avaliar uma contestação.');
    }

    const now = new Date().toISOString();
    const updatedContest: TimesheetContest = { ...params.contest };
    const updatedTimesheet: TimesheetRecord = { ...params.timesheet };

    updatedContest.reviewed_by = params.reviewer_id;
    updatedContest.review_notes = params.review_notes.trim();
    updatedContest.reviewed_at = now;
    updatedContest.updated_at = now;

    if (params.decision === 'ACCEPT') {
      updatedContest.status = 'RESOLVED_ACCEPTED';
      // Ao deferir, o espelho volta para DRAFT para permitir inclusão dos devidos ajustes
      updatedTimesheet.status = 'DRAFT';
    } else {
      updatedContest.status = 'REJECTED';
      // Ao indeferir, o espelho retorna para PENDING_SIGNATURE para ciência do colaborador
      updatedTimesheet.status = 'PENDING_SIGNATURE';
    }

    return {
      timesheet: updatedTimesheet,
      contest: updatedContest
    };
  }
}
