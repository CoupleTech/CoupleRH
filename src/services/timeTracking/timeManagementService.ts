/**
 * timeManagementService.ts
 * 
 * Módulo de Serviços para Gestão de Ponto Eletrônico pelo DP e Gestores (PT-11):
 * - Gestão de Dispositivos e Fontes (REP-C, REP-P Mobile, Importação AFD)
 * - Triagem e Importação de Arquivos AFD (Portaria 671)
 * - Identificação, Tratamento e Filtro de Inconsistências de Jornada (CLT arts. 66, 71, 74)
 * - Central de Aprovações (Ajustes de Ponto, Contestações de Espelho e Compensações de Banco de Horas)
 */

import { supabase } from '../../lib/supabase';
import {
  TimeBankService,
  type TimeBankPolicyType,
  type TimeBankAlertStatus,
  formatMinutesToHours
} from './timeBankService';
import type {
  TimeDevice,
  TimeDeviceKind,
  TimeDeviceStatus,
  TimeDailySummary,
  TimeDailyStatus
} from './timeTrackingModel';
import type { TimesheetContest } from './timesheetContestService';

export interface TimeEntryAdjustment {
  id?: string;
  tenant_id: string;
  time_entry_id?: string;
  contract_id: string;
  worker_name?: string;
  requested_timestamp: string;
  entry_type: 'IN' | 'OUT' | 'BREAK_START' | 'BREAK_END';
  adjustment_reason: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  requested_by: string;
  approved_by?: string;
  review_notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TimeBankCompensationRequest {
  id: string;
  tenant_id: string;
  contract_id: string;
  worker_name?: string;
  account_id: string;
  date: string;
  minutes: number;
  current_balance_minutes: number;
  reason?: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  requested_by: string;
  reviewed_by?: string;
  review_notes?: string;
  created_at?: string;
}

export interface AfdFileRecord {
  id: string;
  tenant_id: string;
  company_id?: string;
  device_id?: string;
  device_name?: string;
  file_name: string;
  file_hash: string;
  file_size_bytes?: number;
  period_start?: string;
  period_end?: string;
  total_records: number;
  imported_records: number;
  duplicate_records: number;
  rejected_records: number;
  status: 'PENDING' | 'PROCESSING' | 'IMPORTED' | 'ERROR';
  error_message?: string;
  created_at: string;
}

export interface PendingApprovalsGroup {
  adjustments: TimeEntryAdjustment[];
  contests: (TimesheetContest & { worker_name?: string; period_label?: string })[];
  compensations: TimeBankCompensationRequest[];
  totalCount: number;
}

/**
 * Converte qualquer timestamp (UTC ou com offset) para a data (YYYY-MM-DD) e hora (HH:mm) oficial de Brasília (America/Sao_Paulo - UTC-3)
 */
export function formatPunchToSaoPaulo(dateInput: string | Date): { date: string; time: string; hours: number; minutes: number } {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) {
    return { date: '', time: '00:00', hours: 0, minutes: 0 };
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(d);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }

  const date = `${partMap.year}-${partMap.month}-${partMap.day}`;
  let hourStr = partMap.hour || '00';
  if (hourStr === '24') hourStr = '00';
  const minStr = partMap.minute || '00';
  const time = `${hourStr.padStart(2, '0')}:${minStr.padStart(2, '0')}`;

  return {
    date,
    time,
    hours: parseInt(hourStr, 10),
    minutes: parseInt(minStr, 10)
  };
}

export class TimeManagementService {
  /**
   * Valida a integridade da configuração de um dispositivo de ponto
   */
  static validateDeviceConfig(device: Partial<TimeDevice>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!device.name || device.name.trim().length === 0) {
      errors.push('O nome do dispositivo é obrigatório.');
    }

    const validKinds: TimeDeviceKind[] = ['REP_C', 'REP_P_MOBILE', 'IMPORT'];
    if (!device.kind || !validKinds.includes(device.kind)) {
      errors.push('Tipo de dispositivo inválido (deve ser REP_C, REP_P_MOBILE ou IMPORT).');
    }

    if (device.kind === 'REP_C') {
      if (!device.serial_number || device.serial_number.trim().length === 0) {
        errors.push('Número de série / fabricação é obrigatório para equipamentos físicos REP-C.');
      }
    }

    if (device.port !== undefined && device.port !== null) {
      if (device.port < 1 || device.port > 65535) {
        errors.push('A porta de comunicação deve estar entre 1 e 65535.');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Classifica inconsistências de jornada diária com base em regras da CLT
   */
  static classifyInconsistencies(summary: Partial<TimeDailySummary>): string[] {
    const alerts: string[] = [];

    // Violação de intrajornada (Art. 71 da CLT)
    if ((summary.intrajornada_violation_minutes ?? 0) > 0) {
      alerts.push('INTRAJORNADA_VIOLATION');
    }

    // Violação de descanso interjornada mínimo de 11h (Art. 66 da CLT)
    if ((summary.interjornada_violation_minutes ?? 0) > 0) {
      alerts.push('INTERJORNADA_VIOLATION');
    }

    // Marcações ímpares ou batidas faltantes
    if (summary.inconsistencies?.includes('MISSING_PUNCH')) {
      alerts.push('MISSING_PUNCH');
    }

    // Atrasos excessivos ou faltas não abonadas
    if ((summary.delay_minutes ?? 0) > 10) {
      alerts.push('EXCESSIVE_DELAY');
    }
    if ((summary.absence_minutes ?? 0) > 0) {
      alerts.push('UNJUSTIFIED_ABSENCE');
    }

    return Array.from(new Set(alerts));
  }

  /**
   * Filtra lista de resumos diários pelo tipo de inconsistência
   */
  static filterSummariesByInconsistency(
    summaries: TimeDailySummary[],
    filterType: 'ALL' | 'ONLY_INCONSISTENT' | 'MISSING_PUNCH' | 'INTRAJORNADA' | 'INTERJORNADA' | 'ABSENCE'
  ): TimeDailySummary[] {
    if (filterType === 'ALL') return summaries;

    if (filterType === 'ONLY_INCONSISTENT') {
      return summaries.filter((s) => s.status === 'INCONSISTENT' || (s.inconsistencies && s.inconsistencies.length > 0));
    }

    return summaries.filter((s) => {
      const issues = this.classifyInconsistencies(s);
      switch (filterType) {
        case 'MISSING_PUNCH':
          return issues.includes('MISSING_PUNCH') || s.inconsistencies?.includes('MISSING_PUNCH');
        case 'INTRAJORNADA':
          return issues.includes('INTRAJORNADA_VIOLATION') || (s.intrajornada_violation_minutes ?? 0) > 0;
        case 'INTERJORNADA':
          return issues.includes('INTERJORNADA_VIOLATION') || (s.interjornada_violation_minutes ?? 0) > 0;
        case 'ABSENCE':
          return issues.includes('UNJUSTIFIED_ABSENCE') || (s.absence_minutes ?? 0) > 0;
        default:
          return true;
      }
    });
  }

  /**
   * Processa a deliberação de uma solicitação de ajuste de ponto
   */
  static processAdjustmentReview(
    adjustment: TimeEntryAdjustment,
    approved: boolean,
    reviewerId: string,
    reviewNotes?: string
  ): TimeEntryAdjustment {
    if (!reviewerId) {
      throw new Error('ID do revisor é obrigatório para deliberar sobre o ajuste.');
    }

    if (!approved && (!reviewNotes || reviewNotes.trim().length === 0)) {
      throw new Error('Justificativa é obrigatória para rejeitar um ajuste de ponto.');
    }

    return {
      ...adjustment,
      status: approved ? 'APPROVED' : 'REJECTED',
      approved_by: approved ? reviewerId : undefined,
      review_notes: reviewNotes || (approved ? 'Ajuste aprovado pelo gestor/DP' : undefined),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Processa a deliberação de contestação de espelho de ponto
   */
  static processContestReview(
    contest: TimesheetContest,
    approved: boolean,
    reviewerId: string,
    notes: string
  ): { contest: TimesheetContest; timesheetStatus: 'DRAFT' | 'PENDING_SIGNATURE' } {
    if (!reviewerId) {
      throw new Error('ID do revisor é obrigatório para deliberar sobre a contestação.');
    }
    if (!notes || notes.trim().length === 0) {
      throw new Error('Parecer do gestor/DP é obrigatório para deliberar sobre a contestação.');
    }

    const updatedContest: TimesheetContest = {
      ...contest,
      status: approved ? 'RESOLVED_ACCEPTED' : 'REJECTED',
      reviewed_by: reviewerId,
      review_notes: notes,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return {
      contest: updatedContest,
      timesheetStatus: approved ? 'DRAFT' : 'PENDING_SIGNATURE'
    };
  }

  /**
   * Processa a deliberação de solicitação de folga compensatória do Banco de Horas
   */
  static processTimeBankCompensationReview(
    request: TimeBankCompensationRequest,
    approved: boolean,
    reviewerId: string,
    notes?: string
  ): TimeBankCompensationRequest {
    if (!reviewerId) {
      throw new Error('ID do revisor é obrigatório.');
    }

    if (approved && request.minutes > request.current_balance_minutes) {
      throw new Error('Saldo de banco de horas insuficiente para compensar a folga solicitada.');
    }

    if (!approved && (!notes || notes.trim().length === 0)) {
      throw new Error('Justificativa é obrigatória para recusar a folga compensatória.');
    }

    return {
      ...request,
      status: approved ? 'APPROVED' : 'REJECTED',
      reviewed_by: reviewerId,
      review_notes: notes || (approved ? 'Folga compensatória autorizada.' : undefined)
    };
  }

  // =========================================================================
  // Integração com Supabase (Queries autenticadas)
  // =========================================================================

  /**
   * Busca dispositivos cadastrados
   */
  static async fetchDevices(tenantId: string, companyId?: string): Promise<TimeDevice[]> {
    let query = supabase
      .from('time_devices')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name');

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as TimeDevice[];
  }

  /**
   * Salva ou atualiza um dispositivo de ponto
   */
  static async saveDevice(device: Partial<TimeDevice>): Promise<TimeDevice> {
    const validation = this.validateDeviceConfig(device);
    if (!validation.valid) {
      throw new Error(validation.errors.join(' '));
    }

    if (device.id) {
      const { data, error } = await supabase
        .from('time_devices')
        .update({
          name: device.name,
          kind: device.kind,
          vendor: device.vendor,
          model: device.model,
          serial_number: device.serial_number,
          host: device.host,
          port: device.port,
          status: device.status ?? 'ACTIVE',
          updated_at: new Date().toISOString()
        })
        .eq('id', device.id)
        .select()
        .single();

      if (error) throw error;
      return data as TimeDevice;
    } else {
      const { data, error } = await supabase
        .from('time_devices')
        .insert({
          tenant_id: device.tenant_id,
          company_id: device.company_id,
          name: device.name,
          kind: device.kind,
          vendor: device.vendor,
          model: device.model,
          serial_number: device.serial_number,
          host: device.host,
          port: device.port,
          status: device.status ?? 'ACTIVE'
        })
        .select()
        .single();

      if (error) throw error;
      return data as TimeDevice;
    }
  }

  /**
   * Remove um dispositivo
   */
  static async deleteDevice(deviceId: string): Promise<void> {
    const { error } = await supabase.from('time_devices').delete().eq('id', deviceId);
    if (error) throw error;
  }

  /**
   * Busca histórico de arquivos AFD importados
   */
  static async fetchAfdFiles(tenantId: string, companyId?: string): Promise<AfdFileRecord[]> {
    let query = supabase
      .from('afd_files')
      .select(`
        id, tenant_id, company_id, device_id, file_name, file_hash,
        file_size_bytes, period_start, period_end, total_records,
        imported_records, duplicate_records, rejected_records, status,
        error_message, created_at,
        time_devices(name)
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((row: any) => ({
      ...row,
      device_name: row.time_devices?.name ?? 'Dispositivo Padrão'
    }));
  }

  /**
   * Busca resumos diários com inconsistências para tratamento
   */
  static async fetchDailySummaries(
    tenantId: string,
    filters: {
      companyId?: string;
      startDate?: string;
      endDate?: string;
      contractId?: string;
      onlyInconsistent?: boolean;
    }
  ): Promise<(TimeDailySummary & { worker_name?: string; position_name?: string })[]> {
    let query = supabase
      .from('time_daily_summary')
      .select(`
        *,
        employment_contracts!inner (
          id,
          company_id,
          workers (
            people (
              full_name
            )
          ),
          positions (
            title
          )
        )
      `)
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false });

    if (filters.companyId) {
      query = query.eq('employment_contracts.company_id', filters.companyId);
    }
    if (filters.startDate) {
      query = query.gte('date', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('date', filters.endDate);
    }
    if (filters.contractId) {
      query = query.eq('contract_id', filters.contractId);
    }
    if (filters.onlyInconsistent) {
      query = query.eq('status', 'INCONSISTENT');
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((row: any) => ({
      ...row,
      company_id: row.company_id ?? row.employment_contracts?.company_id,
      worker_name: row.employment_contracts?.workers?.people?.full_name ?? 'Colaborador',
      position_name: row.employment_contracts?.positions?.title ?? 'Geral'
    }));
  }

  /**
   * Salva solicitação ou ajuste manual de batida
   */
  static async saveAdjustment(
    adjustment: Omit<TimeEntryAdjustment, 'id' | 'created_at' | 'updated_at'>
  ): Promise<TimeEntryAdjustment> {
    const { data, error } = await supabase
      .from('time_entry_adjustments')
      .insert({
        tenant_id: adjustment.tenant_id,
        time_entry_id: adjustment.time_entry_id,
        contract_id: adjustment.contract_id,
        requested_timestamp: adjustment.requested_timestamp,
        entry_type: adjustment.entry_type,
        adjustment_reason: adjustment.adjustment_reason,
        status: adjustment.status,
        requested_by: adjustment.requested_by,
        approved_by: adjustment.approved_by
      })
      .select()
      .single();

    if (error) throw error;
    return data as TimeEntryAdjustment;
  }

  /**
   * Busca todas as aprovações pendentes (Ajustes, Contestações, Folgas de Banco)
   */
  static async fetchPendingApprovals(tenantId: string, companyId?: string): Promise<PendingApprovalsGroup> {
    // 1. Ajustes pendentes
    const { data: adjustmentsData, error: adjError } = await supabase
      .from('time_entry_adjustments')
      .select(`
        *,
        employment_contracts!inner (
          id,
          company_id,
          workers (
            people (
              full_name
            )
          )
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('status', 'PENDING_APPROVAL')
      .order('created_at', { ascending: false });

    if (adjError) throw adjError;

    let filteredAdjustments = (adjustmentsData || []).map((row: any) => ({
      id: row.id,
      tenant_id: row.tenant_id,
      time_entry_id: row.time_entry_id,
      contract_id: row.contract_id,
      worker_name: row.employment_contracts?.workers?.people?.full_name ?? 'Colaborador',
      requested_timestamp: row.requested_timestamp,
      entry_type: row.entry_type,
      adjustment_reason: row.adjustment_reason,
      status: row.status,
      requested_by: row.requested_by,
      approved_by: row.approved_by,
      created_at: row.created_at,
      _company_id: row.employment_contracts?.company_id
    }));

    if (companyId) {
      filteredAdjustments = filteredAdjustments.filter((a: any) => !a._company_id || a._company_id === companyId);
    }

    // 2. Contestações pendentes
    const { data: contestsData, error: contestError } = await supabase
      .from('timesheet_contests')
      .select(`
        *,
        employment_contracts!inner (
          id,
          company_id,
          workers (
            people (
              full_name
            )
          )
        ),
        timesheets (
          period_start,
          period_end
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false });

    if (contestError) throw contestError;

    let filteredContests = (contestsData || []).map((row: any) => {
      const pStart = row.timesheets?.period_start;
      const periodLabel = pStart
        ? new Date(pStart).toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })
        : 'Competência Atual';
      return {
        id: row.id,
        tenant_id: row.tenant_id,
        timesheet_id: row.timesheet_id,
        contract_id: row.contract_id,
        worker_id: row.worker_id,
        worker_name: row.employment_contracts?.workers?.people?.full_name ?? 'Colaborador',
        period_label: periodLabel,
        reason: row.reason,
        affected_dates: row.affected_dates || [],
        attachment_url: row.attachment_url,
        status: row.status,
        created_at: row.created_at,
        _company_id: row.employment_contracts?.company_id
      };
    });

    if (companyId) {
      filteredContests = filteredContests.filter((c: any) => !c._company_id || c._company_id === companyId);
    }

    // 3. Folgas de Banco de Horas pendentes (se houver transação tipo COMPENSATION_DAY_OFF em fila)
    const compensations: TimeBankCompensationRequest[] = [];

    const totalCount = filteredAdjustments.length + filteredContests.length + compensations.length;

    return {
      adjustments: filteredAdjustments,
      contests: filteredContests,
      compensations,
      totalCount
    };
  }

  /**
   * Busca colaboradores ativos para o seletor do Cartão de Ponto (com resiliência a schemas legados)
   */
  static async fetchWorkersForTimeManagement(
    tenantId: string,
    companyId?: string
  ): Promise<WorkerOption[]> {
    let data: any[] | null = null;

    // 1. Tentar query completa com overtime_regime
    try {
      const { data: fullData, error: fullError } = await supabase
        .from('workers')
        .select(`
          id,
          company_id,
          pis_pasep,
          people (
            id,
            full_name,
            cpf
          ),
          employment_contracts (
            id,
            status,
            company_id,
            overtime_regime,
            positions (
              title
            ),
            departments (
              name
            )
          )
        `)
        .eq('tenant_id', tenantId);

      if (!fullError && fullData) {
        data = fullData;
      } else {
        throw fullError;
      }
    } catch (err: any) {
      console.warn('Query completa falhou (provável ausência de overtime_regime). Acionando fallback resiliente:', err?.message);
      
      // 2. Fallback resiliente sem overtime_regime
      try {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('workers')
          .select(`
            id,
            company_id,
            pis_pasep,
            people (
              id,
              full_name,
              cpf
            ),
            employment_contracts (
              id,
              status,
              company_id,
              positions (
                title
              ),
              departments (
                name
              )
            )
          `)
          .eq('tenant_id', tenantId);

        if (!fallbackError && fallbackData) {
          data = fallbackData;
        } else {
          throw fallbackError;
        }
      } catch (fbErr: any) {
        console.warn('Fallback 2 falhou. Acionando fallback mínimo essencial:', fbErr?.message);
        
        // 3. Fallback mínimo essencial
        const { data: minimalData, error: minErr } = await supabase
          .from('workers')
          .select(`
            id,
            company_id,
            pis_pasep,
            people (
              id,
              full_name,
              cpf
            ),
            employment_contracts (
              id,
              status,
              company_id
            )
          `)
          .eq('tenant_id', tenantId);

        if (minErr) {
          console.error('Erro ao carregar colaboradores do banco:', minErr);
          throw minErr;
        }
        data = minimalData;
      }
    }

    const list: WorkerOption[] = [];
    (data || []).forEach((w: any) => {
      const contracts = Array.isArray(w.employment_contracts) ? w.employment_contracts : [];
      const activeContract = contracts.find((c: any) => c.status === 'ACTIVE') || contracts[0];
      
      const targetCompany = activeContract?.company_id || w.company_id;
      if (companyId && targetCompany && targetCompany !== companyId) {
        return;
      }

      const positionObj = Array.isArray(activeContract?.positions) ? activeContract.positions[0] : activeContract?.positions;
      const departmentObj = Array.isArray(activeContract?.departments) ? activeContract.departments[0] : activeContract?.departments;

      list.push({
        worker_id: w.id,
        contract_id: activeContract?.id || '',
        full_name: w.people?.full_name || 'Sem Nome',
        cpf: w.people?.cpf,
        position_title: positionObj?.title || 'Colaborador',
        department_name: departmentObj?.name,
        pis_pasep: w.pis_pasep,
        overtime_regime: activeContract?.overtime_regime || 'TIME_BANK'
      });
    });

    return list.sort((a, b) => a.full_name.localeCompare(b.full_name));
  }

  /**
   * Consolida o Cartão de Ponto Mensal do Colaborador (dia a dia de 1 a N)
   */
  static async fetchMonthlyTimesheet(params: {
    tenantId: string;
    workerId: string;
    contractId?: string;
    year: number;
    month: number;
  }): Promise<MonthlyTimesheetSummary> {
    const { tenantId, workerId, year, month } = params;

    // 1. Dados do colaborador e contrato
    const { data: workerData } = await supabase
      .from('workers')
      .select(`
        id,
        pis_pasep,
        people (
          full_name
        ),
        employment_contracts (
          id,
          status,
          work_schedule_id,
          positions (
            title
          ),
          work_schedules (
            name,
            weekly_hours,
            standard_tolerance
          )
        )
      `)
      .eq('id', workerId)
      .single();

    const workerName = workerData?.people?.full_name || 'Colaborador';
    const contracts = Array.isArray(workerData?.employment_contracts) ? workerData.employment_contracts : [];
    const contract = contracts.find((c: any) => c.id === params.contractId) || contracts[0];
    const contractId = contract?.id || '';
    const positionTitle = contract?.positions?.title || 'Geral';

    // 2. Intervalo do mês em horário de Brasília (UTC-3)
    const lastDay = new Date(year, month, 0).getDate();
    const startDateIso = `${year}-${String(month).padStart(2, '0')}-01T00:00:00-03:00`;
    const endDateIso = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59-03:00`;
    const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    // 3. Batidas brutas do relógio em time_punch_records
    const { data: punchesRaw } = await supabase
      .from('time_punch_records')
      .select('id, nsr, punched_at, source, record_type')
      .eq('tenant_id', tenantId)
      .eq('worker_id', workerId)
      .gte('punched_at', startDateIso)
      .lte('punched_at', endDateIso)
      .order('punched_at', { ascending: true });

    // 4. Ajustes/Abonos em time_entry_adjustments
    const { data: adjustmentsRaw } = await supabase
      .from('time_entry_adjustments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('contract_id', contractId)
      .gte('requested_timestamp', startDateIso)
      .lte('requested_timestamp', endDateIso);

    // 4.1 Identificar ajustes de deslocamento de jornada para o dia anterior (turnos noturnos)
    const shiftedPunchesMap: Record<string, { target_date: string; adjustment_id: string }> = {};
    (adjustmentsRaw || []).forEach((adj: any) => {
      if (adj.status === 'APPROVED' && adj.adjustment_reason?.includes('[SHIFT_PREVIOUS_DAY]')) {
        const punchIdMatch = adj.adjustment_reason.match(/punch_id:([a-zA-Z0-9_-]+)/);
        const targetDateMatch = adj.adjustment_reason.match(/target_date:([0-9]{4}-[0-9]{2}-[0-9]{2})/);
        if (punchIdMatch && targetDateMatch) {
          shiftedPunchesMap[punchIdMatch[1]] = {
            target_date: targetDateMatch[1],
            adjustment_id: adj.id
          };
        }
      }
    });

    // 5. Saldo do Banco de Horas
    let bankBalance = 0;
    if (contractId) {
      const { data: bankAcc } = await supabase
        .from('time_bank_accounts')
        .select('balance_minutes')
        .eq('contract_id', contractId)
        .eq('status', 'ACTIVE')
        .maybeSingle();
      if (bankAcc) {
        bankBalance = (bankAcc as any).balance_minutes ?? (bankAcc as any).current_balance_minutes ?? 0;
      }
    }

    // Mapear batidas por dia local de Brasília (America/Sao_Paulo - UTC-3)
    const punchesByDay: Record<string, MonthlyPunchItem[]> = {};
    (punchesRaw || []).forEach((p: any) => {
      const sp = formatPunchToSaoPaulo(p.punched_at);
      const shiftInfo = shiftedPunchesMap[p.id];
      const effectiveDate = shiftInfo ? shiftInfo.target_date : sp.date;
      const isShifted = !!shiftInfo;

      if (!punchesByDay[effectiveDate]) punchesByDay[effectiveDate] = [];
      punchesByDay[effectiveDate].push({
        id: p.id,
        nsr: p.nsr,
        time: sp.time,
        source: p.source,
        punched_at: p.punched_at,
        is_shifted: isShifted,
        original_date: sp.date,
        adjustment_id: shiftInfo?.adjustment_id
      });
    });

    // Mapear ajustes e abonos por dia local de Brasília
    const adjustmentsByDay: Record<string, any[]> = {};
    (adjustmentsRaw || []).forEach((adj: any) => {
      const sp = formatPunchToSaoPaulo(adj.requested_timestamp);
      if (!adjustmentsByDay[sp.date]) adjustmentsByDay[sp.date] = [];
      adjustmentsByDay[sp.date].push(adj);
    });

    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const dayNamesFull = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

    const days: MonthlyDayTimesheet[] = [];
    let totWorked = 0;
    let totExpected = 0;
    let totHe50 = 0;
    let totHe100 = 0;
    let totDelay = 0;
    let totAbsence = 0;
    let totJustified = 0;

    for (let day = 1; day <= lastDay; day++) {
      const dateObj = new Date(year, month - 1, day);
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeekIndex = dateObj.getDay();
      const isWeekend = dayOfWeekIndex === 0 || dayOfWeekIndex === 6;
      const expectedMinutes = isWeekend ? 0 : 480; // 8h em dias úteis
      const expectedSchedule = isWeekend ? 'Folga / DSR' : '08:00 - 12:00 / 13:00 - 17:00 (8h)';

      const dayPunches = punchesByDay[dateStr] || [];
      const dayAdjustments = adjustmentsByDay[dateStr] || [];

      // Ordenar batidas do dia:
      // Se a batida foi deslocada para o dia anterior (is_shifted) e seu horário é na madrugada (h < 12),
      // somamos 1440 minutos para que ela fique no fim da jornada iniciada na noite do dia anterior!
      dayPunches.sort((a, b) => {
        const [ha, ma] = a.time.split(':').map(Number);
        const [hb, mb] = b.time.split(':').map(Number);
        const minA = a.is_shifted && ha < 12 ? (ha + 24) * 60 + ma : ha * 60 + ma;
        const minB = b.is_shifted && hb < 12 ? (hb + 24) * 60 + mb : hb * 60 + mb;
        return minA - minB;
      });

      // Calcular pares de batidas do dia
      let workedMin = 0;
      let breakMin = 0;
      let hasMissingPunch = false;

      if (dayPunches.length >= 2) {
        const punchMinutes = dayPunches.map((p) => {
          const [h, m] = p.time.split(':').map(Number);
          return p.is_shifted && h < 12 ? (h + 24) * 60 + m : h * 60 + m;
        });

        for (let i = 0; i < punchMinutes.length - 1; i += 2) {
          workedMin += Math.max(0, punchMinutes[i + 1] - punchMinutes[i]);
          if (i + 2 < punchMinutes.length) {
            breakMin += Math.max(0, punchMinutes[i + 2] - punchMinutes[i + 1]);
          }
        }

        if (punchMinutes.length % 2 !== 0) {
          hasMissingPunch = true;
        }
      } else if (dayPunches.length === 1) {
        hasMissingPunch = true;
      }

      // Adicional Noturno: minutos entre 22h e 05h
      let nightMin = 0;
      dayPunches.forEach((p) => {
        const [h] = p.time.split(':').map(Number);
        if (h >= 22 || h < 5) nightMin += 30; // estimativa proporcional
      });

      // Cálculo de Horas Extras e Atrasos
      let he50 = 0;
      let he100 = 0;
      let delayMin = 0;
      let absenceMin = 0;

      if (isWeekend) {
        if (workedMin > 0) {
          if (dayOfWeekIndex === 0) {
            he100 = workedMin; // Domingo trabalhado = HE 100%
          } else {
            he50 = workedMin;
          }
        }
      } else {
        totExpected += expectedMinutes;
        if (workedMin > expectedMinutes) {
          he50 = workedMin - expectedMinutes;
        } else if (workedMin > 0 && workedMin < expectedMinutes) {
          delayMin = expectedMinutes - workedMin;
        } else if (workedMin === 0) {
          absenceMin = expectedMinutes;
        }
      }

      // Checar abonos
      const approvedAbono = dayAdjustments.find((a: any) => a.status === 'APPROVED');
      let status: MonthlyDayTimesheet['status'] = 'REGULAR';
      let justification = '';

      if (approvedAbono) {
        status = 'JUSTIFIED';
        justification = approvedAbono.adjustment_reason || 'Abono autorizado';
        absenceMin = 0;
        delayMin = 0;
        totJustified += expectedMinutes;
      } else if (hasMissingPunch) {
        status = 'MISSING_PUNCH';
      } else if (absenceMin > 0) {
        status = 'ABSENCE';
      } else if (delayMin > 10) {
        status = 'DELAY';
      } else if (isWeekend && workedMin === 0) {
        status = 'DAY_OFF';
      }

      const balanceMin = (workedMin + (approvedAbono ? expectedMinutes : 0)) - expectedMinutes;

      totWorked += workedMin;
      totHe50 += he50;
      totHe100 += he100;
      totDelay += delayMin;
      totAbsence += absenceMin;

      days.push({
        date: dateStr,
        dayOfMonth: day,
        dayOfWeek: dayNames[dayOfWeekIndex],
        dayOfWeekFull: dayNamesFull[dayOfWeekIndex],
        isWeekend,
        expected_schedule: expectedSchedule,
        expected_minutes: expectedMinutes,
        punches: dayPunches,
        worked_minutes: workedMin,
        break_minutes: breakMin,
        overtime_50_minutes: he50,
        overtime_100_minutes: he100,
        night_shift_minutes: nightMin,
        delay_minutes: delayMin,
        absence_minutes: absenceMin,
        balance_minutes: balanceMin,
        status,
        inconsistency_text: hasMissingPunch
          ? 'Marcação ímpar (falta batida de retorno ou saída)'
          : absenceMin > 0
          ? 'Falta integral não justificada'
          : delayMin > 10
          ? `Atraso apurado (${delayMin} min)`
          : undefined,
        justification
      });
    }

    return {
      worker_id: workerId,
      worker_name: workerName,
      contract_id: contractId,
      position_title: positionTitle,
      year,
      month,
      month_label: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
      total_worked_minutes: totWorked,
      total_expected_minutes: totExpected,
      total_overtime_50_minutes: totHe50,
      total_overtime_100_minutes: totHe100,
      total_delay_minutes: totDelay,
      total_absence_minutes: totAbsence,
      total_justified_minutes: totJustified,
      time_bank_balance_minutes: bankBalance,
      days
    };
  }

  /**
   * Inclui marcação avulsa manual com justificativa legal (Portaria 671)
   */
  static async addManualPunch(params: {
    tenantId: string;
    companyId?: string;
    workerId: string;
    contractId?: string;
    date: string; // 'YYYY-MM-DD'
    time: string; // 'HH:mm'
    entryType: 'IN' | 'OUT' | 'BREAK_START' | 'BREAK_END';
    reason: string;
    userName?: string;
  }): Promise<void> {
    const { tenantId, companyId, workerId, contractId, date, time, entryType, reason, userName } = params;

    const punchIso = `${date}T${time}:00-03:00`;

    // 1. Obter próximo NSR sequencial
    const { data: maxNsrData } = await supabase
      .from('time_punch_records')
      .select('nsr')
      .eq('tenant_id', tenantId)
      .order('nsr', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextNsr = (maxNsrData?.nsr ? Number(maxNsrData.nsr) : 90000) + 1;

    // 2. Inserir em time_punch_records como registro MANUAL
    const { data: punchRec, error: punchErr } = await supabase
      .from('time_punch_records')
      .insert({
        tenant_id: tenantId,
        company_id: companyId || null,
        worker_id: workerId,
        contract_id: contractId || null,
        nsr: nextNsr,
        record_type: 3,
        punched_at: punchIso,
        source: 'MANUAL',
        raw_line: `[INCLUSÃO MANUAL PORTARIA 671] Tipo: ${entryType} | Motivo: ${reason} | Operador: ${userName || 'DP'}`,
        receipt_code: `MAN-${Date.now().toString(36).toUpperCase()}`
      })
      .select('id')
      .single();

    if (punchErr) throw punchErr;

    // 3. Registrar em time_entry_adjustments como aprovado
    if (contractId) {
      await supabase.from('time_entry_adjustments').insert({
        tenant_id: tenantId,
        contract_id: contractId,
        requested_timestamp: punchIso,
        entry_type: entryType,
        adjustment_reason: `[INCLUSÃO MANUAL] ${reason}`,
        status: 'APPROVED',
        requested_by: userName || 'DP',
        approved_by: userName || 'DP',
        review_notes: `Inserido manualmente com NSR ${nextNsr}`
      });
    }
  }

  /**
   * Salva abono ou justificativa legal para o dia
   */
  static async saveDayAbono(params: {
    tenantId: string;
    contractId: string;
    workerId: string;
    date: string;
    reason: string;
    abonoType: string;
    userName?: string;
  }): Promise<void> {
    const { tenantId, contractId, date, reason, abonoType, userName } = params;

    const abonoTimestamp = `${date}T08:00:00Z`;

    const { error } = await supabase.from('time_entry_adjustments').insert({
      tenant_id: tenantId,
      contract_id: contractId,
      requested_timestamp: abonoTimestamp,
      entry_type: 'IN',
      adjustment_reason: `[ABONO: ${abonoType}] ${reason}`,
      status: 'APPROVED',
      requested_by: userName || 'DP',
      approved_by: userName || 'DP',
      review_notes: `Abono deferido: ${abonoType}`
    });

    if (error) throw error;
  }

  /**
   * Aloca uma batida na jornada do dia anterior (para turnos noturnos que viram a meia-noite)
   */
  static async shiftPunchToPreviousDay(params: {
    tenantId: string;
    contractId: string;
    punchId: string;
    punchTime: string;
    punchedAt: string;
    currentDate: string;
    previousDate: string;
    userName?: string;
  }): Promise<void> {
    const { tenantId, contractId, punchId, punchTime, punchedAt, currentDate, previousDate, userName } = params;

    const reason = `[SHIFT_PREVIOUS_DAY] punch_id:${punchId}|source_date:${currentDate}|target_date:${previousDate}|time:${punchTime}`;

    // 1. Remover qualquer ajuste anterior dessa batida para evitar duplicidade
    await supabase
      .from('time_entry_adjustments')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('contract_id', contractId)
      .ilike('adjustment_reason', `%punch_id:${punchId}%`);

    // 2. Inserir novo ajuste aprovado pelo DP
    const { error } = await supabase.from('time_entry_adjustments').insert({
      tenant_id: tenantId,
      contract_id: contractId,
      requested_timestamp: punchedAt,
      entry_type: 'OUT',
      adjustment_reason: reason,
      status: 'APPROVED',
      requested_by: userName || 'DP',
      approved_by: userName || 'DP',
      review_notes: `Batida das ${punchTime} alocada na jornada de encerramento do dia anterior (${previousDate}) por solicitação do DP.`
    });

    if (error) throw error;
  }

  /**
   * Desfaz a alocação da batida no dia anterior, retornando-a para o dia civil original
   */
  static async undoShiftPunch(params: {
    tenantId: string;
    contractId: string;
    punchId: string;
    adjustmentId?: string;
  }): Promise<void> {
    const { tenantId, contractId, punchId, adjustmentId } = params;

    let query = supabase
      .from('time_entry_adjustments')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('contract_id', contractId);

    if (adjustmentId) {
      query = query.eq('id', adjustmentId);
    } else {
      query = query.ilike('adjustment_reason', `%punch_id:${punchId}%`);
    }

    const { error } = await query;
    if (error) throw error;
  }

  /**
   * Transforma a apuração do Ponto em Lançamentos da Folha de Pagamento e/ou Créditos no Banco de Horas
   */
  static async integrateTimesheetToPayrollAndBank(params: {
    tenantId: string;
    companyId?: string;
    year: number;
    month: number;
    payrollPeriodId?: string;
    destiny?: 'HYBRID' | 'PAYROLL_ONLY' | 'BANK_ONLY';
    contractIdFilter?: string;
    userName?: string;
    monthlyBankCapHours?: number | null;
  }): Promise<IntegrateTimesheetResult> {
    const {
      tenantId,
      companyId,
      year,
      month,
      destiny = 'HYBRID',
      contractIdFilter,
      userName = 'Operador DP',
      monthlyBankCapHours
    } = params;

    // 1. Identificar ou provisionar o período de folha (payroll_periods)
    let periodId = params.payrollPeriodId;
    if (!periodId) {
      let pQuery = supabase
        .from('payroll_periods')
        .select('id, status')
        .eq('tenant_id', tenantId)
        .eq('year', year)
        .eq('month', month)
        .eq('type', 'MONTHLY');

      if (companyId) {
        pQuery = pQuery.eq('company_id', companyId);
      }

      const { data: pList } = await pQuery;
      if (pList && pList.length > 0) {
        periodId = pList[0].id;
      } else {
        // Criar o período mensal caso ainda não exista
        const { data: newPeriod, error: pCreateErr } = await supabase
          .from('payroll_periods')
          .insert({
            tenant_id: tenantId,
            company_id: companyId || null,
            month,
            year,
            type: 'MONTHLY',
            status: 'DRAFT'
          })
          .select('id')
          .single();

        if (pCreateErr) throw new Error('Não foi possível localizar ou criar a competência da folha: ' + pCreateErr.message);
        periodId = newPeriod.id;
      }
    }

    // 2. Buscar catálogo de rubricas ativas do tenant
    const { data: rubricsData, error: rErr } = await supabase
      .from('payroll_rubrics')
      .select('id, code, name, type')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (rErr) throw new Error('Falha ao consultar rubricas: ' + rErr.message);

    const rubricByCode: Record<string, { id: string; code: string; name: string }> = {};
    (rubricsData || []).forEach((r: any) => {
      rubricByCode[r.code] = { id: r.id, code: r.code, name: r.name };
    });

    // 3. Buscar colaboradores para integração
    const workers = await this.fetchWorkersForTimeManagement(tenantId, companyId);
    const targetWorkers = contractIdFilter
      ? workers.filter((w) => w.contract_id === contractIdFilter)
      : workers;

    if (targetWorkers.length === 0) {
      throw new Error('Nenhum colaborador localizado para integração nesta competência.');
    }

    let totalEventsCreated = 0;
    let totalBankCreditsMinutes = 0;
    let totalPayrollHeHours = 0;
    let totalNightShiftHours = 0;
    let totalBankCapOverflowHours = 0;
    let contractsWithOverflow = 0;
    const summaryList: IntegrateTimesheetResult['summary'] = [];

    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const periodDateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

    // 4. Processar cada colaborador
    for (const worker of targetWorkers) {
      if (!worker.contract_id) continue;

      // Apurar espelho do mês
      const timesheet = await this.fetchMonthlyTimesheet({
        tenantId,
        workerId: worker.worker_id,
        contractId: worker.contract_id,
        year,
        month
      });

      // Calcular horas de adicional noturno acumuladas nos dias
      let totalNightMinutes = 0;
      timesheet.days.forEach((d) => {
        d.punches.forEach((p) => {
          const [h] = p.time.split(':').map(Number);
          if (h >= 22 || h < 5) totalNightMinutes += 30; // cálculo padrão proporcional noturno
        });
      });

      const he50Min = timesheet.total_overtime_50_minutes;
      const he100Min = timesheet.total_overtime_100_minutes;
      const totalHeMin = he50Min + he100Min;
      const delaysMin = timesheet.total_delay_minutes;
      const absenceMin = timesheet.total_absence_minutes;

      const he50Hours = Math.round((he50Min / 60) * 100) / 100;
      const he100Hours = Math.round((he100Min / 60) * 100) / 100;
      const nightHours = Math.round((totalNightMinutes / 60) * 100) / 100;
      const delaysHours = Math.round((delaysMin / 60) * 100) / 100;
      const absencesDays = absenceMin > 0 ? Math.max(1, Math.round(absenceMin / 480)) : 0;

      // TB-01: Regime de compensação soberano do contrato individual
      const contractRegime = worker.overtime_regime || 'TIME_BANK';
      let effectiveDestiny: 'TIME_BANK' | 'OVERTIME_PAYROLL' | 'HYBRID' = contractRegime;

      if (params.destiny === 'PAYROLL_ONLY') {
        effectiveDestiny = 'OVERTIME_PAYROLL';
      } else if (params.destiny === 'BANK_ONLY') {
        effectiveDestiny = 'TIME_BANK';
      }

      const isBankOnly = effectiveDestiny === 'TIME_BANK';
      const isHybrid = effectiveDestiny === 'HYBRID';
      const isPayrollOnly = effectiveDestiny === 'OVERTIME_PAYROLL';

      // Verificar se o contrato possui conta ativa de Banco de Horas
      const { data: existingAccount } = await supabase
        .from('time_bank_accounts')
        .select('*')
        .eq('contract_id', worker.contract_id)
        .eq('status', 'ACTIVE')
        .maybeSingle();

      const shouldUseBank = isBankOnly || isHybrid;

      let bankCreditedMinutes = 0;

      // TB-04.3: Análise do Teto Mensal de Acúmulo no Banco
      const capAnalysis = TimeBankService.calculateMonthlyCapOverflow({
        overtime50Minutes: he50Min,
        overtime100Minutes: he100Min,
        monthlyCapHours: monthlyBankCapHours,
        isHybrid
      });

      // A) Destino Banco de Horas
      if (shouldUseBank) {
        let accountId = existingAccount?.id;
        let currentBalance = existingAccount?.balance_minutes || 0;

        // Se não tiver conta, provisiona conta de Acordo Individual (CLT Art. 59 §5º, 6 meses)
        if (!accountId) {
          const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
          const endDateObj = new Date(year, month - 1 + 6, 0);
          const endDate = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}`;

          const { data: newAcc, error: accErr } = await supabase
            .from('time_bank_accounts')
            .insert({
              tenant_id: tenantId,
              contract_id: worker.contract_id,
              balance_minutes: 0,
              start_date: startDate,
              end_date: endDate,
              status: 'ACTIVE',
              policy_type: 'ACORDO_INDIVIDUAL',
              validity_months: 6,
              expiration_rule: 'PAY_AS_OVERTIME'
            })
            .select('id')
            .single();

          if (!accErr && newAcc) {
            accountId = newAcc.id;
          }
        }

        if (accountId) {
          // O crédito no banco respeita o teto mensal calculado
          const minutesToCreditInBank = capAnalysis.bankMinutes;

          // Creditar Horas Extras no Banco de Horas
          if (minutesToCreditInBank > 0) {
            const description = capAnalysis.hasCap && capAnalysis.overflowMinutes > 0
              ? `Crédito de horas extras apuradas no ponto (limitado ao teto mensal de ${monthlyBankCapHours}h00; ${Math.round(capAnalysis.overflowMinutes / 60 * 100) / 100}h transbordaram para folha)`
              : `Crédito de horas extras apuradas no ponto (${timesheet.month_label})`;

            await supabase.from('time_bank_transactions').insert({
              tenant_id: tenantId,
              account_id: accountId,
              date: periodDateStr,
              minutes: minutesToCreditInBank,
              transaction_type: 'OVERTIME',
              description,
              payroll_period_id: periodId
            });

            currentBalance += minutesToCreditInBank;
            bankCreditedMinutes += minutesToCreditInBank;
            totalBankCreditsMinutes += minutesToCreditInBank;
          }

          // Debitar atrasos significativos no Banco de Horas
          if (delaysMin > 10) {
            await supabase.from('time_bank_transactions').insert({
              tenant_id: tenantId,
              account_id: accountId,
              date: periodDateStr,
              minutes: -delaysMin,
              transaction_type: 'DELAY',
              description: `Débito de atrasos apurados no ponto (${timesheet.month_label})`,
              payroll_period_id: periodId
            });
            currentBalance -= delaysMin;
          }

          // Atualizar saldo da conta
          await supabase
            .from('time_bank_accounts')
            .update({
              balance_minutes: currentBalance,
              updated_at: new Date().toISOString()
            })
            .eq('id', accountId);
        }
      }

      // B) Destino Folha de Pagamento (payroll_variable_events)
      // 1. Limpar eventos anteriores de integração do ponto para este contrato e período (idempotência)
      await supabase
        .from('payroll_variable_events')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('period_id', periodId)
        .eq('contract_id', worker.contract_id)
        .ilike('reference', '%INTEGRAÇÃO_PONTO%');

      const eventsToInsert: any[] = [];

      // TB-04.3: Horas extras 50% em folha:
      // Se for OVERTIME_PAYROLL recebe tudo; se usar banco recebe o transbordo do teto (overflow50Hours)
      const effectiveHe50Hours = isPayrollOnly
        ? he50Hours
        : (shouldUseBank ? capAnalysis.overflow50Hours : 0);

      if (effectiveHe50Hours > 0 && rubricByCode['150']) {
        const isOverflow = shouldUseBank && capAnalysis.overflow50Hours > 0;
        eventsToInsert.push({
          tenant_id: tenantId,
          period_id: periodId,
          contract_id: worker.contract_id,
          rubric_id: rubricByCode['150'].id,
          quantity: effectiveHe50Hours,
          amount: 0,
          reference: isOverflow
            ? `INTEGRAÇÃO_PONTO: HE 50% (Transbordo Teto Banco: ${effectiveHe50Hours}h)`
            : `INTEGRAÇÃO_PONTO: HE 50% (${effectiveHe50Hours}h)`
        });
        totalPayrollHeHours += effectiveHe50Hours;
      }

      // TB-04.3: Horas extras 100% em folha:
      // Se for OVERTIME_PAYROLL ou HYBRID recebe normal; se for TIME_BANK recebe o transbordo do teto (overflow100Hours)
      const effectiveHe100Hours = (isPayrollOnly || isHybrid)
        ? he100Hours
        : (shouldUseBank ? capAnalysis.overflow100Hours : 0);

      if (effectiveHe100Hours > 0 && rubricByCode['160']) {
        const isOverflow = isBankOnly && capAnalysis.overflow100Hours > 0;
        eventsToInsert.push({
          tenant_id: tenantId,
          period_id: periodId,
          contract_id: worker.contract_id,
          rubric_id: rubricByCode['160'].id,
          quantity: effectiveHe100Hours,
          amount: 0,
          reference: isOverflow
            ? `INTEGRAÇÃO_PONTO: HE 100% (Transbordo Teto Banco: ${effectiveHe100Hours}h)`
            : `INTEGRAÇÃO_PONTO: HE 100% (${effectiveHe100Hours}h)`
        });
        totalPayrollHeHours += effectiveHe100Hours;
      }

      if (capAnalysis.hasCap && capAnalysis.overflowMinutes > 0) {
        totalBankCapOverflowHours += (capAnalysis.overflow50Hours + capAnalysis.overflow100Hours);
        contractsWithOverflow++;
      }

      // Atrasos em folha: apenas se for OVERTIME_PAYROLL
      if (isPayrollOnly && delaysHours > 0 && rubricByCode['802']) {
        eventsToInsert.push({
          tenant_id: tenantId,
          period_id: periodId,
          contract_id: worker.contract_id,
          rubric_id: rubricByCode['802'].id,
          quantity: delaysHours,
          amount: 0,
          reference: `INTEGRAÇÃO_PONTO: Atrasos (${delaysHours}h)`
        });
      }

      // Adicional Noturno (cód 301): SEMPRE vai para folha de pagamento (CLT art. 73 e Súmula 60 TST)
      if (nightHours > 0 && rubricByCode['301']) {
        eventsToInsert.push({
          tenant_id: tenantId,
          period_id: periodId,
          contract_id: worker.contract_id,
          rubric_id: rubricByCode['301'].id,
          quantity: nightHours,
          amount: 0,
          reference: `INTEGRAÇÃO_PONTO: Adic. Noturno (${nightHours}h)`
        });
        totalNightShiftHours += nightHours;
      }

      // Faltas injustificadas (cód 801): Se houver faltas sem abono, lança na folha
      if (absencesDays > 0 && rubricByCode['801']) {
        eventsToInsert.push({
          tenant_id: tenantId,
          period_id: periodId,
          contract_id: worker.contract_id,
          rubric_id: rubricByCode['801'].id,
          quantity: absencesDays,
          amount: 0,
          reference: `INTEGRAÇÃO_PONTO: Faltas (${absencesDays}d)`
        });
      }

      if (eventsToInsert.length > 0) {
        const { error: insErr } = await supabase.from('payroll_variable_events').insert(eventsToInsert);
        if (!insErr) {
          totalEventsCreated += eventsToInsert.length;
        }
      }

      summaryList.push({
        worker_name: worker.full_name,
        he50_hours: he50Hours,
        he100_hours: he100Hours,
        night_hours: nightHours,
        bank_credited_minutes: bankCreditedMinutes,
        delays_hours: delaysHours,
        absences_days: absencesDays,
        bank_cap_applied_hours: capAnalysis.hasCap ? (monthlyBankCapHours || undefined) : undefined,
        overflow_he_hours: capAnalysis.hasCap && capAnalysis.overflowMinutes > 0
          ? (capAnalysis.overflow50Hours + capAnalysis.overflow100Hours)
          : undefined
      });
    }

    // 5. Registrar fechamento em time_period_closures
    const closurePayload = {
      tenant_id: tenantId,
      company_id: companyId || null,
      payroll_period_id: periodId,
      period_start: `${year}-${String(month).padStart(2, '0')}-01`,
      period_end: periodDateStr,
      status: 'CLOSED',
      total_contracts: targetWorkers.length,
      total_events_generated: totalEventsCreated,
      summary: {
        total_payroll_he_hours: totalPayrollHeHours,
        total_bank_credits_minutes: totalBankCreditsMinutes,
        total_night_hours: totalNightShiftHours,
        total_bank_cap_overflow_hours: totalBankCapOverflowHours,
        contracts_with_overflow: contractsWithOverflow
      },
      closed_by: userName,
      closed_at: new Date().toISOString()
    };

    await supabase.from('time_period_closures').insert(closurePayload);

    return {
      success: true,
      total_contracts_processed: targetWorkers.length,
      total_events_created: totalEventsCreated,
      total_bank_credits_minutes: totalBankCreditsMinutes,
      total_payroll_he_hours: Math.round(totalPayrollHeHours * 100) / 100,
      total_night_shift_hours: Math.round(totalNightShiftHours * 100) / 100,
      total_bank_cap_overflow_hours: Math.round(totalBankCapOverflowHours * 100) / 100,
      contracts_with_overflow: contractsWithOverflow,
      summary: summaryList
    };
  }

  /**
   * Abona e compensa ocorrências de jornada (atrasos ou faltas) consumindo saldo positivo do banco de horas (TB-02).
   * Previne descontos indevidos na folha de pagamento (rubricas 801/802) e perda do DSR.
   */
  static async compensateTimesheetOccurrence(params: {
    tenantId: string;
    contractId: string;
    date: string;
    occurrenceType: 'DELAY' | 'ABSENCE';
    minutes: number;
    allowPartial?: boolean;
    justification?: string;
    userName?: string;
  }): Promise<{
    success: boolean;
    compensated_minutes: number;
    remaining_occurrence_minutes: number;
    remaining_balance_minutes: number;
    message: string;
  }> {
    const {
      tenantId,
      contractId,
      date,
      occurrenceType,
      minutes,
      allowPartial = false,
      justification = 'Compensação aprovada pelo gestor',
      userName = 'Gestor DP'
    } = params;

    if (minutes <= 0) {
      throw new Error('A quantidade de minutos para compensação deve ser maior que zero.');
    }

    // 1. Localizar conta ativa de Banco de Horas do colaborador
    const { data: account, error: accErr } = await supabase
      .from('time_bank_accounts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('contract_id', contractId)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (accErr) throw new Error('Falha ao consultar banco de horas: ' + accErr.message);
    if (!account) {
      throw new Error('O colaborador não possui conta ativa de Banco de Horas vinculada ao contrato.');
    }

    const currentBalance = account.balance_minutes || 0;
    if (currentBalance <= 0) {
      throw new Error(`Saldo insuficiente no banco de horas. Saldo atual: ${currentBalance} min.`);
    }

    if (minutes > currentBalance && !allowPartial) {
      throw new Error(
        `Saldo insuficiente para compensação integral. Solicitado: ${minutes} min, disponível: ${currentBalance} min.`
      );
    }

    const compensatedMinutes = Math.min(minutes, currentBalance);
    const remainingOccurrenceMinutes = minutes - compensatedMinutes;
    const remainingBalanceMinutes = currentBalance - compensatedMinutes;

    const txType = occurrenceType === 'DELAY' ? 'COMPENSATION_DELAY' : 'COMPENSATION_ABSENCE';
    const txDesc = `[${userName}] ${justification} (Compensados ${compensatedMinutes} min de ${occurrenceType === 'DELAY' ? 'atraso' : 'falta'})`;

    // 2. Gravar transação de compensação no banco de horas
    const { error: txErr } = await supabase.from('time_bank_transactions').insert({
      tenant_id: tenantId,
      account_id: account.id,
      date,
      minutes: -compensatedMinutes,
      transaction_type: txType,
      description: txDesc
    });

    if (txErr) throw new Error('Falha ao registrar transação no banco de horas: ' + txErr.message);

    // 3. Atualizar saldo da conta de banco de horas
    const { error: updErr } = await supabase
      .from('time_bank_accounts')
      .update({
        balance_minutes: remainingBalanceMinutes,
        updated_at: new Date().toISOString()
      })
      .eq('id', account.id);

    if (updErr) throw new Error('Falha ao atualizar saldo do banco de horas: ' + updErr.message);

    // 4. Se existir resumo diário (time_daily_summary) para esta data, ajustar para prevenir desconto na folha
    const { data: dailySummary } = await supabase
      .from('time_daily_summary')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('contract_id', contractId)
      .eq('date', date)
      .single();

    if (dailySummary) {
      const summaryUpdate: any = {
        updated_at: new Date().toISOString()
      };

      if (occurrenceType === 'DELAY') {
        summaryUpdate.delay_minutes = Math.max(0, (dailySummary.delay_minutes || 0) - compensatedMinutes);
      } else {
        summaryUpdate.absence_minutes = Math.max(0, (dailySummary.absence_minutes || 0) - compensatedMinutes);
      }

      // Se todas as pendências foram zeradas, regulariza o status do dia
      const remainingDelays = summaryUpdate.delay_minutes ?? dailySummary.delay_minutes ?? 0;
      const remainingAbsences = summaryUpdate.absence_minutes ?? dailySummary.absence_minutes ?? 0;
      const hasOtherIssues =
        (dailySummary.intrajornada_violation_minutes || 0) > 0 ||
        (dailySummary.interjornada_violation_minutes || 0) > 0 ||
        (dailySummary.inconsistencies && dailySummary.inconsistencies.length > 0);

      if (remainingDelays === 0 && remainingAbsences === 0 && !hasOtherIssues) {
        summaryUpdate.status = 'REGULAR';
      }

      await supabase
        .from('time_daily_summary')
        .update(summaryUpdate)
        .eq('id', dailySummary.id);
    }

    return {
      success: true,
      compensated_minutes: compensatedMinutes,
      remaining_occurrence_minutes: remainingOccurrenceMinutes,
      remaining_balance_minutes: remainingBalanceMinutes,
      message: `Sucesso: ${compensatedMinutes} minutos compensados com o saldo do Banco de Horas. Saldo remanescente: ${remainingBalanceMinutes} min.`
    };
  }

  /**
   * Lança saldo inicial / legado de banco de horas (TB-03).
   * Tenta acionar a RPC atômica register_time_bank_initial_balance;
   * se a RPC não existir no Postgres, executa fallback resiliente local via Supabase.
   */
  static async registerInitialBalance(params: {
    tenantId: string;
    contractId: string;
    cutoffDate: string;
    minutes: number;
    justification: string;
    policyType?: TimeBankPolicyType;
    validityMonths?: number;
    companyId?: string;
    userName?: string;
  }): Promise<{
    success: boolean;
    account_id: string;
    transaction_id?: string;
    final_balance_minutes: number;
    message: string;
  }> {
    const {
      tenantId,
      contractId,
      cutoffDate,
      minutes,
      justification,
      policyType = 'ACORDO_INDIVIDUAL',
      validityMonths = 6,
      companyId,
      userName = 'Gestor DP'
    } = params;

    if (!contractId) {
      throw new Error('ID do contrato é obrigatório para lançar saldo inicial.');
    }
    if (!cutoffDate) {
      throw new Error('Data de corte é obrigatória para lançar saldo inicial.');
    }
    if (!justification || justification.trim().length < 3) {
      throw new Error('Justificativa auditável de origem é obrigatória.');
    }

    const desc = `[${userName}] ${justification.trim()}`;

    // 1. Tentar executar via RPC atômica no banco de dados
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('register_time_bank_initial_balance', {
        p_tenant_id: tenantId,
        p_contract_id: contractId,
        p_cutoff_date: cutoffDate,
        p_minutes: minutes,
        p_justification: desc,
        p_policy_type: policyType,
        p_validity_months: validityMonths,
        p_company_id: companyId || null
      });

      if (!rpcError && rpcData && rpcData.length > 0) {
        const row = rpcData[0];
        return {
          success: true,
          account_id: row.account_id,
          transaction_id: row.transaction_id,
          final_balance_minutes: row.final_balance_minutes,
          message: row.message || 'Saldo inicial lançado com sucesso via RPC.'
        };
      }
    } catch (e) {
      console.warn('Falha na RPC register_time_bank_initial_balance, acionando fallback resiliente:', e);
    }

    // 2. Fallback resiliente: queries diretas no Supabase
    // 2.1 Buscar conta ativa existente
    const { data: existingAccount, error: accErr } = await supabase
      .from('time_bank_accounts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('contract_id', contractId)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (accErr) {
      throw new Error('Erro ao consultar banco de horas: ' + accErr.message);
    }

    let accountId = existingAccount?.id;
    let currentBalance = existingAccount?.balance_minutes || 0;

    // 2.2 Se não existir conta ativa, provisionar nova conta
    if (!accountId) {
      const calculatedEndDate = new Date(cutoffDate);
      calculatedEndDate.setMonth(calculatedEndDate.getMonth() + validityMonths);
      calculatedEndDate.setDate(calculatedEndDate.getDate() - 1);
      const endDateStr = calculatedEndDate.toISOString().split('T')[0];

      const { data: newAcc, error: createErr } = await supabase
        .from('time_bank_accounts')
        .insert({
          tenant_id: tenantId,
          contract_id: contractId,
          balance_minutes: 0,
          start_date: cutoffDate,
          end_date: endDateStr,
          status: 'ACTIVE',
          policy_type: policyType,
          validity_months: validityMonths,
          expiration_rule: 'PAY_AS_OVERTIME',
          warning_days_before_expiration: 30,
          payout_rubric_code: '152'
        })
        .select()
        .single();

      if (createErr || !newAcc) {
        throw new Error('Falha ao provisionar conta de banco de horas: ' + (createErr?.message || ''));
      }

      accountId = newAcc.id;
      currentBalance = 0;
    }

    const finalBalance = currentBalance + minutes;

    // 2.3 Gravar transação INITIAL_BALANCE
    const { data: newTx, error: txErr } = await supabase
      .from('time_bank_transactions')
      .insert({
        tenant_id: tenantId,
        account_id: accountId,
        date: cutoffDate,
        minutes,
        transaction_type: 'INITIAL_BALANCE',
        description: desc
      })
      .select()
      .single();

    if (txErr) {
      throw new Error('Falha ao registrar transação de saldo inicial: ' + txErr.message);
    }

    // 2.4 Atualizar saldo da conta
    const { error: updErr } = await supabase
      .from('time_bank_accounts')
      .update({
        balance_minutes: finalBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', accountId);

    if (updErr) {
      throw new Error('Falha ao atualizar saldo acumulado da conta: ' + updErr.message);
    }

    return {
      success: true,
      account_id: accountId,
      transaction_id: newTx?.id,
      final_balance_minutes: finalBalance,
      message: `Saldo inicial (${formatMinutesToHours(minutes)}) gravado com sucesso. Saldo acumulado: ${formatMinutesToHours(finalBalance)}.`
    };
  }

  /**
   * Processa importação em lote (CSV/Excel) de saldos iniciais de múltiplos colaboradores (TB-03).
   */
  static async importInitialBalancesBatch(params: {
    tenantId: string;
    companyId?: string;
    csvText: string;
    userName?: string;
  }): Promise<InitialBalancesBatchResult> {
    const { tenantId, companyId, csvText, userName = 'Importação em Lote' } = params;

    const parsed = TimeBankService.parseInitialBalancesCsv(csvText);
    const workers = await this.fetchWorkersForTimeManagement(tenantId, companyId);

    // Indexar colaboradores por CPF limpo (11 dígitos), por contract_id e por worker_id
    const workerMapByCpf = new Map<string, WorkerOption>();
    const workerMapByContract = new Map<string, WorkerOption>();
    const workerMapById = new Map<string, WorkerOption>();

    workers.forEach((w) => {
      if (w.cpf) {
        const cleanCpf = w.cpf.replace(/\D/g, '');
        if (cleanCpf) workerMapByCpf.set(cleanCpf, w);
      }
      if (w.contract_id) workerMapByContract.set(w.contract_id, w);
      if (w.worker_id) workerMapById.set(w.worker_id, w);
    });

    const items: InitialBalancesBatchItemResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    // 1. Processar linhas inválidas do parser
    for (const inv of parsed.invalidRows) {
      failureCount++;
      items.push({
        line: inv.raw_line_number,
        identifier: inv.identifier,
        cutoff_date: inv.cutoff_date,
        minutes: 0,
        formatted_hours: inv.formatted_hours,
        status: 'ERROR',
        message: inv.error || 'Erro de formatação na linha.'
      });
    }

    // 2. Processar linhas válidas
    for (const row of parsed.validRows) {
      const cleanIdent = row.identifier.replace(/\D/g, '');
      const matchedWorker =
        workerMapByCpf.get(cleanIdent) ||
        workerMapByContract.get(row.identifier) ||
        workerMapById.get(row.identifier);

      if (!matchedWorker) {
        failureCount++;
        items.push({
          line: row.raw_line_number,
          identifier: row.identifier,
          cutoff_date: row.cutoff_date,
          minutes: row.minutes,
          formatted_hours: row.formatted_hours,
          status: 'ERROR',
          message: `Colaborador não localizado com o CPF/Identificador "${row.identifier}".`
        });
        continue;
      }

      try {
        const regRes = await this.registerInitialBalance({
          tenantId,
          contractId: matchedWorker.contract_id,
          cutoffDate: row.cutoff_date,
          minutes: row.minutes,
          justification: row.description,
          policyType: row.policy_type,
          validityMonths: row.validity_months,
          companyId,
          userName
        });

        if (regRes.success) {
          successCount++;
          items.push({
            line: row.raw_line_number,
            identifier: row.identifier,
            name: matchedWorker.full_name,
            contract_id: matchedWorker.contract_id,
            cutoff_date: row.cutoff_date,
            minutes: row.minutes,
            formatted_hours: row.formatted_hours,
            status: 'SUCCESS',
            message: regRes.message
          });
        } else {
          failureCount++;
          items.push({
            line: row.raw_line_number,
            identifier: row.identifier,
            name: matchedWorker.full_name,
            contract_id: matchedWorker.contract_id,
            cutoff_date: row.cutoff_date,
            minutes: row.minutes,
            formatted_hours: row.formatted_hours,
            status: 'ERROR',
            message: regRes.message || 'Falha ao registrar saldo inicial.'
          });
        }
      } catch (err: any) {
        failureCount++;
        items.push({
          line: row.raw_line_number,
          identifier: row.identifier,
          name: matchedWorker.full_name,
          contract_id: matchedWorker.contract_id,
          cutoff_date: row.cutoff_date,
          minutes: row.minutes,
          formatted_hours: row.formatted_hours,
          status: 'ERROR',
          message: err.message || 'Erro inesperado ao registrar saldo.'
        });
      }
    }

    // Ordenar por número de linha
    items.sort((a, b) => a.line - b.line);

    return {
      totalLines: parsed.totalLines,
      successCount,
      failureCount,
      items
    };
  }

  /**
   * Painel de Alertas de Vencimento de Banco de Horas (TB-04 Item 1).
   * Monitora a proximidade do encerramento do ciclo legal (CLT Art. 59).
   */
  static async fetchTimeBankExpirationAlerts(params: {
    tenantId: string;
    companyId?: string;
    referenceDate?: string;
  }): Promise<TimeBankExpirationAlertsPanel> {
    const { tenantId, companyId, referenceDate } = params;
    const refDate = referenceDate || new Date().toISOString().split('T')[0];

    let accounts: any[] = [];

    try {
      const { data, error } = await supabase
        .from('time_bank_accounts')
        .select(`
          id,
          tenant_id,
          contract_id,
          balance_minutes,
          start_date,
          end_date,
          status,
          policy_type,
          validity_months,
          warning_days_before_expiration,
          expiration_rule,
          employment_contracts!contract_id (
            id,
            worker_id,
            company_id,
            workers (
              id,
              people (
                full_name,
                cpf
              )
            ),
            positions (
              title
            )
          )
        `)
        .eq('tenant_id', tenantId)
        .eq('status', 'ACTIVE');

      if (error) {
        console.warn('Consulta padrão de alertas de banco de horas reportou aviso, acionando fallback defensivo:', error);
        throw error;
      }

      accounts = data || [];
    } catch (queryErr: any) {
      console.warn('Consulta padrão de alertas de banco de horas acionou fallback defensivo:', queryErr?.message || queryErr);
      // Fallback defensivo: consulta direta em time_bank_accounts sem join relacional profundo
      try {
        const { data: rawAccounts, error: rawErr } = await supabase
          .from('time_bank_accounts')
          .select('id, tenant_id, contract_id, balance_minutes, start_date, end_date, status, policy_type, validity_months, warning_days_before_expiration, expiration_rule')
          .eq('tenant_id', tenantId)
          .eq('status', 'ACTIVE');

        if (!rawErr && rawAccounts && rawAccounts.length > 0) {
          const contractIds = Array.from(new Set(rawAccounts.map((a: any) => a.contract_id).filter(Boolean)));
          let contractsMap: Record<string, any> = {};

          if (contractIds.length > 0) {
            const { data: contractsData } = await supabase
              .from('employment_contracts')
              .select(`
                id,
                worker_id,
                company_id,
                workers (
                  id,
                  people (
                    full_name,
                    cpf
                  )
                ),
                positions (
                  title
                )
              `)
              .in('id', contractIds);

            (contractsData || []).forEach((c: any) => {
              contractsMap[c.id] = c;
            });
          }

          accounts = rawAccounts.map((acc: any) => ({
            ...acc,
            employment_contracts: contractsMap[acc.contract_id] || null
          }));
        } else {
          accounts = [];
        }
      } catch (fallbackFatalErr) {
        console.error('Falha no fallback de alertas de banco de horas:', fallbackFatalErr);
        accounts = [];
      }
    }

    let expiredCount = 0;
    let criticalCount = 0;
    let warningCount = 0;
    let totalMinutesAtRisk = 0;
    const alerts: TimeBankExpirationAlertItem[] = [];

    (accounts || []).forEach((acc: any) => {
      const contract = acc.employment_contracts;
      const targetCompany = acc.company_id || contract?.company_id;
      if (companyId && targetCompany && targetCompany !== companyId) {
        return;
      }

      const worker = contract?.workers;
      const person = worker?.people;
      const workerName = person?.full_name || 'Colaborador';
      const cpf = person?.cpf;
      const positionTitle = contract?.positions?.title || 'Geral';

      const alert = TimeBankService.checkExpirationAndAlerts(acc, refDate);

      // Apenas computa risco e adiciona se tiver saldo positivo
      if (acc.balance_minutes > 0) {
        totalMinutesAtRisk += acc.balance_minutes;

        if (alert.status === 'EXPIRED') {
          expiredCount++;
        } else if (alert.status === 'CRITICAL') {
          criticalCount++;
        } else if (alert.status === 'WARNING') {
          warningCount++;
        }

        if (alert.status !== 'NORMAL') {
          alerts.push({
            account_id: acc.id,
            contract_id: acc.contract_id,
            worker_id: contract?.worker_id,
            worker_name: workerName,
            cpf,
            position_title: positionTitle,
            policy_type: acc.policy_type || 'ACORDO_INDIVIDUAL',
            start_date: acc.start_date,
            end_date: acc.end_date,
            balance_minutes: acc.balance_minutes,
            balance_formatted: formatMinutesToHours(acc.balance_minutes),
            days_remaining: alert.days_remaining,
            status: alert.status,
            action_recommended: alert.action_recommended,
            message: alert.message
          });
        }
      }
    });

    // Ordenação por prioridade: EXPIRED (1) > CRITICAL (2) > WARNING (3) > NORMAL (4)
    // Desempate: menor days_remaining primeiro
    const priorityMap: Record<TimeBankAlertStatus, number> = {
      EXPIRED: 1,
      CRITICAL: 2,
      WARNING: 3,
      NORMAL: 4
    };

    alerts.sort((a, b) => {
      const pA = priorityMap[a.status] || 5;
      const pB = priorityMap[b.status] || 5;
      if (pA !== pB) return pA - pB;
      return a.days_remaining - b.days_remaining;
    });

    const totalHoursAtRisk = Math.round((totalMinutesAtRisk / 60) * 100) / 100;

    return {
      totalAccountsMonitored: (accounts || []).length,
      expiredCount,
      criticalCount,
      warningCount,
      totalPositiveHoursAtRisk: totalHoursAtRisk,
      alerts
    };
  }
}

export interface TimeBankExpirationAlertItem {
  account_id: string;
  contract_id: string;
  worker_id?: string;
  worker_name: string;
  cpf?: string;
  position_title: string;
  policy_type: TimeBankPolicyType;
  start_date: string;
  end_date: string;
  balance_minutes: number;
  balance_formatted: string;
  days_remaining: number;
  status: TimeBankAlertStatus;
  action_recommended?: 'SCHEDULE_TIME_OFF' | 'IMMEDIATE_COMPENSATION_OR_PREPARE_PAYOUT' | 'PAY_AS_OVERTIME' | 'NONE';
  message: string;
}

export interface TimeBankExpirationAlertsPanel {
  totalAccountsMonitored: number;
  expiredCount: number;
  criticalCount: number;
  warningCount: number;
  totalPositiveHoursAtRisk: number;
  alerts: TimeBankExpirationAlertItem[];
}

export interface InitialBalancesBatchItemResult {
  line: number;
  identifier: string;
  name?: string;
  contract_id?: string;
  cutoff_date: string;
  minutes: number;
  formatted_hours: string;
  status: 'SUCCESS' | 'ERROR';
  message: string;
}

export interface InitialBalancesBatchResult {
  totalLines: number;
  successCount: number;
  failureCount: number;
  items: InitialBalancesBatchItemResult[];
}

export interface IntegrateTimesheetParams {
  tenantId: string;
  companyId?: string;
  year: number;
  month: number;
  payrollPeriodId?: string;
  destiny?: 'HYBRID' | 'PAYROLL_ONLY' | 'BANK_ONLY';
  contractIdFilter?: string;
  userName?: string;
}

export interface IntegrateTimesheetResult {
  success: boolean;
  total_contracts_processed: number;
  total_events_created: number;
  total_bank_credits_minutes: number;
  total_payroll_he_hours: number;
  total_night_shift_hours: number;
  total_bank_cap_overflow_hours?: number;
  contracts_with_overflow?: number;
  summary: {
    worker_name: string;
    he50_hours: number;
    he100_hours: number;
    night_hours: number;
    bank_credited_minutes: number;
    delays_hours: number;
    absences_days: number;
    bank_cap_applied_hours?: number;
    overflow_he_hours?: number;
  }[];
}

export interface WorkerOption {
  worker_id: string;
  contract_id: string;
  full_name: string;
  cpf?: string;
  position_title: string;
  department_name?: string;
  pis_pasep?: string;
  overtime_regime?: 'TIME_BANK' | 'OVERTIME_PAYROLL' | 'HYBRID';
}

export interface MonthlyPunchItem {
  id: string;
  nsr?: number;
  time: string;
  source: string;
  punched_at: string;
  is_shifted?: boolean;
  original_date?: string;
  adjustment_id?: string;
}

export interface MonthlyDayTimesheet {
  date: string;
  dayOfMonth: number;
  dayOfWeek: string;
  dayOfWeekFull: string;
  isWeekend: boolean;
  expected_schedule: string;
  expected_minutes: number;
  punches: MonthlyPunchItem[];
  worked_minutes: number;
  break_minutes: number;
  overtime_50_minutes: number;
  overtime_100_minutes: number;
  night_shift_minutes: number;
  delay_minutes: number;
  absence_minutes: number;
  balance_minutes: number;
  status: 'REGULAR' | 'MISSING_PUNCH' | 'DELAY' | 'ABSENCE' | 'DAY_OFF' | 'JUSTIFIED';
  inconsistency_text?: string;
  justification?: string;
}

export interface MonthlyTimesheetSummary {
  worker_id: string;
  worker_name: string;
  contract_id: string;
  position_title: string;
  year: number;
  month: number;
  month_label: string;
  total_worked_minutes: number;
  total_expected_minutes: number;
  total_overtime_50_minutes: number;
  total_overtime_100_minutes: number;
  total_delay_minutes: number;
  total_absence_minutes: number;
  total_justified_minutes: number;
  time_bank_balance_minutes: number;
  days: MonthlyDayTimesheet[];
}
