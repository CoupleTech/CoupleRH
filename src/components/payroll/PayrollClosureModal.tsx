import React, { useState } from 'react';
import {
  Lock,
  ShieldCheck,
  AlertTriangle,
  X,
  Loader2,
  FileCheck,
  CheckCircle2
} from 'lucide-react';
import { payrollClosureService } from '../../services/payroll/payrollClosureService';
import { toast } from 'sonner';

interface PayrollClosureModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodId: string;
  periodLabel: string;
  payslipCount: number;
  totalNet: number;
  onSuccess: () => void;
}

export const PayrollClosureModal: React.FC<PayrollClosureModalProps> = ({
  isOpen,
  onClose,
  periodId,
  periodLabel,
  payslipCount,
  totalNet,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleClosePeriod = async () => {
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
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
              <Lock size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Aprovação e Fechamento Imutável</h3>
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
        <div className="p-6 space-y-5">
          {/* Resumo da Folha */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-slate-500 font-medium">Holerites a Fechar</span>
              <p className="text-xl font-bold text-slate-900 mt-0.5">{payslipCount} vidas</p>
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium">Total Líquido da Folha</span>
              <p className="text-xl font-bold text-emerald-600 font-mono mt-0.5">{formatCurrency(totalNet)}</p>
            </div>
          </div>

          {/* Alerta de Imutabilidade */}
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 flex items-start gap-3 text-amber-900 text-xs leading-relaxed">
            <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold mb-0.5">Aviso Legal de Imutabilidade (CLT e Compliance)</strong>
              Ao aprovar o fechamento, os holerites, encargos e memórias de cálculo são <strong>travados de forma imutável</strong> no banco de dados. Nenhuma exclusão ou alteração poderá ser feita sem processo formal de reabertura com justificativa auditável.
            </div>
          </div>

          {/* Observações Opcionais */}
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
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleClosePeriod}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CheckCircle2 size={16} />
            )}
            Aprovar e Fechar Folha
          </button>
        </div>

      </div>
    </div>
  );
};
