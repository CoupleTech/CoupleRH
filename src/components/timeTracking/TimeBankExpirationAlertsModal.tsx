import React, { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  AlertCircle,
  Clock,
  Calendar,
  User,
  ShieldAlert,
  Download,
  Filter,
  Search,
  CheckCircle2,
  Loader2,
  TrendingUp,
  FileSpreadsheet,
  ArrowRight,
  FileSignature
} from 'lucide-react';
import { toast } from 'sonner';
import {
  TimeManagementService,
  type TimeBankExpirationAlertsPanel,
  type TimeBankExpirationAlertItem
} from '../../services/timeTracking/timeManagementService';
import { formatMinutesToHours } from '../../services/timeTracking/timeBankService';

interface TimeBankExpirationAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  companyId?: string;
  onSelectWorkerForTreatment?: (workerId: string) => void;
  onOpenAgreementModal?: (workerId: string) => void;
}

export const TimeBankExpirationAlertsModal: React.FC<TimeBankExpirationAlertsModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  companyId,
  onSelectWorkerForTreatment,
  onOpenAgreementModal
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [panelData, setPanelData] = useState<TimeBankExpirationAlertsPanel | null>(null);
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'EXPIRED' | 'CRITICAL' | 'WARNING'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    if (isOpen && tenantId) {
      loadAlerts();
    }
  }, [isOpen, tenantId, companyId]);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const data = await TimeManagementService.fetchTimeBankExpirationAlerts({
        tenantId,
        companyId
      });
      setPanelData(data);
    } catch (err: any) {
      console.error('Erro ao carregar alertas de vencimento:', err);
      toast.error('Erro ao carregar alertas de banco de horas: ' + (err.message || 'Falha de comunicação'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const alerts = panelData?.alerts || [];

  const filteredAlerts = alerts.filter((item) => {
    if (severityFilter !== 'ALL' && item.status !== severityFilter) {
      return false;
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchName = item.worker_name.toLowerCase().includes(term);
      const matchCpf = item.cpf?.includes(term);
      const matchTitle = item.position_title.toLowerCase().includes(term);
      return matchName || matchCpf || matchTitle;
    }
    return true;
  });

  const handleExportCsv = () => {
    if (alerts.length === 0) {
      toast.info('Nenhum alerta de vencimento para exportar.');
      return;
    }

    const headers = 'COLABORADOR;CPF;CARGO;REGIME;DATA_INICIO;DATA_FIM;DIAS_RESTANTES;SALDO_HORAS;STATUS;ACAO_RECOMENDADA';
    const rows = alerts.map((a) => {
      return `"${a.worker_name}";"${a.cpf || ''}";"${a.position_title}";"${a.policy_type}";"${a.start_date}";"${a.end_date}";${a.days_remaining};"${a.balance_formatted}";"${a.status}";"${a.action_recommended || ''}"`;
    });

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `alertas_vencimento_banco_horas_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Relatório de alertas de vencimento exportado com sucesso!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden my-8 flex flex-col max-h-[92vh]">
        {/* Cabeçalho */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-amber-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Painel de Vencimentos do Banco de Horas
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  CLT Art. 59 §§ 2º e 5º
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitoramento contínuo de vigência legal (6 meses no acordo individual ou 12 meses na CCT) para programar folgas compensatórias e evitar passivos
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

        {/* Conteúdo com Scroll */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Cards de Resumo e KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card Expirados */}
            <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50/50 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700">Ciclos Expirados</p>
                <h3 className="text-2xl font-black text-rose-900 mt-0.5">{panelData?.expiredCount || 0}</h3>
                <p className="text-[11px] text-rose-600 mt-0.5">Exigem pagamento como HE (Art. 59 §3º)</p>
              </div>
              <div className="p-3 bg-rose-100 text-rose-700 rounded-xl">
                <AlertCircle className="w-6 h-6" />
              </div>
            </div>

            {/* Card Críticos (≤ 7 dias) */}
            <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Críticos (≤ 7 dias)</p>
                <h3 className="text-2xl font-black text-amber-900 mt-0.5">{panelData?.criticalCount || 0}</h3>
                <p className="text-[11px] text-amber-600 mt-0.5">Vencimento iminente nesta semana</p>
              </div>
              <div className="p-3 bg-amber-100 text-amber-700 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
            </div>

            {/* Card Em Alerta (≤ 30 dias) */}
            <div className="p-4 rounded-2xl border border-yellow-200 bg-yellow-50/40 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-yellow-800">Em Alerta (≤ 30 dias)</p>
                <h3 className="text-2xl font-black text-yellow-900 mt-0.5">{panelData?.warningCount || 0}</h3>
                <p className="text-[11px] text-yellow-700 mt-0.5">Programar folga compensatória</p>
              </div>
              <div className="p-3 bg-yellow-100 text-yellow-800 rounded-xl">
                <Clock className="w-6 h-6" />
              </div>
            </div>

            {/* Card Saldo Total em Risco */}
            <div className="p-4 rounded-2xl border border-purple-200 bg-purple-50/50 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Horas em Risco</p>
                <h3 className="text-2xl font-black text-purple-900 mt-0.5">
                  +{panelData?.totalPositiveHoursAtRisk || 0}h
                </h3>
                <p className="text-[11px] text-purple-600 mt-0.5">
                  {panelData?.totalAccountsMonitored || 0} contas ativas monitoradas
                </p>
              </div>
              <div className="p-3 bg-purple-100 text-purple-700 rounded-xl">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Barra de Filtros e Busca */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setSeverityFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  severityFilter === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todos em Risco ({alerts.length})
              </button>
              <button
                type="button"
                onClick={() => setSeverityFilter('EXPIRED')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  severityFilter === 'EXPIRED'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                Expirados ({panelData?.expiredCount || 0})
              </button>
              <button
                type="button"
                onClick={() => setSeverityFilter('CRITICAL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  severityFilter === 'CRITICAL'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                Críticos ≤ 7d ({panelData?.criticalCount || 0})
              </button>
              <button
                type="button"
                onClick={() => setSeverityFilter('WARNING')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  severityFilter === 'WARNING'
                    ? 'bg-yellow-500 text-white shadow-xs'
                    : 'bg-yellow-50 text-yellow-800 hover:bg-yellow-100'
                }`}
              >
                Em Alerta ≤ 30d ({panelData?.warningCount || 0})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar colaborador ou CPF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition shadow-xs shrink-0 cursor-pointer"
                title="Exportar planilha de alertas em CSV"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar CSV
              </button>
            </div>
          </div>

          {/* Tabela de Alertas */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-16 flex flex-col items-center justify-center space-y-3">
                <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                <p className="text-sm font-medium text-slate-500">
                  Calculando vencimentos e vigências do banco de horas...
                </p>
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="p-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
                <h4 className="text-base font-bold text-slate-800">Nenhum banco de horas em situação de risco</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                  Todas as contas ativas estão com prazos legais confortáveis (&gt; 30 dias de vigência restante) ou com saldo zerado.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Colaborador / Cargo</th>
                      <th className="py-3 px-4">Regime CLT</th>
                      <th className="py-3 px-4">Término da Vigência</th>
                      <th className="py-3 px-4">Saldo Acumulado</th>
                      <th className="py-3 px-4">Dias Restantes</th>
                      <th className="py-3 px-4">Gravidade & Ação CLT</th>
                      <th className="py-3 px-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {filteredAlerts.map((item) => (
                      <tr
                        key={item.account_id}
                        className={`hover:bg-slate-50/80 transition ${
                          item.status === 'EXPIRED'
                            ? 'bg-rose-50/30'
                            : item.status === 'CRITICAL'
                            ? 'bg-amber-50/30'
                            : ''
                        }`}
                      >
                        {/* Colaborador */}
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900 text-sm">{item.worker_name}</p>
                          <p className="text-[11px] text-slate-400">
                            {item.position_title} {item.cpf ? `· CPF: ${item.cpf}` : ''}
                          </p>
                        </td>

                        {/* Regime */}
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-700">
                            {item.policy_type === 'ACORDO_INDIVIDUAL'
                              ? 'Acordo Individual (6m)'
                              : `${item.policy_type} (12m)`}
                          </span>
                          <p className="text-[10px] text-slate-400">Início: {item.start_date}</p>
                        </td>

                        {/* Fim da Vigência */}
                        <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                          {item.end_date}
                        </td>

                        {/* Saldo Acumulado */}
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-lg inline-block text-xs">
                            {item.balance_formatted}
                          </span>
                        </td>

                        {/* Dias Restantes */}
                        <td className="py-3 px-4 font-bold">
                          {item.days_remaining < 0 ? (
                            <span className="text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full text-[11px]">
                              Expirou há {Math.abs(item.days_remaining)} dias
                            </span>
                          ) : item.days_remaining <= 7 ? (
                            <span className="text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full text-[11px]">
                              Restam {item.days_remaining} dias
                            </span>
                          ) : (
                            <span className="text-yellow-800 bg-yellow-100 px-2 py-0.5 rounded-full text-[11px]">
                              Restam {item.days_remaining} dias
                            </span>
                          )}
                        </td>

                        {/* Gravidade e Mensagem */}
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-1 ${
                              item.status === 'EXPIRED'
                                ? 'bg-rose-600 text-white'
                                : item.status === 'CRITICAL'
                                ? 'bg-amber-600 text-white'
                                : 'bg-yellow-500 text-white'
                            }`}
                          >
                            {item.status === 'EXPIRED'
                              ? 'Expirado'
                              : item.status === 'CRITICAL'
                              ? 'Crítico'
                              : 'Alerta'}
                          </span>
                          <p className="text-[11px] text-slate-600 max-w-xs leading-tight">
                            {item.message}
                          </p>
                        </td>

                        {/* Ação */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {onOpenAgreementModal && item.worker_id && (
                              <button
                                type="button"
                                onClick={() => {
                                  onOpenAgreementModal(item.worker_id!);
                                  onClose();
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition cursor-pointer"
                                title="Emitir Novo Acordo Individual de Banco de Horas (CLT Art. 59 § 5º)"
                              >
                                <FileSignature className="w-3.5 h-3.5 text-indigo-600" />
                                Acordo CLT
                              </button>
                            )}

                            {onSelectWorkerForTreatment && item.worker_id && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectWorkerForTreatment(item.worker_id!);
                                  onClose();
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition cursor-pointer"
                                title="Ver Cartão de Ponto e Programar Folga / Compensação"
                              >
                                Ver Cartão
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            )}
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

        {/* Rodapé */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Art. 59 §3º CLT: Na hipótese de rescisão ou expiração sem compensação, o trabalhador terá direito ao pagamento das horas extras devidas.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer"
          >
            Fechar Painel
          </button>
        </div>
      </div>
    </div>
  );
};
