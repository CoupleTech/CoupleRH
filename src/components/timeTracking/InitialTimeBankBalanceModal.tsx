import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  User,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Upload,
  FileSpreadsheet,
  Download,
  Info,
  Loader2,
  FileText,
  ShieldCheck,
  Plus,
  Minus,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import {
  TimeManagementService,
  type WorkerOption,
  type InitialBalancesBatchResult
} from '../../services/timeTracking/timeManagementService';
import {
  TimeBankService,
  formatMinutesToHours,
  parseHoursToMinutes,
  type TimeBankPolicyType
} from '../../services/timeTracking/timeBankService';

interface InitialTimeBankBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  companyId?: string;
  workersList: WorkerOption[];
  selectedWorkerId?: string;
  onSuccess: () => Promise<void> | void;
}

export const InitialTimeBankBalanceModal: React.FC<InitialTimeBankBalanceModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  companyId,
  workersList,
  selectedWorkerId,
  onSuccess
}) => {
  const [activeTab, setActiveTab] = useState<'individual' | 'batch'>('individual');

  // Estados da Aba 1 (Individual)
  const [localWorkers, setLocalWorkers] = useState<WorkerOption[]>(workersList);
  const [loadingWorkers, setLoadingWorkers] = useState<boolean>(false);
  const [workerId, setWorkerId] = useState<string>('');
  const [cutoffDate, setCutoffDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [balanceSign, setBalanceSign] = useState<'+' | '-'>('+');
  const [balanceHoursStr, setBalanceHoursStr] = useState<string>('10:00');
  const [policyType, setPolicyType] = useState<TimeBankPolicyType>('ACORDO_INDIVIDUAL');
  const [validityMonths, setValidityMonths] = useState<number>(6);
  const [justification, setJustification] = useState<string>('Migração de saldo legado - Sistema Anterior');
  const [savingIndividual, setSavingIndividual] = useState<boolean>(false);

  // Estados da Aba 2 (Lote)
  const [csvContent, setCsvContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [previewData, setPreviewData] = useState<{
    validRows: any[];
    invalidRows: any[];
    totalLines: number;
  } | null>(null);
  const [processingBatch, setProcessingBatch] = useState<boolean>(false);
  const [batchResult, setBatchResult] = useState<InitialBalancesBatchResult | null>(null);

  // Sincronizar e carregar colaboradores caso a lista pai venha vazia
  useEffect(() => {
    if (workersList && workersList.length > 0) {
      setLocalWorkers(workersList);
      if (!workerId || !workersList.some((w) => w.worker_id === workerId)) {
        setWorkerId(selectedWorkerId || workersList[0].worker_id);
      }
    } else if (isOpen && tenantId) {
      setLoadingWorkers(true);
      TimeManagementService.fetchWorkersForTimeManagement(tenantId, companyId)
        .then((data) => {
          setLocalWorkers(data);
          if (data.length > 0) {
            setWorkerId((prev) => (prev && data.some((w) => w.worker_id === prev) ? prev : data[0].worker_id));
          }
        })
        .catch((err) => {
          console.error('Erro ao buscar colaboradores no modal:', err);
        })
        .finally(() => {
          setLoadingWorkers(false);
        });
    }
  }, [isOpen, workersList, tenantId, companyId, selectedWorkerId]);

  // Sincronizar vigência com política
  useEffect(() => {
    if (policyType === 'ACORDO_INDIVIDUAL') {
      setValidityMonths(6);
    } else {
      setValidityMonths(12);
    }
  }, [policyType]);

  if (!isOpen) return null;

  const activeWorker = localWorkers.find((w) => w.worker_id === workerId);
  const fullBalanceStr = `${balanceSign}${balanceHoursStr.replace(/^[+-]/, '')}`;
  const parsedMinutes = parseHoursToMinutes(fullBalanceStr);

  // =========================================================================
  // Handlers - Lançamento Individual
  // =========================================================================
  const handleSaveIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerId) {
      toast.error('Selecione um colaborador.');
      return;
    }
    if (!activeWorker?.contract_id) {
      toast.error('Colaborador selecionado não possui contrato ativo.');
      return;
    }
    if (!cutoffDate) {
      toast.error('Informe a data de corte.');
      return;
    }
    if (parsedMinutes === 0 && balanceHoursStr !== '00:00' && balanceHoursStr !== '0:00') {
      toast.error('Formato de saldo de horas inválido. Utilize HH:MM (ex: 15:30).');
      return;
    }
    if (!justification.trim() || justification.trim().length < 5) {
      toast.error('Informe uma justificativa auditável com pelo menos 5 caracteres.');
      return;
    }

    setSavingIndividual(true);
    try {
      const res = await TimeManagementService.registerInitialBalance({
        tenantId,
        contractId: activeWorker.contract_id,
        cutoffDate,
        minutes: parsedMinutes,
        justification,
        policyType,
        validityMonths,
        companyId,
        userName: 'Gestor DP'
      });

      if (res.success) {
        toast.success(res.message);
        await onSuccess();
        onClose();
      }
    } catch (err: any) {
      console.error('Erro ao lançar saldo inicial:', err);
      toast.error('Erro ao salvar: ' + (err.message || 'Falha na comunicação'));
    } finally {
      setSavingIndividual(false);
    }
  };

  // =========================================================================
  // Handlers - Importação em Lote
  // =========================================================================
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text || '');
      const parsed = TimeBankService.parseInitialBalancesCsv(text || '');
      setPreviewData(parsed);
      setBatchResult(null);
    };
    reader.readAsText(file);
  };

  const handleParseManualText = () => {
    if (!csvContent.trim()) {
      toast.error('Cole o conteúdo CSV para pré-visualizar.');
      return;
    }
    const parsed = TimeBankService.parseInitialBalancesCsv(csvContent);
    setPreviewData(parsed);
    setBatchResult(null);
  };

  const handleDownloadSampleCsv = () => {
    const sample = `CPF;DATA_CORTE;SALDO;JUSTIFICATIVA;POLITICA
12345678901;${cutoffDate};+15:30;Migração do sistema anterior Secullum;ACORDO_INDIVIDUAL
98765432100;${cutoffDate};-04:15;Saldo devedor legado Senior;CCT
11122233344;${cutoffDate};+08:00;Implantação de saldo inicial Totvs;ACORDO_INDIVIDUAL`;

    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modelo_carga_saldo_inicial_banco_horas.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Modelo de importação baixado com sucesso!');
  };

  const handleProcessBatch = async () => {
    if (!csvContent.trim()) {
      toast.error('Nenhum dado CSV para importar.');
      return;
    }

    setProcessingBatch(true);
    try {
      const result = await TimeManagementService.importInitialBalancesBatch({
        tenantId,
        companyId,
        csvText: csvContent,
        userName: 'Gestor DP'
      });

      setBatchResult(result);
      if (result.successCount > 0) {
        toast.success(`Importação concluída! ${result.successCount} colaboradores atualizados.`);
        await onSuccess();
      }
      if (result.failureCount > 0) {
        toast.warning(`${result.failureCount} linhas não puderam ser importadas. Verifique o relatório.`);
      }
    } catch (err: any) {
      console.error('Erro na importação em lote:', err);
      toast.error('Falha na importação em lote: ' + (err.message || 'Tente novamente'));
    } finally {
      setProcessingBatch(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden my-8 flex flex-col max-h-[90vh]">
        {/* Cabeçalho */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-primary-50/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Carga de Saldo Inicial · Banco de Horas Legado
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                  CLT Art. 59
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Implantação ou migração de saldos acumulados de softwares anteriores (Totvs, Senior, Secullum, etc.)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Abas */}
        <div className="flex border-b border-slate-200 bg-slate-50/50 px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('individual')}
            className={`flex items-center gap-2 py-3 px-4 font-semibold text-xs border-b-2 transition ${
              activeTab === 'individual'
                ? 'border-purple-600 text-purple-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-4 h-4" />
            Lançamento Individual (Manual)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('batch')}
            className={`flex items-center gap-2 py-3 px-4 font-semibold text-xs border-b-2 transition ${
              activeTab === 'batch'
                ? 'border-purple-600 text-purple-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Carga em Lote (Arquivo CSV / Excel)
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'individual' ? (
            <form onSubmit={handleSaveIndividual} className="space-y-5">
              {/* Seleção do Colaborador */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Colaborador ({localWorkers.length})</span>
                  {loadingWorkers && (
                    <span className="text-[11px] font-normal text-purple-600 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Carregando colaboradores...
                    </span>
                  )}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <select
                    value={workerId}
                    onChange={(e) => setWorkerId(e.target.value)}
                    disabled={loadingWorkers || localWorkers.length === 0}
                    className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none text-slate-900 font-semibold transition disabled:opacity-60"
                  >
                    {loadingWorkers ? (
                      <option value="">Carregando colaboradores...</option>
                    ) : localWorkers.length === 0 ? (
                      <option value="">Nenhum colaborador localizado para esta empresa</option>
                    ) : (
                      localWorkers.map((w) => (
                        <option key={w.worker_id} value={w.worker_id}>
                          {w.full_name} {w.cpf ? `(CPF: ${w.cpf})` : ''} — {w.position_title}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                {activeWorker && (
                  <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1.5">
                    <span className="font-semibold text-slate-700">Contrato:</span> {activeWorker.contract_id.substring(0, 8)}... ·
                    <span className="font-semibold text-slate-700">Regime Contratual:</span> {activeWorker.overtime_regime || 'TIME_BANK'}
                  </p>
                )}
              </div>

              {/* Data de Corte e Tipo de Saldo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Data de Corte da Migração
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="date"
                      value={cutoffDate}
                      onChange={(e) => setCutoffDate(e.target.value)}
                      required
                      className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none text-slate-900 font-semibold"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Último dia apurado no software anterior ou 1º dia de implantação.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Saldo Inicial (Horas e Minutos)
                  </label>
                  <div className="flex items-center gap-2">
                    {/* Botão de Sinal (+ ou -) */}
                    <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setBalanceSign('+')}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1 ${
                          balanceSign === '+'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Crédito
                      </button>
                      <button
                        type="button"
                        onClick={() => setBalanceSign('-')}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1 ${
                          balanceSign === '-'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Minus className="w-3.5 h-3.5" />
                        Débito
                      </button>
                    </div>

                    {/* Input de Horas HH:MM */}
                    <div className="relative flex-1">
                      <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="HH:MM (ex: 15:30)"
                        value={balanceHoursStr}
                        onChange={(e) => setBalanceHoursStr(e.target.value)}
                        required
                        className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none text-slate-900 font-mono font-bold"
                      />
                    </div>
                  </div>

                  {/* Feedback dinâmico do saldo apurado */}
                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg ${
                        parsedMinutes > 0
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : parsedMinutes < 0
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {formatMinutesToHours(parsedMinutes)} ({Math.abs(parsedMinutes)} minutos)
                    </span>
                    <span className="text-xs text-slate-500">
                      {parsedMinutes > 0
                        ? 'Crédito a favor do trabalhador (direito a folga ou HE)'
                        : parsedMinutes < 0
                        ? 'Saldo devedor do trabalhador (a compensar em jornada)'
                        : 'Saldo zerado'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Política e Vigência */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Regime do Banco de Horas (CLT Art. 59)
                  </label>
                  <select
                    value={policyType}
                    onChange={(e) => setPolicyType(e.target.value as TimeBankPolicyType)}
                    className="w-full px-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none text-slate-900 font-medium"
                  >
                    <option value="ACORDO_INDIVIDUAL">Acordo Individual Escrito (Art. 59 § 5º CLT — Até 6 meses)</option>
                    <option value="CCT">Convenção Coletiva de Trabalho - CCT (Art. 59 § 2º CLT — Até 1 ano)</option>
                    <option value="ACT">Acordo Coletivo de Trabalho - ACT (Art. 59 § 2º CLT — Até 1 ano)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Vigência do Ciclo (Meses)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={policyType === 'ACORDO_INDIVIDUAL' ? 6 : 12}
                    value={validityMonths}
                    onChange={(e) => setValidityMonths(Number(e.target.value))}
                    className="w-full px-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none text-slate-900 font-bold"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    {policyType === 'ACORDO_INDIVIDUAL'
                      ? 'Limite legal estrito de 6 meses no acordo individual direto.'
                      : 'Permitido até 12 meses conforme pactuado no instrumento sindical.'}
                  </p>
                </div>
              </div>

              {/* Justificativa e Origem */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Justificativa e Origem do Saldo (Auditável)
                </label>
                <input
                  type="text"
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Ex: Migração de saldo anterior - Sistema Secullum Ponto 4"
                  required
                  className="w-full px-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none text-slate-900 font-medium"
                />

                {/* Atalhos rápidos de origem */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[11px] font-bold text-slate-400">Origens Frequentes:</span>
                  {[
                    'Migração de saldo legado - Sistema Secullum',
                    'Migração de saldo legado - Sistema Senior Ronda',
                    'Migração de saldo legado - Sistema Totvs Protheus',
                    'Implantação inicial validada pela Diretoria'
                  ].map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setJustification(sug)}
                      className="text-[10px] font-medium bg-slate-100 hover:bg-purple-50 hover:text-purple-700 text-slate-600 px-2 py-0.5 rounded-md transition"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              {/* Card de Governança */}
              <div className="p-3.5 bg-purple-50/60 rounded-xl border border-purple-100 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                <div className="text-xs text-purple-900 space-y-0.5">
                  <p className="font-bold">Provisionamento e Governança do Banco de Horas</p>
                  <p className="text-purple-800 leading-relaxed">
                    Se o colaborador ainda não possuir conta ativa, uma nova conta de Banco de Horas será criada
                    automaticamente com início em <strong>{cutoffDate}</strong> e transação imutável com tipo{' '}
                    <code className="bg-purple-100 px-1 py-0.5 rounded text-[11px] font-mono">INITIAL_BALANCE</code>.
                  </p>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingIndividual}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 rounded-xl shadow-xs transition cursor-pointer"
                >
                  {savingIndividual ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gravando Saldo Inicial...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Efetivar Lançamento de Saldo
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* =============================================================== */
            /* ABA 2: CARGA EM LOTE                                            */
            /* =============================================================== */
            <div className="space-y-5">
              {/* Card de Instruções e Download de Modelo */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-purple-600" />
                    Layout de Arquivo CSV / TXT para Carga em Massa
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Colunas aceitas: <code className="bg-slate-200/80 px-1 py-0.5 rounded text-[11px] font-mono">CPF;DATA_CORTE;SALDO;JUSTIFICATIVA;POLITICA</code>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadSampleCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-xl border border-purple-200 transition shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar Planilha Modelo (.csv)
                </button>
              </div>

              {/* Upload de Arquivo ou Colagem de Texto */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border-2 border-dashed border-slate-200 hover:border-purple-300 rounded-2xl p-6 text-center flex flex-col items-center justify-center bg-slate-50/50 transition">
                  <Upload className="w-8 h-8 text-purple-500 mb-2" />
                  <p className="text-xs font-bold text-slate-700">Selecione o arquivo CSV do seu computador</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 mb-3">Formatos .csv ou .txt delimitados por ponto-e-vírgula</p>
                  <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl cursor-pointer shadow-xs transition">
                    Procurar Arquivo...
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  {fileName && (
                    <span className="mt-2 text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                      Arquivo selecionado: {fileName}
                    </span>
                  )}
                </div>

                <div className="flex flex-col">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Ou Cole os Dados Diretamente
                  </label>
                  <textarea
                    rows={6}
                    value={csvContent}
                    onChange={(e) => setCsvContent(e.target.value)}
                    placeholder="CPF;DATA_CORTE;SALDO;JUSTIFICATIVA&#10;12345678901;2026-01-01;+15:30;Migração Totvs&#10;98765432100;2026-01-01;-04:00;Migração Senior"
                    className="w-full p-3 text-xs font-mono bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none flex-1 text-slate-800"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleParseManualText}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      Validar Texto Colado
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabela de Pré-visualização */}
              {previewData && (
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      Pré-Visualização dos Registros ({previewData.totalLines} linhas)
                    </h4>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        {previewData.validRows.length} Válidos
                      </span>
                      {previewData.invalidRows.length > 0 && (
                        <span className="font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                          {previewData.invalidRows.length} com Erro
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 font-bold text-slate-500 uppercase sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Linha</th>
                          <th className="py-2 px-3">Identificador / CPF</th>
                          <th className="py-2 px-3">Data Corte</th>
                          <th className="py-2 px-3">Saldo</th>
                          <th className="py-2 px-3">Política</th>
                          <th className="py-2 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {previewData.validRows.map((r, idx) => (
                          <tr key={`v-${idx}`} className="hover:bg-slate-50">
                            <td className="py-1.5 px-3">{r.raw_line_number}</td>
                            <td className="py-1.5 px-3 font-semibold text-slate-900">{r.identifier}</td>
                            <td className="py-1.5 px-3">{r.cutoff_date}</td>
                            <td className="py-1.5 px-3 font-bold text-purple-700">{r.formatted_hours}</td>
                            <td className="py-1.5 px-3 text-[11px] font-sans">{r.policy_type}</td>
                            <td className="py-1.5 px-3 font-sans">
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                <CheckCircle2 className="w-3 h-3" /> Válido
                              </span>
                            </td>
                          </tr>
                        ))}
                        {previewData.invalidRows.map((r, idx) => (
                          <tr key={`inv-${idx}`} className="bg-rose-50/40">
                            <td className="py-1.5 px-3 text-rose-600">{r.raw_line_number}</td>
                            <td className="py-1.5 px-3 text-rose-800">{r.identifier || '—'}</td>
                            <td className="py-1.5 px-3 text-rose-600">{r.cutoff_date || '—'}</td>
                            <td className="py-1.5 px-3 text-rose-600">{r.formatted_hours}</td>
                            <td className="py-1.5 px-3 text-[11px] text-rose-600 font-sans">—</td>
                            <td className="py-1.5 px-3 font-sans text-rose-700 text-[11px]">
                              {r.error}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Ação de Processamento do Lote */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      disabled={processingBatch || previewData.validRows.length === 0}
                      onClick={handleProcessBatch}
                      className="inline-flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 rounded-xl shadow-xs transition cursor-pointer"
                    >
                      {processingBatch ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processando Carga ({previewData.validRows.length} registros)...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Importar {previewData.validRows.length} Registros Válidos
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Relatório Final de Importação em Lote */}
              {batchResult && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-purple-600" />
                      Resultado da Importação em Lote
                    </h4>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                        {batchResult.successCount} Sucessos
                      </span>
                      {batchResult.failureCount > 0 && (
                        <span className="font-bold text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full">
                          {batchResult.failureCount} Falhas
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-white font-bold text-slate-500 uppercase sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Linha</th>
                          <th className="py-2 px-3">Colaborador / CPF</th>
                          <th className="py-2 px-3">Saldo</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3">Mensagem / Log</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {batchResult.items.map((item, idx) => (
                          <tr
                            key={`rep-${idx}`}
                            className={item.status === 'SUCCESS' ? 'hover:bg-slate-50' : 'bg-rose-50/50'}
                          >
                            <td className="py-1.5 px-3">{item.line}</td>
                            <td className="py-1.5 px-3 font-semibold text-slate-900">
                              {item.name ? `${item.name} (${item.identifier})` : item.identifier}
                            </td>
                            <td className="py-1.5 px-3 font-bold text-purple-700">{item.formatted_hours}</td>
                            <td className="py-1.5 px-3 font-sans">
                              <span
                                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded ${
                                  item.status === 'SUCCESS'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-rose-50 text-rose-700'
                                }`}
                              >
                                {item.status === 'SUCCESS' ? 'Sucesso' : 'Erro'}
                              </span>
                            </td>
                            <td className="py-1.5 px-3 font-sans text-slate-600 text-[11px]">
                              {item.message}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
