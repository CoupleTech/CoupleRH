import { useState, useEffect } from 'react';
import {
  Watch,
  Upload,
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus,
  RefreshCw,
  Search,
  Filter,
  Check,
  X,
  FileText,
  Key,
  Shield,
  Calendar,
  User,
  ArrowRight,
  Server,
  Smartphone,
  FolderInput,
  Info,
  Loader2,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Moon,
  CornerUpLeft,
  Undo2,
  Zap,
  DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import { useCompany } from '../../contexts/CompanyContext';
import { supabase } from '../../lib/supabase';
import {
  TimeManagementService,
  type TimeEntryAdjustment,
  type AfdFileRecord,
  type PendingApprovalsGroup,
  type WorkerOption,
  type MonthlyTimesheetSummary,
  type MonthlyDayTimesheet,
  type MonthlyPunchItem,
  type IntegrateTimesheetResult
} from '../../services/timeTracking/timeManagementService';
import type {
  TimeDevice,
  TimeDeviceKind,
  TimeDeviceStatus,
  TimeDailySummary
} from '../../services/timeTracking/timeTrackingModel';
import { AfdImportService } from '../../services/timeTracking/afdImportService';
import { TimeExportService } from '../../services/timeTracking/timeExportService';
import { confirmDialog } from '../../components/ConfirmDialogProvider';
import { promptDialog } from '../../components/PromptDialogProvider';

type TabType = 'overview' | 'devices' | 'afd' | 'treatment' | 'approvals' | 'exports';

export default function TimeManagement() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState<boolean>(true);
  const [currentTenantId, setCurrentTenantId] = useState<string>('');

  // Estados dos Dispositivos
  const [devices, setDevices] = useState<TimeDevice[]>([]);
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Partial<TimeDevice> | null>(null);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [selectedDeviceKey, setSelectedDeviceKey] = useState<{ id: string; name: string; key: string } | null>(null);

  // Estados da Importação AFD
  const [afdFiles, setAfdFiles] = useState<AfdFileRecord[]>([]);
  const [uploadingAfd, setUploadingAfd] = useState(false);
  const [importReport, setImportReport] = useState<any | null>(null);

  // Estados do Cartão de Ponto Mensal Interativo (Tratamento)
  const [workersList, setWorkersList] = useState<WorkerOption[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [selectedYearMonth, setSelectedYearMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [monthlyTimesheet, setMonthlyTimesheet] = useState<MonthlyTimesheetSummary | null>(null);
  const [loadingTimesheet, setLoadingTimesheet] = useState<boolean>(false);
  const [timesheetFilter, setTimesheetFilter] = useState<'ALL' | 'WORKED' | 'INCONSISTENCIES'>('ALL');

  // Modais de Inclusão Manual e Abono
  const [manualPunchModalOpen, setManualPunchModalOpen] = useState(false);
  const [manualPunchWorkerId, setManualPunchWorkerId] = useState<string>('');
  const [manualPunchDate, setManualPunchDate] = useState('');
  const [manualPunchTime, setManualPunchTime] = useState('08:00');
  const [manualPunchType, setManualPunchType] = useState<'IN' | 'OUT' | 'BREAK_START' | 'BREAK_END'>('IN');
  const [manualPunchReason, setManualPunchReason] = useState('');
  const [savingManualPunch, setSavingManualPunch] = useState(false);

  // Estados de Integração com Folha e Banco de Horas
  const [integrateModalOpen, setIntegrateModalOpen] = useState(false);
  const [integrateDestiny, setIntegrateDestiny] = useState<'HYBRID' | 'PAYROLL_ONLY' | 'BANK_ONLY'>('HYBRID');
  const [integrating, setIntegrating] = useState(false);
  const [integrateResult, setIntegrateResult] = useState<IntegrateTimesheetResult | null>(null);

  const [abonoModalOpen, setAbonoModalOpen] = useState(false);
  const [abonoDate, setAbonoDate] = useState('');
  const [abonoType, setAbonoType] = useState('Atestado Médico (Art. 473 CLT)');
  const [abonoReason, setAbonoReason] = useState('');
  const [savingAbono, setSavingAbono] = useState(false);

  // Estados para Deslocamento de Jornada Noturna (Virada de Meia-Noite / Fechamento de Turno)
  const [shiftPunchModalOpen, setShiftPunchModalOpen] = useState(false);
  const [selectedPunchToShift, setSelectedPunchToShift] = useState<{
    punch: MonthlyPunchItem;
    currentDate: string;
    previousDate: string;
  } | null>(null);
  const [savingShiftPunch, setSavingShiftPunch] = useState(false);

  // Estados do Tratamento Legado / Fallback
  const [dailySummaries, setDailySummaries] = useState<(TimeDailySummary & { worker_name?: string; position_name?: string })[]>([]);
  const [treatmentFilter, setTreatmentFilter] = useState<'ALL' | 'ONLY_INCONSISTENT' | 'MISSING_PUNCH' | 'INTRAJORNADA' | 'INTERJORNADA' | 'ABSENCE'>('ONLY_INCONSISTENT');
  const [treatmentSearch, setTreatmentSearch] = useState('');
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedSummaryToAdjust, setSelectedSummaryToAdjust] = useState<TimeDailySummary & { worker_name?: string } | null>(null);
  const [adjustForm, setAdjustForm] = useState<{
    entry_type: 'IN' | 'OUT' | 'BREAK_START' | 'BREAK_END';
    time: string;
    reason: string;
  }>({
    entry_type: 'IN',
    time: '08:00',
    reason: ''
  });

  // Estados da Central de Aprovações
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalsGroup>({
    adjustments: [],
    contests: [],
    compensations: [],
    totalCount: 0
  });
  const [processingApproval, setProcessingApproval] = useState(false);

  // Estados de Exportação Fiscal (PT-12)
  const [exportStartDate, setExportStartDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [exportEndDate, setExportEndDate] = useState<string>(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  });
  const [exportingAfd, setExportingAfd] = useState(false);
  const [exportingAej, setExportingAej] = useState(false);
  const [reconcilingAfd, setReconcilingAfd] = useState(false);
  const [warningsFilter, setWarningsFilter] = useState('');
  const [showAllWarnings, setShowAllWarnings] = useState(false);

  // Carregamento inicial do tenant e dados
  useEffect(() => {
    initTenantAndLoad();
  }, [selectedCompanyId]);

  const initTenantAndLoad = async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;

      const { data: tenantData } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', userData.user.id)
        .single();

      if (!tenantData?.tenant_id) return;
      setCurrentTenantId(tenantData.tenant_id);

      await Promise.all([
        loadDevices(tenantData.tenant_id),
        loadAfdFiles(tenantData.tenant_id),
        loadDailySummaries(tenantData.tenant_id),
        loadPendingApprovals(tenantData.tenant_id),
        loadWorkers(tenantData.tenant_id)
      ]);
    } catch (err: any) {
      console.error('Erro ao carregar dados de gestão de ponto:', err);
      toast.error('Erro ao carregar módulo de ponto: ' + (err.message || 'Falha de conexão'));
    } finally {
      setLoading(false);
    }
  };

  const loadWorkers = async (tenantId: string) => {
    try {
      const list = await TimeManagementService.fetchWorkersForTimeManagement(tenantId, selectedCompanyId || undefined);
      setWorkersList(list);
      if (list.length > 0) {
        setSelectedWorkerId((prev) => (prev && list.some(w => w.worker_id === prev) ? prev : list[0].worker_id));
      }
    } catch (err: any) {
      console.error('Erro ao carregar colaboradores para ponto:', err);
    }
  };

  useEffect(() => {
    if (currentTenantId && selectedWorkerId && selectedYearMonth) {
      loadWorkerTimesheet();
    }
  }, [currentTenantId, selectedWorkerId, selectedYearMonth]);

  const loadWorkerTimesheet = async () => {
    if (!currentTenantId || !selectedWorkerId) return;
    setLoadingTimesheet(true);
    try {
      const [yearStr, monthStr] = selectedYearMonth.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr);
      const activeWorker = workersList.find((w) => w.worker_id === selectedWorkerId);
      const res = await TimeManagementService.fetchMonthlyTimesheet({
        tenantId: currentTenantId,
        workerId: selectedWorkerId,
        contractId: activeWorker?.contract_id,
        year,
        month
      });
      setMonthlyTimesheet(res);
    } catch (err: any) {
      console.error('Erro ao carregar cartão de ponto mensal:', err);
      toast.error('Erro ao calcular cartão de ponto: ' + (err.message || 'Falha de conexão'));
    } finally {
      setLoadingTimesheet(false);
    }
  };

  const handleOpenManualPunchModal = (dateStr?: string, workerId?: string) => {
    const today = new Date().toISOString().split('T')[0];
    const initialDate = dateStr || (selectedYearMonth ? `${selectedYearMonth}-01` : today);
    setManualPunchDate(initialDate);
    setManualPunchWorkerId(workerId || selectedWorkerId || (workersList[0]?.worker_id || ''));
    setManualPunchTime('12:00');
    setManualPunchType('IN');
    setManualPunchReason('');
    setManualPunchModalOpen(true);
  };

  const handleSaveManualPunch = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetWorkerId = manualPunchWorkerId || selectedWorkerId;
    if (!currentTenantId || !targetWorkerId || !manualPunchDate || !manualPunchTime) {
      toast.error('Preencha os campos obrigatórios da marcação.');
      return;
    }
    if (!manualPunchReason.trim()) {
      toast.error('Informe a justificativa legal da marcação manual.');
      return;
    }

    setSavingManualPunch(true);
    try {
      const activeWorker = workersList.find((w) => w.worker_id === targetWorkerId);
      await TimeManagementService.addManualPunch({
        tenantId: currentTenantId,
        companyId: selectedCompanyId || undefined,
        workerId: targetWorkerId,
        contractId: activeWorker?.contract_id,
        date: manualPunchDate,
        time: manualPunchTime,
        entryType: manualPunchType,
        reason: manualPunchReason.trim(),
        userName: 'Operador DP'
      });
      toast.success(`Marcação de ponto incluída com sucesso para ${activeWorker?.full_name || 'o colaborador'}!`);
      setManualPunchModalOpen(false);

      if (targetWorkerId === selectedWorkerId) {
        await loadWorkerTimesheet();
      } else {
        setSelectedWorkerId(targetWorkerId);
      }
    } catch (err: any) {
      toast.error('Erro ao incluir marcação: ' + err.message);
    } finally {
      setSavingManualPunch(false);
    }
  };

  const handleOpenIntegrateModal = () => {
    setIntegrateResult(null);
    setIntegrateModalOpen(true);
  };

  const handleConfirmIntegrate = async () => {
    if (!currentTenantId || !selectedYearMonth) return;
    setIntegrating(true);
    try {
      const [yearStr, monthStr] = selectedYearMonth.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr);

      const res = await TimeManagementService.integrateTimesheetToPayrollAndBank({
        tenantId: currentTenantId,
        companyId: selectedCompanyId || undefined,
        year,
        month,
        destiny: integrateDestiny,
        userName: 'Operador DP'
      });

      setIntegrateResult(res);
      toast.success(`Integração concluída! ${res.total_events_created} eventos na folha e ${Math.floor(res.total_bank_credits_minutes / 60)}h no banco.`);
      await loadWorkerTimesheet();
    } catch (err: any) {
      console.error('Erro na integração com folha/banco:', err);
      toast.error('Erro ao integrar ponto com folha: ' + err.message);
    } finally {
      setIntegrating(false);
    }
  };

  const handleOpenAbonoModal = (dateStr: string) => {
    setAbonoDate(dateStr);
    setAbonoType('Atestado Médico (Art. 473 CLT)');
    setAbonoReason('');
    setAbonoModalOpen(true);
  };

  const handleSaveAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTenantId || !selectedWorkerId || !abonoDate) return;
    if (!abonoReason.trim()) {
      toast.error('Informe a justificativa do abono.');
      return;
    }

    setSavingAbono(true);
    try {
      const activeWorker = workersList.find((w) => w.worker_id === selectedWorkerId);
      if (!activeWorker?.contract_id) throw new Error('Contrato ativo não localizado.');

      await TimeManagementService.saveDayAbono({
        tenantId: currentTenantId,
        contractId: activeWorker.contract_id,
        workerId: selectedWorkerId,
        date: abonoDate,
        abonoType,
        reason: abonoReason.trim()
      });
      toast.success('Abono registrado com sucesso!');
      setAbonoModalOpen(false);
      await loadWorkerTimesheet();
    } catch (err: any) {
      toast.error('Erro ao registrar abono: ' + err.message);
    } finally {
      setSavingAbono(false);
    }
  };

  const getPreviousDateStr = (dateStr: string): string => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - 1);
    const prevY = dt.getFullYear();
    const prevM = String(dt.getMonth() + 1).padStart(2, '0');
    const prevD = String(dt.getDate()).padStart(2, '0');
    return `${prevY}-${prevM}-${prevD}`;
  };

  const handleOpenShiftModal = (punch: MonthlyPunchItem, currentDate: string) => {
    const prevDate = getPreviousDateStr(currentDate);
    setSelectedPunchToShift({
      punch,
      currentDate,
      previousDate: prevDate
    });
    setShiftPunchModalOpen(true);
  };

  const handleConfirmShiftPunch = async () => {
    if (!selectedPunchToShift || !currentTenantId || !selectedWorkerId) return;
    setSavingShiftPunch(true);
    try {
      const activeWorker = workersList.find((w) => w.worker_id === selectedWorkerId);
      const contractId = activeWorker?.contract_id || '';

      if (selectedPunchToShift.punch.is_shifted) {
        // Desfazer deslocamento e retornar ao dia original
        await TimeManagementService.undoShiftPunch({
          tenantId: currentTenantId,
          contractId,
          punchId: selectedPunchToShift.punch.id,
          adjustmentId: selectedPunchToShift.punch.adjustment_id
        });
        toast.success(`Batida das ${selectedPunchToShift.punch.time} retornada ao dia civil original.`);
      } else {
        // Mover para a jornada do dia anterior
        await TimeManagementService.shiftPunchToPreviousDay({
          tenantId: currentTenantId,
          contractId,
          punchId: selectedPunchToShift.punch.id,
          punchTime: selectedPunchToShift.punch.time,
          punchedAt: selectedPunchToShift.punch.punched_at,
          currentDate: selectedPunchToShift.currentDate,
          previousDate: selectedPunchToShift.previousDate,
          userName: 'Operador DP'
        });
        toast.success(`Batida das ${selectedPunchToShift.punch.time} alocada com sucesso no fechamento de turno do dia anterior (${selectedPunchToShift.previousDate}).`);
      }

      setShiftPunchModalOpen(false);
      setSelectedPunchToShift(null);
      await loadWorkerTimesheet();
    } catch (err: any) {
      toast.error('Erro ao processar ajuste de jornada: ' + (err.message || 'Tente novamente.'));
    } finally {
      setSavingShiftPunch(false);
    }
  };

  const loadDevices = async (tenantId: string) => {
    try {
      const data = await TimeManagementService.fetchDevices(tenantId, selectedCompanyId || undefined);
      setDevices(data);
    } catch (err: any) {
      console.error('Erro ao carregar dispositivos:', err);
    }
  };

  const loadAfdFiles = async (tenantId: string) => {
    try {
      const data = await TimeManagementService.fetchAfdFiles(tenantId, selectedCompanyId || undefined);
      setAfdFiles(data);
    } catch (err: any) {
      console.error('Erro ao carregar arquivos AFD:', err);
    }
  };

  const loadDailySummaries = async (tenantId: string) => {
    try {
      const data = await TimeManagementService.fetchDailySummaries(tenantId, {
        companyId: selectedCompanyId || undefined
      });
      setDailySummaries(data);
    } catch (err: any) {
      console.error('Erro ao carregar resumos diários:', err);
    }
  };

  const loadPendingApprovals = async (tenantId: string) => {
    try {
      const data = await TimeManagementService.fetchPendingApprovals(tenantId, selectedCompanyId || undefined);
      setPendingApprovals(data);
    } catch (err: any) {
      console.error('Erro ao carregar aprovações pendentes:', err);
    }
  };

  // =========================================================================
  // Handlers de Dispositivos
  // =========================================================================
  const handleOpenDeviceModal = (device?: TimeDevice) => {
    if (device) {
      setEditingDevice({ ...device });
    } else {
      setEditingDevice({
        name: '',
        kind: 'REP_C',
        vendor: 'Control iD',
        model: 'iDClass',
        serial_number: '',
        host: '192.168.1.100',
        port: 80,
        status: 'ACTIVE'
      });
    }
    setDeviceModalOpen(true);
  };

  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDevice || !currentTenantId) return;

    const validation = TimeManagementService.validateDeviceConfig(editingDevice);
    if (!validation.valid) {
      toast.error(validation.errors[0]);
      return;
    }

    try {
      await TimeManagementService.saveDevice({
        ...editingDevice,
        tenant_id: currentTenantId,
        company_id: selectedCompanyId || undefined
      });
      toast.success(editingDevice.id ? 'Dispositivo atualizado com sucesso!' : 'Dispositivo cadastrado com sucesso!');
      setDeviceModalOpen(false);
      setEditingDevice(null);
      await loadDevices(currentTenantId);
    } catch (err: any) {
      toast.error('Erro ao salvar dispositivo: ' + err.message);
    }
  };

  const handleDeleteDevice = async (id: string, name: string) => {
    const confirmed = await confirmDialog({
      title: 'Excluir Dispositivo',
      message: `Tem certeza que deseja excluir o dispositivo "${name}"? Batidas já registradas serão preservadas.`
    });
    if (!confirmed) return;

    try {
      await TimeManagementService.deleteDevice(id);
      toast.success('Dispositivo removido com sucesso.');
      await loadDevices(currentTenantId);
    } catch (err: any) {
      toast.error('Erro ao remover dispositivo: ' + err.message);
    }
  };

  const handleShowDeviceKey = (device: TimeDevice) => {
    const mockApiKey = btoa(`${device.id}:${device.created_at || 'secret'}:couplerh`);
    setSelectedDeviceKey({
      id: device.id || '',
      name: device.name,
      key: `rep_live_${mockApiKey.substring(0, 32)}`
    });
    setKeyModalOpen(true);
  };

  // =========================================================================
  // Handlers de Importação de AFD
  // =========================================================================
  const handleAfdFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentTenantId) return;

    setUploadingAfd(true);
    setImportReport(null);

    try {
      const fileContent = await file.text();
      const report = await AfdImportService.importAfdFile({
        tenant_id: currentTenantId,
        company_id: selectedCompanyId || undefined,
        file_name: file.name,
        file_content: fileContent
      });

      setImportReport(report);
      if (report.success) {
        toast.success(`AFD importado com sucesso! ${report.imported} batidas cadastradas.`);
      } else {
        toast.error(`Falha na importação do AFD: ${report.error_message || 'Verifique o formato'}`);
      }
      await loadAfdFiles(currentTenantId);
      await loadDailySummaries(currentTenantId);
    } catch (err: any) {
      toast.error('Erro ao processar arquivo AFD: ' + (err.message || 'Formato inválido'));
    } finally {
      setUploadingAfd(false);
      event.target.value = '';
    }
  };

  const handleReconcileAfd = async () => {
    if (!currentTenantId) return;
    setReconcilingAfd(true);
    try {
      const res = await AfdImportService.reconcileAfdPunches(currentTenantId, selectedCompanyId || undefined);
      if (res.reconciled > 0) {
        toast.success(`Conciliação concluída! ${res.reconciled} batidas foram vinculadas a colaboradores.`);
        await loadDailySummaries(currentTenantId);
      } else {
        toast.info(
          res.totalUnlinked > 0
            ? `${res.totalUnlinked} batidas na trilha de auditoria aguardam correspondência de PIS/CPF de colaboradores.`
            : 'Todas as batidas importadas já estão conciliadas!'
        );
      }
    } catch (err: any) {
      toast.error('Erro ao conciliar batidas: ' + err.message);
    } finally {
      setReconcilingAfd(false);
    }
  };

  // =========================================================================
  // Handlers de Tratamento & Inconsistências
  // =========================================================================
  const handleOpenAdjustModal = (summary: TimeDailySummary & { worker_name?: string }) => {
    setSelectedSummaryToAdjust(summary);
    setAdjustForm({
      entry_type: 'IN',
      time: '08:00',
      reason: ''
    });
    setAdjustModalOpen(true);
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSummaryToAdjust || !currentTenantId) return;

    if (!adjustForm.reason.trim()) {
      toast.error('A justificativa do ajuste é obrigatória (ex: Falha no relógio, Esquecimento, Atestado).');
      return;
    }

    try {
      const requestedTimestamp = `${selectedSummaryToAdjust.date}T${adjustForm.time}:00-03:00`;
      const { data: userData } = await supabase.auth.getUser();

      await TimeManagementService.saveAdjustment({
        tenant_id: currentTenantId,
        contract_id: selectedSummaryToAdjust.contract_id,
        requested_timestamp: requestedTimestamp,
        entry_type: adjustForm.entry_type,
        adjustment_reason: adjustForm.reason,
        status: 'APPROVED', // Lançado pelo próprio DP/gestor já com efeito aprovado
        requested_by: userData?.user?.id || '',
        approved_by: userData?.user?.id || ''
      });

      toast.success('Ajuste de ponto registrado e aprovado com sucesso!');
      setAdjustModalOpen(false);
      setSelectedSummaryToAdjust(null);
      await loadDailySummaries(currentTenantId);
      await loadPendingApprovals(currentTenantId);
    } catch (err: any) {
      toast.error('Erro ao registrar ajuste: ' + err.message);
    }
  };

  // =========================================================================
  // Handlers da Central de Aprovações
  // =========================================================================
  const handleReviewAdjustment = async (adj: TimeEntryAdjustment, approved: boolean) => {
    let reviewNotes = '';
    if (!approved) {
      const reason = await promptDialog({
        title: 'Recusar Ajuste de Ponto',
        message: 'Informe o motivo da recusa para ciência do colaborador:'
      });
      if (!reason) return;
      reviewNotes = reason;
    }

    setProcessingApproval(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const updated = TimeManagementService.processAdjustmentReview(
        adj,
        approved,
        userData?.user?.id || 'admin-user',
        reviewNotes
      );

      const { error } = await supabase
        .from('time_entry_adjustments')
        .update({
          status: updated.status,
          approved_by: updated.approved_by,
          updated_at: updated.updated_at
        })
        .eq('id', adj.id);

      if (error) throw error;

      toast.success(approved ? 'Ajuste de ponto aprovado com sucesso!' : 'Ajuste de ponto recusado.');
      await loadPendingApprovals(currentTenantId);
      await loadDailySummaries(currentTenantId);
    } catch (err: any) {
      toast.error('Erro ao deliberar ajuste: ' + err.message);
    } finally {
      setProcessingApproval(false);
    }
  };

  const handleReviewContest = async (contest: any, approved: boolean) => {
    let notes = '';
    if (approved) {
      notes = 'Contestação deferida pelo DP. Espelho reaberto para correções.';
    } else {
      const reason = await promptDialog({
        title: 'Indeferir Contestação de Espelho',
        message: 'Informe o parecer fundamentado da decisão:'
      });
      if (!reason) return;
      notes = reason;
    }

    setProcessingApproval(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const reviewResult = TimeManagementService.processContestReview(
        contest,
        approved,
        userData?.user?.id || 'admin-user',
        notes
      );

      // Atualiza a contestação
      const { error: contestErr } = await supabase
        .from('timesheet_contests')
        .update({
          status: reviewResult.contest.status,
          reviewed_by: reviewResult.contest.reviewed_by,
          review_notes: reviewResult.contest.review_notes,
          reviewed_at: reviewResult.contest.reviewed_at,
          updated_at: reviewResult.contest.updated_at
        })
        .eq('id', contest.id);

      if (contestErr) throw contestErr;

      // Atualiza o espelho de ponto para DRAFT (se deferido) ou PENDING_SIGNATURE (se indeferido)
      const { error: tsErr } = await supabase
        .from('timesheets')
        .update({
          status: reviewResult.timesheetStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', contest.timesheet_id);

      if (tsErr) throw tsErr;

      toast.success(
        approved
          ? 'Contestação deferida. O espelho de ponto foi retornado para rascunho (DRAFT).'
          : 'Contestação indeferida com parecer registrado.'
      );
      await loadPendingApprovals(currentTenantId);
    } catch (err: any) {
      toast.error('Erro ao processar deliberação: ' + err.message);
    } finally {
      setProcessingApproval(false);
    }
  };

  // =========================================================================
  // Handlers de Exportações Fiscais (PT-12 - Portaria MTP 671/2021)
  // =========================================================================
  const handleDownloadAfd = async () => {
    if (!currentTenantId) return;
    setExportingAfd(true);
    try {
      let query = supabase
        .from('time_punch_records')
        .select('*')
        .eq('tenant_id', currentTenantId)
        .gte('punched_at', `${exportStartDate}T00:00:00`)
        .lte('punched_at', `${exportEndDate}T23:59:59`)
        .order('nsr', { ascending: true });

      if (selectedCompanyId) {
        query = query.eq('company_id', selectedCompanyId);
      }

      const { data: punches, error } = await query;
      if (error) throw error;

      const afdText = TimeExportService.generateAfd({
        employer: {
          cnpj: selectedCompany?.cnpj || '00000000000191',
          corporate_name: selectedCompany?.corporate_name || 'Empresa Empregadora'
        },
        device_serial: '0000000000000001',
        period_start: exportStartDate,
        period_end: exportEndDate,
        records: (punches || []) as any[]
      });

      const blob = new Blob([afdText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AFD_${selectedCompany?.cnpj?.replace(/\D/g, '') || 'EMPRESA'}_${exportStartDate}_${exportEndDate}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`AFD exportado com sucesso! (${punches?.length || 0} batidas no período)`);
    } catch (err: any) {
      toast.error('Erro ao exportar AFD: ' + err.message);
    } finally {
      setExportingAfd(false);
    }
  };

  const handleDownloadAej = async () => {
    if (!currentTenantId) return;
    setExportingAej(true);
    try {
      const summaries = await TimeManagementService.fetchDailySummaries(currentTenantId, {
        companyId: selectedCompanyId || undefined,
        startDate: exportStartDate,
        endDate: exportEndDate
      });

      const workersMap = new Map<string, any>();
      summaries.forEach((s) => {
        if (!workersMap.has(s.contract_id)) {
          workersMap.set(s.contract_id, {
            cpf: '00000000000',
            name: s.worker_name || 'Colaborador',
            contract_id: s.contract_id,
            position_title: s.position_name
          });
        }
      });

      const aejText = TimeExportService.generateAej({
        employer: {
          cnpj: selectedCompany?.cnpj || '00000000000191',
          corporate_name: selectedCompany?.corporate_name || 'Empresa Empregadora'
        },
        period_start: exportStartDate,
        period_end: exportEndDate,
        workers: Array.from(workersMap.values()),
        daily_summaries: summaries.map((s) => ({
          contract_id: s.contract_id,
          date: s.date,
          expected_work_minutes: s.expected_work_minutes,
          worked_minutes: s.worked_minutes,
          overtime_50_minutes: s.overtime_50_minutes,
          overtime_100_minutes: s.overtime_100_minutes,
          night_shift_minutes: s.night_shift_minutes,
          delay_minutes: s.delay_minutes,
          absence_minutes: s.absence_minutes,
          intrajornada_violation_minutes: s.intrajornada_violation_minutes,
          interjornada_violation_minutes: s.interjornada_violation_minutes,
          punches: []
        }))
      });

      const blob = new Blob([aejText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AEJ_${selectedCompany?.cnpj?.replace(/\D/g, '') || 'EMPRESA'}_${exportStartDate}_${exportEndDate}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`AEJ exportado com sucesso! (${summaries.length} jornadas consolidadas)`);
    } catch (err: any) {
      toast.error('Erro ao exportar AEJ: ' + err.message);
    } finally {
      setExportingAej(false);
    }
  };

  const handleDownloadCertificate = () => {
    const cert = TimeExportService.generateComplianceCertificate({
      employer: {
        cnpj: selectedCompany?.cnpj || '00.000.000/0001-91',
        corporate_name: selectedCompany?.corporate_name || 'Empresa Empregadora'
      },
      period_start: exportStartDate,
      period_end: exportEndDate,
      total_workers: dailySummaries.length > 0 ? new Set(dailySummaries.map((s) => s.contract_id)).size : 1,
      total_punches: dailySummaries.reduce((acc, s) => acc + (s.worked_minutes > 0 ? 4 : 0), 0)
    });

    const certText = `
================================================================================
${cert.document_title.toUpperCase()}
Fundamentação: ${cert.legal_basis}
================================================================================

DADOS DO FABRICANTE / DESENVOLVEDOR DO SOFTWARE:
Razão Social: ${cert.developer_name}
CNPJ: ${cert.developer_cnpj}
Programa / Sistema: ${cert.software_name}
Versão Homologada: ${cert.software_version}

DADOS DO EMPREGADOR:
Razão Social: ${cert.employer_name}
CNPJ: ${cert.employer_cnpj}
Período Auditado: ${cert.period}
Total de Trabalhadores Ativos: ${cert.total_workers}

DECLARAÇÕES FORMAIS DE CONFORMIDADE:
${cert.declarations.map((d, i) => `${i + 1}. ${d}`).join('\n\n')}

INTEGRIDADE E CARIMBO DE TEMPO:
Hash Criptográfico de Emissão: ${cert.immutable_hash}
Data/Hora de Emissão: ${new Date(cert.issued_at).toLocaleString('pt-BR')}

Este atestado atende integralmente ao Art. 89 da Portaria MTP nº 671/2021
e comprova a idoneidade jurídica do controle de jornada por REP-P.
================================================================================
    `.trim();

    const blob = new Blob([certText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Atestado_Portaria_671_${selectedCompany?.cnpj?.replace(/\D/g, '') || 'EMPRESA'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Atestado Técnico gerado com sucesso!');
  };

  // Filtragem de resumos diários para tratamento
  const filteredSummaries = TimeManagementService.filterSummariesByInconsistency(
    dailySummaries.filter((s) => {
      if (!treatmentSearch.trim()) return true;
      const term = treatmentSearch.toLowerCase();
      return (
        s.worker_name?.toLowerCase().includes(term) ||
        s.date.includes(term) ||
        s.position_name?.toLowerCase().includes(term)
      );
    }),
    treatmentFilter
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-primary-50 text-primary-600 rounded-xl">
              <Watch className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Gestão de Ponto Eletrônico</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Controle de REPs físicos e mobile, importação AFD Portaria MTP 671/2021, tratamento de inconsistências e central de aprovações.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => initTenantAndLoad()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <a
            href="/ponto/espelho"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-sm transition"
          >
            <Clock className="w-4 h-4" />
            Espelho & Fechamento
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-primary-50 text-primary-700 font-semibold shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Info className="w-4 h-4" />
          Visão Geral
        </button>

        <button
          onClick={() => setActiveTab('devices')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition whitespace-nowrap ${
            activeTab === 'devices'
              ? 'bg-primary-50 text-primary-700 font-semibold shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Server className="w-4 h-4" />
          Dispositivos & Relógios
          <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600 font-bold">
            {devices.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('afd')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition whitespace-nowrap ${
            activeTab === 'afd'
              ? 'bg-primary-50 text-primary-700 font-semibold shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Upload className="w-4 h-4" />
          Importação AFD (Portaria 671)
          <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600 font-bold">
            {afdFiles.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('treatment')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition whitespace-nowrap ${
            activeTab === 'treatment'
              ? 'bg-primary-50 text-primary-700 font-semibold shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Tratamento & Inconsistências
          {dailySummaries.filter((s) => s.status === 'INCONSISTENT').length > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800 font-bold">
              {dailySummaries.filter((s) => s.status === 'INCONSISTENT').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('approvals')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition whitespace-nowrap ${
            activeTab === 'approvals'
              ? 'bg-primary-50 text-primary-700 font-semibold shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <CheckCircle className="w-4 h-4 text-emerald-500" />
          Central de Aprovações
          {pendingApprovals.totalCount > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-rose-100 text-rose-800 font-bold">
              {pendingApprovals.totalCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('exports')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition whitespace-nowrap ${
            activeTab === 'exports'
              ? 'bg-primary-50 text-primary-700 font-semibold shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-4 h-4 text-primary-600" />
          Exportações Fiscais (AFD / AEJ)
        </button>
      </div>

      {/* ================================================================== */}
      {/* ABA 1: VISÃO GERAL */}
      {/* ================================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Server className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Dispositivos / REPs</p>
                <h3 className="text-2xl font-black text-slate-900">{devices.length}</h3>
                <p className="text-xs text-emerald-600 font-medium">
                  {devices.filter((d) => d.status === 'ACTIVE').length} ativos e monitorados
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Inconsistências</p>
                <h3 className="text-2xl font-black text-slate-900">
                  {dailySummaries.filter((s) => s.status === 'INCONSISTENT').length}
                </h3>
                <p className="text-xs text-slate-500">Marcações ímpares e desvios</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Aprovações Pendentes</p>
                <h3 className="text-2xl font-black text-slate-900">{pendingApprovals.totalCount}</h3>
                <p className="text-xs text-rose-600 font-medium">
                  {pendingApprovals.adjustments.length} ajustes + {pendingApprovals.contests.length} contestações
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <FolderInput className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Arquivos AFD</p>
                <h3 className="text-2xl font-black text-slate-900">{afdFiles.length}</h3>
                <p className="text-xs text-emerald-600 font-medium">Portaria MTP 671/2021</p>
              </div>
            </div>
          </div>

          {/* Cards de Acesso Rápido às Rotinas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div>
                <div className="p-2.5 w-fit bg-primary-50 text-primary-600 rounded-xl mb-3">
                  <Upload className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Importação de Arquivo AFD</h3>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  Faça o upload manual de arquivos de dados de ponto extraídos de qualquer relógio homologado pelo MTP.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('afd')}
                className="mt-4 inline-flex items-center justify-between w-full px-4 py-2.5 text-sm font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-xl transition"
              >
                Importar Arquivo AFD
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div>
                <div className="p-2.5 w-fit bg-amber-50 text-amber-600 rounded-xl mb-3">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Tratar Inconsistências de Ponto</h3>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  Identifique batidas faltantes, horas extras não autorizadas, violações de intervalo e registre justificativas.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('treatment')}
                className="mt-4 inline-flex items-center justify-between w-full px-4 py-2.5 text-sm font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-xl transition"
              >
                Tratar Ocorrências
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
              <div>
                <div className="p-2.5 w-fit bg-emerald-50 text-emerald-600 rounded-xl mb-3">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Deliberação de Solicitações</h3>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  Avalie pedidos de ajustes de marcação e contestações de espelho de ponto abertas pelos colaboradores.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('approvals')}
                className="mt-4 inline-flex items-center justify-between w-full px-4 py-2.5 text-sm font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition"
              >
                Ver Central de Aprovações
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* ABA 2: DISPOSITIVOS & RELÓGIOS (REP) */}
      {/* ================================================================== */}
      {activeTab === 'devices' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Fontes e Relógios de Ponto</h2>
              <p className="text-sm text-slate-500">
                Gerencie coletores locais (Control iD), pontos por aplicativo mobile e canais de importação.
              </p>
            </div>
            <button
              onClick={() => handleOpenDeviceModal()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              Novo Dispositivo
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            {devices.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Server className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h4 className="text-base font-bold text-slate-700">Nenhum dispositivo cadastrado</h4>
                <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-4">
                  Cadastre o primeiro relógio físico Control iD ou ative o ponto mobile para este estabelecimento.
                </p>
                <button
                  onClick={() => handleOpenDeviceModal()}
                  className="px-4 py-2 text-sm font-semibold text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-xl transition"
                >
                  Cadastrar Dispositivo Agora
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-xs uppercase font-bold text-slate-500 tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Dispositivo / Nome</th>
                      <th className="py-3.5 px-4">Tipo Legal</th>
                      <th className="py-3.5 px-4">Fabricante / Modelo</th>
                      <th className="py-3.5 px-4">Nº de Série</th>
                      <th className="py-3.5 px-4">IP / Porta</th>
                      <th className="py-3.5 px-4">Último NSR</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {devices.map((device) => (
                      <tr key={device.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            {device.kind === 'REP_C' && <Server className="w-4 h-4 text-blue-500" />}
                            {device.kind === 'REP_P_MOBILE' && <Smartphone className="w-4 h-4 text-emerald-500" />}
                            {device.kind === 'IMPORT' && <FolderInput className="w-4 h-4 text-purple-500" />}
                            <span>{device.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              device.kind === 'REP_C'
                                ? 'bg-blue-50 text-blue-700'
                                : device.kind === 'REP_P_MOBILE'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-purple-50 text-purple-700'
                            }`}
                          >
                            {device.kind === 'REP_C' ? 'REP-C (Físico)' : device.kind === 'REP_P_MOBILE' ? 'REP-P (Mobile)' : 'Arquivo AFD'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {device.vendor || 'Control iD'} {device.model ? `(${device.model})` : ''}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-500">
                          {device.serial_number || '—'}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs">
                          {device.host ? `${device.host}:${device.port || 80}` : 'Nuvem / Celular'}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-800">
                          #{device.last_nsr ?? 0}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              device.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700'
                                : device.status === 'OFFLINE'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {device.status === 'ACTIVE' ? 'Ativo' : device.status === 'OFFLINE' ? 'Offline' : device.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleShowDeviceKey(device)}
                              className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-slate-100 rounded-lg transition"
                              title="Chave de Integração / HMAC"
                            >
                              <Key className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenDeviceModal(device)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteDevice(device.id || '', device.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* ABA 3: IMPORTAÇÃO DE ARQUIVO AFD (PORTARIA MTP 671) */}
      {/* ================================================================== */}
      {activeTab === 'afd' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Importar Arquivo-Fonte de Dados (AFD)</h2>
            <p className="text-sm text-slate-500 mb-6">
              O AFD é o arquivo oficial padronizado pela Portaria MTP 671/2021 contendo registros imutáveis de ponto e hash criptográfico.
            </p>

            {/* Drag and Drop Box */}
            <div className="border-2 border-dashed border-slate-300 hover:border-primary-500 rounded-2xl p-8 text-center transition bg-slate-50/50">
              <input
                type="file"
                id="afd-file-input"
                accept=".txt,.afd"
                onChange={handleAfdFileUpload}
                disabled={uploadingAfd}
                className="hidden"
              />
              <label
                htmlFor="afd-file-input"
                className={`cursor-pointer flex flex-col items-center justify-center ${uploadingAfd ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <div className="p-4 bg-primary-50 text-primary-600 rounded-2xl mb-3">
                  {uploadingAfd ? <Loader2 className="w-8 h-8 animate-spin" /> : <Upload className="w-8 h-8" />}
                </div>
                <h3 className="text-base font-bold text-slate-800">
                  {uploadingAfd ? 'Processando e validando AFD...' : 'Clique para selecionar o arquivo AFD'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">Formatos suportados: .txt ou .afd (Portaria MTP 671/2021)</p>
              </label>
            </div>

            {/* Relatório de Importação Imediato */}
            {importReport && (
              <div className={`mt-6 p-5 rounded-2xl border ${importReport.success ? 'bg-emerald-50/60 border-emerald-200' : 'bg-rose-50/60 border-rose-200'}`}>
                <div className="flex items-center gap-2 mb-3">
                  {importReport.success ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                  )}
                  <h4 className="font-bold text-slate-900">
                    {importReport.success ? 'Resultado do Processamento do AFD' : 'Inconsistência no Arquivo'}
                  </h4>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mt-3">
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-xs text-slate-500 block">Total de Batidas</span>
                    <strong className="text-lg text-slate-900">{importReport.total_records || 0}</strong>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-xs text-slate-500 block">Importadas com Sucesso</span>
                    <strong className="text-lg text-emerald-600 font-bold">{importReport.imported || 0}</strong>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-xs text-slate-500 block">Duplicadas (Ignoradas)</span>
                    <strong className="text-lg text-amber-600 font-bold">{importReport.duplicates || 0}</strong>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-xs text-slate-500 block">Rejeitadas / Erros</span>
                    <strong className="text-lg text-rose-600 font-bold">{importReport.rejected || 0}</strong>
                  </div>
                </div>

                {importReport.warnings?.length > 0 && (
                  <div className="mt-4 text-xs text-amber-900 bg-amber-50 p-4 rounded-xl border border-amber-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-amber-200/80">
                      <div>
                        <strong className="text-amber-950 font-bold flex items-center gap-1.5 text-sm">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          Avisos de conciliação ({importReport.warnings.length} colaboradores/documentos)
                        </strong>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          Batidas mantidas integralmente na trilha de auditoria do REP (Portaria 671). Caso os colaboradores sejam cadastrados posteriormente, clique em conciliar.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleReconcileAfd}
                        disabled={reconcilingAfd}
                        className="self-start sm:self-auto px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 shrink-0"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${reconcilingAfd ? 'animate-spin' : ''}`} />
                        {reconcilingAfd ? 'Conciliando...' : 'Conciliar Batidas do REP'}
                      </button>
                    </div>

                    {importReport.warnings.length > 5 && (
                      <div className="mb-2.5">
                        <input
                          type="text"
                          placeholder="Filtrar por nome ou PIS..."
                          value={warningsFilter}
                          onChange={(e) => setWarningsFilter(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-white border border-amber-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-inner"
                        />
                      </div>
                    )}

                    <div className="max-h-56 overflow-y-auto pr-2 space-y-1.5 scrollbar-thin scrollbar-thumb-amber-200">
                      {importReport.warnings
                        .filter((w: string) => !warningsFilter || w.toLowerCase().includes(warningsFilter.toLowerCase()))
                        .slice(0, showAllWarnings ? undefined : 15)
                        .map((w: string, idx: number) => (
                          <div key={idx} className="bg-amber-100/60 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg text-[11px] text-amber-950 flex items-start gap-2 border border-amber-200/50">
                            <span className="text-amber-600 font-bold mt-0.5">•</span>
                            <span className="leading-relaxed">{w}</span>
                          </div>
                        ))}
                    </div>

                    {importReport.warnings.length > 15 && (
                      <div className="mt-2.5 pt-2 border-t border-amber-200/60 flex items-center justify-between text-xs">
                        <button
                          type="button"
                          onClick={() => setShowAllWarnings(!showAllWarnings)}
                          className="font-semibold text-amber-900 hover:text-amber-950 underline cursor-pointer"
                        >
                          {showAllWarnings ? 'Mostrar menos' : `Ver todos os ${importReport.warnings.length} colaboradores listados`}
                        </button>
                        <span className="text-[11px] text-amber-700">
                          {showAllWarnings ? `Exibindo todos (${importReport.warnings.length})` : 'Exibindo os primeiros 15'}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Histórico de Arquivos Importados */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-900">Histórico de Arquivos AFD Importados</h3>
            </div>
            {afdFiles.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                Nenhum arquivo AFD foi importado ainda.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs uppercase font-bold text-slate-500">
                    <tr>
                      <th className="py-3 px-4">Nome do Arquivo</th>
                      <th className="py-3 px-4">Dispositivo</th>
                      <th className="py-3 px-4">Data do Envio</th>
                      <th className="py-3 px-4">Importadas</th>
                      <th className="py-3 px-4">Duplicadas</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Hash SHA-256</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {afdFiles.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-semibold text-slate-900 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-slate-400" />
                          {f.file_name}
                        </td>
                        <td className="py-3 px-4">{f.device_name}</td>
                        <td className="py-3 px-4">
                          {new Date(f.created_at).toLocaleString('pt-BR')}
                        </td>
                        <td className="py-3 px-4 font-bold text-emerald-600">{f.imported_records}</td>
                        <td className="py-3 px-4 text-slate-500">{f.duplicate_records}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              f.status === 'IMPORTED'
                                ? 'bg-emerald-50 text-emerald-700'
                                : f.status === 'ERROR'
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {f.status === 'IMPORTED' ? 'Importado' : f.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-400">
                          {f.file_hash ? `${f.file_hash.substring(0, 12)}...` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* ABA 4: CARTÃO DE PONTO MENSAL INTERATIVO & TRATAMENTO (PT-11) */}
      {/* ================================================================== */}
      {activeTab === 'treatment' && (
        <div className="space-y-6">
          {/* Barra de Filtros e Seletores do Cartão de Ponto */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary-600" />
                  Cartão de Ponto Mensal & Tratamento
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Inspecione as batidas reais do relógio REP, saldos de banco de horas, horas extras e lance inclusões ou abonos.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Seletor de Competência (Mês / Ano) */}
                <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      const [y, m] = selectedYearMonth.split('-').map(Number);
                      const prevDate = new Date(y, m - 2, 1);
                      setSelectedYearMonth(`${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`);
                    }}
                    className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition shadow-xs cursor-pointer"
                    title="Mês Anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-2 px-2">
                    <Calendar className="w-4 h-4 text-primary-600" />
                    <input
                      type="month"
                      value={selectedYearMonth}
                      onChange={(e) => setSelectedYearMonth(e.target.value)}
                      className="bg-transparent font-bold text-slate-800 text-sm focus:outline-none cursor-pointer"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const [y, m] = selectedYearMonth.split('-').map(Number);
                      const nextDate = new Date(y, m, 1);
                      setSelectedYearMonth(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`);
                    }}
                    className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition shadow-xs cursor-pointer"
                    title="Próximo Mês"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Botão de Incluir Batida Manual */}
                <button
                  type="button"
                  onClick={() => handleOpenManualPunchModal()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition shadow-xs cursor-pointer shrink-0"
                  title="Incluir Batida Manual Esquecida ou por Falha no Relógio"
                >
                  <Plus className="w-3.5 h-3.5 text-primary-600" />
                  Incluir Marcação Manual
                </button>

                {/* Botão de Integrar com Folha e Banco de Horas */}
                <button
                  type="button"
                  onClick={handleOpenIntegrateModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl shadow-xs transition cursor-pointer shrink-0"
                  title="Fechar Período e Alimentar Folha de Pagamento e Banco de Horas"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Integrar com Folha & Banco
                </button>
              </div>
            </div>

            {/* Linha de Seleção do Colaborador e Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                  Colaborador Ativo ({workersList.length})
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <select
                    value={selectedWorkerId}
                    onChange={(e) => setSelectedWorkerId(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 text-sm font-semibold bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none text-slate-800 transition"
                  >
                    {workersList.length === 0 ? (
                      <option value="">Nenhum colaborador localizado na empresa selecionada</option>
                    ) : (
                      workersList.map((w) => (
                        <option key={w.worker_id} value={w.worker_id}>
                          {w.full_name} · {w.position_title} {w.pis_pasep ? `(PIS: ${w.pis_pasep})` : ''}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                  Filtro de Exibição dos Dias
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={timesheetFilter}
                    onChange={(e) => setTimesheetFilter(e.target.value as any)}
                    className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none text-slate-700 font-medium"
                  >
                    <option value="ALL">Todos os Dias do Mês ({monthlyTimesheet?.days.length || 31})</option>
                    <option value="WORKED">Apenas Dias Trabalhados</option>
                    <option value="INCONSISTENCIES">Apenas Inconsistências / Faltas</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => loadWorkerTimesheet()}
                    disabled={loadingTimesheet}
                    className="p-2.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition shrink-0"
                    title="Recarregar Batidas"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingTimesheet ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Cards de Totais e Saldos do Mês */}
          {monthlyTimesheet && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Horas Trabalhadas</p>
                  <h3 className="text-2xl font-black text-slate-900">
                    {Math.floor(monthlyTimesheet.total_worked_minutes / 60)}h{' '}
                    {String(monthlyTimesheet.total_worked_minutes % 60).padStart(2, '0')}m
                  </h3>
                  <p className="text-xs text-slate-400">
                    Previsto: {Math.floor(monthlyTimesheet.total_expected_minutes / 60)}h no mês
                  </p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Horas Extras</p>
                  <h3 className="text-2xl font-black text-emerald-600">
                    +{Math.floor((monthlyTimesheet.total_overtime_50_minutes + monthlyTimesheet.total_overtime_100_minutes) / 60)}h{' '}
                    {String((monthlyTimesheet.total_overtime_50_minutes + monthlyTimesheet.total_overtime_100_minutes) % 60).padStart(2, '0')}m
                  </h3>
                  <p className="text-xs text-slate-400">
                    50%: {Math.floor(monthlyTimesheet.total_overtime_50_minutes / 60)}h | 100%: {Math.floor(monthlyTimesheet.total_overtime_100_minutes / 60)}h
                  </p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Atrasos & Faltas</p>
                  <h3 className="text-2xl font-black text-amber-600">
                    -{Math.floor((monthlyTimesheet.total_delay_minutes + monthlyTimesheet.total_absence_minutes) / 60)}h{' '}
                    {String((monthlyTimesheet.total_delay_minutes + monthlyTimesheet.total_absence_minutes) % 60).padStart(2, '0')}m
                  </h3>
                  <p className="text-xs text-slate-400">
                    Faltas: {Math.floor(monthlyTimesheet.total_absence_minutes / 60)}h | Atrasos: {monthlyTimesheet.total_delay_minutes}m
                  </p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
                <div className={`p-3 rounded-xl ${monthlyTimesheet.time_bank_balance_minutes >= 0 ? 'bg-purple-50 text-purple-600' : 'bg-rose-50 text-rose-600'}`}>
                  <Watch className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Saldo Banco de Horas</p>
                  <h3 className={`text-2xl font-black ${monthlyTimesheet.time_bank_balance_minutes >= 0 ? 'text-purple-600' : 'text-rose-600'}`}>
                    {monthlyTimesheet.time_bank_balance_minutes >= 0 ? '+' : '-'}
                    {Math.floor(Math.abs(monthlyTimesheet.time_bank_balance_minutes) / 60)}h{' '}
                    {String(Math.abs(monthlyTimesheet.time_bank_balance_minutes) % 60).padStart(2, '0')}m
                  </h3>
                  <p className="text-xs text-slate-400">Acumulado na conta do colaborador</p>
                </div>
              </div>
            </div>
          )}

          {/* Tabela do Cartão de Ponto Dia a Dia */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">
                  Espelho do Mês: {monthlyTimesheet?.month_label || 'Período'} · {monthlyTimesheet?.worker_name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cargo: {monthlyTimesheet?.position_title} · Registro imutável Portaria MTP 671/2021
                </p>
              </div>

              <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
                {(monthlyTimesheet?.days || []).reduce((acc, d) => acc + d.punches.length, 0)} batidas registradas no mês
              </span>
            </div>

            {loadingTimesheet ? (
              <div className="flex flex-col items-center justify-center p-16 space-y-3">
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                <p className="text-sm font-medium text-slate-500">Calculando espelho e batidas do relógio...</p>
              </div>
            ) : !monthlyTimesheet || monthlyTimesheet.days.length === 0 ? (
              <div className="text-center py-12 px-4">
                <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <h4 className="text-base font-bold text-slate-700">Nenhum registro localizado</h4>
                <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
                  Selecione um colaborador acima para visualizar o cartão de ponto mensal.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50/90 border-b border-slate-200 text-xs uppercase font-bold text-slate-500">
                    <tr>
                      <th className="py-3.5 px-4 w-32">Dia / Data</th>
                      <th className="py-3.5 px-4 min-w-[280px]">Batidas Reais do Relógio (REP)</th>
                      <th className="py-3.5 px-4 w-36">Horas Trabalhadas</th>
                      <th className="py-3.5 px-4 w-32">Extras / Saldo</th>
                      <th className="py-3.5 px-4 min-w-[180px]">Ocorrência / Status</th>
                      <th className="py-3.5 px-4 text-right w-44">Ações de Tratamento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {monthlyTimesheet.days
                      .filter((d) => {
                        if (timesheetFilter === 'WORKED') return d.worked_minutes > 0;
                        if (timesheetFilter === 'INCONSISTENCIES') {
                          return d.status === 'MISSING_PUNCH' || d.status === 'ABSENCE' || d.status === 'DELAY';
                        }
                        return true;
                      })
                      .map((day) => (
                        <tr
                          key={day.date}
                          className={`hover:bg-slate-50/80 transition ${
                            day.isWeekend ? 'bg-slate-50/40 text-slate-500' : ''
                          }`}
                        >
                          {/* Dia e Data */}
                          <td className="py-3 px-4 font-mono">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                                  day.isWeekend
                                    ? 'bg-slate-200/80 text-slate-600'
                                    : 'bg-primary-50 text-primary-700'
                                }`}
                              >
                                {String(day.dayOfMonth).padStart(2, '0')}
                              </span>
                              <div>
                                <p className="font-semibold text-slate-800 text-xs leading-tight">
                                  {day.dayOfWeek}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {day.date.split('-').reverse().slice(0, 2).join('/')}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Batidas do Relógio (Originais REP) */}
                          <td className="py-3 px-4">
                            {day.punches.length === 0 ? (
                              day.isWeekend ? (
                                <span className="text-xs text-slate-400 font-medium">Folga / DSR</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                                  Sem marcação
                                </span>
                              )
                            ) : (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {day.punches.map((p, idx) => (
                                  <button
                                    key={p.id || idx}
                                    type="button"
                                    onClick={() => handleOpenShiftModal(p, day.date)}
                                    className={`group px-2.5 py-1 text-xs font-mono font-bold rounded-lg shadow-xs flex items-center gap-1.5 border transition-all cursor-pointer select-none text-left ${
                                      p.source === 'MANUAL'
                                        ? 'bg-amber-50 text-amber-900 border-amber-300 hover:border-amber-400'
                                        : p.is_shifted
                                        ? 'bg-indigo-950 text-indigo-100 border-indigo-600 hover:border-indigo-400 shadow-sm'
                                        : 'bg-slate-900 text-slate-100 border-slate-800 hover:border-slate-600 hover:bg-slate-800'
                                    }`}
                                    title={
                                      p.is_shifted
                                        ? `Batida alocada na jornada de ${day.date} (original: ${p.original_date} às ${p.time}) · Clique para desfazer`
                                        : `NSR: ${p.nsr || '—'} · Origem: ${p.source} · Clique para alocar no encerramento da jornada do dia anterior`
                                    }
                                  >
                                    <span>{p.time}</span>
                                    {p.is_shifted && (
                                      <span className="text-[9px] bg-indigo-500 text-white px-1 py-0.2 rounded font-sans font-bold flex items-center gap-0.5" title="Alocada no dia anterior">
                                        D-1 ☾
                                      </span>
                                    )}
                                    {p.source === 'MANUAL' && (
                                      <span className="text-[9px] bg-amber-400 text-slate-900 px-1 rounded font-sans font-black">
                                        M
                                      </span>
                                    )}
                                    {!p.is_shifted && (
                                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-indigo-400">
                                        <CornerUpLeft size={11} />
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* Horas Trabalhadas */}
                          <td className="py-3 px-4 font-mono text-xs">
                            {day.worked_minutes > 0 ? (
                              <div>
                                <span className="font-bold text-slate-900 text-sm">
                                  {Math.floor(day.worked_minutes / 60)}h{' '}
                                  {String(day.worked_minutes % 60).padStart(2, '0')}m
                                </span>
                                {day.break_minutes > 0 && (
                                  <span className="text-[11px] text-slate-400 block">
                                    Int: {Math.floor(day.break_minutes / 60)}h {day.break_minutes % 60}m
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          {/* Extras / Saldo do Dia */}
                          <td className="py-3 px-4 font-mono text-xs">
                            {day.overtime_50_minutes > 0 && (
                              <span className="text-emerald-600 font-bold block">
                                +{Math.floor(day.overtime_50_minutes / 60)}h{day.overtime_50_minutes % 60}m (50%)
                              </span>
                            )}
                            {day.overtime_100_minutes > 0 && (
                              <span className="text-purple-600 font-bold block">
                                +{Math.floor(day.overtime_100_minutes / 60)}h{day.overtime_100_minutes % 60}m (100%)
                              </span>
                            )}
                            {day.delay_minutes > 0 && (
                              <span className="text-amber-600 font-bold block">
                                -{day.delay_minutes}m (atraso)
                              </span>
                            )}
                            {!day.overtime_50_minutes && !day.overtime_100_minutes && !day.delay_minutes && (
                              <span className="text-slate-400">00h 00m</span>
                            )}
                          </td>

                          {/* Ocorrência / Status */}
                          <td className="py-3 px-4">
                            {day.status === 'REGULAR' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Check className="w-3 h-3" />
                                Regular
                              </span>
                            )}
                            {day.status === 'MISSING_PUNCH' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                                <AlertTriangle className="w-3 h-3" />
                                Batida Ímpar (Falta saída)
                              </span>
                            )}
                            {day.status === 'DAY_OFF' && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                Folga / DSR
                              </span>
                            )}
                            {day.status === 'ABSENCE' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                Falta Injustificada
                              </span>
                            )}
                            {day.status === 'DELAY' && (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                Atraso ({day.delay_minutes}m)
                              </span>
                            )}
                            {day.status === 'JUSTIFIED' && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200" title={day.justification}>
                                <CheckCircle className="w-3 h-3" />
                                Abonado / Justificado
                              </span>
                            )}
                          </td>

                          {/* Ações de Tratamento */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenManualPunchModal(day.date)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition"
                                title="Incluir Batida Manual Esquecida"
                              >
                                <Plus className="w-3 h-3" />
                                Batida
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenAbonoModal(day.date)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
                                title="Abonar ou Justificar Dia"
                              >
                                <FileText className="w-3 h-3" />
                                Abonar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* ABA 5: CENTRAL DE APROVAÇÕES DO GESTOR */}
      {/* ================================================================== */}
      {activeTab === 'approvals' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Central de Aprovações de Ponto</h2>
            <p className="text-sm text-slate-500">
              Delibere sobre solicitações de inclusão de batidas, contestações de espelho de ponto e folgas de banco de horas.
            </p>
          </div>

          {/* Seção 1: Ajustes Solicitados */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Clock className="w-5 h-5" />
                </span>
                <h3 className="font-bold text-slate-900">Ajustes e Marcações Esquecidas</h3>
              </div>
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800">
                {pendingApprovals.adjustments.length} pendentes
              </span>
            </div>

            {pendingApprovals.adjustments.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">Nenhum ajuste aguardando aprovação.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {pendingApprovals.adjustments.map((adj) => (
                  <div key={adj.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-900">{adj.worker_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Batida solicitada: <strong>{adj.entry_type}</strong> em{' '}
                        {new Date(adj.requested_timestamp).toLocaleString('pt-BR')}
                      </p>
                      <p className="text-xs text-slate-600 mt-1 bg-slate-50 p-2 rounded-lg border border-slate-200 inline-block">
                        <strong>Motivo:</strong> {adj.adjustment_reason}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReviewAdjustment(adj, true)}
                        disabled={processingApproval}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Aprovar
                      </button>
                      <button
                        onClick={() => handleReviewAdjustment(adj, false)}
                        disabled={processingApproval}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition"
                      >
                        <X className="w-3.5 h-3.5" />
                        Recusar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Seção 2: Contestações de Espelho de Ponto (Portaria MTP 671) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <AlertTriangle className="w-5 h-5" />
                </span>
                <h3 className="font-bold text-slate-900">Contestações Formais de Espelho de Ponto</h3>
              </div>
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800">
                {pendingApprovals.contests.length} pendentes
              </span>
            </div>

            {pendingApprovals.contests.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">Nenhuma contestação aberta pelos colaboradores.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {pendingApprovals.contests.map((c) => (
                  <div key={c.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{c.worker_name}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
                          {c.period_label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Datas afetadas:{' '}
                        <strong>
                          {c.affected_dates && c.affected_dates.length > 0
                            ? c.affected_dates.join(', ')
                            : 'Todo o período'}
                        </strong>
                      </p>
                      <p className="text-xs text-amber-900 bg-amber-50/80 p-2.5 rounded-xl border border-amber-200 mt-2">
                        <strong>Motivo da Contestação:</strong> {c.reason}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReviewContest(c, true)}
                        disabled={processingApproval}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Deferir (Reabrir Espelho)
                      </button>
                      <button
                        onClick={() => handleReviewContest(c, false)}
                        disabled={processingApproval}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition"
                      >
                        <X className="w-3.5 h-3.5" />
                        Indeferir
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* ABA 6: EXPORTAÇÕES FISCAIS (AFD, AEJ E ATESTADO PORTARIA 671) */}
      {/* ================================================================== */}
      {activeTab === 'exports' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Exportações para Auditoria e Fiscalização Trabalhista</h2>
                <p className="text-sm text-slate-500">
                  Geração dos arquivos oficiais exigidos pelos Auditores-Fiscais do Trabalho (MTP / Portaria 671/2021).
                </p>
              </div>

              {/* Seletor de Período para Exportação */}
              <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-500 font-bold">Período:</span>
                <input
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                  className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <span className="text-xs text-slate-400">até</span>
                <input
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                  className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: AFD */}
              <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-xl w-fit mb-3">
                    <Server className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">AFD (Arquivo-Fonte de Dados)</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Arquivo bruto padronizado (Portaria 671, Art. 81 e Anexo V) com cabeçalho Tipo 1, registros Tipo 3 com NSR e CRC-16 e trailer Tipo 9.
                  </p>
                </div>

                <button
                  onClick={handleDownloadAfd}
                  disabled={exportingAfd}
                  className="mt-5 inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-sm disabled:opacity-50"
                >
                  {exportingAfd ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  Baixar Arquivo AFD (.txt)
                </button>
              </div>

              {/* Card 2: AEJ */}
              <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="p-3 bg-primary-50 text-primary-600 rounded-xl w-fit mb-3">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">AEJ (Arquivo Eletrônico de Jornada)</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Arquivo oficial do PTRP (Portaria 671, Art. 83 e Anexo VI) com identificação do desenvolvedor coupleRH, empregados, horários tratados e banco de horas.
                  </p>
                </div>

                <button
                  onClick={handleDownloadAej}
                  disabled={exportingAej}
                  className="mt-5 inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition shadow-sm disabled:opacity-50"
                >
                  {exportingAej ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  Baixar Arquivo AEJ (.txt)
                </button>
              </div>

              {/* Card 3: Atestado Técnico Art. 89 */}
              <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl w-fit mb-3">
                    <Shield className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">Atestado Técnico e Termo</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Termo de Responsabilidade e Atestado Técnico de Conformidade do Software (Art. 89 da Portaria 671/2021) com hash imutável e declarações legais.
                  </p>
                </div>

                <button
                  onClick={handleDownloadCertificate}
                  className="mt-5 inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-sm"
                >
                  <Shield className="w-4 h-4" />
                  Emitir Atestado (.txt)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL: CADASTRO / EDIÇÃO DE DISPOSITIVO */}
      {/* ================================================================== */}
      {deviceModalOpen && editingDevice && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-lg">
                {editingDevice.id ? 'Editar Dispositivo' : 'Cadastrar Novo Dispositivo'}
              </h3>
              <button
                onClick={() => setDeviceModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDevice} className="space-y-4 mt-4">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Nome Identificador *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: REP Fábrica Entrada 1"
                  value={editingDevice.name || ''}
                  onChange={(e) => setEditingDevice({ ...editingDevice, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Tipo de Dispositivo *
                  </label>
                  <select
                    value={editingDevice.kind || 'REP_C'}
                    onChange={(e) => setEditingDevice({ ...editingDevice, kind: e.target.value as TimeDeviceKind })}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  >
                    <option value="REP_C">REP-C (Relógio Físico)</option>
                    <option value="REP_P_MOBILE">REP-P (Ponto Celular / PWA)</option>
                    <option value="IMPORT">Canal de Importação AFD</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Fabricante
                  </label>
                  <input
                    type="text"
                    placeholder="Control iD, Henry, Dimep..."
                    value={editingDevice.vendor || ''}
                    onChange={(e) => setEditingDevice({ ...editingDevice, vendor: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  >
                  </input>
                </div>
              </div>

              {editingDevice.kind === 'REP_C' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        Modelo
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: iDClass"
                        value={editingDevice.model || ''}
                        onChange={(e) => setEditingDevice({ ...editingDevice, model: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        Nº de Série INMETRO *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Nº de Registro"
                        value={editingDevice.serial_number || ''}
                        onChange={(e) => setEditingDevice({ ...editingDevice, serial_number: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        IP Local / Host
                      </label>
                      <input
                        type="text"
                        placeholder="192.168.1.100"
                        value={editingDevice.host || ''}
                        onChange={(e) => setEditingDevice({ ...editingDevice, host: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                        Porta
                      </label>
                      <input
                        type="number"
                        placeholder="80"
                        value={editingDevice.port || 80}
                        onChange={(e) => setEditingDevice({ ...editingDevice, port: Number(e.target.value) })}
                        className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none font-mono"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeviceModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-sm transition"
                >
                  Salvar Dispositivo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL: CHAVE DE INTEGRAÇÃO HMAC */}
      {/* ================================================================== */}
      {keyModalOpen && selectedDeviceKey && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <span className="p-3 bg-primary-50 text-primary-600 rounded-2xl">
                <Key className="w-6 h-6" />
              </span>
              <div>
                <h3 className="font-bold text-slate-900">Chave de Integração do Dispositivo</h3>
                <p className="text-xs text-slate-500">{selectedDeviceKey.name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Utilize esta chave no coletor local (agente Node/Control iD) ou nos headers HTTP para autenticar o envio de batidas à Edge Function <code className="bg-slate-100 px-1 py-0.5 rounded text-primary-700">time-ingest</code> com assinatura HMAC-SHA256:
            </p>

            <div className="bg-slate-900 text-slate-100 font-mono text-xs p-3.5 rounded-xl break-all mb-4 select-all">
              {selectedDeviceKey.key}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedDeviceKey.key);
                  toast.success('Chave copiada para a área de transferência!');
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition shadow-sm"
              >
                Copiar Chave
              </button>
              <button
                onClick={() => setKeyModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL: TRATAR INCONSISTÊNCIA / AJUSTE MANUAL */}
      {/* ================================================================== */}
      {adjustModalOpen && selectedSummaryToAdjust && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900">Tratar Inconsistência de Ponto</h3>
                <p className="text-xs text-slate-500">
                  {selectedSummaryToAdjust.worker_name} · Data: {selectedSummaryToAdjust.date.split('-').reverse().join('/')}
                </p>
              </div>
              <button
                onClick={() => setAdjustModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-4 mt-4">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Tipo de Marcação a Incluir *
                </label>
                <select
                  value={adjustForm.entry_type}
                  onChange={(e) => setAdjustForm({ ...adjustForm, entry_type: e.target.value as any })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="IN">Entrada (Início de Turno)</option>
                  <option value="BREAK_START">Saída para Intervalo (Almoço)</option>
                  <option value="BREAK_END">Retorno do Intervalo</option>
                  <option value="OUT">Saída (Fim de Turno)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Horário Real *
                </label>
                <input
                  type="time"
                  required
                  value={adjustForm.time}
                  onChange={(e) => setAdjustForm({ ...adjustForm, time: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Justificativa Legal / Motivo *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Ex: Esquecimento de crachá confirmado com o gestor; Atestado médico de 2h; Serviço externo autorizado."
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-sm transition"
                >
                  Gravar Ajuste Aprovado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL: INCLUSÃO MANUAL DE BATIDA (PORTARIA MTP 671/2021) */}
      {/* ================================================================== */}
      {manualPunchModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-primary-50 text-primary-600 rounded-xl">
                  <Clock className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900">Incluir Marcação de Ponto</h3>
                  <p className="text-xs text-slate-500">
                    {workersList.find((w) => w.worker_id === selectedWorkerId)?.full_name || 'Colaborador'} · {manualPunchDate ? manualPunchDate.split('-').reverse().join('/') : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setManualPunchModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveManualPunch} className="space-y-4 mt-4">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Colaborador *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <select
                    value={manualPunchWorkerId}
                    onChange={(e) => setManualPunchWorkerId(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 font-semibold text-slate-800"
                  >
                    {workersList.map((w) => (
                      <option key={w.worker_id} value={w.worker_id}>
                        {w.full_name} · {w.position_title} {w.pis_pasep ? `(PIS: ${w.pis_pasep})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Data da Batida *
                  </label>
                  <input
                    type="date"
                    required
                    value={manualPunchDate}
                    onChange={(e) => setManualPunchDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Horário Real *
                  </label>
                  <input
                    type="time"
                    required
                    value={manualPunchTime}
                    onChange={(e) => setManualPunchTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono font-bold text-slate-900 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Tipo da Marcação *
                </label>
                <select
                  value={manualPunchType}
                  onChange={(e) => setManualPunchType(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none font-medium text-slate-800"
                >
                  <option value="IN">Entrada (Início de Jornada)</option>
                  <option value="BREAK_START">Saída para Intervalo (Almoço)</option>
                  <option value="BREAK_END">Retorno de Intervalo</option>
                  <option value="OUT">Saída (Fim de Jornada)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    Justificativa Legal / Motivo *
                  </label>
                  <span className="text-[11px] text-slate-400">Clique para preenchimento rápido</span>
                </div>

                {/* Atalhos de Motivos Frequentes (Falta de energia, esquecimento, etc) */}
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  <button
                    type="button"
                    onClick={() => setManualPunchReason('Queda de energia no estabelecimento / Relógio parou de funcionar')}
                    className="px-2.5 py-1 text-xs bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    ⚡ Queda de energia / Relógio parou
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualPunchReason('Esquecimento do registro de ponto pelo colaborador')}
                    className="px-2.5 py-1 text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-medium transition cursor-pointer shadow-2xs"
                  >
                    ⏰ Esquecimento do colaborador
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualPunchReason('Inconsistência técnica no coletor / Biometria não reconhecida')}
                    className="px-2.5 py-1 text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-medium transition cursor-pointer shadow-2xs"
                  >
                    📟 Falha técnica no coletor REP
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualPunchReason('Serviço externo autorizado / Trabalho fora da sede')}
                    className="px-2.5 py-1 text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-medium transition cursor-pointer shadow-2xs"
                  >
                    🚗 Serviço externo autorizado
                  </button>
                </div>

                <textarea
                  required
                  rows={2}
                  placeholder="Descreva a justificativa (ex: Falta de energia elétrica das 11h às 13h no estabelecimento)..."
                  value={manualPunchReason}
                  onChange={(e) => setManualPunchReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none text-slate-800"
                />
              </div>

              <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Portaria MTP nº 671/2021:</strong> Esta inclusão será gravada no banco com identificação de origem <code>MANUAL</code> e comporá a trilha de auditoria fiscal e o Espelho de Ponto.
                </p>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setManualPunchModalOpen(false)}
                  disabled={savingManualPunch}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingManualPunch}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {savingManualPunch ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gravando...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Gravar Marcação
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL: INTEGRAR PONTO À FOLHA DE PAGAMENTO E BANCO DE HORAS */}
      {/* ================================================================== */}
      {integrateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Zap className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900">Integrar Ponto à Folha e Banco de Horas</h3>
                  <p className="text-xs text-slate-500">
                    Competência: <strong className="text-slate-800">{monthlyTimesheet?.month_label || selectedYearMonth}</strong> · {workersList.length} colaboradores
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIntegrateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mt-4">
              {/* Card de Regras e Destino */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-2">
                <p className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  Como o sistema processa as horas apuradas:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1">
                  <li><strong>Adicional Noturno (cód 301):</strong> SEMPRE lançado na Folha de Pagamento conforme CLT Art. 73 e Súmula 60 TST.</li>
                  <li><strong>Atrasos e Faltas (cód 801/802):</strong> Lançados na Folha para desconto ou debitados do Banco de Horas.</li>
                  <li><strong>Horas Extras 50% e 100%:</strong> Destinadas conforme a opção abaixo.</li>
                </ul>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                  Destino das Horas Extras Apuradas:
                </label>
                <div className="grid grid-cols-1 gap-2.5">
                  <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${integrateDestiny === 'HYBRID' ? 'bg-primary-50/60 border-primary-500 ring-1 ring-primary-500' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                    <input
                      type="radio"
                      name="integrateDestiny"
                      value="HYBRID"
                      checked={integrateDestiny === 'HYBRID'}
                      onChange={() => setIntegrateDestiny('HYBRID')}
                      className="mt-1 text-primary-600"
                    />
                    <div>
                      <strong className="text-sm text-slate-900 block font-bold">Regime Híbrido Automático (Recomendado)</strong>
                      <span className="text-xs text-slate-500">Colaboradores com Banco de Horas ativo acumulam créditos; colaboradores com contrato padrão recebem o pagamento das extras em folha (rubricas 150 e 160).</span>
                    </div>
                  </label>

                  <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${integrateDestiny === 'BANK_ONLY' ? 'bg-primary-50/60 border-primary-500 ring-1 ring-primary-500' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                    <input
                      type="radio"
                      name="integrateDestiny"
                      value="BANK_ONLY"
                      checked={integrateDestiny === 'BANK_ONLY'}
                      onChange={() => setIntegrateDestiny('BANK_ONLY')}
                      className="mt-1 text-primary-600"
                    />
                    <div>
                      <strong className="text-sm text-slate-900 block font-bold">Creditar Tudo no Banco de Horas (Compensação)</strong>
                      <span className="text-xs text-slate-500">Todas as horas extras são creditadas nas contas de banco de horas (CLT Art. 59 §5º). Abre a conta automaticamente se o colaborador ainda não possuir.</span>
                    </div>
                  </label>

                  <label className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition ${integrateDestiny === 'PAYROLL_ONLY' ? 'bg-primary-50/60 border-primary-500 ring-1 ring-primary-500' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                    <input
                      type="radio"
                      name="integrateDestiny"
                      value="PAYROLL_ONLY"
                      checked={integrateDestiny === 'PAYROLL_ONLY'}
                      onChange={() => setIntegrateDestiny('PAYROLL_ONLY')}
                      className="mt-1 text-primary-600"
                    />
                    <div>
                      <strong className="text-sm text-slate-900 block font-bold">Pagar Todas as Horas Extras na Folha (Dinheiro)</strong>
                      <span className="text-xs text-slate-500">Gera lançamentos variáveis imediatos das rubricas 150 (HE 50%) e 160 (HE 100%) para cálculo no holerite do mês.</span>
                    </div>
                  </label>
                </div>
              </div>

              {integrateResult && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
                  <p className="font-bold text-emerald-950 flex items-center gap-1.5 text-sm">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    Integração concluída com sucesso!
                  </p>
                  <p>• {integrateResult.total_contracts_processed} contratos processados.</p>
                  <p>• {integrateResult.total_events_created} eventos gerados na Folha de Pagamento.</p>
                  <p>• {Math.floor(integrateResult.total_bank_credits_minutes / 60)}h {integrateResult.total_bank_credits_minutes % 60}m creditados no Banco de Horas.</p>
                  <p>• {integrateResult.total_payroll_he_hours}h extras e {integrateResult.total_night_shift_hours}h noturnas enviadas à folha.</p>
                </div>
              )}

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIntegrateModalOpen(false)}
                  disabled={integrating}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  {integrateResult ? 'Fechar' : 'Cancelar'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmIntegrate}
                  disabled={integrating}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {integrating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processando Apuração e Folha...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      {integrateResult ? 'Re-executar Integração' : 'Confirmar e Integrar com a Folha'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL: ABONO / JUSTIFICATIVA LEGAL DO DIA (CLT ART. 473) */}
      {/* ================================================================== */}
      {abonoModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <FileText className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900">Abonar / Justificar Dia de Trabalho</h3>
                  <p className="text-xs text-slate-500">
                    {workersList.find((w) => w.worker_id === selectedWorkerId)?.full_name || 'Colaborador'} · {abonoDate ? abonoDate.split('-').reverse().join('/') : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAbonoModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAbono} className="space-y-4 mt-4">
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Data do Abono / Falta *
                </label>
                <input
                  type="date"
                  required
                  value={abonoDate}
                  onChange={(e) => setAbonoDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Enquadramento Legal / Tipo de Abono *
                </label>
                <select
                  value={abonoType}
                  onChange={(e) => setAbonoType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium text-slate-800"
                >
                  <option value="Atestado Médico (Art. 473 CLT)">Atestado Médico (Art. 473 CLT)</option>
                  <option value="Declaração de Comparecimento Médico">Declaração de Comparecimento Médico / Consulta</option>
                  <option value="Falta Abonada pela Empresa (Liberalidade)">Falta Abonada pela Empresa (Liberalidade)</option>
                  <option value="Casamento / Gala (3 dias - Art. 473 CLT)">Casamento / Gala (3 dias consecutivos - Art. 473 II CLT)</option>
                  <option value="Luto / Nojo (2 dias - Art. 473 CLT)">Falecimento de Cônjuge / Ascendente / Descendente (2 dias - Art. 473 I CLT)</option>
                  <option value="Doação de Sangue Voluntária (Art. 473 IV)">Doação de Sangue Voluntária (1 dia/ano - Art. 473 IV CLT)</option>
                  <option value="Convocação Judicial / Júri / Eleitoral">Convocação Judicial / Tribunal do Júri / Eleitoral</option>
                  <option value="Licença Paternidade (5 dias CLT)">Licença Paternidade (5 dias - CLT / CF Art. 7º)</option>
                  <option value="Outro Motivo Deferido">Outra Justificativa Deferida pelo DP</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Detalhamento / Justificativa *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Ex: Apresentado atestado médico do Dr. Silva CRM 12345 com afastamento por 1 dia (CID Z00)."
                  value={abonoReason}
                  onChange={(e) => setAbonoReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none text-slate-800"
                />
              </div>

              <div className="p-3 bg-indigo-50/80 border border-indigo-200/80 rounded-xl text-xs text-indigo-800 flex items-start gap-2">
                <CheckCircle className="w-4 h-4 shrink-0 text-indigo-600 mt-0.5" />
                <p className="leading-relaxed">
                  O abono desconsiderará faltas e atrasos para este dia no cálculo do espelho mensal e consolidará a justificativa legal.
                </p>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAbonoModalOpen(false)}
                  disabled={savingAbono}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingAbono}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {savingAbono ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gravando...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Confirmar Abono
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* MODAL: AJUSTE DE JORNADA NOTURNA (VIRADA DE MEIA-NOITE) */}
      {/* ================================================================== */}
      {shiftPunchModalOpen && selectedPunchToShift && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Moon className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900">Ajuste de Jornada Noturna</h3>
                  <p className="text-xs text-slate-500">
                    Alocação de batida após a meia-noite
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShiftPunchModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mt-4">
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Horário da Marcação:</span>
                  <span className="font-mono font-bold text-base text-slate-900 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200">
                    {selectedPunchToShift.punch.time}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Dia Civil Registrado:</span>
                  <span className="font-semibold text-slate-700">
                    {selectedPunchToShift.currentDate.split('-').reverse().join('/')}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Origem do Ponto:</span>
                  <span className="font-semibold text-slate-700">
                    {selectedPunchToShift.punch.source}
                  </span>
                </div>
                {selectedPunchToShift.punch.is_shifted && (
                  <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200">
                    <span className="text-indigo-600 font-bold">Situação Atual:</span>
                    <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold">
                      Alocada na jornada de {selectedPunchToShift.currentDate.split('-').reverse().join('/')}
                    </span>
                  </div>
                )}
              </div>

              {!selectedPunchToShift.punch.is_shifted ? (
                <div className="space-y-2.5">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Esta marcação foi registrada após a meia-noite (<strong className="text-slate-900">{selectedPunchToShift.punch.time}</strong>). Se o colaborador ultrapassou o horário para encerrar a jornada iniciada no dia anterior, você pode alocá-la como a saída do turno do dia <strong className="text-indigo-600">{selectedPunchToShift.previousDate.split('-').reverse().join('/')}</strong>.
                  </p>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      O registro original na trilha <em>time_punch_records</em> permanece 100% imutável. A alocação é registrada e auditada como ajuste do DP.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Esta batida está atualmente alocada na jornada do dia anterior. Deseja desfazer o ajuste e devolvê-la para o dia civil original (<strong className="text-slate-900">{selectedPunchToShift.punch.original_date ? selectedPunchToShift.punch.original_date.split('-').reverse().join('/') : selectedPunchToShift.currentDate}</strong>)?
                  </p>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShiftPunchModalOpen(false)}
                  disabled={savingShiftPunch}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={savingShiftPunch}
                  onClick={handleConfirmShiftPunch}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition disabled:opacity-50 ${
                    selectedPunchToShift.punch.is_shifted
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {savingShiftPunch ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processando...
                    </>
                  ) : selectedPunchToShift.punch.is_shifted ? (
                    <>
                      <Undo2 className="w-4 h-4" />
                      Desfazer Alocação
                    </>
                  ) : (
                    <>
                      <CornerUpLeft className="w-4 h-4" />
                      Alocar no Dia Anterior ({selectedPunchToShift.previousDate.split('-').reverse().slice(0, 2).join('/')})
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
