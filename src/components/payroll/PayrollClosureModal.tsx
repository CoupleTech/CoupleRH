import React, { useState, useEffect } from 'react';
import {
  Lock,
  AlertTriangle,
  X,
  Loader2,
  CheckCircle2,
  Ban,
  AlertOctagon,
  ChevronDown,
  ChevronUp,
  UserX
} from 'lucide-react';
import {
  payrollClosureService,
  type ClosureValidationResult
} from '../../services/payroll/payrollClosureService';
import { toast } from 'sonner';

interface PayrollClosureModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodId: string;
  periodLabel: string;
  payslipCount: number;
  totalNet: number;
  onSuccess: () => void;
  onOpenAudit?: () => void;
}

export const PayrollClosureModal: React.FC<PayrollClosureModalProps> = ({
  isOpen,
  onClose,
  periodId,
  periodLabel,
  payslipCount,
  totalNet,
  onSuccess,
  onOpenAudit
}) => {
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [validationResult, setValidationResult] = useState<ClosureValidationResult | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen && periodId) {
      runClosureValidation();
    }
  }, [isOpen, periodId]);

  const runClosureValidation = async () => {
    setValidating(true);
    try {
      const res = await payrollClosureService.validatePeriodBeforeClosure(periodId);
      setValidationResult(res);
      if (!res.canClose) {
        setShowErrorDetails(true);
      }
    } catch (err: any) {
      console.error('Falha ao validar fechamento:', err);
      // Fallback em caso de erro na consulta
      setValidationResult(null);
    } finally {
      setValidating(false);
    }
  };

  if (!isOpen) return null;

  const isBlocked = !validating && validationResult !== null && !validationResult.canClose;

  const handleClosePeriod = async () => {
    if (isBlocked) {
      toast.error('O fechamento está bloqueado. Corrija os erros apontados antes de fechar a folha.');
      return;
    }

    setLoading(true);
    try {
      await payrollClosureService.closePeriod({
        period_id: periodId,
        notes: notes.trim() || undefined,
      });
      toast.success('Folha fechada com sucesso! Os registros agora são imutáveis.');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao fechar folha:', err);
      toast.error(err.message || 'Erro ao fechar folha de pagamento.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${
              isBlocked ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
            }`}>
              {isBlocked ? <Ban size={20} /> : <Lock size={20} />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {isBlocked ? 'Fechamento Bloqueado (Críticas Impeditivas)' : 'Aprovação e Fechamento Imutável'}
              </h3>
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
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Resumo da Folha */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-slate-500 font-medium">Holerites no Período</span>
              <p className="text-xl font-bold text-slate-900 mt-0.5">{payslipCount} vidas</p>
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium">Total Líquido da Folha</span>
              <p className="text-xl font-bold text-emerald-600 font-mono mt-0.5">{formatCurrency(totalNet)}</p>
            </div>
          </div>

          {/* Validação de Bloqueio por Erros */}
          {validating ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center gap-3 text-slate-600 text-xs py-6">
              <Loader2 size={18} className="animate-spin text-indigo-600" />
              <span>Verificando integridade dos cálculos e colaboradores em erro...</span>
            </div>
          ) : isBlocked && validationResult ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 space-y-3">
              <div className="flex items-start gap-3">
                <AlertOctagon size={22} className="text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider">
                    Bloqueio Legal CLT & Compliance: {validationResult.blockingErrorsCount} Colaborador(es) em Erro
                  </h4>
                  <p className="text-xs text-rose-700 mt-0.5 leading-relaxed">
                    A folha de pagamento não pode ser fechada enquanto houver colaboradores com cálculo com erro, salários líquidos negativos ou divergências matemáticas.
                  </p>
                </div>
              </div>

              {/* Botão de Accordion com a lista de erros */}
              <button
                type="button"
                onClick={() => setShowErrorDetails(!showErrorDetails)}
                className="w-full flex items-center justify-between px-3 py-2 bg-rose-100/70 hover:bg-rose-100 rounded-lg text-xs font-bold text-rose-900 transition-colors"
              >
                <span>Ver lista detalhada de colaboradores impedidos ({validationResult.blockingErrorsCount})</span>
                {showErrorDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showErrorDetails && (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {validationResult.errorDetails.map((err, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-white border border-rose-200 text-xs shadow-sm flex items-start gap-2.5"
                    >
                      <UserX size={16} className="text-rose-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <strong className="text-slate-900 truncate">{err.employee_name}</strong>
                          {err.employee_cpf && (
                            <span className="text-[10px] text-slate-500 font-mono">{err.employee_cpf}</span>
                          )}
                        </div>
                        <p className="text-[11px] text-rose-700 mt-0.5 leading-snug">
                          {err.reason}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {onOpenAudit && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenAudit();
                    }}
                    className="text-xs font-semibold text-rose-700 hover:text-rose-900 underline"
                  >
                    Abrir Auditoria de Pré-Folha para resolver pendências →
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-start gap-3 text-emerald-950 text-xs">
              <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold text-emerald-900 mb-0.5">Folha Apta para Fechamento</strong>
                Todos os colaboradores do período foram calculados sem erros impeditivos, líquidos negativos ou inconsistências de dados.
              </div>
            </div>
          )}

          {/* Alerta de Imutabilidade */}
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 flex items-start gap-3 text-amber-900 text-xs leading-relaxed">
            <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold mb-0.5">Aviso Legal de Imutabilidade (CLT e Compliance)</strong>
              Ao aprovar o fechamento, os holerites, encargos e memórias de cálculo são <strong>travados de forma imutável</strong> no banco de dados. Nenhuma exclusão ou alteração poderá ser feita sem processo formal de reabertura com justificativa auditável.
            </div>
          </div>

          {/* Observações Opcionais */}
          {!isBlocked && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Observações do Fechamento (Opcional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Folha conferida e validada de acordo com o fechamento contábil e ponto eletrônico."
                className="w-full h-20 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white resize-none"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div>
            {isBlocked && (
              <span className="text-xs text-rose-600 font-semibold flex items-center gap-1.5">
                <Ban size={14} /> Fechamento bloqueado por erros
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleClosePeriod}
              disabled={loading || validating || isBlocked}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all ${
                isBlocked
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50'
              }`}
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : isBlocked ? (
                <Ban size={16} />
              ) : (
                <CheckCircle2 size={16} />
              )}
              {isBlocked ? 'Fechamento Bloqueado' : 'Aprovar e Fechar Folha'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

