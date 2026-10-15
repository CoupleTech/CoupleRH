import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  X,
  Loader2,
  CalendarDays,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  formatMinutesToHours,
  TimeBankService,
  type TimeBankAccount,
  type TimeBankTransaction,
  type TimeBankStatement
} from '../../services/timeTracking/timeBankService';
import { toast } from 'sonner';

interface TimeBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractId: string;
}

export const TimeBankModal: React.FC<TimeBankModalProps> = ({
  isOpen,
  onClose,
  contractId
}) => {
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<TimeBankAccount | null>(null);
  const [statement, setStatement] = useState<TimeBankStatement | null>(null);
  const [showRequestOffModal, setShowRequestOffModal] = useState(false);
  const [offDate, setOffDate] = useState('');
  const [offHours, setOffHours] = useState('8');
  const [offDescription, setOffDescription] = useState('');
  const [submittingOff, setSubmittingOff] = useState(false);

  useEffect(() => {
    if (!isOpen || !contractId) return;
    fetchTimeBankData();
  }, [isOpen, contractId]);

  const fetchTimeBankData = async () => {
    setLoading(true);
    try {
      // 1. Buscar conta ativa de banco de horas
      const { data: accountData, error: accError } = await supabase
        .from('time_bank_accounts')
        .select('*')
        .eq('contract_id', contractId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (accError) throw accError;

      if (!accountData) {
        setAccount(null);
        setStatement(null);
        return;
      }

      setAccount(accountData as TimeBankAccount);

      // 2. Buscar transações da conta
      const { data: txData, error: txError } = await supabase
        .from('time_bank_transactions')
        .select('*')
        .eq('account_id', accountData.id)
        .order('date', { ascending: true })
        .order('created_at', { ascending: true });

      if (txError) throw txError;

      const transactions = (txData || []) as TimeBankTransaction[];
      const stmt = TimeBankService.generateStatement(accountData as TimeBankAccount, transactions);
      setStatement(stmt);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao carregar banco de horas: ' + (err.message || 'Desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleRequestCompDayOff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return;

    const minutes = Math.round(parseFloat(offHours) * 60);
    if (!minutes || minutes <= 0) {
      toast.error('Informe uma quantidade válida de horas para a folga.');
      return;
    }

    if (!offDate) {
      toast.error('Selecione a data da folga compensatória.');
      return;
    }

    setSubmittingOff(true);
    try {
      // Insere transação de COMPENSATION_DAY_OFF
      const { error: txError } = await supabase.from('time_bank_transactions').insert({
        tenant_id: account.tenant_id,
        account_id: account.id,
        date: offDate,
        minutes: -minutes,
        transaction_type: 'COMPENSATION_DAY_OFF',
        description: offDescription.trim() || `Folga compensatória agendada (${offHours}h)`
      });

      if (txError) throw txError;

      // Atualiza saldo da conta
      const newBalance = account.balance_minutes - minutes;
      await supabase
        .from('time_bank_accounts')
        .update({ balance_minutes: newBalance, updated_at: new Date().toISOString() })
        .eq('id', account.id);

      toast.success('Folga compensatória agendada com sucesso!');
      setShowRequestOffModal(false);
      setOffDate('');
      setOffDescription('');
      fetchTimeBankData();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao solicitar folga: ' + (err.message || 'Desconhecido'));
    } finally {
      setSubmittingOff(false);
    }
  };

  if (!isOpen) return null;

  const alert = account
    ? TimeBankService.checkExpirationAndAlerts(account, new Date().toISOString().substring(0, 10))
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
              <TrendingUp size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-display leading-tight">Banco de Horas</h2>
              <p className="text-xs text-white/80 font-medium">Extrato e Gestão de Compensação</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 size={32} className="animate-spin text-emerald-500" />
              <p className="text-sm font-medium">Carregando movimentações do banco de horas...</p>
            </div>
          ) : !account ? (
            <div className="text-center py-10 space-y-3">
              <Clock size={40} className="mx-auto text-slate-300" />
              <p className="text-base font-bold text-slate-700">Nenhum banco de horas ativo</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Não há acordo de banco de horas cadastrado para o seu contrato de trabalho no momento.
              </p>
            </div>
          ) : (
            <>
              {/* Saldo em Destaque */}
              <div
                className={`p-6 rounded-3xl border ${
                  account.balance_minutes >= 0
                    ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200'
                    : 'bg-gradient-to-br from-rose-50 to-orange-50 border-rose-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Saldo Acumulado Atual
                  </span>
                  <span
                    className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                      account.policy_type === 'ACORDO_INDIVIDUAL'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-indigo-100 text-indigo-800'
                    }`}
                  >
                    {account.policy_type === 'ACORDO_INDIVIDUAL' ? 'Acordo Individual (6m)' : 'CCT (12m)'}
                  </span>
                </div>

                <div className="flex items-baseline justify-between">
                  <div
                    className={`text-4xl sm:text-5xl font-black font-mono tracking-tight ${
                      account.balance_minutes >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {formatMinutesToHours(account.balance_minutes)}
                  </div>

                  <button
                    onClick={() => setShowRequestOffModal(true)}
                    className="py-2 px-3.5 rounded-xl bg-white text-emerald-700 border border-emerald-300 font-bold text-xs shadow-sm hover:bg-emerald-50 transition-all flex items-center gap-1.5"
                  >
                    <CalendarDays size={14} />
                    <span>Agendar Folga</span>
                  </button>
                </div>

                <p className="text-xs text-slate-500 mt-3 flex items-center gap-1.5">
                  <Calendar size={13} className="text-slate-400" />
                  Vigência: {account.start_date} até {account.end_date}
                </p>
              </div>

              {/* Alerta de Vencimento */}
              {alert && alert.status !== 'NORMAL' && (
                <div
                  className={`p-4 rounded-2xl border flex items-start gap-3 ${
                    alert.status === 'CRITICAL' || alert.status === 'EXPIRED'
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}
                >
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold">
                      {alert.status === 'EXPIRED' ? 'Banco de Horas Vencido' : 'Aviso de Vencimento do Acordo'}
                    </p>
                    <p className="text-xs mt-0.5 opacity-90">{alert.message}</p>
                  </div>
                </div>
              )}

              {/* Formulário de Folga Compensatória (Expansível) */}
              {showRequestOffModal && (
                <form
                  onSubmit={handleRequestCompDayOff}
                  className="p-4 bg-slate-50 border border-emerald-200 rounded-2xl space-y-3 animate-fade-in"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Agendar Folga Compensatória
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowRequestOffModal(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Data da Folga</label>
                      <input
                        type="date"
                        required
                        className="w-full text-xs py-2 px-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        value={offDate}
                        onChange={(e) => setOffDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Horas a Debitar</label>
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        max="10"
                        required
                        className="w-full text-xs py-2 px-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        value={offHours}
                        onChange={(e) => setOffHours(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Motivo / Observação</label>
                    <input
                      type="text"
                      placeholder="Ex: Compensação de feriado ou ponte..."
                      className="w-full text-xs py-2 px-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      value={offDescription}
                      onChange={(e) => setOffDescription(e.target.value)}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowRequestOffModal(false)}
                      className="py-1.5 px-3 rounded-xl border border-slate-200 text-xs text-slate-600 font-semibold"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={submittingOff}
                      className="py-1.5 px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 flex items-center gap-1.5"
                    >
                      {submittingOff ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      <span>Confirmar Folga</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Extrato de Transações */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Extrato de Movimentações
                </p>

                {statement && statement.entries.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {statement.entries.map((entry, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">{entry.date}</span>
                            <span
                              className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                                entry.minutes > 0
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {entry.transaction_type}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-xs">{entry.description}</p>
                        </div>

                        <div className="text-right">
                          <p
                            className={`font-mono font-bold ${
                              entry.minutes > 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {entry.minutes_formatted}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            Saldo: {entry.running_balance_formatted}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-xl border border-slate-100">
                    Nenhuma movimentação registrada no período deste banco de horas.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TimeBankModal;
