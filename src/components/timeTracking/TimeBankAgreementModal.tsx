import React, { useState, useEffect } from 'react';
import {
  FileSignature,
  X,
  Calendar,
  User,
  ShieldCheck,
  Send,
  MessageCircle,
  CheckCircle,
  AlertTriangle,
  Clock,
  Loader2,
  Copy,
  Users,
  Search,
  ExternalLink,
  History,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import {
  TimeBankAgreementService,
  type EmitTimeBankAgreementResult
} from '../../services/documents/timeBankAgreementService';
import type { WorkerOption } from '../../services/timeTracking/timeManagementService';

interface TimeBankAgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  companyId?: string;
  workersList: WorkerOption[];
  preSelectedWorkerId?: string;
  onSuccess?: () => void;
}

export const TimeBankAgreementModal: React.FC<TimeBankAgreementModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  companyId,
  workersList,
  preSelectedWorkerId,
  onSuccess
}) => {
  const [activeTab, setActiveTab] = useState<'INDIVIDUAL' | 'BATCH' | 'HISTORY'>('INDIVIDUAL');

  // Estados de Emissão Individual
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [validFrom, setValidFrom] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [validTo, setValidTo] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().split('T')[0];
  });
  const [policyType, setPolicyType] = useState<'INDIVIDUAL_AGREEMENT' | 'COLLECTIVE_AGREEMENT'>('INDIVIDUAL_AGREEMENT');
  const [emittingIndividual, setEmittingIndividual] = useState<boolean>(false);
  const [lastEmissionResult, setLastEmissionResult] = useState<EmitTimeBankAgreementResult | null>(null);

  // Estados de Emissão em Lote
  const [batchSelectedWorkerIds, setBatchSelectedWorkerIds] = useState<string[]>([]);
  const [batchEmitting, setBatchEmitting] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  // Estados do Histórico
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [historySearch, setHistorySearch] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      if (preSelectedWorkerId) {
        setSelectedWorkerId(preSelectedWorkerId);
      } else if (workersList.length > 0 && !selectedWorkerId) {
        setSelectedWorkerId(workersList[0].worker_id);
      }
      setLastEmissionResult(null);
      if (activeTab === 'HISTORY') {
        loadHistory();
      }
    }
  }, [isOpen, preSelectedWorkerId, workersList, activeTab]);

  // Recalcular data final quando data inicial mudar
  const handleValidFromChange = (newFrom: string) => {
    setValidFrom(newFrom);
    const validity = TimeBankAgreementService.calculateDefaultValidity(newFrom);
    setValidTo(validity.validTo);
  };

  const handleEmitIndividual = async () => {
    if (!tenantId || !companyId) {
      toast.error('Empresa ou tenant não identificado.');
      return;
    }
    if (!selectedWorkerId) {
      toast.error('Selecione um colaborador.');
      return;
    }

    // Validação legal CLT
    const validation = TimeBankAgreementService.validateAgreementPeriod({
      validFrom,
      validTo,
      policyType
    });
    if (!validation.isValid) {
      toast.error(validation.error || 'Período inválido.');
      return;
    }

    setEmittingIndividual(true);
    setLastEmissionResult(null);

    try {
      const res = await TimeBankAgreementService.emitTimeBankAgreement({
        tenantId,
        companyId,
        workerId: selectedWorkerId,
        validFrom,
        validTo,
        policyType
      });

      if (res.success) {
        setLastEmissionResult(res);
        toast.success('Termo de Acordo Individual gerado e enviado com sucesso!');
        if (onSuccess) onSuccess();
      } else {
        toast.error(res.error || 'Falha ao emitir acordo.');
      }
    } catch (err: any) {
      toast.error('Erro na emissão: ' + (err.message || 'Falha de comunicação'));
    } finally {
      setEmittingIndividual(false);
    }
  };

  const handleEmitBatch = async () => {
    if (!tenantId || !companyId) {
      toast.error('Empresa ou tenant não identificado.');
      return;
    }
    if (batchSelectedWorkerIds.length === 0) {
      toast.error('Selecione ao menos um colaborador para emissão em lote.');
      return;
    }

    setBatchEmitting(true);
    setBatchProgress({ current: 0, total: batchSelectedWorkerIds.length });

    try {
      const res = await TimeBankAgreementService.emitAgreementsBatch({
        tenantId,
        companyId,
        workerIds: batchSelectedWorkerIds,
        validFrom,
        validTo
      });

      toast.success(`Emissão concluída! ${res.emittedCount} termos emitidos.`);
      if (res.skippedCount > 0) {
        toast.warning(`${res.skippedCount} colaboradores apresentaram pendências.`);
      }
      setActiveTab('HISTORY');
      loadHistory();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast.error('Erro no processamento em lote: ' + (err.message || ''));
    } finally {
      setBatchEmitting(false);
      setBatchProgress(null);
    }
  };

  const loadHistory = async () => {
    if (!tenantId) return;
    setLoadingHistory(true);
    try {
      const docs = await TimeBankAgreementService.fetchIssuedAgreements({
        tenantId,
        companyId: companyId || undefined
      });
      setHistoryList(docs);
    } catch (err) {
      console.error('Erro ao carregar histórico de termos:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado para a área de transferência!`);
  };

  if (!isOpen) return null;

  const activeWorker = workersList.find((w) => w.worker_id === selectedWorkerId);

  const filteredHistory = historyList.filter((item) => {
    if (!historySearch.trim()) return true;
    const term = historySearch.toLowerCase();
    return (
      item.workerName.toLowerCase().includes(term) ||
      item.workerCpf.toLowerCase().includes(term) ||
      (item.verificationCode && item.verificationCode.toLowerCase().includes(term))
    );
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Cabeçalho do Modal */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-400/30">
              <FileSignature className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Acordo Individual de Banco de Horas</h2>
              <p className="text-xs text-indigo-200">
                Art. 59, § 5º da CLT — Emissão oficial com Hash SHA-256 e assinatura digital no celular
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Abas Superiores */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('INDIVIDUAL')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'INDIVIDUAL'
                ? 'bg-white text-indigo-700 border-t border-x border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-4 h-4" />
            Emissão Individual
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('BATCH');
              if (batchSelectedWorkerIds.length === 0) {
                setBatchSelectedWorkerIds(workersList.map((w) => w.worker_id));
              }
            }}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'BATCH'
                ? 'bg-white text-indigo-700 border-t border-x border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            Emissão em Lote ({workersList.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('HISTORY');
              loadHistory();
            }}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'HISTORY'
                ? 'bg-white text-indigo-700 border-t border-x border-slate-200 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            Termos Emitidos
          </button>
        </div>

        {/* Conteúdo das Abas */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
          {/* ============================================================== */}
          {/* ABA 1: EMISSÃO INDIVIDUAL */}
          {/* ============================================================== */}
          {activeTab === 'INDIVIDUAL' && (
            <div className="space-y-5">
              {/* Card de Aviso Legal CLT */}
              <div className="p-4 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl flex items-start gap-3 text-indigo-900 text-xs leading-relaxed">
                <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Requisito Formal da CLT (Art. 59, § 5º):</span> O banco de horas individual por acordo escrito entre empregador e empregado é válido por no máximo <strong>6 meses</strong>. A compensação deve ocorrer nesse prazo, sob pena de pagamento com adicional de 50%/100%. O documento gerado utiliza Assinatura Eletrônica Avançada com código OTP de segurança e registro imutável em blockchain/hash forense.
                </div>
              </div>

              {/* Formulário */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Colaborador Beneficiário *
                  </label>
                  <select
                    value={selectedWorkerId}
                    onChange={(e) => {
                      setSelectedWorkerId(e.target.value);
                      setLastEmissionResult(null);
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {workersList.map((w) => (
                      <option key={w.worker_id} value={w.worker_id}>
                        {w.worker_name} — CPF: {w.worker_cpf} ({w.position_title || 'Cargo'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Data de Início da Vigência
                  </label>
                  <input
                    type="date"
                    value={validFrom}
                    onChange={(e) => handleValidFromChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Data Limite de Compensação (Término)
                  </label>
                  <input
                    type="date"
                    value={validTo}
                    onChange={(e) => setValidTo(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Calculado automaticamente para 6 meses conforme a lei.
                  </span>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Modalidade do Acordo
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label
                      className={`p-3.5 border rounded-xl flex items-center gap-3 cursor-pointer transition ${
                        policyType === 'INDIVIDUAL_AGREEMENT'
                          ? 'border-indigo-500 bg-indigo-50/50 text-indigo-900'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="policyType"
                        value="INDIVIDUAL_AGREEMENT"
                        checked={policyType === 'INDIVIDUAL_AGREEMENT'}
                        onChange={() => setPolicyType('INDIVIDUAL_AGREEMENT')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <p className="text-xs font-bold">Acordo Individual Escrito</p>
                        <p className="text-[11px] text-slate-500">CLT Art. 59 § 5º — vigência máx. 6 meses</p>
                      </div>
                    </label>

                    <label
                      className={`p-3.5 border rounded-xl flex items-center gap-3 cursor-pointer transition ${
                        policyType === 'COLLECTIVE_AGREEMENT'
                          ? 'border-indigo-500 bg-indigo-50/50 text-indigo-900'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="policyType"
                        value="COLLECTIVE_AGREEMENT"
                        checked={policyType === 'COLLECTIVE_AGREEMENT'}
                        onChange={() => setPolicyType('COLLECTIVE_AGREEMENT')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <p className="text-xs font-bold">Convenção / Acordo Coletivo</p>
                        <p className="text-[11px] text-slate-500">CLT Art. 59 § 2º — vigência máx. 12 meses</p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Botão de Disparo */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  O colaborador receberá o termo na aba de Documentos do celular com alerta de assinatura.
                </span>
                <button
                  type="button"
                  disabled={emittingIndividual}
                  onClick={handleEmitIndividual}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-xs transition cursor-pointer"
                >
                  {emittingIndividual ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gerando Termo...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Gerar Termo e Enviar para Assinatura
                    </>
                  )}
                </button>
              </div>

              {/* Card de Resultado da Emissão */}
              {lastEmissionResult && lastEmissionResult.success && (
                <div className="p-5 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                      Termo emitido com sucesso!
                    </div>
                    <span className="text-xs font-mono font-bold bg-white px-2 py-0.5 rounded border border-emerald-200 text-emerald-700">
                      {lastEmissionResult.verificationCode}
                    </span>
                  </div>

                  <p className="text-xs text-emerald-900 leading-relaxed">
                    O documento foi gerado e registrado com Hash SHA-256 canônico e está aguardando assinatura eletrônica com código OTP de segurança pelo colaborador no Portal.
                  </p>

                  {lastEmissionResult.whatsAppMessage && (
                    <div className="pt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(
                            lastEmissionResult.whatsAppMessage || '',
                            'Mensagem de WhatsApp'
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-white hover:bg-emerald-100/70 border border-emerald-200 rounded-lg transition cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        Copiar Mensagem para WhatsApp
                      </button>

                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(
                          lastEmissionResult.whatsAppMessage
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Abrir WhatsApp Web
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* ABA 2: EMISSÃO EM LOTE */}
          {/* ============================================================== */}
          {activeTab === 'BATCH' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Emissão Coletiva de Termos de Banco de Horas</h3>
                  <p className="text-xs text-slate-500">
                    Selecione os colaboradores que devem receber o termo para assinatura simultaneamente.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBatchSelectedWorkerIds(workersList.map((w) => w.worker_id))}
                    className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                  >
                    Marcar Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchSelectedWorkerIds([])}
                    className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                  >
                    Desmarcar
                  </button>
                </div>
              </div>

              {/* Lista Selecionável */}
              <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                {workersList.map((w) => {
                  const isChecked = batchSelectedWorkerIds.includes(w.worker_id);
                  return (
                    <label
                      key={w.worker_id}
                      className={`p-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition ${
                        isChecked ? 'bg-indigo-50/30' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBatchSelectedWorkerIds((prev) => [...prev, w.worker_id]);
                            } else {
                              setBatchSelectedWorkerIds((prev) => prev.filter((id) => id !== w.worker_id));
                            }
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-900">{w.worker_name}</p>
                          <p className="text-[11px] text-slate-500">
                            CPF: {w.worker_cpf} • {w.position_title || 'Cargo não informado'}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {w.overtime_regime || 'TIME_BANK'}
                      </span>
                    </label>
                  );
                })}
              </div>

              {/* Botão de Disparo em Lote */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">
                  {batchSelectedWorkerIds.length} colaborador(es) selecionado(s)
                </span>
                <button
                  type="button"
                  disabled={batchEmitting || batchSelectedWorkerIds.length === 0}
                  onClick={handleEmitBatch}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-xs transition cursor-pointer"
                >
                  {batchEmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Emitindo {batchProgress ? `(${batchProgress.current}/${batchProgress.total})` : '...'}
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Emitir para {batchSelectedWorkerIds.length} Colaboradores
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* ABA 3: HISTÓRICO & STATUS */}
          {/* ============================================================== */}
          {activeTab === 'HISTORY' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Buscar por colaborador ou código..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={loadHistory}
                  disabled={loadingHistory}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Atualizar Lista
                </button>
              </div>

              {loadingHistory ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                  <p className="text-xs">Carregando termos emitidos...</p>
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Nenhum termo de banco de horas encontrado para esta empresa.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">Colaborador</th>
                        <th className="px-4 py-3">Código Verificação</th>
                        <th className="px-4 py-3">Vigência CLT</th>
                        <th className="px-4 py-3">Status Assinatura</th>
                        <th className="px-4 py-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredHistory.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition">
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-900">{item.workerName}</p>
                            <p className="text-[11px] text-slate-500">CPF: {item.workerCpf}</p>
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-indigo-700">
                            {item.verificationCode || '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {item.validTo ? (
                              <span>até {item.validTo.split('-').reverse().join('/')}</span>
                            ) : (
                              '6 meses'
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {item.status === 'SIGNED' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle className="w-3 h-3 text-emerald-600" />
                                Assinado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-amber-100 text-amber-800 border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600" />
                                Pendente Assinatura
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {item.status === 'PENDING' && (
                              <button
                                type="button"
                                onClick={() => {
                                  const portalUrl = `${window.location.origin}/portal/login`;
                                  const msg = TimeBankAgreementService.buildWhatsAppNotificationMessage({
                                    workerName: item.workerName,
                                    companyName: 'Sua Empresa',
                                    verificationCode: item.verificationCode || '',
                                    portalUrl,
                                    validTo: item.validTo ? item.validTo.split('-').reverse().join('/') : ''
                                  });
                                  copyToClipboard(msg, 'Lembrete WhatsApp');
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                                title="Copiar Lembrete de Assinatura para WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                Lembrar WhatsApp
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <p className="text-[11px] text-slate-500">
            Base legal: Consolidação das Leis do Trabalho (Decreto-Lei nº 5.452/1943) e Lei nº 13.467/2017.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
