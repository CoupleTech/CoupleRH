import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  MessageSquare,
  ShieldCheck
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  TimesheetPdfService,
  type TimesheetReportData,
  type TimesheetDailyRow,
  formatMinutesHHMM
} from '../../services/timeTracking/timesheetPdfService';
import {
  TimesheetContestService,
  type TimesheetRecord
} from '../../services/timeTracking/timesheetContestService';
import { toast } from 'sonner';

interface TimesheetViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractId: string;
  workerId: string;
  workerName: string;
  workerCpf: string;
  companyName: string;
  companyCnpj: string;
}

export const TimesheetViewModal: React.FC<TimesheetViewModalProps> = ({
  isOpen,
  onClose,
  contractId,
  workerId,
  workerName,
  workerCpf,
  companyName,
  companyCnpj
}) => {
  const [loading, setLoading] = useState(true);
  const [timesheet, setTimesheet] = useState<TimesheetRecord | null>(null);
  const [dailyRows, setDailyRows] = useState<TimesheetDailyRow[]>([]);
  const [showContestForm, setShowContestForm] = useState(false);
  const [contestReason, setContestReason] = useState('');
  const [affectedDate, setAffectedDate] = useState('');
  const [submittingContest, setSubmittingContest] = useState(false);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    if (!isOpen || !contractId) return;
    fetchTimesheetData();
  }, [isOpen, contractId]);

  const fetchTimesheetData = async () => {
    setLoading(true);
    try {
      // 1. Buscar último espelho de ponto do contrato
      const { data: tsData, error: tsError } = await supabase
        .from('timesheets')
        .select('*')
        .eq('contract_id', contractId)
        .order('period_start', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (tsError) throw tsError;

      if (!tsData) {
        setTimesheet(null);
        setDailyRows([]);
        return;
      }

      setTimesheet(tsData as TimesheetRecord);

      // 2. Buscar resumos diários da competência para montar a grade
      const { data: dailyData, error: dailyError } = await supabase
        .from('time_daily_summary')
        .select('*')
        .eq('contract_id', contractId)
        .gte('date', tsData.period_start)
        .lte('date', tsData.period_end)
        .order('date', { ascending: true });

      if (dailyError) throw dailyError;

      const rows: TimesheetDailyRow[] = (dailyData || []).map((d: any) => {
        const dateObj = new Date(d.date + 'T12:00:00Z');
        const dayOfWeek = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' });

        return {
          date: d.date,
          dayOfWeek,
          punches: d.notes?.includes('Batidas:') ? d.notes.replace('Batidas: ', '').split(' ') : [],
          worked_minutes: d.worked_minutes || 0,
          overtime_50_minutes: d.overtime_50_minutes || 0,
          overtime_100_minutes: d.overtime_100_minutes || 0,
          night_shift_minutes: d.night_shift_minutes || 0,
          delay_minutes: d.delay_minutes || 0,
          absence_minutes: d.absence_minutes || 0,
          intrajornada_violation_minutes: d.intrajornada_violation_minutes || 0,
          time_bank_minutes: (d.time_bank_credited_minutes || 0) - (d.time_bank_debited_minutes || 0),
          status: d.status || 'REGULAR',
          notes: d.notes || ''
        };
      });

      setDailyRows(rows);
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao carregar espelho de ponto: ' + (err.message || 'Desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!timesheet) return;

    try {
      const reportData: TimesheetReportData = {
        tenant_id: timesheet.tenant_id,
        company: {
          corporate_name: companyName,
          cnpj: companyCnpj
        },
        employee: {
          worker_id: workerId,
          full_name: workerName,
          cpf: workerCpf
        },
        period: {
          month: parseInt(timesheet.period_start.substring(5, 7), 10),
          year: parseInt(timesheet.period_start.substring(0, 4), 10),
          start_date: timesheet.period_start,
          end_date: timesheet.period_end
        },
        daily_rows: dailyRows
      };

      const doc = TimesheetPdfService.generateTimesheetPdf(reportData);
      doc.save(`Espelho_Ponto_${workerName.replace(/\s+/g, '_')}_${timesheet.period_start}.pdf`);
      toast.success('Download do Espelho de Ponto em PDF concluído.');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao gerar PDF do espelho: ' + err.message);
    }
  };

  const handleSignTimesheet = async () => {
    if (!timesheet) return;
    setSigning(true);
    try {
      const { error } = await supabase
        .from('timesheets')
        .update({
          status: 'SIGNED',
          updated_at: new Date().toISOString()
        })
        .eq('id', timesheet.id);

      if (error) throw error;

      setTimesheet((prev) => (prev ? { ...prev, status: 'SIGNED' } : null));
      toast.success('Espelho de ponto assinado com sucesso!');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao assinar espelho: ' + (err.message || 'Desconhecido'));
    } finally {
      setSigning(false);
    }
  };

  const handleOpenContest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!timesheet) return;

    if (!contestReason || contestReason.trim().length < 10) {
      toast.error('Descreva o motivo da contestação com no mínimo 10 caracteres.');
      return;
    }

    setSubmittingContest(true);
    try {
      // 1. Executa serviço de contestação
      const contestResult = TimesheetContestService.openContest({
        timesheet,
        worker_id: workerId,
        reason: contestReason,
        affected_dates: affectedDate ? [affectedDate] : []
      });

      // 2. Grava no banco de dados
      const { error: insertError } = await supabase.from('timesheet_contests').insert({
        tenant_id: timesheet.tenant_id,
        timesheet_id: timesheet.id,
        contract_id: contractId,
        worker_id: workerId,
        reason: contestResult.contest.reason,
        affected_dates: contestResult.contest.affected_dates,
        status: 'PENDING'
      });

      if (insertError) throw insertError;

      // 3. Atualiza status em timesheets
      await supabase
        .from('timesheets')
        .update({
          status: 'CONTESTED',
          rejection_reason: contestResult.contest.reason,
          contested_at: contestResult.timesheet.contested_at,
          updated_at: new Date().toISOString()
        })
        .eq('id', timesheet.id);

      setTimesheet(contestResult.timesheet);
      setShowContestForm(false);
      setContestReason('');
      setAffectedDate('');
      toast.success('Contestação enviada ao Departamento Pessoal para análise.');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao contestar espelho: ' + (err.message || 'Desconhecido'));
    } finally {
      setSubmittingContest(false);
    }
  };

  if (!isOpen) return null;

  const totals = TimesheetPdfService.calculateMonthlyTotals(dailyRows);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-900 px-6 py-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
              <FileText size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-display leading-tight">Espelho de Ponto</h2>
              <p className="text-xs text-white/80 font-medium">Portaria MTP nº 671/2021</p>
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
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 size={32} className="animate-spin text-indigo-500" />
              <p className="text-sm font-medium">Carregando espelho de ponto...</p>
            </div>
          ) : !timesheet ? (
            <div className="text-center py-10 space-y-3">
              <FileText size={40} className="mx-auto text-slate-300" />
              <p className="text-base font-bold text-slate-700">Espelho ainda não apurado</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                O espelho deste período ainda está em processamento pelo Departamento Pessoal.
              </p>
            </div>
          ) : (
            <>
              {/* Status do Espelho e Download */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Período: {timesheet.period_start} a {timesheet.period_end}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
                        timesheet.status === 'SIGNED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : timesheet.status === 'CONTESTED'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-indigo-100 text-indigo-800'
                      }`}
                    >
                      {timesheet.status === 'SIGNED'
                        ? 'Assinado pelo Colaborador'
                        : timesheet.status === 'CONTESTED'
                        ? 'Contestação sob Análise do DP'
                        : 'Pendente de Ciência / Assinatura'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleDownloadPdf}
                  className="py-2 px-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Download size={14} />
                  <span>Baixar PDF</span>
                </button>
              </div>

              {/* Totalizadores Mensais */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Trabalhadas</p>
                  <p className="text-base font-mono font-black text-slate-900 mt-0.5">
                    {totals.total_worked_formatted}
                  </p>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-center">
                  <p className="text-[10px] uppercase font-bold text-emerald-600">Horas Extras</p>
                  <p className="text-base font-mono font-black text-emerald-700 mt-0.5">
                    {formatMinutesHHMM(totals.total_overtime_50_minutes + totals.total_overtime_100_minutes)}
                  </p>
                </div>
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-center">
                  <p className="text-[10px] uppercase font-bold text-indigo-600">Adic. Noturno</p>
                  <p className="text-base font-mono font-black text-indigo-700 mt-0.5">
                    {totals.total_night_shift_formatted}
                  </p>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-center">
                  <p className="text-[10px] uppercase font-bold text-rose-600">Atrasos/Faltas</p>
                  <p className="text-base font-mono font-black text-rose-700 mt-0.5">
                    {totals.total_delay_formatted}
                  </p>
                </div>
              </div>

              {/* Formulário de Contestação */}
              {showContestForm && (
                <form
                  onSubmit={handleOpenContest}
                  className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3 animate-fade-in"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                      Contestar Marcações do Espelho
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowContestForm(false)}
                      className="text-amber-500 hover:text-amber-700"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-amber-800 block mb-1">
                      Data da Ocorrência (Opcional)
                    </label>
                    <input
                      type="date"
                      className="w-full text-xs py-2 px-3 bg-white border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      value={affectedDate}
                      onChange={(e) => setAffectedDate(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-amber-800 block mb-1">
                      Motivo Detalhado da Contestação *
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Descreva a inconsistência (ex: trabalhei até 19h no dia 10 e a batida não computou)..."
                      className="w-full text-xs py-2 px-3 bg-white border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      value={contestReason}
                      onChange={(e) => setContestReason(e.target.value)}
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowContestForm(false)}
                      className="py-1.5 px-3 rounded-xl border border-amber-200 text-xs text-amber-800 font-semibold"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={submittingContest}
                      className="py-1.5 px-4 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 flex items-center gap-1.5"
                    >
                      {submittingContest ? <Loader2 size={14} className="animate-spin" /> : <AlertCircle size={14} />}
                      <span>Enviar Contestação</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Botões de Ação de Assinatura / Contestação */}
              {timesheet.status === 'PENDING_SIGNATURE' && !showContestForm && (
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setShowContestForm(true)}
                    className="flex-1 py-3 px-4 rounded-xl border border-amber-300 text-amber-800 font-bold text-xs hover:bg-amber-50 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <MessageSquare size={16} />
                    <span>Contestar Ponto</span>
                  </button>

                  <button
                    onClick={handleSignTimesheet}
                    disabled={signing}
                    className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-emerald-500/20"
                  >
                    {signing ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                    <span>Dar Ciência e Assinar</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TimesheetViewModal;
