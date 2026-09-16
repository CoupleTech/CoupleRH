import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Save,
  Briefcase,
  Percent,
  DollarSign,
  Calculator,
  Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

interface Rubric {
  id: string;
  code: string;
  name: string;
}

export default function BenefitForm() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [type, setType] = useState("TRANSPORTATION");
  const [provider, setProvider] = useState("");
  const [companyCost, setCompanyCost] = useState("");

  const [discountType, setDiscountType] = useState("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [selectedRubric, setSelectedRubric] = useState<string>("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRubrics();
  }, []);

  const fetchRubrics = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const { data: tenantData } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", userData.user?.id)
      .single();

    if (tenantData) {
      // Buscar apenas rubricas de desconto ativas
      const { data } = await supabase
        .from("payroll_rubrics")
        .select("id, code, name")
        .eq("tenant_id", tenantData.tenant_id)
        .eq("type", "DEDUCTION")
        .eq("is_active", true)
        .order("code", { ascending: true });

      if (data) {
        setRubrics(data);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      alert("Preencha o nome do benefício.");
      return;
    }

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
        benefit_type: type,
        provider_name: provider || null,
        company_contribution: companyCost ? parseFloat(companyCost) : 0,
        employee_discount_percentage:
          discountType === "percentage" && discountValue
            ? parseFloat(discountValue)
            : null,
        employee_discount_fixed:
          discountType === "fixed" && discountValue
            ? parseFloat(discountValue)
            : null,
        is_active: isActive,
        rubric_id:
          discountType !== "none" && selectedRubric ? selectedRubric : null,
      };

      const { error } = await supabase.from("benefit_catalogs").insert(payload);

      if (error) throw error;

      navigate("/beneficios");
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar o benefício.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-up max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <button
          type="button"
          onClick={() => navigate("/beneficios")}
          className="btn-ghost p-2"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display">
            Novo Benefício
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Cadastre as regras corporativas de concessão e desconto
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="panel p-6 lg:p-8">
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2 mb-4">
              <Briefcase size={20} className="text-primary-600" />
              Dados Básicos
            </h2>
            <div className="grid grid-cols-2 gap-6">
              <div className="col-span-2 md:col-span-1">
                <label className="input-label">Nome do Benefício</label>
                <input
                  type="text"
                  placeholder="Ex: Vale Refeição Alelo"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 focus:ring-2 focus:ring-primary-500 outline-none"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="input-label">Categoria / eSocial</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-900 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="TRANSPORTATION">Vale-Transporte</option>
                  <option value="MEAL">Vale-Refeição</option>
                  <option value="FOOD">Vale-Alimentação</option>
                  <option value="HEALTH_INSURANCE">
                    Assistência Médica / Plano de Saúde
                  </option>
                  <option value="DENTAL_INSURANCE">
                    Assistência Odontológica
                  </option>
                  <option value="OTHER">Outros</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="input-label">
                  Nome do Fornecedor / Operadora (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Amil, Ticket, SulAmérica..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 focus:ring-2 focus:ring-primary-500 outline-none"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="pt-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2 mb-4">
              <DollarSign size={20} className="text-primary-600" />
              Regras Financeiras (Folha de Pagamento)
            </h2>
            <div className="grid grid-cols-2 gap-6">
              <div className="col-span-2 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <p className="text-sm font-semibold text-slate-700 mb-3">
                  Como será descontado do colaborador?
                </p>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="discountType"
                      checked={discountType === "percentage"}
                      onChange={() => setDiscountType("percentage")}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm font-medium text-slate-700">
                      Porcentagem (%)
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="discountType"
                      checked={discountType === "fixed"}
                      onChange={() => setDiscountType("fixed")}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm font-medium text-slate-700">
                      Valor Fixo (R$)
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="discountType"
                      checked={discountType === "none"}
                      onChange={() => {
                        setDiscountType("none");
                        setSelectedRubric("");
                      }}
                      className="text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm font-medium text-slate-700">
                      Sem desconto (100% Empresa)
                    </span>
                  </label>
                </div>
              </div>

              {discountType !== "none" && (
                <>
                  <div className="col-span-2 md:col-span-1 relative">
                    <label className="input-label">
                      Valor do Desconto{" "}
                      {discountType === "percentage" ? "(%)" : "(R$)"}
                    </label>
                    <div className="absolute inset-y-0 left-0 pl-3 top-6 flex items-center pointer-events-none">
                      {discountType === "percentage" ? (
                        <Percent className="h-4 w-4 text-slate-400" />
                      ) : (
                        <DollarSign className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                    <input
                      type="number"
                      min="0"
                      step={discountType === "percentage" ? "1" : "0.01"}
                      className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg bg-slate-50 focus:ring-2 focus:ring-primary-500 outline-none"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      placeholder={
                        discountType === "percentage"
                          ? "Ex: 6 (referente a 6% do salário)"
                          : "Ex: 15.50"
                      }
                      required
                    />
                  </div>

                  <div className="col-span-2 md:col-span-1">
                    <label className="input-label flex items-center gap-1">
                      <Calculator size={14} className="text-primary-600" />{" "}
                      Vínculo no Motor de Cálculo
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-amber-50 text-slate-900 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      value={selectedRubric}
                      onChange={(e) => setSelectedRubric(e.target.value)}
                      required
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
                      A rubrica escolhida será automaticamente inserida no
                      holerite do colaborador.
                    </p>
                  </div>
                </>
              )}

              <div className="col-span-2 md:col-span-1 relative mt-2">
                <label className="input-label">
                  Custo Médio da Empresa (R$ / opcional)
                </label>
                <div className="absolute inset-y-0 left-0 pl-3 top-6 flex items-center pointer-events-none">
                  <DollarSign className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="number"
                  step="0.01"
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg bg-slate-50 focus:ring-2 focus:ring-primary-500 outline-none"
                  value={companyCost}
                  onChange={(e) => setCompanyCost(e.target.value)}
                  placeholder="Ex: 350.00"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <div>
                <p className="font-semibold text-slate-800">Benefício Ativo</p>
                <p className="text-xs text-slate-500">
                  Disponível para atribuir aos colaboradores
                </p>
              </div>
            </label>

            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Save size={18} />
              )}
              Salvar Benefício
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
