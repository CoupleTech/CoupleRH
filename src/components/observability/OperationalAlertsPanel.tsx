import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
  RefreshCw,
  ShieldAlert,
  Calendar,
  XCircle,
  FileText
} from 'lucide-react';
import {
  ObservabilityService,
  type SystemOperationalAlert,
  type AlertSubsystem,
  type AlertSeverity
} from '../../services/observability/observabilityService';

interface OperationalAlertsPanelProps {
  tenantId: string;
  userId: string;
}

export const OperationalAlertsPanel: React.FC<OperationalAlertsPanelProps> = ({
  tenantId,
  userId
}) => {
  const [alerts, setAlerts] = useState<SystemOperationalAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [subsystemFilter, setSubsystemFilter] = useState<AlertSubsystem | 'ALL'>('ALL');
  const [resolvedFilter, setResolvedFilter] = useState<boolean>(false);
  const [selectedAlert, setSelectedAlert] = useState<SystemOperationalAlert | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [isResolving, setIsResolving] = useState<boolean>(false);
  const [summary, setSummary] = useState<{
    totalUnresolved: number;
    bySubsystem: Record<AlertSubsystem, number>;
    criticalCount: number;
  }>({
    totalUnresolved: 0,
    bySubsystem: {
      PAYROLL: 0,
      TIME_TRACKING: 0,
      SECURITY: 0,
      DOCUMENT_SIGNING: 0,
      GENERAL: 0
    },
    criticalCount: 0
  });

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const options: { subsystem?: AlertSubsystem; resolved?: boolean; limit?: number } = {
        resolved: resolvedFilter,
        limit: 50
      };
      if (subsystemFilter !== 'ALL') {
        options.subsystem = subsystemFilter;
      }

      const [alertsData, summaryData] = await Promise.all([
        ObservabilityService.listAlerts(tenantId, options),
        ObservabilityService.getAlertsSummary(tenantId)
      ]);

      setAlerts(alertsData);
      setSummary(summaryData);
    } catch (err) {
      console.error('Erro ao carregar alertas operacionais:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, subsystemFilter, resolvedFilter]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleResolveAlert = async () => {
    if (!selectedAlert) return;
    setIsResolving(true);
    try {
      const ok = await ObservabilityService.resolveAlert(
        selectedAlert.id,
        userId,
        resolutionNotes
      );
      if (ok) {
        setSelectedAlert(null);
        setResolutionNotes('');
        await loadAlerts();
      }
    } catch (err) {
      console.error('Falha ao resolver alerta:', err);
    } finally {
      setIsResolving(false);
    }
  };

  const getSeverityBadge = (severity: AlertSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
            <ShieldAlert className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            Crítico
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            <XCircle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            Erro
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">
            <AlertTriangle className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
            Aviso
          </span>
        );
      case 'INFO':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
            Informação
          </span>
        );
    }
  };

  const getSubsystemLabel = (subsystem: AlertSubsystem) => {
    switch (subsystem) {
      case 'PAYROLL':
        return 'Folha de Pagamento';
      case 'TIME_TRACKING':
        return 'Ponto Eletrônico';
      case 'SECURITY':
        return 'Segurança & LGPD';
      case 'DOCUMENT_SIGNING':
        return 'Assinaturas Digitais';
      case 'GENERAL':
      default:
        return 'Geral';
    }
  };

  return (
    <div className="space-y-6">
      {/* Resumo Executivo Superior */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Alertas Pendentes
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {summary.totalUnresolved}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-rose-600 uppercase tracking-wider">
              Incidentes Críticos
            </p>
            <p className="text-2xl font-bold text-rose-600 mt-1">
              {summary.criticalCount}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-950 flex items-center justify-center text-rose-600">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Falhas de Folha
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {summary.bySubsystem.PAYROLL}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Falhas de Ponto (REP/AFD)
            </p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              {summary.bySubsystem.TIME_TRACKING}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-cyan-50 dark:bg-cyan-950 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Ações */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 font-medium">
            <Filter className="w-4 h-4" />
            <span>Filtros:</span>
          </div>

          <select
            value={subsystemFilter}
            onChange={(e) => setSubsystemFilter(e.target.value as AlertSubsystem | 'ALL')}
            className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Todos os Subsistemas</option>
            <option value="PAYROLL">Folha de Pagamento</option>
            <option value="TIME_TRACKING">Ponto Eletrônico</option>
            <option value="SECURITY">Segurança & LGPD</option>
            <option value="DOCUMENT_SIGNING">Assinaturas</option>
          </select>

          <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-0.5">
            <button
              type="button"
              onClick={() => setResolvedFilter(false)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                !resolvedFilter
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Pendentes ({summary.totalUnresolved})
            </button>
            <button
              type="button"
              onClick={() => setResolvedFilter(true)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                resolvedFilter
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Resolvidos
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => loadAlerts()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Lista de Alertas */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600 mb-2" />
            Carregando incidentes operacionais...
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <h4 className="text-base font-semibold text-slate-900 dark:text-white">
              Nenhum alerta {resolvedFilter ? 'resolvido' : 'pendente'}
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {resolvedFilter
                ? 'Histórico de alertas resolvidos limpo ou sem registros recentes.'
                : 'Excelente! Todos os motores de folha e ponto estão operando sem falhas impeditivas.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="p-4 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {getSeverityBadge(alert.severity)}
                    <span className="text-xs font-medium text-slate-400">
                      • {getSubsystemLabel(alert.subsystem)}
                    </span>
                    {alert.error_code && (
                      <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded">
                        {alert.error_code}
                      </span>
                    )}
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(alert.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>

                  <h5 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {alert.title}
                  </h5>

                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                    {alert.message}
                  </p>

                  {alert.resolved && alert.resolution_notes && (
                    <div className="text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800/50 mt-2">
                      <span className="font-semibold">Resolução:</span> {alert.resolution_notes}
                    </div>
                  )}
                </div>

                {!alert.resolved && (
                  <div className="flex-shrink-0 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAlert(alert);
                        setResolutionNotes('');
                      }}
                      className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-all"
                    >
                      Tratar / Resolver
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Resolução de Alerta */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              Resolver Alerta Operacional
            </h3>

            <div className="my-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 space-y-1">
              <p>
                <span className="font-semibold text-slate-900 dark:text-white">Incidente:</span>{' '}
                {selectedAlert.title}
              </p>
              <p>
                <span className="font-semibold text-slate-900 dark:text-white">Subsistema:</span>{' '}
                {getSubsystemLabel(selectedAlert.subsystem)}
              </p>
              <p>
                <span className="font-semibold text-slate-900 dark:text-white">Mensagem:</span>{' '}
                {selectedAlert.message}
              </p>
            </div>

            <div className="space-y-2 mb-6">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Anotações de Resolução (obrigatório para auditoria)
              </label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                rows={3}
                placeholder="Descreva a ação corretiva tomada (ex: corrigido cálculo na competência, reprocessado AFD com cabeçalho retificado)..."
                className="w-full text-xs p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedAlert(null)}
                disabled={isResolving}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleResolveAlert}
                disabled={isResolving || !resolutionNotes.trim()}
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-all disabled:opacity-50"
              >
                {isResolving ? 'Salvando...' : 'Confirmar Resolução'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
