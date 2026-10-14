import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  History,
  X,
  Loader2,
  Calendar,
  User,
  Clock
} from 'lucide-react';
import {
  payrollClosureService,
  type ReopeningRecord
} from '../../services/payroll/payrollClosureService';
import { toast } from 'sonner';

interface PayrollReopenModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodId: string;
  periodLabel: string;
  tenantId: string;
  currentVersion: number;
  onSuccess: () => void;
}

export const PayrollReopenModal: React.FC<PayrollReopenModalProps> = ({
  isOpen,
  onClose,
  periodId,
  periodLabel,
  tenantId,
  currentVersion,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState('');
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [history, setHistory] = useState<ReopeningRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (isOpen && periodId) {
      checkPermissionAndLoadHistory();
    }
  }, [isOpen, periodId, tenantId]);

  const checkPermissionAndLoadHistory = async () => {
    setLoading(true);
    try {
      const perm = await payrollClosureService.checkCurrentUserReopenPermission(tenantId);
      setIsAuthorized(perm.authorized);
      setUserRole(perm.role || '');

      const hist = await payrollClosureService.fetchReopenHistory(periodId);
      setHistory(hist);
    } catch (err) {
      console.error('Erro ao verificar permissão:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const minChars = 15;
  const currentLength = reason.trim().length;
  const isReasonValid = currentLength >= minChars;

  const handleReopen = async () => {
    if (!isReasonValid) {
      toast.error(`A justificativa deve conter no mínimo ${minChars} caracteres.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await payrollClosureService.reopenPeriod({
        period_id: periodId,
        reason: reason.trim(),
      });
      toast.success(`Folha reaberta com sucesso! Versão incrementada para v${res.new_version}.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao reabrir folha:', err);
      toast.error(err.message || 'Erro ao reabrir folha fechada.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-rose-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-md">
              <RotateCcw size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900">Reabertura Controlada da Folha</h3>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800">
                  v{currentVersion} &rarr; v{currentVersion + 1}
                </span>
              </div>
              <p className="text-xs text-slate-500">Competência: {periodLabel}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <Loader2 className="animate-spin w-8 h-8 mx-auto text-rose-600 mb-2" />
              <p className="text-xs font-semibold">Verificando autorização de segurança...</p>
            </div>
          ) : (
            <>
              {/* Checagem de Perfil */}
              {isAuthorized === false && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-3">
                  <ShieldAlert size={20} className="text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold mb-0.5">Acesso Bloqueado: Perfil Não Autorizado</strong>
                    Seu perfil atual (<span className="font-mono font-bold">{userRole || 'operador'}</span>) não possui privilégios de gestor para reabrir folhas fechadas. Esta operação é reservada estritamente para administradores ou gestores de DP (<span className="font-mono">dp_manager</span>).
                  </div>
                </div>
              )}

              {/* Informações de Versionamento */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-700">
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span>Impacto da Reabertura</span>
                  <span className="text-rose-600">Auditoria Obrigatória</span>
                </div>
                <p className="leading-relaxed text-slate-600">
                  Ao reabrir a folha, o status retornará para <span className="font-bold text-slate-900">REABERTA (DRAFT)</span>, permitindo recálculo. Todos os holerites passarão a ser identificados como versão <span className="font-mono font-bold text-rose-600">v{currentVersion + 1}</span>, preservando o histórico legal da versão anterior <span className="font-mono font-bold">v{currentVersion}</span>.
                </p>
              </div>

              {/* Formulário de Justificativa */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Justificativa Formal para Auditoria <span className="text-rose-600">*</span>
                  </label>
                  <span className={`text-[11px] font-mono font-bold ${
                    isReasonValid ? 'text-emerald-600' : 'text-slate-400'
                  }`}>
                    {currentLength} / mín. {minChars} caracteres
                  </span>
                </div>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={isAuthorized === false || submitting}
                  placeholder="Descreva detalhadamente o motivo contábil ou trabalhista que motivou a reabertura (ex: Ajuste de horas extras pendentes após apuração tardia de ponto)..."
                  className="w-full h-28 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white resize-none disabled:opacity-50"
                />
              </div>

              {/* Histórico de Reaberturas */}
              {history.length > 0 && (
                <div className="pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
                  >
                    <History size={14} />
                    Histórico de Reaberturas Desta Competência ({history.length})
                  </button>

                  {showHistory && (
                    <div className="mt-3 space-y-2 max-h-40 overflow-y-auto pr-1">
                      {history.map(item => (
                        <div key={item.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                          <div className="flex items-center justify-between text-slate-500 mb-1">
                            <span className="font-mono font-bold text-rose-700">
                              v{item.previous_version} &rarr; v{item.new_version}
                            </span>
                            <span className="flex items-center gap-1 text-[11px]">
                              <Clock size={12} />
                              {new Date(item.reopened_at).toLocaleDateString('pt-BR')} às {new Date(item.reopened_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-slate-700 font-medium italic">"{item.reason}"</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleReopen}
            disabled={!isReasonValid || isAuthorized === false || submitting}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RotateCcw size={16} />
            )}
            Reabrir Folha com Auditoria
          </button>
        </div>

      </div>
    </div>
  );
};
