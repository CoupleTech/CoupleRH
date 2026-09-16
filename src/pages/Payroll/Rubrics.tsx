import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  Plus,
  Loader2,
  Settings,
  Check,
  X,
  ShieldAlert,
  Cpu,
} from "lucide-react";
import { supabase } from "../../lib/supabase";

interface Rubric {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: string;
  category: string;
  origin: string;
  calculation_type: string;
  calculation_base?: string;
  percentage?: number | null;
  divisor?: number | null;
  factor?: number | null;
  quantity?: number | null;
  calculation_order: number;
  formula: string;
  incidence_inss: boolean;
  incidence_irrf: boolean;
  incidence_fgts: boolean;
  incidence_inss_patronal: boolean;
  incidence_rat: boolean;
  incidence_third_parties: boolean;
  generates_base_inss: boolean;
  generates_base_irrf: boolean;
  generates_base_fgts: boolean;
  valid_from: string;
  valid_to?: string;
  version: number;
  esocial_code: string;
  esocial_description?: string;
  is_active: boolean;
}

export default function PayrollRubrics() {
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "basico" | "calculo" | "tributacao"
  >("basico");

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("EARNING");
  const [category, setCategory] = useState("SALARY");
  const [origin, setOrigin] = useState("MANUAL");
  const [calculationType, setCalculationType] = useState("FIXO");
  const [calculationBase, setCalculationBase] = useState("");
  const [percentage, setPercentage] = useState<number | "">("");
  const [divisor, setDivisor] = useState<number | "">("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [factor, setFactor] = useState<number | "">("");
  const [calculationOrder, setCalculationOrder] = useState<number | "">(50);
  const [formula, setFormula] = useState("");
  
  // Incidências e Bases
  const [inss, setInss] = useState(false);
  const [irrf, setIrrf] = useState(false);
  const [fgts, setFgts] = useState(false);
  const [incidenceInssPatronal, setIncidenceInssPatronal] = useState(false);
  const [incidenceRat, setIncidenceRat] = useState(false);
  const [incidenceThirdParties, setIncidenceThirdParties] = useState(false);
  
  const [generatesBaseInss, setGeneratesBaseInss] = useState(false);
  const [generatesBaseIrrf, setGeneratesBaseIrrf] = useState(false);
  const [generatesBaseFgts, setGeneratesBaseFgts] = useState(false);
  
  const [esocialCode, setEsocialCode] = useState("");
  const [esocialDescription, setEsocialDescription] = useState("");
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    fetchRubrics();
  }, []);

  const fetchRubrics = async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const { data: tenantData } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", userData.user?.id)
      .single();

    if (tenantData) {
      const { data, error } = await supabase
        .from("payroll_rubrics")
        .select("*")
        .eq("tenant_id", tenantData.tenant_id)
        .eq("is_active", true)
        .order("code", { ascending: true });

      if (!error && data) {
        setRubrics(data as Rubric[]);
      }
    }
    setLoading(false);
  };

  const openModal = (r?: Rubric) => {
    if (r) {
      setEditingId(r.id);
      setCode(r.code);
      setName(r.name);
      setDescription(r.description || "");
      setType(r.type || "EARNING");
      setCategory(r.category || "SALARY");
      setOrigin(r.origin || "MANUAL");
      setCalculationType(r.calculation_type || "FIXO");
      setCalculationBase(r.calculation_base || "");
      setPercentage(r.percentage ?? "");
      setDivisor(r.divisor ?? "");
      setFactor(r.factor ?? "");
      setQuantity(r.quantity ?? "");
      setCalculationOrder(r.calculation_order || 50);
      setFormula(r.formula || "");
      setInss(r.incidence_inss || false);
      setIrrf(r.incidence_irrf || false);
      setFgts(r.incidence_fgts || false);
      setIncidenceInssPatronal(r.incidence_inss_patronal || false);
      setIncidenceRat(r.incidence_rat || false);
      setIncidenceThirdParties(r.incidence_third_parties || false);
      setGeneratesBaseInss(r.generates_base_inss || false);
      setGeneratesBaseIrrf(r.generates_base_irrf || false);
      setGeneratesBaseFgts(r.generates_base_fgts || false);
      setEsocialCode(r.esocial_code || "");
      setEsocialDescription(r.esocial_description || "");
      setValidFrom(r.valid_from ? r.valid_from.split("T")[0] : new Date().toISOString().split("T")[0]);
    } else {
      setEditingId(null);
      setCode("");
      setName("");
      setDescription("");
      setType("EARNING");
      setCategory("SALARY");
      setOrigin("MANUAL");
      setCalculationType("FIXO");
      setCalculationBase("");
      setPercentage("");
      setDivisor("");
      setFactor("");
      setQuantity("");
      setCalculationOrder(50);
      setFormula("");
      setInss(false);
      setIrrf(false);
      setFgts(false);
      setIncidenceInssPatronal(false);
      setIncidenceRat(false);
      setIncidenceThirdParties(false);
      setGeneratesBaseInss(false);
      setGeneratesBaseIrrf(false);
      setGeneratesBaseFgts(false);
      setEsocialCode("");
      setEsocialDescription("");
      setValidFrom(new Date().toISOString().split("T")[0]);
    }
    setActiveTab("basico");
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
        code,
        name,
        description,
        type,
        category,
        origin,
        calculation_type: calculationType,
        calculation_base: calculationBase || null,
        percentage: percentage === "" ? null : percentage,
        divisor: divisor === "" ? null : divisor,
        factor: factor === "" ? null : factor,
        quantity: quantity === "" ? null : quantity,
        calculation_order: calculationOrder === "" ? 50 : calculationOrder,
        formula,
        incidence_inss: inss,
        incidence_irrf: irrf,
        incidence_fgts: fgts,
        incidence_inss_patronal: incidenceInssPatronal,
        incidence_rat: incidenceRat,
        incidence_third_parties: incidenceThirdParties,
        generates_base_inss: generatesBaseInss,
        generates_base_irrf: generatesBaseIrrf,
        generates_base_fgts: generatesBaseFgts,
        esocial_code: esocialCode,
        esocial_description: esocialDescription,
        valid_from: validFrom,
        is_active: true,
      };

      if (editingId) {
        await supabase
          .from("payroll_rubrics")
          .update(payload)
          .eq("id", editingId);
      } else {
        await supabase.from("payroll_rubrics").insert(payload);
      }

      setIsModalOpen(false);
      fetchRubrics();
    } catch (err) {
      console.error(err);
      alert(
        "Erro ao salvar a rubrica. Verifique se o código já não está em uso.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingId) return;
    if (!window.confirm("Tem certeza que deseja excluir esta rubrica?")) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("payroll_rubrics")
        .delete()
        .eq("id", editingId);

      if (error && error.code === "23503") {
        const { error: softError } = await supabase
          .from("payroll_rubrics")
          .update({ is_active: false })
          .eq("id", editingId);
        if (softError) throw softError;
        alert(
          "Esta rubrica já foi utilizada em cálculos e não pode ser apagada fisicamente para não quebrar o histórico. Ela foi desativada e removida da lista com sucesso.",
        );
      } else if (error) {
        throw error;
      }

      setIsModalOpen(false);
      fetchRubrics();
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir a rubrica.");
    } finally {
      setSaving(false);
    }
  };

  const filtered = rubrics.filter(
    (r) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.code.includes(searchTerm),
  );

  return (
    <div className="animate-fade-up max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display flex items-center gap-3">
            <Cpu className="text-primary-600" />
            Motor de Rubricas
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure os eventos e regras matemáticas da folha de pagamento.
          </p>
        </div>

        <button onClick={() => openModal()} className="btn-primary">
          <Plus size={18} />
          <span>Nova Rubrica</span>
        </button>
      </div>

      <div className="panel-flush">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar por código ou nome..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                <th className="px-6 py-4">Código / Rubrica</th>
                <th className="px-6 py-4">Natureza (Tipo)</th>
                <th className="px-6 py-4">Regra de Cálculo</th>
                <th className="px-6 py-4">Ordem</th>
                <th className="px-6 py-4">Incidências</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-500 mb-2" />
                    Carregando motor...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-slate-500 font-bold"
                  >
                    Nenhuma rubrica cadastrada no sistema.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => openModal(r)}
                    className="hover:bg-slate-50 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center border font-bold text-xs
                        ${
                          r.type === "EARNING"
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : r.type === "DEDUCTION"
                              ? "bg-rose-50 border-rose-200 text-rose-700"
                              : "bg-slate-100 border-slate-300 text-slate-700"
                        }
                      `}
                        >
                          {r.code}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{r.name}</p>
                          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-1">
                            {r.category} • {r.origin}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] uppercase tracking-widest font-bold
                      ${
                        r.type === "EARNING"
                          ? "bg-emerald-100 text-emerald-800"
                          : r.type === "DEDUCTION"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-slate-200 text-slate-700"
                      }
                    `}
                      >
                        {r.type === "EARNING" && "Provento (+)"}
                        {r.type === "DEDUCTION" && "Desconto (-)"}
                        {r.type === "BASE" && "Base Cálc. (=)"}
                        {r.type === "INFORMATIVE" && "Informativa"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-700">
                        {r.calculation_type === "FIXED" || r.calculation_type === "FIXO" ? "Valor Fixo" : ""}
                        {r.calculation_type === "FORMULA" && "Fórmula Avançada"}
                        {r.calculation_type === "PERCENTAGE_OF_BASE" || r.calculation_type === "PERCENTUAL" ? "% Sobre Base" : ""}
                        {r.calculation_type === "REFERENCE_TABLE" || r.calculation_type === "AUTOMATICA" ? "Tabela Ref." : ""}
                        {r.calculation_type === "HOURS" || r.calculation_type === "HORAS" ? "Por Horas" : ""}
                        {r.calculation_type === "DAYS" || r.calculation_type === "DIAS" ? "Por Dias" : ""}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                        {r.calculation_order}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2 flex-wrap max-w-[150px]">
                        {r.incidence_inss && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">INSS</span>}
                        {r.incidence_irrf && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-200">IRRF</span>}
                        {r.incidence_fgts && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary-100 text-primary-800 border border-primary-200">FGTS</span>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 animate-in fade-in backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white shrink-0">
              <h3 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
                <Settings size={20} className="text-primary-600" />
                {editingId ? `Editar Rubrica [${code}]` : "Configurar Nova Rubrica"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex border-b border-slate-200 px-6 shrink-0 bg-white pt-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab("basico")}
                className={`whitespace-nowrap px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === "basico" ? "border-primary-600 text-primary-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
              >
                1. Dados Básicos
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("calculo")}
                className={`whitespace-nowrap px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === "calculo" ? "border-primary-600 text-primary-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
              >
                2. Motor de Cálculo
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("tributacao")}
                className={`whitespace-nowrap px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === "tributacao" ? "border-primary-600 text-primary-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
              >
                3. Incidências e Bases
              </button>
            </div>

            <form
              onSubmit={handleSave}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="p-6 overflow-y-auto bg-white flex-1">
                {/* ABA 1: Básico */}
                {activeTab === "basico" && (
                  <div className="space-y-5 animate-in fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="col-span-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                          Código
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: 101"
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-primary-500 outline-none font-mono"
                        />
                      </div>
                      <div className="col-span-3">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                          Nome da Rubrica
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: Salário Base"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-primary-500 outline-none font-bold"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                        Descrição / Observação
                      </label>
                      <textarea
                        rows={2}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-primary-500 outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                          Natureza (Tipo)
                        </label>
                        <select
                          value={type}
                          onChange={(e) => setType(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-primary-500 outline-none"
                        >
                          <option value="EARNING">Provento (+) Ganhos</option>
                          <option value="DEDUCTION">Desconto (-) Retenções</option>
                          <option value="BASE">Base de Cálculo (=) Informativo</option>
                          <option value="INFORMATIVE">Informativa</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                          Categoria Contábil
                        </label>
                        <select
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-primary-500 outline-none"
                        >
                          <option value="SALARY">Salários e Ordenados</option>
                          <option value="OVERTIME">Horas Extras</option>
                          <option value="ALLOWANCE">Adicionais (Ins/Per/Not)</option>
                          <option value="BENEFIT">Benefício</option>
                          <option value="TAX">Tributos e Encargos</option>
                          <option value="ADVANCE">Adiantamentos</option>
                          <option value="OTHER">Outros Diversos</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                          Origem
                        </label>
                        <select
                          value={origin}
                          onChange={(e) => setOrigin(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-primary-500 outline-none"
                        >
                          <option value="MANUAL">Manual</option>
                          <option value="AUTOMATICA">Automática (Motor)</option>
                          <option value="IMPORTADA">Importada (Ponto)</option>
                          <option value="INTEGRACAO">Integração API</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                          Data Início da Vigência
                        </label>
                        <input
                          type="date"
                          required
                          value={validFrom}
                          onChange={(e) => setValidFrom(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-primary-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ABA 2: Cálculo */}
                {activeTab === "calculo" && (
                  <div className="space-y-5 animate-in fade-in">
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                          Ordem de Processamento
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            required
                            min="1"
                            value={calculationOrder}
                            onChange={(e) => setCalculationOrder(e.target.value === "" ? "" : parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-primary-500 outline-none"
                          />
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">Ex: Salários (10), Adicionais (20), INSS (50).</p>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-5 border border-slate-200 mt-4">
                      <div className="flex items-center gap-2 mb-2 text-slate-700 font-bold">
                        <Cpu size={16} className="text-primary-600" /> <span>Modo de Processamento</span>
                      </div>
                      <select
                        value={calculationType}
                        onChange={(e) => setCalculationType(e.target.value)}
                        className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500 mb-6 font-medium"
                      >
                        <option value="FIXO">Valor Fixo ou Manual</option>
                        <option value="PERCENTUAL">% Sobre Base de Cálculo</option>
                        <option value="HORAS">Valor por Horas</option>
                        <option value="DIAS">Valor por Dias</option>
                        <option value="AUTOMATICA">Tabela de Referência (INSS/IRRF)</option>
                        <option value="FORMULA">Expressão Matemática Avançada (Fórmula)</option>
                      </select>

                      {calculationType !== "FORMULA" && calculationType !== "AUTOMATICA" && (
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                              Base de Cálculo Principal (Código)
                            </label>
                            <input
                              type="text"
                              placeholder="Ex: BASE_INSS"
                              value={calculationBase}
                              onChange={(e) => setCalculationBase(e.target.value)}
                              className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                              Percentual Aplicado (%)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Ex: 30"
                              value={percentage}
                              onChange={(e) => setPercentage(e.target.value === "" ? "" : parseFloat(e.target.value))}
                              className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                              Divisor Padrão (Opcional)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Ex: 220"
                              value={divisor}
                              onChange={(e) => setDivisor(e.target.value === "" ? "" : parseFloat(e.target.value))}
                              className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                              Fator Multiplicador (Ex: 1.5)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Ex: 1.5"
                              value={factor}
                              onChange={(e) => setFactor(e.target.value === "" ? "" : parseFloat(e.target.value))}
                              className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                              Quantidade Fixo (Opcional)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Ex: 10"
                              value={quantity}
                              onChange={(e) => setQuantity(e.target.value === "" ? "" : parseFloat(e.target.value))}
                              className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono text-sm"
                            />
                          </div>
                        </div>
                      )}

                      {calculationType === "FORMULA" && (
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                            Algoritmo (Fórmula)
                          </label>
                          <textarea
                            rows={4}
                            placeholder="Ex: (base_salary / 220) * input_hours * 1.5"
                            value={formula}
                            onChange={(e) => setFormula(e.target.value)}
                            className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono text-sm"
                          />
                          <p className="text-[10px] text-slate-500 mt-2 font-medium">
                            Variáveis: base_salary, workload, input_value, input_hours, min_wage.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ABA 3: Tributação */}
                {activeTab === "tributacao" && (
                  <div className="space-y-6 animate-in fade-in">
                    <div className="bg-amber-50 p-4 border border-amber-200 rounded-lg flex items-start gap-3">
                      <ShieldAlert
                        className="text-amber-600 shrink-0 mt-0.5"
                        size={18}
                      />
                      <div className="text-sm text-amber-800">
                        <strong>Atenção às Incidências e Bases!</strong>
                        <p className="mt-1">
                          Erros na parametrização desta seção podem gerar passivos trabalhistas graves e cálculos incorretos de tributos no eSocial.
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Incidências (Descontos) */}
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">Incidências de Tributos (Empregado)</h4>
                        <div className="space-y-2">
                          <label className="flex items-center gap-3 p-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                            <input type="checkbox" checked={inss} onChange={(e) => setInss(e.target.checked)} className="w-4 h-4 text-primary-600 rounded" />
                            <span className="text-sm font-medium">Incide INSS Empregado</span>
                          </label>
                          <label className="flex items-center gap-3 p-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                            <input type="checkbox" checked={irrf} onChange={(e) => setIrrf(e.target.checked)} className="w-4 h-4 text-primary-600 rounded" />
                            <span className="text-sm font-medium">Incide IRRF</span>
                          </label>
                          <label className="flex items-center gap-3 p-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                            <input type="checkbox" checked={fgts} onChange={(e) => setFgts(e.target.checked)} className="w-4 h-4 text-primary-600 rounded" />
                            <span className="text-sm font-medium">Incide FGTS (8%)</span>
                          </label>
                        </div>
                      </div>

                      {/* Bases (Gera Base) */}
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">Bases Geradas (Motor)</h4>
                        <div className="space-y-2">
                          <label className="flex items-center gap-3 p-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                            <input type="checkbox" checked={generatesBaseInss} onChange={(e) => setGeneratesBaseInss(e.target.checked)} className="w-4 h-4 text-primary-600 rounded" />
                            <span className="text-sm font-medium">Gera BASE_INSS</span>
                          </label>
                          <label className="flex items-center gap-3 p-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                            <input type="checkbox" checked={generatesBaseIrrf} onChange={(e) => setGeneratesBaseIrrf(e.target.checked)} className="w-4 h-4 text-primary-600 rounded" />
                            <span className="text-sm font-medium">Gera BASE_IRRF</span>
                          </label>
                          <label className="flex items-center gap-3 p-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                            <input type="checkbox" checked={generatesBaseFgts} onChange={(e) => setGeneratesBaseFgts(e.target.checked)} className="w-4 h-4 text-primary-600 rounded" />
                            <span className="text-sm font-medium">Gera BASE_FGTS</span>
                          </label>
                        </div>
                      </div>

                      {/* Encargos Patronais */}
                      <div className="md:col-span-2">
                        <h4 className="text-sm font-bold text-slate-800 mb-3 border-b pb-2">Encargos Patronais</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <label className="flex items-center gap-3 p-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                            <input type="checkbox" checked={incidenceInssPatronal} onChange={(e) => setIncidenceInssPatronal(e.target.checked)} className="w-4 h-4 text-primary-600 rounded" />
                            <span className="text-sm font-medium">INSS Patronal (20%)</span>
                          </label>
                          <label className="flex items-center gap-3 p-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                            <input type="checkbox" checked={incidenceRat} onChange={(e) => setIncidenceRat(e.target.checked)} className="w-4 h-4 text-primary-600 rounded" />
                            <span className="text-sm font-medium">RAT/FAP</span>
                          </label>
                          <label className="flex items-center gap-3 p-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                            <input type="checkbox" checked={incidenceThirdParties} onChange={(e) => setIncidenceThirdParties(e.target.checked)} className="w-4 h-4 text-primary-600 rounded" />
                            <span className="text-sm font-medium">Terceiros</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                          Código Natureza eSocial (Tabela 3)
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: 1000 (Salário)"
                          value={esocialCode}
                          onChange={(e) => setEsocialCode(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-primary-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                          Descrição Natureza eSocial
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: Salário, vencimento, soldo..."
                          value={esocialDescription}
                          onChange={(e) => setEsocialDescription(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-primary-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex justify-end gap-3 shrink-0 rounded-b-lg">
                {editingId && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={saving}
                    className="mr-auto px-4 py-2 font-bold text-sm text-rose-600 hover:text-rose-900 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    Excluir Rubrica
                  </button>
                )}
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
                    <Check size={16} />
                  )}
                  <span>Salvar Rubrica</span>
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
