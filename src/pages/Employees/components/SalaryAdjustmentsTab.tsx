import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase";
import { Plus, X, Loader2, Save } from "lucide-react";
import { createPortal } from "react-dom";
import { toast } from 'sonner';

export default function SalaryAdjustmentsTab({ contractId, onSaved }: { contractId?: string | null, onSaved?: () => void }) {
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newSalary, setNewSalary] = useState<number | "">("");
  const [percentage, setPercentage] = useState<number | "">("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [reason, setReason] = useState("");
  const [currentSalary, setCurrentSalary] = useState(0);

  useEffect(() => {
    if (contractId) {
      fetchAdjustments();
      fetchCurrentSalary();
    } else {
      setLoading(false);
    }
  }, [contractId]);

  const fetchAdjustments = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("salary_adjustments")
      .select("*")
      .eq("contract_id", contractId)
      .order("created_at", { ascending: false });
    
    setAdjustments(data || []);
    setLoading(false);
  };

  const fetchCurrentSalary = async () => {
    const { data } = await supabase
      .from("employment_contracts")
      .select("base_salary")
      .eq("id", contractId)
      .single();
    if (data) setCurrentSalary(data.base_salary);
  };

  const handlePercentageChange = (val: string) => {
    const perc = parseFloat(val);
    if (!isNaN(perc)) {
      setPercentage(perc);
      setNewSalary(currentSalary + (currentSalary * (perc / 100)));
    } else {
      setPercentage("");
      setNewSalary("");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractId || !newSalary || !effectiveDate) return;
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: tenantData } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", userData.user?.id)
        .single();

      if (tenantData) {
        // Create the adjustment record
        const { error: insertError } = await supabase.from("salary_adjustments").insert({
          tenant_id: tenantData.tenant_id,
          contract_id: contractId,
          old_salary: currentSalary,
          new_salary: newSalary,
          percentage: percentage || null,
          effective_date: effectiveDate,
          reason,
        });

        if (insertError) throw insertError;

          // Update the contract's base salary
          const { data: contractData, error: updateError } = await supabase
            .from("employment_contracts")
            .update({ base_salary: newSalary })
            .eq("id", contractId)
            .select("company_id")
            .single();

          if (updateError) throw updateError;
          const companyId = contractData?.company_id;

          // Check if effective_date is in the past and we need to generate COMPLEMENTARY payrolls
          // We do this by calling a custom logic or directly here
          const currentDate = new Date();
          const effective = new Date(effectiveDate);
          if (companyId && (effective.getFullYear() < currentDate.getFullYear() || 
             (effective.getFullYear() === currentDate.getFullYear() && effective.getMonth() < currentDate.getMonth()))) {
            
            // Generate complementary periods for each closed month since effective_date
            // 1. Fetch closed periods
            const { data: periods } = await supabase
              .from("payroll_periods")
              .select("id, month, year, type")
              .eq("tenant_id", tenantData.tenant_id)
              .eq("company_id", companyId)
              .eq("status", "CLOSED");

            if (periods) {
               for (const p of periods) {
                 const pDate = new Date(p.year, p.month - 1, 1);
                 if (pDate >= effective && p.type === 'MONTHLY') {
                   // Insert complementary period
                   await supabase.from("payroll_periods").upsert({
                      tenant_id: tenantData.tenant_id,
                      company_id: companyId,
                      month: p.month,
                      year: p.year,
                      type: "COMPLEMENTARY",
                      parent_period_id: p.id,
                      complement_reason: reason || "Reajuste Salarial Retroativo",
                   }, { onConflict: 'tenant_id, company_id, month, year, type', ignoreDuplicates: true });
                 }
               }
            }
          toast.error("Reajuste aplicado! Folhas complementares foram geradas para os meses fechados.");
        } else {
          toast.error("Reajuste aplicado com sucesso!");
        }

        setIsModalOpen(false);
        fetchAdjustments();
        fetchCurrentSalary();
        if (onSaved) onSaved();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao salvar reajuste: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-slate-500 p-4">Carregando...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-900 font-display">Histórico de Reajustes</h3>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} />
          Novo Reajuste (Dissídio)
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-6 py-3 font-semibold">Data Efetiva</th>
              <th className="px-6 py-3 font-semibold">Salário Anterior</th>
              <th className="px-6 py-3 font-semibold">Novo Salário</th>
              <th className="px-6 py-3 font-semibold">% Reajuste</th>
              <th className="px-6 py-3 font-semibold">Motivo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {adjustments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                  Nenhum reajuste registrado.
                </td>
              </tr>
            ) : (
              adjustments.map((adj) => (
                <tr key={adj.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    {new Date(adj.effective_date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                  </td>
                  <td className="px-6 py-4 text-slate-500">R$ {adj.old_salary.toFixed(2)}</td>
                  <td className="px-6 py-4 font-bold text-emerald-600">R$ {adj.new_salary.toFixed(2)}</td>
                  <td className="px-6 py-4 text-slate-600">{adj.percentage ? `${adj.percentage}%` : '-'}</td>
                  <td className="px-6 py-4 text-slate-500">{adj.reason || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 animate-in fade-in backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="text-lg font-bold text-slate-900 font-display">Aplicar Reajuste</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="flex flex-col">
              <div className="p-6 space-y-4">
                <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex items-start gap-2">
                  <div className="text-blue-700 text-sm">
                    <strong>Salário Atual:</strong> R$ {currentSalary.toFixed(2)}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                    Porcentagem (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input w-full"
                    placeholder="Ex: 5"
                    value={percentage}
                    onChange={(e) => handlePercentageChange(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                    Novo Salário (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="input w-full"
                    value={newSalary}
                    onChange={(e) => {
                       setNewSalary(e.target.value === "" ? "" : parseFloat(e.target.value));
                       setPercentage("");
                    }}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                    Data Efetiva (A partir de quando)
                  </label>
                  <input
                    type="date"
                    required
                    className="input w-full"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Se a data for retroativa a folhas fechadas, <strong>folhas complementares</strong> serão geradas automaticamente.
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                    Motivo (Ex: Acordo Coletivo 2026)
                  </label>
                  <input
                    type="text"
                    className="input w-full"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex justify-end gap-3 rounded-b-xl">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  {saving ? "Salvando..." : "Confirmar Reajuste"}
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
