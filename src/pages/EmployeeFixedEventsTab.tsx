import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Loader2,
  Plus,
  TrendingUp,
  Briefcase,
  Check,
  X,
  Trash2,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { formatDate } from "../lib/dateUtils";
import { toast } from 'sonner';
import { confirmDialog } from '../components/ConfirmDialogProvider';

interface Rubric {
  id: string;
  code: string;
  name: string;
  calculation_form: string;
}

interface FixedEvent {
  id: string;
  contract_id: string;
  rubric_id: string;
  value: number | null;
  quantity: number | null;
  start_date: string;
  end_date: string | null;
  notes: string | null;
  payroll_rubrics: Rubric;
}

export default function ({
  contractId,
}: {
  contractId: string;
}) {
  const [events, setEvents] = useState<FixedEvent[]>([]);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [value, setValue] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedRubric, setSelectedRubric] = useState("");

  const selectedRubricObj = rubrics.find(r => r.id === selectedRubric);

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

      // Buscar Eventos Fixos Ativos
      const { data: eventsData, error: eventsError } = await supabase
        .from("employee_fixed_events")
        .select(`
          *,
          payroll_rubrics (id, code, name, calculation_form)
        `)
        .eq("contract_id", contractId)
        .eq("is_active", true)
        .order("start_date", { ascending: false });

      if (!eventsError && eventsData) {
        setEvents(eventsData as any);
      }

      // Buscar Rubricas do tipo EARNING (que não sejam VARIÁVEIS que dependem de ponto)
      const { data: rubricsData } = await supabase
        .from("payroll_rubrics")
        .select("id, code, name, calculation_form")
        .eq("tenant_id", tenantData.tenant_id)
        .eq("type", "EARNING")
        .eq("is_active", true)
        .not("category", "eq", "OVERTIME") // Exclui Horas Extras e Noturno
        .order("code", { ascending: true });

      if (rubricsData) setRubrics(rubricsData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openModal = async () => {
    setValue("");
    setQuantity("1");
    setStartDate(new Date().toISOString().split("T")[0]);
    setEndDate("");
    setNotes("");
    setSelectedRubric("");
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
        value: value ? Number(value) : null,
        quantity: quantity ? Number(quantity) : 1,
        start_date: startDate,
        end_date: endDate || null,
        notes: notes || null,
        is_active: true,
      };

      const { error } = await supabase.from("employee_fixed_events").insert(payload);
      if (error) throw error;

      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      console.error("Erro ao salvar o adicional fixo:", err);
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (!await confirmDialog("Tem certeza que deseja inativar/remover este adicional permanente?")) return;
    try {
      await supabase.from("employee_fixed_events").update({ is_active: false }).eq("id", id);
      fetchData();
    } catch (e) {
      console.error(e);
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
            Adicionais e Proventos Fixos
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Vincule benefícios pecuniários permanentes ao contrato (ex: Insalubridade, Anuênio).
          </p>
        </div>
        <button onClick={openModal} className="btn-primary">
          <Plus size={18} />
          <span>Novo Adicional Fixo</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.length === 0 ? (
          <div className="col-span-full panel bg-white p-12 rounded-lg border border-slate-200 text-center flex flex-col items-center">
            <TrendingUp className="w-12 h-12 text-slate-300 mb-4" />
            <h3 className="text-slate-500 font-bold mb-2">
              Nenhum provento fixo vinculado
            </h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">
              O colaborador não possui insalubridade, periculosidade ou outros adicionais permanentes.
            </p>
          </div>
        ) : (
          events.map((ev) => (
            <div
              key={ev.id}
              className="panel bg-white rounded-lg border border-slate-200 shadow-sm relative group overflow-hidden"
            >
              <div className={`h-1 w-full bg-emerald-500`}></div>

              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center border border-emerald-200">
                      <Briefcase size={18} className="text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 leading-tight">
                        {ev.payroll_rubrics?.name}
                      </h3>
                      <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mt-0.5">
                        Rubrica: {ev.payroll_rubrics?.code}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={async () => handleRemove(ev.id)}
                    className="text-slate-300 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100 p-1"
                    title="Remover Adicional"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Quantidade base:</span>
                    <span className="font-bold text-slate-700">
                      {ev.quantity}
                    </span>
                  </div>

                  {ev.value !== null && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-medium">Valor Mensal:</span>
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                        R$ {ev.value.toFixed(2)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Vigência:</span>
                    <span className="font-bold text-slate-800">
                      {formatDate(ev.start_date)} {ev.end_date ? `a ${formatDate(ev.end_date)}` : "(Permanente)"}
                    </span>
                  </div>

                  {ev.notes && (
                    <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 mt-2">
                      {ev.notes}
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
                <TrendingUp size={20} className="text-primary-600" />
                Vincular Adicional Fixo
              </h3>
              <button
                onClick={async () => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                    Selecione a Rubrica
                  </label>
                  <select
                    required
                    value={selectedRubric}
                    onChange={(e) => setSelectedRubric(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="">-- Escolha um Adicional --</option>
                    {rubrics.map((r) => (
                      <option key={r.id} value={r.id}>
                        [{r.code}] {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedRubricObj?.calculation_form === 'MANUAL' && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                      Valor Fixo Mensal (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder="Ex: 500.00"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                )}

                {(selectedRubricObj?.calculation_form === 'PERCENTUAL' || selectedRubricObj?.calculation_form === 'PERCENTAGE_OF_BASE') && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                      Quantidade Base (Referência)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Para Insalubridade/Periculosidade, normalmente é 1. O motor calculará o percentual da base automaticamente.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                      A partir de
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
                      Até (Opcional)
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
                    Justificativa / Parecer (Opcional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="Ex: Laudo Técnico Nº 1234/2026"
                  ></textarea>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 rounded-b-lg">
                <button
                  type="button"
                  onClick={async () => setIsModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !selectedRubric || !startDate}
                  className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  Vincular Adicional
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
