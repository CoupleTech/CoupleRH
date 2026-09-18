import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Play,
  Calculator,
  Loader2,
  Calendar,
  FileText,
  CheckCircle2,
  DollarSign,
  Users,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  X,
  Trash2,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useCompany } from "../../contexts/CompanyContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from 'sonner';
import { confirmDialog } from '../../components/ConfirmDialogProvider';

interface PayrollPeriod {
  id: string;
  month: number;
  year: number;
  type: string;
  status: string;
  processing_date: string;
}

interface Payslip {
  id: string;
  contract_id: string;
  company_id: string;
  employee_name: string;
  total_earnings: number;
  total_deductions: number;
  net_salary: number;
  base_inss?: number;
  base_irrf?: number;
  base_fgts?: number;
  fgts_month?: number;
  items?: PayslipItem[];
}

interface PayslipItem {
  id: string;
  rubric_name: string;
  reference: string;
  amount: number;
  type: string;
}

interface MemoryCalcItem {
  id: string;
  step_name: string;
  base_value: number;
  quantity_used: number;
  percentage_used: number;
  parsed_formula: string;
  result_value: number;
  origin: string;
  engine_version: string;
}

export default function () {
  const { selectedCompanyId } = useCompany();
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [activePeriod, setActivePeriod] = useState<PayrollPeriod | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);

  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [loadingPayslips, setLoadingPayslips] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [expandedPayslip, setExpandedPayslip] = useState<string | null>(null);
  
  const [memoryData, setMemoryData] = useState<Record<string, MemoryCalcItem[]>>({});
  const [loadingMemory, setLoadingMemory] = useState<Record<string, boolean>>({});
  const [showMemory, setShowMemory] = useState<Record<string, boolean>>({});

  // Folha Complementar
  const [showComplementModal, setShowComplementModal] = useState(false);
  const [selectedParentPeriodId, setSelectedParentPeriodId] = useState("");
  const [complementReason, setComplementReason] = useState("");
  
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  
  const [showNewPeriodModal, setShowNewPeriodModal] = useState(false);
  const [newPeriodMonth, setNewPeriodMonth] = useState(currentMonth);
  const [newPeriodYear, setNewPeriodYear] = useState(currentYear);
  const [newPeriodType, setNewPeriodType] = useState("MONTHLY");



  useEffect(() => {
    fetchPeriods();
  }, [selectedCompanyId]);

  const fetchPeriods = async () => {
    setLoadingPeriods(true);
    const { data: userData } = await supabase.auth.getUser();
    const { data: tenantData } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", userData.user?.id)
      .single();

    if (tenantData) {
      // Create current period if it doesn't exist
      if (selectedCompanyId) {
        const { data: existing } = await supabase
          .from("payroll_periods")
          .select("*")
          .eq("tenant_id", tenantData.tenant_id)
          .eq("company_id", selectedCompanyId)
          .eq("month", currentMonth)
          .eq("year", currentYear)
          .eq("type", "MONTHLY");

        if (!existing || existing.length === 0) {
          await supabase.from("payroll_periods").upsert({
            tenant_id: tenantData.tenant_id,
            company_id: selectedCompanyId,
            month: currentMonth,
            year: currentYear,
            type: "MONTHLY",
          }, { onConflict: 'tenant_id, company_id, month, year, type', ignoreDuplicates: true });
        }
      }

      let query = supabase
        .from("payroll_periods")
        .select("*")
        .eq("tenant_id", tenantData.tenant_id);
        
      if (selectedCompanyId) {
        query = query.eq("company_id", selectedCompanyId);
      }

      const { data } = await query
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .order("type", { ascending: true });

      if (data) {
        setPeriods(data as PayrollPeriod[]);
        if (!activePeriod && data.length > 0) {
          selectPeriod(data[0] as PayrollPeriod);
        } else if (activePeriod) {
          const updatedActive = data.find(p => p.id === activePeriod.id);
          if (updatedActive) selectPeriod(updatedActive as PayrollPeriod);
        }
      }
    }
    setLoadingPeriods(false);
  };

    const createCustomPeriod = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const { data: tenantData } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", userData.user?.id)
      .single();

    if (tenantData && selectedCompanyId) {
      await supabase.from("payroll_periods").upsert({
        tenant_id: tenantData.tenant_id,
        company_id: selectedCompanyId,
        month: newPeriodMonth,
        year: newPeriodYear,
        type: newPeriodType,
      }, { onConflict: 'tenant_id, company_id, month, year, type', ignoreDuplicates: true });
      setShowNewPeriodModal(false);
      fetchPeriods();
    }
  };

  const createPeriodByType = async (type: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const { data: tenantData } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", userData.user?.id)
      .single();

    if (tenantData && selectedCompanyId) {
      await supabase.from("payroll_periods").upsert({
        tenant_id: tenantData.tenant_id,
        company_id: selectedCompanyId,
        month: currentMonth,
        year: currentYear,
        type: type,
      }, { onConflict: 'tenant_id, company_id, month, year, type', ignoreDuplicates: true });
      fetchPeriods();
    }
  };

  const createComplementaryPeriod = async () => {
    if (!selectedParentPeriodId || !complementReason) {
      toast.error("Selecione a folha origem e preencha a justificativa.");
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const { data: tenantData } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", userData.user?.id)
      .single();

    if (tenantData && selectedCompanyId) {
      // Allow multiple complementary periods in the same month by not relying on the composite unique key
      // or we just use month/year/type and for now we limit to 1 per month of COMPLEMENTARY.
      await supabase.from("payroll_periods").insert({
        tenant_id: tenantData.tenant_id,
        company_id: selectedCompanyId,
        month: currentMonth,
        year: currentYear,
        type: "COMPLEMENTARY",
        parent_period_id: selectedParentPeriodId,
        complement_reason: complementReason
      });
      setShowComplementModal(false);
      setComplementReason("");
      setSelectedParentPeriodId("");
      fetchPeriods();
    }
  };

  const selectPeriod = async (period: PayrollPeriod) => {
    setActivePeriod(period);
    fetchPayslips(period.id);
  };

  const fetchPayslips = async (periodId: string) => {
    setLoadingPayslips(true);

    // Fetch payslips with employee details
    const { data, error } = await supabase
      .from("payslips")
      .select(
        `
        id, contract_id, total_earnings, total_deductions, net_salary,
        base_inss, base_irrf, base_fgts, fgts_month,
        employment_contracts (
          company_id,
          workers (
            people (
              full_name
            )
          )
        )
      `,
      )
      .eq("period_id", periodId);

    if (error) {
      console.error("Erro ao buscar holerites:", error);
    }

    if (data && !error) {
      const formatted = data.map((p: any) => {
        const fullName =
          p.employment_contracts?.workers?.people?.full_name || "Desconhecido";
        return {
          id: p.id,
          contract_id: p.contract_id,
          company_id: p.employment_contracts?.company_id,
          employee_name: fullName,
          total_earnings: p.total_earnings,
          total_deductions: p.total_deductions,
          net_salary: p.net_salary,
          base_inss: p.base_inss,
          base_irrf: p.base_irrf,
          base_fgts: p.base_fgts,
          fgts_month: p.fgts_month,
        };
      });
      setPayslips(formatted);
    }
    setLoadingPayslips(false);
  };

  const deletePeriod = async () => {
    if (!activePeriod) return;
    if (activePeriod.status === 'CLOSED') {
      toast.error("Não é possível excluir uma folha fechada.");
      return;
    }
    
    if (!await confirmDialog("Tem certeza que deseja excluir esta folha? Todos os lançamentos serão perdidos.")) return;
    
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('payroll_periods')
        .delete()
        .eq('id', activePeriod.id);
        
      if (error) throw error;
      
      toast.success("Folha excluída com sucesso.");
      setActivePeriod(null);
      await fetchPeriods();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao excluir folha: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const processPayroll = async () => {
    if (!activePeriod) return;
    setProcessing(true);

    try {
      // Call our Supabase Edge Function
      const { data, error } = await supabase.functions.invoke(
        "payroll-engine",
        {
          body: { period_id: activePeriod.id },
        },
      );

      if (error) throw error;
      
      console.log("ENGINE DEBUG LOGS:", data.debug);

      await fetchPeriods(); // Refresh period to get processing_date
      await fetchPayslips(activePeriod.id);
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro no motor de folha: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const togglePayslip = async (payslipId: string) => {
    if (expandedPayslip === payslipId) {
      setExpandedPayslip(null);
      return;
    }

    setExpandedPayslip(payslipId);

    // Lazy load items
    const payslip = payslips.find((p) => p.id === payslipId);
    if (payslip && !payslip.items) {
      const { data } = await supabase
        .from("payslip_items")
        .select(
          `
          id, reference, amount, type,
          payroll_rubrics ( name )
        `,
        )
        .eq("payslip_id", payslipId);

      if (data) {
        const items = data.map((i: any) => ({
          id: i.id,
          rubric_name: i.payroll_rubrics?.name || "Rubrica Removida",
          reference: i.reference,
          amount: i.amount,
          type: i.type,
        }));

        setPayslips((prev) =>
          prev.map((p) => (p.id === payslipId ? { ...p, items } : p)),
        );
      }
    }
  };

  const changePeriodStatus = async (newStatus: string, actionName: string) => {
    if (!activePeriod) return;
    
    // Simular injeção de motivo na sessão se fosse fechamento/reabertura (Para MVP, vamos direto)
    if (newStatus === 'REOPENED') {
      const reason = window.prompt("Motivo da reabertura (Auditoria):");
      if (!reason) return; // Cancelado
      // O ideal é chamar um RPC para setar current_setting('app.audit_reason', reason)
      // Mas para o MVP via client, passamos apenas o status e a trigger default pega.
    }

    if (newStatus === 'CANCELED') {
      const confirm = await confirmDialog("Tem certeza que deseja cancelar esta folha?");
      if (!confirm) return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase
        .from("payroll_periods")
        .update({ status: newStatus })
        .eq("id", activePeriod.id);
        
      if (error) throw error;
      
      await fetchPeriods();
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao ${actionName.toLowerCase()}: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const toggleMemory = async (payslipId: string) => {
    if (memoryData[payslipId]) {
      setShowMemory(prev => ({...prev, [payslipId]: !prev[payslipId]}));
      return;
    }
    
    setLoadingMemory(prev => ({...prev, [payslipId]: true}));
    setShowMemory(prev => ({...prev, [payslipId]: true}));
    
    const { data } = await supabase
      .from("payroll_memory_calc")
      .select("*")
      .eq("payslip_id", payslipId)
      .order("id", { ascending: true });
      
    if (data) {
      setMemoryData(prev => ({...prev, [payslipId]: data as MemoryCalcItem[]}));
    }
    setLoadingMemory(prev => ({...prev, [payslipId]: false}));
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val);

  const getMonthName = (month: number) => {
    const date = new Date(2000, month - 1, 1);
    return format(date, "MMMM", { locale: ptBR }).toUpperCase();
  };

  const filteredPayslips = payslips.filter((p) => {
    if (selectedCompanyId && p.company_id !== selectedCompanyId) return false;
    return true;
  });

  return (
    <div className="animate-fade-up max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display flex items-center gap-3">
            <Play className="text-primary-600 fill-primary-600" />
            Processamento de Folha
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Acione o motor de regras e calcule os holerites do mês.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
                    <button
            onClick={async () => setShowNewPeriodModal(true)}
            className="btn-primary flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm transition-all"
            title="Abrir Nova Competência"
          >
            + Nova Competência
          </button>
          <button
            onClick={async () => createPeriodByType("ADVANCE")}
            className="btn-secondary whitespace-nowrap bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm transition-all"
            title="Gerar Competência de Adiantamento (Dia 15/20)"
          >
            + Adiantamento
          </button>
          <button
            onClick={async () => createPeriodByType("THIRTEENTH_1")}
            className="btn-secondary whitespace-nowrap bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm transition-all"
            title="Gerar 1ª Parcela do 13º Salário (até 30/Nov)"
          >
            + 13º (1ª Parc)
          </button>
          <button
            onClick={async () => createPeriodByType("THIRTEENTH_2")}
            className="btn-secondary whitespace-nowrap bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm transition-all"
            title="Gerar 2ª Parcela do 13º Salário (até 20/Dez)"
          >
            + 13º (2ª Parc)
          </button>
          <button
            onClick={async () => setShowComplementModal(true)}
            className="btn-secondary whitespace-nowrap bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm transition-all"
            title="Gerar Folha Complementar"
          >
            + Complementar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Competências Sidebar */}
        <div className="col-span-1 space-y-4">
          <div className="panel p-0 overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 font-bold text-slate-700 text-sm flex items-center gap-2 uppercase tracking-widest">
              <Calendar size={16} /> Competências
            </div>
            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {loadingPeriods ? (
                <div className="p-4 text-center">
                  <Loader2 className="animate-spin mx-auto text-primary-500" />
                </div>
              ) : (
                periods.map((p) => (
                  <button
                    key={p.id}
                    onClick={async () => selectPeriod(p)}
                    className={`w-full text-left p-4 hover:bg-slate-50 transition-colors ${activePeriod?.id === p.id ? "bg-primary-50 border-l-4 border-primary-600" : "border-l-4 border-transparent"}`}
                  >
                    <div className="font-bold text-slate-900">
                      {getMonthName(p.month)} / {p.year}
                    </div>
                    <div className="text-xs text-slate-500 flex justify-between mt-1">
                      <span>{p.type === "MONTHLY" ? "Mensal" : p.type === "ADVANCE" ? "Adiantamento" : p.type === "THIRTEENTH_1" ? "13º (1ª Parc)" : p.type === "THIRTEENTH_2" ? "13º (2ª Parc)" : p.type === "VACATION" ? "Férias" : p.type === "COMPLEMENTARY" ? "Complementar" : p.type}</span>
                      {p.processing_date ? (
                        <span className="text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 size={12} /> Calculado
                        </span>
                      ) : (
                        <span className="text-amber-600">Aberto</span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Workspace do Processamento */}
        <div className="col-span-1 md:col-span-3">
          {activePeriod ? (
            <div className="space-y-6">
              {/* Card de Ação */}
              <div className="panel p-6 bg-white border-l-4 border-l-primary-600 shadow-lg relative overflow-hidden">
                {/* Decoração Visual */}
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <Play size={120} />
                </div>

                <div className="relative z-10">
                  <h2 className="text-2xl font-bold font-display text-slate-900 mb-1">
                    Folha de {getMonthName(activePeriod.month)}{" "}
                    {activePeriod.year}
                  </h2>
                  <p className="text-slate-500 mb-6 max-w-xl">
                    O motor de folha irá varrer todos os colaboradores ativos,
                    ler as regras e incidências das rubricas e processar os
                    holerites individualmente.
                  </p>

                  <div className="flex gap-4 items-center flex-wrap">
                    {/* DRAFT ou REOPENED -> Permite Rodar Motor */}
                    {['DRAFT', 'REOPENED', 'CALCULATED'].includes(activePeriod.status) && (
                      <button
                        onClick={processPayroll}
                        disabled={processing}
                        className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-lg font-bold shadow-md hover:bg-slate-800 transition-colors disabled:opacity-50"
                      >
                        {processing ? (
                          <Loader2 className="animate-spin" size={18} />
                        ) : (
                          <Play size={18} className="fill-current" />
                        )}
                        {activePeriod.status === 'CALCULATED' ? "Reprocessar" : "Rodar Motor"}
                      </button>
                    )}

                    {/* CALCULATED -> Permite enviar para Conferência */}
                    {activePeriod.status === 'CALCULATED' && (
                      <button
                        onClick={async () => changePeriodStatus('CONFERENCE', 'Enviar para Conferência')}
                        disabled={processing}
                        className="flex items-center gap-2 bg-amber-100 text-amber-700 border border-amber-200 px-6 py-2.5 rounded-lg font-bold shadow-sm hover:bg-amber-200 transition-colors disabled:opacity-50"
                      >
                        Enviar para Conferência
                      </button>
                    )}

                    {/* CONFERENCE -> Permite Fechar ou Voltar */}
                    {activePeriod.status === 'CONFERENCE' && (
                      <>
                        <button
                          onClick={async () => changePeriodStatus('CLOSED', 'Fechar Folha')}
                          disabled={processing}
                          className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-lg font-bold shadow-md hover:bg-emerald-700 transition-colors disabled:opacity-50"
                        >
                          <CheckCircle2 size={18} />
                          Aprovar e Fechar Folha
                        </button>
                        <button
                          onClick={async () => changePeriodStatus('CALCULATED', 'Voltar para Cálculo')}
                          disabled={processing}
                          className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 px-6 py-2.5 rounded-lg font-bold shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                        >
                          Voltar p/ Cálculo
                        </button>
                      </>
                    )}

                    {/* CLOSED -> Permite Reabrir */}
                    {activePeriod.status === 'CLOSED' && (
                      <button
                        onClick={async () => changePeriodStatus('REOPENED', 'Reabrir Folha')}
                        disabled={processing}
                        className="flex items-center gap-2 bg-rose-100 text-rose-700 border border-rose-200 px-6 py-2.5 rounded-lg font-bold shadow-sm hover:bg-rose-200 transition-colors disabled:opacity-50"
                      >
                        <AlertCircle size={18} />
                        Reabrir Folha (Auditoria)
                      </button>
                    )}

                    {/* Excluir Periodo (Apenas não fechado) */}
                    {activePeriod.status !== 'CLOSED' && (
                      <button
                        onClick={deletePeriod}
                        disabled={processing}
                        className="flex items-center gap-2 bg-rose-50 text-rose-600 border border-rose-200 px-6 py-2.5 rounded-lg font-bold shadow-sm hover:bg-rose-100 transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={18} />
                        Excluir
                      </button>
                    )}

                    {/* Mostrar Status Atual como Badge */}
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-widest ml-auto
                      ${activePeriod.status === 'DRAFT' || activePeriod.status === 'REOPENED' ? 'bg-slate-100 text-slate-600' : ''}
                      ${activePeriod.status === 'CALCULATED' ? 'bg-primary-100 text-primary-700' : ''}
                      ${activePeriod.status === 'CONFERENCE' ? 'bg-amber-100 text-amber-700' : ''}
                      ${activePeriod.status === 'CLOSED' ? 'bg-emerald-100 text-emerald-700' : ''}
                      ${activePeriod.status === 'CANCELED' ? 'bg-rose-100 text-rose-700' : ''}
                    `}>
                      STATUS: {
                        activePeriod.status === 'DRAFT' ? 'Rascunho' : 
                        activePeriod.status === 'CALCULATED' ? 'Calculada' : 
                        activePeriod.status === 'CONFERENCE' ? 'Conferência' : 
                        activePeriod.status === 'CLOSED' ? 'Fechada' : 
                        activePeriod.status === 'REOPENED' ? 'Reaberta' : 
                        activePeriod.status === 'CANCELED' ? 'Cancelada' : activePeriod.status
                      }
                    </span>

                    {activePeriod.processing_date && !processing && (
                      <span className="text-sm font-bold text-emerald-600 flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-lg">
                        <CheckCircle2 size={16} /> Processado em{" "}
                        {format(
                          new Date(activePeriod.processing_date),
                          "dd/MM 'às' HH:mm",
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Lista de Holerites */}
              <div className="panel overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <FileText size={18} className="text-slate-400" /> Holerites
                    Gerados ({filteredPayslips.length})
                  </h3>
                  {filteredPayslips.length > 0 && (
                    <div className="text-sm font-bold text-slate-600">
                      Total Líquido da Folha:{" "}
                      <span className="text-primary-700">
                        {formatCurrency(
                          filteredPayslips.reduce((acc, p) => acc + p.net_salary, 0),
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {loadingPayslips ? (
                  <div className="p-12 text-center text-slate-400">
                    <Loader2 className="animate-spin mx-auto mb-2" />{" "}
                    Carregando...
                  </div>
                ) : filteredPayslips.length === 0 ? (
                  <div className="p-12 text-center">
                    <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-slate-900">
                      Nenhum holerite calculado
                    </h3>
                    <p className="text-slate-500 mt-1">
                      Clique no botão negro acima para rodar o motor desta
                      competência.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredPayslips.map((p) => (
                      <div key={p.id} className="group">
                        {/* Header do Holerite (Resumo) */}
                        <div
                          className="px-6 py-4 hover:bg-slate-50 transition-colors cursor-pointer flex justify-between items-center"
                          onClick={async () => togglePayslip(p.id)}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm">
                              {p.employee_name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">
                                {p.employee_name}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {activePeriod?.type === 'ADVANCE' ? 'Holerite de Adiantamento' : 
                         activePeriod?.type === 'MONTHLY' ? 'Holerite Mensal' :
                         activePeriod?.type === 'THIRTEENTH_1' ? '1ª Parc. 13º' :
                         activePeriod?.type === 'THIRTEENTH_2' ? '2ª Parc. 13º' :
                         activePeriod?.type === 'VACATION' ? 'Recibo de Férias' : 
                         'Holerite'}        </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-8">
                            <div className="text-right hidden sm:block">
                              <p className="text-[10px] uppercase tracking-widest text-emerald-600 font-bold">
                                Proventos
                              </p>
                              <p className="font-mono text-sm text-slate-900">
                                {formatCurrency(p.total_earnings)}
                              </p>
                            </div>
                            <div className="text-right hidden sm:block">
                              <p className="text-[10px] uppercase tracking-widest text-rose-600 font-bold">
                                Descontos
                              </p>
                              <p className="font-mono text-sm text-slate-900">
                                {formatCurrency(p.total_deductions)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] uppercase tracking-widest text-primary-600 font-bold">
                                Líquido a Receber
                              </p>
                              <p className="font-mono font-bold text-slate-900">
                                {formatCurrency(p.net_salary)}
                              </p>
                            </div>
                            <div className="text-slate-400">
                              {expandedPayslip === p.id ? (
                                <ChevronUp />
                              ) : (
                                <ChevronDown />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Detalhes do Holerite (Itens) */}
                        {expandedPayslip === p.id && (
                          <div className="bg-slate-50 px-6 py-6 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
                            <div className="bg-white border border-slate-200 shadow-sm rounded-lg overflow-hidden font-mono text-sm">
                              <table className="w-full text-left">
                                <thead className="bg-slate-100 text-slate-500 uppercase tracking-widest text-[10px]">
                                  <tr>
                                    <th className="px-4 py-2 font-bold">
                                      Rubrica / Descrição
                                    </th>
                                    <th className="px-4 py-2 font-bold text-right">
                                      Referência
                                    </th>
                                    <th className="px-4 py-2 font-bold text-right">
                                      Vencimentos
                                    </th>
                                    <th className="px-4 py-2 font-bold text-right">
                                      Descontos
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-dashed divide-slate-200">
                                  {!p.items ? (
                                    <tr>
                                      <td
                                        colSpan={4}
                                        className="text-center py-4"
                                      >
                                        <Loader2
                                          className="animate-spin inline"
                                          size={16}
                                        />
                                      </td>
                                    </tr>
                                  ) : (
                                    p.items.map((item) => (
                                      <tr key={item.id}>
                                        <td className="px-4 py-2 text-slate-800">
                                          {item.rubric_name}
                                        </td>
                                        <td className="px-4 py-2 text-right text-slate-500">
                                          {item.reference}
                                        </td>
                                        <td className="px-4 py-2 text-right text-emerald-700">
                                          {item.type === "EARNING"
                                            ? formatCurrency(item.amount)
                                            : ""}
                                        </td>
                                        <td className="px-4 py-2 text-right text-rose-700">
                                          {item.type === "DEDUCTION"
                                            ? formatCurrency(item.amount)
                                            : ""}
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                                <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold">
                                  <tr>
                                    <td
                                      colSpan={2}
                                      className="px-4 py-3 text-right"
                                    >
                                      TOTAIS:
                                    </td>
                                    <td className="px-4 py-3 text-right text-emerald-700">
                                      {formatCurrency(p.total_earnings)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-rose-700">
                                      {formatCurrency(p.total_deductions)}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                            
                            {/* Bases Legais (Footer do Holerite) */}
                            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white border border-slate-200 rounded-lg p-3 text-center shadow-sm">
                                  <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Base INSS</p>
                                  <p className="font-mono font-bold text-slate-800">{formatCurrency(p.base_inss || 0)}</p>
                                </div>
                                <div className="bg-white border border-slate-200 rounded-lg p-3 text-center shadow-sm">
                                  <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Base IRRF</p>
                                  <p className="font-mono font-bold text-slate-800">{formatCurrency(p.base_irrf || 0)}</p>
                                </div>
                                <div className="bg-white border border-slate-200 rounded-lg p-3 text-center shadow-sm">
                                  <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Base FGTS</p>
                                  <p className="font-mono font-bold text-slate-800">{formatCurrency(p.base_fgts || 0)}</p>
                                </div>
                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center shadow-sm">
                                  <p className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">FGTS do Mês (Depósito)</p>
                                  <p className="font-mono font-bold text-emerald-800">{formatCurrency(p.fgts_month || 0)}</p>
                                </div>
                            </div>
                            
                            {/* Memória de Cálculo Button */}
                            <div className="mt-4 flex justify-end">
                              <button 
                                onClick={async () => toggleMemory(p.id)}
                                className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800 font-bold bg-primary-50 px-4 py-2 rounded-lg transition-colors"
                              >
                                <Calculator size={16} />
                                {showMemory[p.id] ? "Ocultar Memória de Cálculo" : "Ver Memória de Cálculo"}
                              </button>
                            </div>

                            {/* Memória de Cálculo Table */}
                            {showMemory[p.id] && (
                              <div className="mt-4 bg-slate-900 rounded-lg p-1 overflow-hidden animate-in fade-in slide-in-from-top-2">
                                <div className="bg-slate-800 text-slate-300 text-xs px-4 py-2 flex items-center gap-2 border-b border-slate-700">
                                  <Calculator size={14} className="text-primary-400" />
                                  <span className="font-bold text-white tracking-widest">MEMÓRIA DE CÁLCULO (DEBUG / AUDITORIA)</span>
                                </div>
                                {loadingMemory[p.id] ? (
                                  <div className="p-6 text-center text-slate-400">
                                    <Loader2 className="animate-spin inline mr-2" size={16} /> Carregando...
                                  </div>
                                ) : memoryData[p.id]?.length > 0 ? (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left font-mono text-[10px] sm:text-xs">
                                      <thead className="bg-slate-900/50 text-slate-400 uppercase">
                                        <tr>
                                          <th className="px-4 py-2 font-semibold">Rubrica / Passo</th>
                                          <th className="px-4 py-2 font-semibold text-right">Base</th>
                                          <th className="px-4 py-2 font-semibold text-right">Qtd</th>
                                          <th className="px-4 py-2 font-semibold text-right">%</th>
                                          <th className="px-4 py-2 font-semibold">Fórmula (Execução)</th>
                                          <th className="px-4 py-2 font-semibold text-right">Resultado</th>
                                          <th className="px-4 py-2 font-semibold text-center">Origem</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-700/50">
                                        {memoryData[p.id].map((mem, i) => (
                                          <tr key={mem.id || i} className="hover:bg-slate-700/30 text-slate-300">
                                            <td className="px-4 py-2 font-bold text-primary-300">{mem.step_name}</td>
                                            <td className="px-4 py-2 text-right text-slate-400">{mem.base_value ? formatCurrency(mem.base_value) : '-'}</td>
                                            <td className="px-4 py-2 text-right text-slate-400">{mem.quantity_used || '-'}</td>
                                            <td className="px-4 py-2 text-right text-slate-400">{mem.percentage_used ? `${mem.percentage_used}%` : '-'}</td>
                                            <td className="px-4 py-2 text-amber-200 truncate max-w-[200px]" title={mem.parsed_formula}>{mem.parsed_formula}</td>
                                            <td className="px-4 py-2 text-right font-bold text-white">{formatCurrency(mem.result_value)}</td>
                                            <td className="px-4 py-2 text-center">
                                              <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-[9px]">{mem.origin}</span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <div className="p-6 text-center text-slate-500">
                                    Nenhuma memória de cálculo encontrada para este holerite.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400">
              Selecione uma competência ao lado.
            </div>
          )}
        </div>
      </div>

            {showNewPeriodModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 animate-in fade-in backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900 font-display">
                Nova Competência
              </h2>
              <button
                onClick={async () => setShowNewPeriodModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Mês</label>
                  <select 
                    value={newPeriodMonth} 
                    onChange={(e) => setNewPeriodMonth(Number(e.target.value))}
                    className="input-field w-full"
                  >
                    {Array.from({length: 12}, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>{getMonthName(m)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Ano</label>
                  <input 
                    type="number" 
                    value={newPeriodYear} 
                    onChange={(e) => setNewPeriodYear(Number(e.target.value))}
                    className="input-field w-full"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Tipo de Folha</label>
                <select 
                  value={newPeriodType} 
                  onChange={(e) => setNewPeriodType(e.target.value)}
                  className="input-field w-full"
                >
                  <option value="MONTHLY">Mensal</option>
                  <option value="ADVANCE">Adiantamento</option>
                  <option value="THIRTEENTH_1">13º Salário (1ª Parcela)</option>
                  <option value="THIRTEENTH_2">13º Salário (2ª Parcela)</option>
                  <option value="PROFIT_SHARING">PLR / Bônus</option>
                </select>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={async () => setShowNewPeriodModal(false)}
                className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={createCustomPeriod}
                className="btn-primary px-4 py-2"
              >
                Criar Competência
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showComplementModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 animate-in fade-in backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900 font-display">
                Nova Folha Complementar
              </h2>
              <button
                onClick={async () => setShowComplementModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Folha Original
                </label>
                <select
                  value={selectedParentPeriodId}
                  onChange={(e) => setSelectedParentPeriodId(e.target.value)}
                  className="input-field w-full"
                >
                  <option value="">Selecione a folha que foi paga com erro ou atraso...</option>
                  {periods.filter(p => p.status === 'CLOSED').map(p => (
                    <option key={p.id} value={p.id}>
                      {getMonthName(p.month)} / {p.year} - {p.type === 'MONTHLY' ? 'Mensal' : p.type}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Somente competências FECHADAS podem ter folha complementar.
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Justificativa
                </label>
                <textarea
                  value={complementReason}
                  onChange={(e) => setComplementReason(e.target.value)}
                  className="input-field w-full h-24"
                  placeholder="Ex: Pagamento de comissões atrasadas da competência anterior."
                />
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={async () => setShowComplementModal(false)}
                className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={createComplementaryPeriod}
                className="btn-primary px-4 py-2"
              >
                Criar Folha
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
