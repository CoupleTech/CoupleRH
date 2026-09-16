import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Loader2,
  Plus,
  Receipt,
  Scale,
  CreditCard,
  Briefcase,
  FileText,
  Check,
  X,
  Trash2,
  Edit,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { formatDate } from "../lib/dateUtils";

interface Rubric {
  id: string;
  code: string;
  name: string;
}

interface Deduction {
  id: string;
  contract_id: string;
  rubric_id: string;
  deduction_type: string;
  amount_type: string;
  value: number;
  total_limit: number | null;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  deduct_on_advance: boolean;
  payroll_rubrics: Rubric;
}

export default function EmployeeDeductionsTab({
  contractId,
}: {
  contractId: string;
}) {
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [type, setType] = useState("LOAN");
  const [amountType, setAmountType] = useState("FIXED");
  const [value, setValue] = useState("");
  const [totalLimit, setTotalLimit] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedRubric, setSelectedRubric] = useState("");
  const [deductOnAdvance, setDeductOnAdvance] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [contractId]);

  const fetchData = async () => {
    if (!contractId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: tenantData } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", userData.user?.id)
        .single();

      if (!tenantData) return;

      // Buscar Descontos Ativos
      const { data: deducData, error: deducError } = await supabase
        .from("employee_deductions")
        .select(`
          *,
          payroll_rubrics (id, code, name)
        `)
        .eq("contract_id", contractId)
        .eq("is_active", true)
        .order("start_date", { ascending: false });

      if (!deducError && deducData) {
        setDeductions(deducData as any);
      }

      // Buscar Rubricas do tipo DEDUCTION
      const { data: rubricsData } = await supabase
        .from("payroll_rubrics")
        .select("id, code, name")
        .eq("tenant_id", tenantData.tenant_id)
        .eq("type", "DEDUCTION")
        .eq("is_active", true)
        .order("code", { ascending: true });

      if (rubricsData) setRubrics(rubricsData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openModal = () => {
    setEditingId(null);
    setType("LOAN");
    setAmountType("FIXED");
    setValue("");
    setTotalLimit("");
    setStartDate(new Date().toISOString().split("T")[0]);
    setEndDate("");
    setNotes("");
    setSelectedRubric("");
    setDeductOnAdvance(false);
    setIsModalOpen(true);
  };

  const openEditModal = (d: Deduction) => {
    setEditingId(d.id);
    setType(d.deduction_type);
    setAmountType(d.amount_type);
    setValue(String(d.value));
    setTotalLimit(d.total_limit ? String(d.total_limit) : "");
    setStartDate(d.start_date);
    setEndDate(d.end_date || "");
    setNotes(d.notes || "");
    setSelectedRubric(d.rubric_id);
    setDeductOnAdvance(d.deduct_on_advance);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: tenantData } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", userData.user?.id)
        .single();

      const payload = {
        tenant_id: tenantData?.tenant_id,
        contract_id: contractId,
        rubric_id: selectedRubric,
        deduction_type: type,
        amount_type: amountType,
        value: Number(value),
        total_limit: totalLimit ? Number(totalLimit) : null,
        start_date: startDate,
        end_date: endDate || null,
        notes: notes || null,
        deduct_on_advance: deductOnAdvance,
        is_active: true,
      };

      if (editingId) {
        const { error } = await supabase.from("employee_deductions").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("employee_deductions").insert(payload);
        if (error) throw error;
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      console.error("Erro ao salvar o desconto:", err);
      alert("Erro ao salvar o desconto: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm("Tem certeza que deseja inativar/remover este desconto?")) return;
    try {
      // Marcamos como inativo em vez de deletar para manter histórico
      await supabase.from("employee_deductions").update({ is_active: false }).eq("id", id);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const getTypeIcon = (t: string) => {
    switch (t) {
      case "ALIMONY":
        return <Scale size={18} className="text-violet-500" />;
      case "LOAN":
        return <CreditCard size={18} className="text-blue-500" />;
      case "ADVANCE":
        return <Briefcase size={18} className="text-amber-500" />;
      case "COPARTICIPATION":
        return <Receipt size={18} className="text-rose-500" />;
      default:
        return <FileText size={18} className="text-slate-500" />;
    }
  };

  const getTypeLabel = (t: string) => {
    switch (t) {
      case "ALIMONY":
        return "Pensão Alimentícia";
      case "LOAN":
        return "Empréstimo Consignado";
      case "ADVANCE":
        return "Adiantamento Salarial";
      case "COPARTICIPATION":
        return "Coparticipação";
      default:
        return "Outros Descontos";
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-display">
            Descontos e Retenções
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie pensões, empréstimos e outros descontos customizados do colaborador.
          </p>
        </div>
        <button onClick={openModal} className="btn-primary">
          <Plus size={18} />
          <span>Novo Desconto</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {deductions.length === 0 ? (
          <div className="col-span-full panel bg-white p-12 rounded-lg border border-slate-200 text-center flex flex-col items-center">
            <Receipt className="w-12 h-12 text-slate-300 mb-4" />
            <h3 className="text-slate-500 font-bold mb-2">
              Nenhum desconto ativo
            </h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">
              O colaborador não possui descontos ou retenções lançadas no histórico.
            </p>
          </div>
        ) : (
          deductions.map((d) => (
            <div
              key={d.id}
              className="panel bg-white rounded-lg border border-slate-200 shadow-sm relative group overflow-hidden"
            >
              <div className={`h-1 w-full bg-slate-300`}></div>

              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200">
                      {getTypeIcon(d.deduction_type)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 leading-tight flex items-center flex-wrap">
                        {getTypeLabel(d.deduction_type)}
                        {d.deduct_on_advance && (
                          <span className="text-[9px] uppercase tracking-widest font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded ml-2">
                            No Vale
                          </span>
                        )}
                      </h3>
                      <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mt-0.5">
                        Rubrica: [{d.payroll_rubrics?.code}] {d.payroll_rubrics?.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEditModal(d)}
                      className="text-slate-300 hover:text-blue-600 transition-colors p-1"
                      title="Editar Desconto"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleRemove(d.id)}
                      className="text-slate-300 hover:text-rose-600 transition-colors p-1"
                      title="Remover Desconto"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Valor a debitar:</span>
                    <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100">
                      {d.amount_type === "PERCENTAGE"
                        ? `${d.value}%`
                        : `R$ ${d.value.toFixed(2)}`}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Vigência:</span>
                    <span className="font-bold text-slate-800">
                      {formatDate(d.start_date)} {d.end_date ? `a ${formatDate(d.end_date)}` : "(Sem limite)"}
                    </span>
                  </div>

                  {d.total_limit && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-medium">Teto do Empréstimo:</span>
                      <span className="font-bold text-slate-800">
                        R$ {d.total_limit.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {d.notes && (
                    <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 mt-2">
                      {d.notes}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 animate-in fade-in backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
                <Receipt size={20} className="text-primary-600" />
                Novo Desconto / Retenção
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                      Tipo de Desconto
                    </label>
                    <select
                      required
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="LOAN">Empréstimo Consignado</option>
                      <option value="ALIMONY">Pensão Alimentícia</option>
                      <option value="ADVANCE">Adiantamento Salarial</option>
                      <option value="COPARTICIPATION">Coparticipação Diversa</option>
                      <option value="OTHER">Outros</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                      Rubrica vinculada
                    </label>
                    <select
                      required
                      value={selectedRubric}
                      onChange={(e) => setSelectedRubric(e.target.value)}
                      className="w-full px-3 py-2 border border-amber-300 rounded-lg bg-amber-50 focus:bg-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="">-- Selecione --</option>
                      {rubrics.map((r) => (
                        <option key={r.id} value={r.id}>
                          [{r.code}] {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                      Regra do Valor
                    </label>
                    <select
                      required
                      value={amountType}
                      onChange={(e) => setAmountType(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="FIXED">Valor Fixo Mensal (R$)</option>
                      <option value="PERCENTAGE">Percentual (%) da Base</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                      Valor ({amountType === "FIXED" ? "R$" : "%"})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder="Ex: 50.00"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                </div>

                {type === "LOAN" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                        Limite Total / Valor do Empréstimo (R$ - Opcional)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={totalLimit}
                        onChange={(e) => setTotalLimit(e.target.value)}
                        placeholder="Ex: 2000.00"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">
                        O sistema parará de descontar quando a soma dos descontos atingir este limite.
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                      Data Início
                    </label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                      Data Fim (Opcional)
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                    Processo Judicial ou Observações (Opcional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="Ex: Nº do Processo: 0000.00..."
                  ></textarea>
                </div>

                <div className="flex items-center gap-3 bg-amber-50 p-3 rounded-lg border border-amber-200 mt-4">
                  <input
                    type="checkbox"
                    id="deductOnAdvance"
                    checked={deductOnAdvance}
                    onChange={(e) => setDeductOnAdvance(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500"
                  />
                  <label htmlFor="deductOnAdvance" className="text-xs font-bold text-amber-800 cursor-pointer">
                    Descontar no Adiantamento (Vale) em vez do Mensal
                  </label>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 rounded-b-lg">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !selectedRubric || !value || !startDate}
                  className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  Salvar Desconto
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
