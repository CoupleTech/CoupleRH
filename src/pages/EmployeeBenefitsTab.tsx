import { useState, useEffect } from "react";
import {
  Loader2,
  Plus,
  Bus,
  Utensils,
  HeartPulse,
  Gift,
  ShieldAlert,
  Check,
  X,
  Trash2,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { toast } from 'sonner';
import { confirmDialog } from '../components/ConfirmDialogProvider';

interface Benefit {
  id: string;
  name: string;
  benefit_type: string;
  employee_discount_percentage: number | null;
  employee_discount_fixed: number | null;
  provider_name: string;
}

interface EmployeeBenefit {
  id: string;
  benefit_id: string;
  custom_discount_value: number | null;
  card_number: string | null;
  dependent_count: number;
  status: string;
  benefit_catalogs: Benefit;
}

export default function ({
  contractId,
}: {
  contractId: string;
}) {
  const [employeeBenefits, setEmployeeBenefits] = useState<EmployeeBenefit[]>(
    [],
  );
  const [catalog, setCatalog] = useState<Benefit[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [selectedBenefitId, setSelectedBenefitId] = useState("");
  const [customDiscount, setCustomDiscount] = useState<number | "">("");
  const [cardNumber, setCardNumber] = useState("");
  const [dependentCount, setDependentCount] = useState(0);

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

      if (!tenantData) throw new Error("Tenant não encontrado");

      // Buscar benefícios vinculados
      const { data: empBenData, error: empError } = await supabase
        .from("employee_benefits")
        .select(
          `
          id, benefit_id, custom_discount_value, card_number, dependent_count, status,
          benefits_catalog (*)
        `,
        )
        .eq("contract_id", contractId)
        .eq("status", "ACTIVE");

      if (!empError && empBenData) {
        setEmployeeBenefits(empBenData as any);
      }

      // Buscar catálogo da empresa
      const { data: catData, error: catError } = await supabase
        .from("benefits_catalog")
        .select("*")
        .eq("tenant_id", tenantData.tenant_id);

      if (!catError && catData) {
        setCatalog(catData as Benefit[]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openModal = async () => {
    setSelectedBenefitId("");
    setCustomDiscount("");
    setCardNumber("");
    setDependentCount(0);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBenefitId) return toast.error("Selecione um benefício do catálogo");

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
        benefit_id: selectedBenefitId,
        custom_discount_value:
          customDiscount === "" ? null : Number(customDiscount),
        card_number: cardNumber || null,
        dependent_count: dependentCount,
        status: "ACTIVE",
      };

      const { error } = await supabase
        .from("employee_benefits")
        .insert(payload);
      if (error) {
        if (error.code === "23505") {
          // unique violation
          toast.error("O colaborador já possui este benefício cadastrado.");
        } else {
          throw error;
        }
      } else {
        setIsModalOpen(false);
        fetchData();
      }
    } catch (e: any) {
      console.error(e);
      toast.error(`Erro ao vincular benefício: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (
      !await confirmDialog("Tem certeza que deseja remover este benefício do colaborador?")
    )
      return;
    try {
      // Deleta ou desativa? Vamos deletar no MVP pra facilitar a recriação, ou inativar.
      await supabase.from("employee_benefits").delete().eq("id", id);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const getBenefitIcon = async (type: string) => {
    switch (type) {
      case "VT":
        return <Bus size={18} className="text-emerald-500" />;
      case "VR":
      case "VA":
        return <Utensils size={18} className="text-amber-500" />;
      case "HEALTH":
      case "DENTAL":
        return <HeartPulse size={18} className="text-rose-500" />;
      default:
        return <Gift size={18} className="text-primary-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  // Filtrar catálogo para não mostrar os que ele já tem
  const availableCatalog = catalog.filter(
    (c) => !employeeBenefits.find((eb) => eb.benefit_id === c.id),
  );

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-display">
            Benefícios Ativos
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie os benefícios vinculados a este colaborador.
          </p>
        </div>
        <button onClick={openModal} className="btn-primary">
          <Plus size={18} />
          <span>Vincular Benefício</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {employeeBenefits.length === 0 ? (
          <div className="col-span-full panel bg-white p-12 rounded-lg border border-slate-200 text-center flex flex-col items-center">
            <Gift className="w-12 h-12 text-slate-300 mb-4" />
            <h3 className="text-slate-500 font-bold mb-2">
              Nenhum benefício vinculado
            </h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">
              Este colaborador ainda não possui benefícios ativos da empresa.
              Clique no botão acima para adicionar.
            </p>
          </div>
        ) : (
          employeeBenefits.map((eb) => {
            const b = eb.benefits_catalog;
            const hasCustom = eb.custom_discount_value !== null;
            const finalDiscountValue = hasCustom ? eb.custom_discount_value : (b.default_discount_value || 0);
            const discountLabel = hasCustom 
                ? `R$ ${finalDiscountValue?.toFixed(2)}` 
                : b.discount_type === 'PERCENTAGE' 
                  ? `${finalDiscountValue}%` 
                  : b.discount_type === 'FIXED_VALUE' 
                    ? `R$ ${finalDiscountValue?.toFixed(2)}` 
                    : "Isento";

            return (
              <div
                key={eb.id}
                className="panel bg-white rounded-lg border border-slate-200 shadow-sm relative group overflow-hidden"
              >
                {/* Linha superior colorida */}
                <div
                  className={`h-1 w-full ${b.benefit_type === "VT" ? "bg-emerald-500" : b.benefit_type === "HEALTH" || b.benefit_type === "DENTAL" ? "bg-rose-500" : "bg-primary-500"}`}
                ></div>

                <div className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200">
                        {getBenefitIcon(b.benefit_type)}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 leading-tight">
                          {b.name}
                        </h3>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500">
                          {b.provider_name || "Sem bandeira"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={async () => handleRemove(eb.id)}
                      className="text-slate-300 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100 p-1"
                      title="Remover Benefício"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 font-medium">
                        Desconto em Folha:
                      </span>
                      <span className="font-bold text-slate-800">
                        {discountLabel}
                      </span>
                    </div>

                    {eb.card_number && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500 font-medium">
                          Nº Cartão:
                        </span>
                        <span className="font-bold text-slate-800">
                          {eb.card_number}
                        </span>
                      </div>
                    )}

                    {(b.benefit_type === "HEALTH" ||
                      b.benefit_type === "DENTAL") &&
                      eb.dependent_count > 0 && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-slate-500 font-medium">
                            Dependentes Inclusos:
                          </span>
                          <span className="font-bold text-slate-800">
                            {eb.dependent_count}
                          </span>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Vincular */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
                <Gift size={20} className="text-primary-600" />
                Vincular Benefício
              </h3>
              <button
                onClick={async () => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                    Catálogo da Empresa
                  </label>
                  {availableCatalog.length === 0 ? (
                    <div className="p-3 bg-amber-50 text-amber-800 text-sm border border-amber-200 rounded-lg flex items-start gap-2">
                      <ShieldAlert size={16} className="mt-0.5 shrink-0" />
                      <p>
                        O colaborador já possui todos os benefícios do catálogo
                        ou não há benefícios cadastrados na empresa.
                      </p>
                    </div>
                  ) : (
                    <select
                      required
                      value={selectedBenefitId}
                      onChange={(e) => setSelectedBenefitId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="">Selecione um benefício...</option>
                      {availableCatalog.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.provider_name})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {selectedBenefitId && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                          Nº do Cartão / Matrícula (Opcional)
                        </label>
                        <input
                          type="text"
                          placeholder="Deixe em branco se ainda não tiver"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      </div>

                      {/* Opcional: Só mostra dependentes se for Saúde/Odonto, mas pra simplificar o MVP pode deixar p/ todos e só usar se quiser */}
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                          Dependentes Incluídos
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={dependentCount}
                          onChange={(e) =>
                            setDependentCount(Number(e.target.value))
                          }
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                          Desconto Customizado
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Usar padrão"
                          value={customDiscount}
                          onChange={(e) =>
                            setCustomDiscount(
                              e.target.value ? Number(e.target.value) : "",
                            )
                          }
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                          Vazio = Usa regra da empresa
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="submit"
                  disabled={saving || !selectedBenefitId}
                  className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  Vincular
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
