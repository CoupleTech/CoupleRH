import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  Plus,
  Check,
  Loader2,
  Landmark,
  HeartPulse,
  Bus,
  Utensils,
  Gift,
  Pencil,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Pagination } from "../../components/Pagination";
import { toast } from 'sonner';

interface Benefit {
  id: string;
  name: string;
  benefit_type: string;
  employee_discount_percentage: number | null;
  employee_discount_fixed: number | null;
  provider_name: string;
  rubric_id?: string;
}

export default async function BenefitsList() {
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [benefitType, setBenefitType] = useState("TRANSPORTATION");
  const [providerName, setProviderName] = useState("");
  const [discountType, setDiscountType] = useState("NONE");
  const [defaultDiscount, setDefaultDiscount] = useState(0);

  const [rubrics, setRubrics] = useState<any[]>([]);
  const [selectedRubric, setSelectedRubric] = useState("");

  useEffect(() => {
    fetchBenefits();
  }, []);

  const fetchBenefits = async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const { data: tenantData } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", userData.user?.id)
      .single();

    if (tenantData) {
      const { data, error } = await supabase
        .from("benefit_catalogs")
        .select("*")
        .eq("tenant_id", tenantData.tenant_id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("ERRO LISTAGEM SUPABASE:", error);
        toast.error(`Erro Supabase (Listagem Benefícios): ${error.message}`);
      }

      if (!error && data) {
        setBenefits(data as Benefit[]);
      }

      const { data: rubricsData } = await supabase
        .from("payroll_rubrics")
        .select("id, code, name")
        .eq("tenant_id", tenantData.tenant_id)
        .eq("type", "DEDUCTION")
        .eq("is_active", true)
        .order("code", { ascending: true });

      if (rubricsData) setRubrics(rubricsData);
    }
    setLoading(false);
  };

  const getBenefitIcon = async (type: string) => {
    switch (type) {
      case "TRANSPORTATION":
        return <Bus size={18} className="text-emerald-500" />;
      case "MEAL":
      case "FOOD":
        return <Utensils size={18} className="text-amber-500" />;
      case "HEALTH_INSURANCE":
      case "DENTAL_INSURANCE":
        return <HeartPulse size={18} className="text-rose-500" />;
      default:
        return <Gift size={18} className="text-primary-500" />;
    }
  };

  const getBenefitTypeLabel = async (type: string) => {
    switch (type) {
      case "TRANSPORTATION":
        return "Vale Transporte";
      case "MEAL":
        return "Vale Refeição";
      case "FOOD":
        return "Vale Alimentação";
      case "HEALTH_INSURANCE":
        return "Plano de Saúde";
      case "DENTAL_INSURANCE":
        return "Plano Odontológico";
      case "LIFE_INSURANCE":
        return "Seguro de Vida";
      default:
        return "Outros";
    }
  };

  const openModal = async (b?: Benefit) => {
    if (b) {
      setEditingId(b.id);
      setName(b.name);
      setBenefitType(b.benefit_type);
      setProviderName(b.provider_name || "");
      if (b.employee_discount_percentage) {
        setDiscountType("PERCENTAGE");
        setDefaultDiscount(b.employee_discount_percentage);
      } else if (b.employee_discount_fixed) {
        setDiscountType("FIXED_VALUE");
        setDefaultDiscount(b.employee_discount_fixed);
      } else {
        setDiscountType("NONE");
        setDefaultDiscount(0);
      }
      setSelectedRubric(b.rubric_id || "");
    } else {
      setEditingId(null);
      setName("");
      setBenefitType("TRANSPORTATION");
      setProviderName("");
      setDiscountType("NONE");
      setDefaultDiscount(0);
      setSelectedRubric("");
    }
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
        name,
        benefit_type: benefitType,
        provider_name: providerName,
        employee_discount_percentage: discountType === "PERCENTAGE" ? defaultDiscount : null,
        employee_discount_fixed: discountType === "FIXED_VALUE" ? defaultDiscount : null,
        rubric_id:
          discountType !== "NONE" && selectedRubric ? selectedRubric : null,
      };

      if (editingId) {
        await supabase
          .from("benefit_catalogs")
          .update(payload)
          .eq("id", editingId);
      } else {
        await supabase.from("benefit_catalogs").insert(payload);
      }

      setIsModalOpen(false);
      fetchBenefits();
      } catch (err: any) {
        console.error("Erro ao salvar:", err);
        toast.error("Erro ao salvar o benefício: " + err.message);
      } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!await confirmDialog("Deseja realmente excluir este benefício?")) return;
    
    const { error } = await supabase
      .from("benefit_catalogs")
      .delete()
      .eq("id", id);
      
    if (error) {
      if (error.code === '23503') {
        toast.error("Não é possível excluir este benefício pois ele está vinculado a colaboradores.");
      } else {
        toast.error("Erro ao excluir benefício.");
      }
    } else {
      setBenefits(benefits.filter(b => b.id !== id));
    }
  };

  const filtered = benefits.filter((b) =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Gift size={16} />
            <span>Gestão e Rotinas</span>
            <ChevronRight size={14} />
            <span className="text-slate-900 font-medium">Benefícios</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 font-display tracking-tight">Catálogo de Benefícios</h1>
          <p className="text-sm text-slate-500 mt-1">Gerencie os benefícios oferecidos pela empresa aos colaboradores.</p>
        </div>

        <button onClick={async () => openModal()} className="btn-primary">
          <Plus size={18} />
          <span>Novo Benefício</span>
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Buscar benefícios..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
          />
        </div>
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
          </div>
        ) : filtered.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Benefício / Tipo</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fornecedor</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Regra de Desconto (Padrão)</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginated.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200">
                          {getBenefitIcon(b.benefit_type)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{b.name}</p>
                          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-1">
                            {getBenefitTypeLabel(b.benefit_type)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-sm text-slate-700">
                        {b.provider_name || "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {!b.employee_discount_percentage && !b.employee_discount_fixed && (
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-600">Sem Desconto</span>
                      )}
                      {b.employee_discount_percentage && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border bg-rose-50 text-rose-700 border-rose-200">
                          -{b.employee_discount_percentage}% no salário
                        </span>
                      )}
                      {b.employee_discount_fixed && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border bg-rose-50 text-rose-700 border-rose-200">
                          -R$ {b.employee_discount_fixed.toFixed(2)} fixo
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={async () => openModal(b)}
                          className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors cursor-pointer"
                          title="Editar Benefício"
                        >
                          <Pencil size={16} />
                        </button>
                        <button 
                          onClick={async () => handleDelete(b.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filtered.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        </>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
              <Gift className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">Nenhum benefício cadastrado no catálogo</h3>
            <p className="text-slate-500 max-w-sm mb-6">
              {searchTerm 
                ? "Não encontramos nenhum benefício correspondente à sua busca."
                : "Você ainda não possui benefícios cadastrados. Clique no botão acima para adicionar."}
            </p>
          </div>
        )}
      </div>

      {/* Modal Novo/Editar */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 animate-in fade-in backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
                <Landmark size={20} className="text-primary-600" />
                {editingId ? "Editar Benefício" : "Novo Benefício no Catálogo"}
              </h3>
            </div>

            <form onSubmit={handleSave}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                    Nome Interno
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: VT Padrão 6%, VR Flash R$30"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                      Categoria
                    </label>
                    <select
                      value={benefitType}
                      onChange={(e) => setBenefitType(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="TRANSPORTATION">Vale Transporte</option>
                      <option value="MEAL">Vale Refeição</option>
                      <option value="FOOD">Vale Alimentação</option>
                      <option value="HEALTH_INSURANCE">Assistência Médica</option>
                      <option value="DENTAL_INSURANCE">Assistência Odontológica</option>
                      <option value="LIFE_INSURANCE">Seguro de Vida</option>
                      <option value="OTHER">Outros</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                      Fornecedor / Bandeira
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: SPTrans, Flash, Amil"
                      value={providerName}
                      onChange={(e) => setProviderName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 mt-4">
                  <h4 className="text-sm font-bold text-slate-700 mb-3">
                    Regra de Desconto em Folha
                  </h4>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                        Tipo de Desconto
                      </label>
                      <select
                        value={discountType}
                        onChange={(e) => {
                          setDiscountType(e.target.value);
                          if (e.target.value === "NONE") setDefaultDiscount(0);
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                      >
                        <option value="NONE">Custeado pela Empresa (0%)</option>
                        <option value="PERCENTAGE">
                          Desconto em % (Ex: 6%)
                        </option>
                        <option value="FIXED_VALUE">
                          Valor Fixo (Ex: R$ 50)
                        </option>
                      </select>
                    </div>

                    {discountType !== "NONE" && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                          {discountType === "PERCENTAGE"
                            ? "Porcentagem Padrão (%)"
                            : "Valor Fixo Padrão (R$)"}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={defaultDiscount}
                          onChange={(e) =>
                            setDefaultDiscount(Number(e.target.value))
                          }
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      </div>
                    )}

                    {discountType !== "NONE" && (
                      <div className="col-span-2 mt-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                          Vínculo com Motor de Cálculo (Rubrica)
                        </label>
                        <select
                          required
                          value={selectedRubric}
                          onChange={(e) => setSelectedRubric(e.target.value)}
                          className="w-full px-3 py-2 border border-amber-300 rounded-lg bg-amber-50 focus:bg-white text-sm focus:outline-none focus:ring-1 focus:primary-500"
                        >
                          <option value="">
                            -- Selecione a Rubrica de Desconto --
                          </option>
                          {rubrics.map((r) => (
                            <option key={r.id} value={r.id}>
                              [{r.code}] {r.name}
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-slate-500 mt-1">
                          Esta rubrica será automaticamente inserida no holerite
                          para calcular o desconto deste benefício.
                        </p>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    * Este é o valor padrão. Você pode definir um desconto
                    diferente (ou isenção) na ficha de cada colaborador.
                  </p>
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
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  <span>Salvar Benefício</span>
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
