import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  X,
  Loader2,
  RefreshCw,
  Search,
  Filter,
  Users,
  DollarSign,
  Clock,
  FileQuestion,
  TrendingDown,
  TrendingUp,
  FileText
} from 'lucide-react';
import {
  payrollPreFlightAuditService,
  type PreFlightAuditResult,
  type PreFlightFinding,
  type PreFlightFindingCategory,
  type PreFlightFindingSeverity
} from '../../services/payroll/payrollPreFlightAuditService';
import { toast } from 'sonner';

interface PrePayrollAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodId: string;
  periodLabel: string;
  onSelectEmployee?: (contractId: string) => void;
}

export const PrePayrollAuditModal: React.FC<PrePayrollAuditModalProps> = ({
  isOpen,
  onClose,
  periodId,
  periodLabel,
  onSelectEmployee
}) => {
  const [loading, setLoading] = useState(false);
  const [auditResult, setAuditResult] = useState<PreFlightAuditResult | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<PreFlightFindingCategory | 'ALL'>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<PreFlightFindingSeverity | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen && periodId) {
      runAudit();
    }
  }, [isOpen, periodId]);

  const runAudit = async () => {
    setLoading(true);
    try {
      const result = await payrollPreFlightAuditService.runPrePayrollAudit(periodId);
      setAuditResult(result);
    } catch (err: any) {
      console.error('Erro ao auditar pré-folha:', err);
      toast.error('Erro ao auditar pré-folha: ' + (err.message || 'Falha na conexão'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const findings = auditResult?.findings || [];
  const summary = auditResult?.summary;

  const filteredFindings = findings.filter(f => {
    if (selectedCategory !== 'ALL' && f.category !== selectedCategory) return false;
    if (selectedSeverity !== 'ALL' && f.severity !== selectedSeverity) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = f.employee_name.toLowerCase().includes(q);
      const matchTitle = f.title.toLowerCase().includes(q);
      const matchDesc = f.description.toLowerCase().includes(q);
      if (!matchName && !matchTitle && !matchDesc) return false;
    }
    return true;
  });

  const getSeverityBadge = (severity: PreFlightFindingSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <ShieldAlert size={13} className="text-rose-600" />
            Crítico
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle size={13} className="text-amber-600" />
            Alerta
          </span>
        );
      case 'INFO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Info size={13} className="text-blue-600" />
            Informativo
          </span>
        );
    }
  };

  const getCategoryIcon = (category: PreFlightFindingCategory) => {
    switch (category) {
      case 'NET_VARIATION':
        return <TrendingDown size={16} className="text-amber-600" />;
      case 'ZERO_BASE':
        return <DollarSign size={16} className="text-rose-600" />;
      case 'DEPENDENTS_CHANGED':
        return <Users size={16} className="text-blue-600" />;
      case 'NEW_RUBRIC':
        return <FileText size={16} className="text-purple-600" />;
      case 'PENDING_TIME_PUNCH':
        return <Clock size={16} className="text-rose-600" />;
    }
  };

  const getCategoryLabel = (category: PreFlightFindingCategory) => {
    switch (category) {
      case 'NET_VARIATION':
        return 'Variação de Líquido';
      case 'ZERO_BASE':
        return 'Base Zerada';
      case 'DEPENDENTS_CHANGED':
        return 'Dependentes';
      case 'NEW_RUBRIC':
        return 'Rubricas Novas';
      case 'PENDING_TIME_PUNCH':
        return 'Ponto Pendente';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95">
        
        {/* Top Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-md">
              <ShieldCheck size={22} className="text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Pré-Folha & Críticas de Auditoria</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-slate-200 text-slate-700">
                  {periodLabel}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Validação automática de riscos trabalhistas, inconsistências tributárias e variações antes do fechamento
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={runAudit}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm transition-all disabled:opacity-50"
              title="Reexecutar verificação"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Reauditar
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-20 text-center text-slate-400">
              <Loader2 className="animate-spin w-10 h-10 mx-auto text-primary-600 mb-3" />
              <p className="text-sm font-semibold text-slate-700">Auditando consistência da folha...</p>
              <p className="text-xs text-slate-400 mt-1">Conferindo variações salariais, bases legais, dependentes e ponto eletrônico</p>
            </div>
          ) : (
            <>
              {/* Summary KPIs */}
              {summary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Status do Fechamento */}
                  <div className={`p-4 rounded-xl border ${
                    summary.can_proceed_to_closure
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50/70 border-rose-200 text-rose-900'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider">Status Fechamento</span>
                      {summary.can_proceed_to_closure ? (
                        <CheckCircle2 size={18} className="text-emerald-600" />
                      ) : (
                        <ShieldAlert size={18} className="text-rose-600" />
                      )}
                    </div>
                    <p className="text-lg font-bold mt-2">
                      {summary.can_proceed_to_closure ? 'Apto para Fechar' : 'Bloqueado por Erro'}
                    </p>
                    <p className="text-xs opacity-80 mt-0.5">
                      {summary.can_proceed_to_closure
                        ? 'Nenhuma crítica impeditiva encontrada'
                        : `${summary.critical_count} inconsistência(s) crítica(s)`}
                    </p>
                  </div>

                  {/* Críticos */}
                  <div
                    onClick={() => { setSelectedSeverity('CRITICAL'); setSelectedCategory('ALL'); }}
                    className="p-4 rounded-xl border border-rose-200 bg-white hover:bg-rose-50/40 cursor-pointer transition-all shadow-sm group"
                  >
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Críticas Graves</span>
                      <ShieldAlert size={18} className="text-rose-600 group-hover:scale-110 transition-transform" />
                    </div>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{summary.critical_count}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Bases zeradas ou ponto contestado</p>
                  </div>

                  {/* Alertas */}
                  <div
                    onClick={() => { setSelectedSeverity('WARNING'); setSelectedCategory('ALL'); }}
                    className="p-4 rounded-xl border border-amber-200 bg-white hover:bg-amber-50/40 cursor-pointer transition-all shadow-sm group"
                  >
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Alertas de Atenção</span>
                      <AlertTriangle size={18} className="text-amber-600 group-hover:scale-110 transition-transform" />
                    </div>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{summary.warning_count}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Variações bruscas ou pendências</p>
                  </div>

                  {/* Informativos */}
                  <div
                    onClick={() => { setSelectedSeverity('INFO'); setSelectedCategory('ALL'); }}
                    className="p-4 rounded-xl border border-blue-200 bg-white hover:bg-blue-50/40 cursor-pointer transition-all shadow-sm group"
                  >
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-700">Informativos</span>
                      <Info size={18} className="text-blue-600 group-hover:scale-110 transition-transform" />
                    </div>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{summary.info_count}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Novas rubricas ou dependentes</p>
                  </div>
                </div>
              )}

              {/* Filters & Search */}
              <div className="space-y-3">
                {/* Search and Category Badges */}
                <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                    <input
                      type="text"
                      placeholder="Buscar por colaborador ou crítica..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                    />
                  </div>

                  {/* Filter Severity */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                    <button
                      onClick={() => setSelectedSeverity('ALL')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        selectedSeverity === 'ALL'
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Todos ({findings.length})
                    </button>
                    <button
                      onClick={() => setSelectedSeverity('CRITICAL')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        selectedSeverity === 'CRITICAL'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                          : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
                      }`}
                    >
                      Críticos ({summary?.critical_count || 0})
                    </button>
                    <button
                      onClick={() => setSelectedSeverity('WARNING')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        selectedSeverity === 'WARNING'
                          ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                          : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
                      }`}
                    >
                      Alertas ({summary?.warning_count || 0})
                    </button>
                    <button
                      onClick={() => setSelectedSeverity('INFO')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        selectedSeverity === 'INFO'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
                      }`}
                    >
                      Info ({summary?.info_count || 0})
                    </button>
                  </div>
                </div>

                {/* Categories Tab Bar */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 text-xs">
                  <button
                    onClick={() => setSelectedCategory('ALL')}
                    className={`py-2 px-3 border-b-2 font-bold whitespace-nowrap transition-colors ${
                      selectedCategory === 'ALL'
                        ? 'border-slate-900 text-slate-900'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Todas Categorias
                  </button>
                  <button
                    onClick={() => setSelectedCategory('NET_VARIATION')}
                    className={`py-2 px-3 border-b-2 font-bold whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                      selectedCategory === 'NET_VARIATION'
                        ? 'border-amber-600 text-amber-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <TrendingDown size={14} />
                    Variação do Líquido ({summary?.findings_by_category.NET_VARIATION || 0})
                  </button>
                  <button
                    onClick={() => setSelectedCategory('ZERO_BASE')}
                    className={`py-2 px-3 border-b-2 font-bold whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                      selectedCategory === 'ZERO_BASE'
                        ? 'border-rose-600 text-rose-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <DollarSign size={14} />
                    Bases Zeradas ({summary?.findings_by_category.ZERO_BASE || 0})
                  </button>
                  <button
                    onClick={() => setSelectedCategory('DEPENDENTS_CHANGED')}
                    className={`py-2 px-3 border-b-2 font-bold whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                      selectedCategory === 'DEPENDENTS_CHANGED'
                        ? 'border-blue-600 text-blue-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Users size={14} />
                    Dependentes ({summary?.findings_by_category.DEPENDENTS_CHANGED || 0})
                  </button>
                  <button
                    onClick={() => setSelectedCategory('NEW_RUBRIC')}
                    className={`py-2 px-3 border-b-2 font-bold whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                      selectedCategory === 'NEW_RUBRIC'
                        ? 'border-purple-600 text-purple-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <FileText size={14} />
                    Rubricas Novas ({summary?.findings_by_category.NEW_RUBRIC || 0})
                  </button>
                  <button
                    onClick={() => setSelectedCategory('PENDING_TIME_PUNCH')}
                    className={`py-2 px-3 border-b-2 font-bold whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                      selectedCategory === 'PENDING_TIME_PUNCH'
                        ? 'border-rose-600 text-rose-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Clock size={14} />
                    Ponto Pendente ({summary?.findings_by_category.PENDING_TIME_PUNCH || 0})
                  </button>
                </div>
              </div>

              {/* Findings List */}
              <div className="space-y-3">
                {filteredFindings.length === 0 ? (
                  <div className="p-12 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-2" />
                    <h3 className="text-sm font-bold text-slate-900">Nenhuma crítica encontrada neste filtro</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {findings.length === 0
                        ? 'Parabéns! Todos os apontamentos automáticos da pré-folha estão em conformidade.'
                        : 'Altere os filtros acima para visualizar os outros apontamentos da folha.'}
                    </p>
                  </div>
                ) : (
                  filteredFindings.map((finding) => (
                    <div
                      key={finding.id}
                      className={`p-4 rounded-xl border transition-all ${
                        finding.severity === 'CRITICAL'
                          ? 'border-l-4 border-l-rose-600 border-rose-200 bg-rose-50/20 hover:bg-rose-50/40'
                          : finding.severity === 'WARNING'
                          ? 'border-l-4 border-l-amber-500 border-amber-200 bg-amber-50/20 hover:bg-amber-50/40'
                          : 'border-l-4 border-l-blue-500 border-blue-200 bg-blue-50/20 hover:bg-blue-50/40'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getSeverityBadge(finding.severity)}
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                            {getCategoryIcon(finding.category)}
                            {getCategoryLabel(finding.category)}
                          </span>
                          <span className="text-xs font-bold text-slate-900">
                            {finding.employee_name}
                          </span>
                        </div>

                        {onSelectEmployee && (
                          <button
                            onClick={() => {
                              onSelectEmployee(finding.contract_id);
                              onClose();
                            }}
                            className="text-xs font-semibold text-primary-600 hover:text-primary-800 self-start sm:self-auto hover:underline"
                          >
                            Ver Holerite &rarr;
                          </button>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-slate-900">{finding.title}</h4>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{finding.description}</p>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 text-center sm:text-left">
            {summary && (
              <span>
                Total de apontamentos: <strong>{summary.total_findings}</strong> | Críticos:{' '}
                <strong className={summary.critical_count > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                  {summary.critical_count}
                </strong>{' '}
                | Alertas: <strong>{summary.warning_count}</strong>
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm"
          >
            Fechar Painel
          </button>
        </div>
      </div>
    </div>
  );
};
