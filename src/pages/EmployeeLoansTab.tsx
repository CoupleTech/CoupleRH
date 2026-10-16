import React, { useState, useEffect } from "react";
import {
  Landmark,
  Plus,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  Edit2,
  Trash2,
  PauseCircle,
  PlayCircle,
  TrendingDown,
  Info,
  Calendar,
  Layers,
  Sparkles
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import { confirmDialog } from "../components/ConfirmDialogProvider";
import { formatCurrency, formatDate } from "../lib/dateUtils";

interface EmployeeLoan {
  id: string;
  tenant_id: string;
  company_id: string;
  contract_id: string;
  bank_name: string;
  contract_number: string | null;
  installment_amount: number;
  total_installments: number;
  current_installment: number;
  start_date: string;
  end_date: string | null;
  provision_on_advance: boolean;
  advance_provision_percentage: number;
  status: "ACTIVE" | "PAUSED" | "SETTLED" | "CANCELLED";
  notes: string | null;
  created_at?: string;
}

const COMMON_BANKS = [
  "Caixa Econômica Federal",
  "Banco do Brasil",
  "Bradesco",
  "Itaú Unibanco",
  "Santander",
  "Banco Inter",
  "Banco Pan",
  "C6 Bank",
  "Nubank",
  "Safra",
  "Daycoval",
  "Outro / Convênio FGTS Digital"
];

interface EmployeeLoansTabProps {
  contractId?: string;
  companyId?: string;
  baseSalary?: number;
}

export default function EmployeeLoansTab({
  contractId,
  companyId,
  baseSalary = 0
}: EmployeeLoansTabProps) {
  const [loans, setLoans] = useState<EmployeeLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingLoan, setEditingLoan] = useState<EmployeeLoan | null>(null);

  // Form states
  const [bankName, setBankName] = useState(COMMON_BANKS[0]);
  const [customBank, setCustomBank] = useState("");
  const [contractNumber, setContractNumber] = useState("");
  const [installmentAmount, setInstallmentAmount] = useState<string>("");
  const [totalInstallments, setTotalInstallments] = useState<string>("24");
  const [currentInstallment, setCurrentInstallment] = useState<string>("1");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [provisionOnAdvance, setProvisionOnAdvance] = useState(true);
  const [advanceProvisionPercentage, setAdvanceProvisionPercentage] = useState<string>("40");
  const [status, setStatus] = useState<"ACTIVE" | "PAUSED" | "SETTLED" | "CANCELLED">("ACTIVE");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (contractId) {
      fetchLoans();
    } else {
      setLoading(false);
    }
  }, [contractId]);

  const fetchLoans = async () => {
    if (!contractId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("employee_loans")
        .select("*")
        .eq("contract_id", contractId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLoans(data || []);
    } catch (err: any) {
      console.error("Erro ao carregar empréstimos consignados:", err);
      toast.error("Erro ao carregar contratos de empréstimo consignado");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (loan?: EmployeeLoan) => {
    if (loan) {
      setEditingLoan(loan);
      if (COMMON_BANKS.includes(loan.bank_name)) {
        setBankName(loan.bank_name);
        setCustomBank("");
      } else {
        setBankName("Outro / Convênio FGTS Digital");
        setCustomBank(loan.bank_name);
      }
      setContractNumber(loan.contract_number || "");
      setInstallmentAmount(String(loan.installment_amount));
      setTotalInstallments(String(loan.total_installments));
      setCurrentInstallment(String(loan.current_installment));
      setStartDate(loan.start_date || new Date().toISOString().split("T")[0]);
      setProvisionOnAdvance(loan.provision_on_advance);
      setAdvanceProvisionPercentage(String(loan.advance_provision_percentage || 40));
      setStatus(loan.status);
      setNotes(loan.notes || "");
    } else {
      setEditingLoan(null);
      setBankName(COMMON_BANKS[0]);
      setCustomBank("");
      setContractNumber("");
      setInstallmentAmount("");
      setTotalInstallments("24");
      setCurrentInstallment("1");
      setStartDate(new Date().toISOString().split("T")[0]);
      setProvisionOnAdvance(true);
      setAdvanceProvisionPercentage("40");
      setStatus("ACTIVE");
      setNotes("");
    }
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractId) {
      toast.error("Contrato do funcionário não identificado");
      return;
    }

    const valorParcela = parseFloat(installmentAmount.replace(",", "."));
    if (isNaN(valorParcela) || valorParcela <= 0) {
      toast.error("Informe um valor válido para a parcela mensal");
      return;
    }

    const totParc = parseInt(totalInstallments);
    if (isNaN(totParc) || totParc <= 0) {
      toast.error("Informe a quantidade total de parcelas");
      return;
    }

    const currParc = parseInt(currentInstallment);
    if (isNaN(currParc) || currParc < 1 || currParc > totParc) {
      toast.error("Parcela atual inválida");
      return;
    }

    const pctProvisao = parseFloat(advanceProvisionPercentage.replace(",", "."));
    if (provisionOnAdvance && (isNaN(pctProvisao) || pctProvisao < 0 || pctProvisao > 100)) {
      toast.error("Percentual de provisão no vale deve ser entre 0% e 100%");
      return;
    }

    const finalBank = bankName === "Outro / Convênio FGTS Digital" && customBank.trim()
      ? customBank.trim()
      : bankName;

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: tenantData } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", userData.user?.id)
        .single();

      if (!tenantData) throw new Error("Tenant não identificado");

      let finalCompanyId = companyId;
      if (!finalCompanyId) {
        const { data: contractRow } = await supabase
          .from("employment_contracts")
          .select("company_id")
          .eq("id", contractId)
          .single();
        finalCompanyId = contractRow?.company_id;
      }

      if (!finalCompanyId) throw new Error("Empresa do contrato não identificada");

      const payload = {
        tenant_id: tenantData.tenant_id,
        company_id: finalCompanyId,
        contract_id: contractId,
        bank_name: finalBank,
        contract_number: contractNumber.trim() || null,
        installment_amount: valorParcela,
        total_installments: totParc,
        current_installment: currParc,
        start_date: startDate,
        provision_on_advance: provisionOnAdvance,
        advance_provision_percentage: provisionOnAdvance ? pctProvisao : 40,
        status: status,
        notes: notes.trim() || null,
        updated_at: new Date().toISOString()
      };

      if (editingLoan) {
        const { error } = await supabase
          .from("employee_loans")
          .update(payload)
          .eq("id", editingLoan.id);
        if (error) throw error;
        toast.success("Contrato de consignado atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("employee_loans")
          .insert(payload);
        if (error) throw error;
        toast.success("Contrato de empréstimo consignado cadastrado!");
      }

      setShowModal(false);
      fetchLoans();
    } catch (err: any) {
      console.error("Erro ao salvar consignado:", err);
      toast.error(`Falha ao salvar: ${err.message || "Erro desconhecido"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (loan: EmployeeLoan) => {
    const nextStatus = loan.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    const actionLabel = nextStatus === "ACTIVE" ? "reativar" : "pausar";

    const confirmed = await confirmDialog({
      title: `${nextStatus === "ACTIVE" ? "Reativar" : "Pausar"} Desconto de Consignado`,
      message: `Deseja realmente ${actionLabel} o desconto do empréstimo de ${loan.bank_name}?`,
      confirmLabel: nextStatus === "ACTIVE" ? "Reativar" : "Pausar",
      variant: nextStatus === "ACTIVE" ? "default" : "warning"
    });

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("employee_loans")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", loan.id);
      if (error) throw error;
      toast.success(`Contrato ${nextStatus === "ACTIVE" ? "reativado" : "pausado"} com sucesso!`);
      fetchLoans();
    } catch (err: any) {
      toast.error(`Erro ao atualizar status: ${err.message}`);
    }
  };

  const handleDelete = async (loan: EmployeeLoan) => {
    const confirmed = await confirmDialog({
      title: "Excluir Empréstimo Consignado",
      message: `Tem certeza que deseja excluir o contrato de consignado de ${loan.bank_name}? Esta ação removerá os provisionamentos automáticos das próximas folhas.`,
      confirmLabel: "Excluir",
      variant: "danger"
    });

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("employee_loans")
        .delete()
        .eq("id", loan.id);
      if (error) throw error;
      toast.success("Contrato de consignado excluído!");
      fetchLoans();
    } catch (err: any) {
      toast.error(`Erro ao excluir: ${err.message}`);
    }
  };

  // Cálculos de Margem Consignável (Lei 10.820/03 - 35% de margem padrão CLT)
  const margemConsignavelCLT = baseSalary > 0 ? baseSalary * 0.35 : 0;
  const totalComprometidoAtivo = loans
    .filter((l) => l.status === "ACTIVE")
    .reduce((acc, curr) => acc + Number(curr.installment_amount), 0);
  const margemRestante = Math.max(0, margemConsignavelCLT - totalComprometidoAtivo);
  const pctUsoMargem = margemConsignavelCLT > 0
    ? Math.min(100, (totalComprometidoAtivo / margemConsignavelCLT) * 100)
    : 0;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cards de Resumo e Margem Consignável */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Margem Consignável Total (35%) */}
        <div className="panel p-5 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-xl shadow-sm border border-slate-700/50 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
              <Landmark size={14} /> Margem Consignável (35%)
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
              CLT / FGTS Digital
            </span>
          </div>
          <div className="text-2xl font-bold font-display text-white mt-1">
            {formatCurrency ? formatCurrency(margemConsignavelCLT) : `R$ ${margemConsignavelCLT.toFixed(2)}`}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Base salarial atual: {formatCurrency ? formatCurrency(baseSalary) : `R$ ${baseSalary.toFixed(2)}`}
          </p>
        </div>

        {/* Card 2: Comprometimento Atual */}
        <div className="panel p-5 bg-white rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <TrendingDown size={14} className="text-amber-500" /> Total Descontado
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                pctUsoMargem > 90
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : pctUsoMargem > 70
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}
            >
              {pctUsoMargem.toFixed(0)}% Utilizado
            </span>
          </div>
          <div className="text-2xl font-bold font-display text-slate-900 mt-1">
            {formatCurrency ? formatCurrency(totalComprometidoAtivo) : `R$ ${totalComprometidoAtivo.toFixed(2)}`}
          </div>
          {/* Barra de Progresso de Margem */}
          <div className="w-full bg-slate-100 rounded-full h-2 mt-3 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                pctUsoMargem > 90
                  ? "bg-rose-500"
                  : pctUsoMargem > 70
                  ? "bg-amber-500"
                  : "bg-indigo-600"
              }`}
              style={{ width: `${pctUsoMargem}%` }}
            />
          </div>
        </div>

        {/* Card 3: Margem Livre */}
        <div className="panel p-5 bg-white rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-500" /> Margem Livre Restante
            </span>
          </div>
          <div className="text-2xl font-bold font-display text-emerald-600 mt-1">
            {formatCurrency ? formatCurrency(margemRestante) : `R$ ${margemRestante.toFixed(2)}`}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Disponível para novos convênios ou contratos
          </p>
        </div>
      </div>

      {/* Alerta Informativo do Mecanismo de Provisionamento no Vale */}
      <div className="p-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-200/80 rounded-xl flex items-start gap-3 text-slate-700 shadow-sm">
        <Sparkles size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed space-y-1">
          <p className="font-bold text-slate-900">
            Provisionamento Inteligente no Adiantamento (Vale) & Fechamento Mensal
          </p>
          <p className="text-slate-600">
            Ao ativar o <strong>Provisionamento no Vale</strong>, o motor retém automaticamente a fatia proporcional da parcela (ex: 40% na rubrica <em>807 - Provisão Consignado</em>) no adiantamento quinzenal para blindar o trabalhador contra saldo negativo. No fechamento da folha mensal, essa reserva é devolvida como crédito (rubrica <em>407 - Estorno Provisão</em>) e o valor integral da parcela é descontado oficialmente (rubrica <em>805 - Empréstimo Consignado</em>), fechando a contabilidade no centavo!
          </p>
        </div>
      </div>

      {/* Cabeçalho da Lista e Botão Novo */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
            <Landmark size={20} className="text-primary-600" />
            Contratos de Empréstimo Consignado
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerencie convênios de Crédito do Trabalhador, FGTS Digital e amortizações automáticas
          </p>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="btn-primary text-xs flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold shadow-sm"
        >
          <Plus size={16} /> Novo Empréstimo
        </button>
      </div>

      {/* Lista de Contratos */}
      {loans.length === 0 ? (
        <div className="panel bg-white p-12 text-center rounded-xl border border-slate-200 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <Landmark size={24} />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            Nenhum empréstimo consignado ativo
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Este colaborador não possui descontos de consignado vinculados. Clique no botão acima para adicionar um novo contrato.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loans.map((loan) => {
            const pctProgresso = Math.min(
              100,
              (loan.current_installment / loan.total_installments) * 100
            );
            const provisaoValeValor = loan.provision_on_advance
              ? (Number(loan.installment_amount) * (loan.advance_provision_percentage / 100))
              : 0;

            return (
              <div
                key={loan.id}
                className={`panel p-5 bg-white rounded-xl border transition-all shadow-sm relative ${
                  loan.status === "ACTIVE"
                    ? "border-slate-200 hover:border-primary-300"
                    : "border-slate-200 bg-slate-50/60 opacity-80"
                }`}
              >
                {/* Cabeçalho do Card */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Instituição Consignatária
                    </span>
                    <h3 className="text-base font-bold text-slate-900 font-display">
                      {loan.bank_name}
                    </h3>
                    {loan.contract_number && (
                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        Contrato: {loan.contract_number}
                      </p>
                    )}
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border tracking-wider uppercase ${
                      loan.status === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : loan.status === "PAUSED"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : loan.status === "SETTLED"
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-slate-100 text-slate-600 border-slate-300"
                    }`}
                  >
                    {loan.status === "ACTIVE"
                      ? "Ativo"
                      : loan.status === "PAUSED"
                      ? "Pausado"
                      : loan.status === "SETTLED"
                      ? "Quitado"
                      : "Cancelado"}
                  </span>
                </div>

                {/* Métricas do Contrato */}
                <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-100 mb-3">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Parcela Mensal (cód 805)
                    </span>
                    <p className="text-base font-bold text-slate-900 font-display">
                      {formatCurrency ? formatCurrency(loan.installment_amount) : `R$ ${loan.installment_amount.toFixed(2)}`}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Provisão no Vale (cód 807)
                    </span>
                    <p className="text-xs font-semibold text-indigo-700 mt-1 flex items-center gap-1">
                      {loan.provision_on_advance ? (
                        <>
                          <CheckCircle2 size={13} className="text-emerald-500" />
                          {loan.advance_provision_percentage}% (
                          {formatCurrency ? formatCurrency(provisaoValeValor) : `R$ ${provisaoValeValor.toFixed(2)}`})
                        </>
                      ) : (
                        <span className="text-slate-400 font-normal">Desativado</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Progresso das Parcelas */}
                <div className="mb-4">
                  <div className="flex justify-between items-center text-xs text-slate-600 mb-1.5">
                    <span className="font-semibold">
                      Parcela {loan.current_installment} de {loan.total_installments}
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      {pctProgresso.toFixed(0)}% pago
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-2 rounded-full bg-primary-600 transition-all duration-500"
                      style={{ width: `${pctProgresso}%` }}
                    />
                  </div>
                </div>

                {/* Notas / Detalhes */}
                {loan.notes && (
                  <p className="text-xs text-slate-500 italic mb-4 line-clamp-2 bg-slate-50 p-2 rounded border border-slate-100">
                    "{loan.notes}"
                  </p>
                )}

                {/* Ações */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => handleToggleStatus(loan)}
                    title={loan.status === "ACTIVE" ? "Pausar desconto" : "Reativar desconto"}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    {loan.status === "ACTIVE" ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                  </button>

                  <button
                    onClick={() => handleOpenModal(loan)}
                    title="Editar contrato"
                    className="p-1.5 text-slate-500 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>

                  <button
                    onClick={() => handleDelete(loan)}
                    title="Excluir contrato"
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Criação / Edição de Empréstimo */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 border border-slate-200 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
                  <Landmark size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-display">
                    {editingLoan ? "Editar Empréstimo Consignado" : "Novo Empréstimo Consignado"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Defina as condições financeiras e de amortização em folha
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Banco / Instituição */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Instituição Consignatária / Banco *
                </label>
                <select
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="input-field text-sm w-full font-medium"
                >
                  {COMMON_BANKS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              {bankName === "Outro / Convênio FGTS Digital" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nome da Instituição / Correspondente Bancário *
                  </label>
                  <input
                    type="text"
                    required
                    value={customBank}
                    onChange={(e) => setCustomBank(e.target.value)}
                    placeholder="Ex: Facta Financeira, Banco Mercantil, etc."
                    className="input-field text-sm w-full"
                  />
                </div>
              )}

              {/* Número do Contrato e Data de Início */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Número do Contrato / Proposta
                  </label>
                  <input
                    type="text"
                    value={contractNumber}
                    onChange={(e) => setContractNumber(e.target.value)}
                    placeholder="Ex: 2026.00948.X"
                    className="input-field text-sm w-full font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Data da 1ª Parcela / Início *
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input-field text-sm w-full"
                  />
                </div>
              </div>

              {/* Valor da Parcela e Total de Parcelas */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Valor da Parcela (R$) *
                  </label>
                  <input
                    type="text"
                    required
                    value={installmentAmount}
                    onChange={(e) => setInstallmentAmount(e.target.value)}
                    placeholder="Ex: 450.00"
                    className="input-field text-sm w-full font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Total Parcelas *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={totalInstallments}
                    onChange={(e) => setTotalInstallments(e.target.value)}
                    className="input-field text-sm w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Parcela Atual *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={currentInstallment}
                    onChange={(e) => setCurrentInstallment(e.target.value)}
                    className="input-field text-sm w-full"
                  />
                </div>
              </div>

              {/* Seção de Provisionamento no Vale */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="chk-provisao"
                      checked={provisionOnAdvance}
                      onChange={(e) => setProvisionOnAdvance(e.target.checked)}
                      className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500 cursor-pointer"
                    />
                    <label htmlFor="chk-provisao" className="text-xs font-bold text-slate-800 cursor-pointer">
                      Provisionar Parcela no Adiantamento (Vale)
                    </label>
                  </div>

                  {provisionOnAdvance && (
                    <span className="text-[10px] font-bold text-primary-700 bg-primary-100/60 px-2 py-0.5 rounded">
                      Recomendado CLT
                    </span>
                  )}
                </div>

                {provisionOnAdvance && (
                  <div className="flex items-center gap-3 pt-2 border-t border-slate-200/60">
                    <label className="text-xs text-slate-600 font-medium shrink-0">
                      Provisão no Vale (% da parcela):
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={advanceProvisionPercentage}
                      onChange={(e) => setAdvanceProvisionPercentage(e.target.value)}
                      className="input-field text-xs w-20 py-1 px-2 font-bold text-center"
                    />
                    <span className="text-xs text-slate-500">
                      (Padrão: 40% da parcela = retenção temporária na rubrica 807)
                    </span>
                  </div>
                )}
              </div>

              {/* Status e Observações */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Status do Contrato
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="input-field text-sm w-full font-medium"
                  >
                    <option value="ACTIVE">Ativo (Processando Desconto)</option>
                    <option value="PAUSED">Pausado (Suspender Temporariamente)</option>
                    <option value="SETTLED">Quitado (Amortização Concluída)</option>
                    <option value="CANCELLED">Cancelado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Observações Internas (Opcional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ex: Portabilidade ou solicitação judicial"
                    className="input-field text-sm w-full"
                  />
                </div>
              </div>

              {/* Ações do Modal */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-ghost text-xs px-4 py-2 rounded-lg font-bold"
                  disabled={saving}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary text-xs px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm"
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Salvando...
                    </>
                  ) : (
                    <>Salvar Contrato</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
