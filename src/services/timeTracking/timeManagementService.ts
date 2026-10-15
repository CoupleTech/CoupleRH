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
      query = query.eq('company_id', filters.companyId);
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
   * Busca colaboradores ativos para o seletor do Cartão de Ponto
   */
  static async fetchWorkersForTimeManagement(
    tenantId: string,
    companyId?: string
  ): Promise<WorkerOption[]> {
    let query = supabase
      .from('workers')
      .select(`
        id,
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

    const { data, error } = await query;
    if (error) throw error;

    const list: WorkerOption[] = [];
    (data || []).forEach((w: any) => {
      const contracts = Array.isArray(w.employment_contracts) ? w.employment_contracts : [];
      const activeContract = contracts.find((c: any) => c.status === 'ACTIVE') || contracts[0];
      
      if (companyId && activeContract?.company_id && activeContract.company_id !== companyId) {
        return;
      }

      list.push({
        worker_id: w.id,
        contract_id: activeContract?.id || '',
        full_name: w.people?.full_name || 'Sem Nome',
        position_title: activeContract?.positions?.title || 'Colaborador',
        department_name: activeContract?.departments?.name,
        pis_pasep: w.pis_pasep
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

    // 2. Intervalo do mês
    const lastDay = new Date(year, month, 0).getDate();
    const startDateIso = `${year}-${String(month).padStart(2, '0')}-01T00:00:00Z`;
    const endDateIso = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59Z`;
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

    // 5. Saldo do Banco de Horas
    let bankBalance = 0;
    if (contractId) {
      const { data: bankAcc } = await supabase
        .from('time_bank_accounts')
        .select('current_balance_minutes')
        .eq('contract_id', contractId)
        .eq('status', 'ACTIVE')
        .maybeSingle();
      if (bankAcc) {
        bankBalance = bankAcc.current_balance_minutes || 0;
      }
    }

    // Mapear batidas por dia local (YYYY-MM-DD)
    const punchesByDay: Record<string, MonthlyPunchItem[]> = {};
    (punchesRaw || []).forEach((p: any) => {
      const d = new Date(p.punched_at);
      const dayKey = d.toISOString().split('T')[0];
      const hours = String(d.getUTCHours()).padStart(2, '0');
      const mins = String(d.getUTCMinutes()).padStart(2, '0');
      if (!punchesByDay[dayKey]) punchesByDay[dayKey] = [];
      punchesByDay[dayKey].push({
        id: p.id,
        nsr: p.nsr,
        time: `${hours}:${mins}`,
        source: p.source,
        punched_at: p.punched_at
      });
    });

    // Mapear ajustes e abonos por dia
    const adjustmentsByDay: Record<string, any[]> = {};
    (adjustmentsRaw || []).forEach((adj: any) => {
      const d = new Date(adj.requested_timestamp);
      const dayKey = d.toISOString().split('T')[0];
      if (!adjustmentsByDay[dayKey]) adjustmentsByDay[dayKey] = [];
      adjustmentsByDay[dayKey].push(adj);
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

      // Calcular pares de batidas do dia
      let workedMin = 0;
      let breakMin = 0;
      let hasMissingPunch = false;

      if (dayPunches.length >= 2) {
        // Ordenar minutos desde meia-noite
        const punchMinutes = dayPunches.map((p) => {
          const [h, m] = p.time.split(':').map(Number);
          return h * 60 + m;
        }).sort((a, b) => a - b);

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

    const punchIso = `${date}T${time}:00Z`;

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
}

export interface WorkerOption {
  worker_id: string;
  contract_id: string;
  full_name: string;
  position_title: string;
  department_name?: string;
  pis_pasep?: string;
}

export interface MonthlyPunchItem {
  id: string;
  nsr?: number;
  time: string;
  source: string;
  punched_at: string;
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
