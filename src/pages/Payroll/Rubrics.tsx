import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  Plus,
  Loader2,
  Settings,
  Check,
  X,
  Cpu,
  ShieldAlert,
  Play,
  Sparkles,
  AlertTriangle,
  FileText,
  CheckCircle2,
  History,
  Copy,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Pagination } from "../../components/Pagination";
import { toast } from 'sonner';
import { confirmDialog } from '../../components/ConfirmDialogProvider';
import {
  RUBRIC_TEMPLATES,
  ESOCIAL_NATURE_SUGGESTIONS,
  getEsocialNatureSuggestion,
  simulateRubricCalculation,
  validateRubricConfig,
  createNewRubricVersion,
  PUBLISHED_VARIABLES,
} from "../../services/rubricWizardService";
import type {
  RubricConfig,
  SimulationEmployeeContext,
  RubricKind,
} from "../../services/rubricWizardService";

interface Rubric {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: string;
  category: string;
  origin: string;
  calculation_type: string;
  calculation_form?: string;
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
  generates_inss_base?: boolean;
  generates_irrf_base?: boolean;
  generates_fgts_base?: boolean;
  rubric_type?: string;
  rubric_kind?: RubricKind;
  valid_from: string;
  valid_to?: string;
  version: number;
  status?: 'DRAFT' | 'APPROVED' | 'ACTIVE' | 'RETIRED';
  is_system?: boolean;
  esocial_nature?: string;
  legal_basis?: string;
  esocial_code: string;
  esocial_description?: string;
  is_active: boolean;
}

export default function () {
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
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
  const [activeTab, setActiveTab] = useState<
    "basico" | "calculo" | "tributacao" | "simulador"
  >("basico");

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"EARNING" | "DEDUCTION">("EARNING");
  const [category, setCategory] = useState("SALARY");
  const [rubricKind, setRubricKind] = useState<RubricKind>("OTHER");
  const [origin, setOrigin] = useState("MANUAL");
  const [calculationType, setCalculationType] = useState("FIXO");
  const [calculationBase, setCalculationBase] = useState("");
  const [percentage, setPercentage] = useState<number | "">("");
  const [divisor, setDivisor] = useState<number | "">("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [factor, setFactor] = useState<number | "">("");
  const [calculationOrder, setCalculationOrder] = useState<number | "">(50);
  const [formula, setFormula] = useState("");
  
  // Governança v2
  const [status, setStatus] = useState<'DRAFT' | 'APPROVED' | 'ACTIVE' | 'RETIRED'>('ACTIVE');
  const [version, setVersion] = useState(1);
  const [isSystem, setIsSystem] = useState(false);
  const [esocialNature, setEsocialNature] = useState("");
  const [legalBasis, setLegalBasis] = useState("");
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split("T")[0]);
  const [validTo, setValidTo] = useState("");

  // Incidências e Bases
  const [inss, setInss] = useState(false);
  const [irrf, setIrrf] = useState(false);
  const [fgts, setFgts] = useState(false);
  const [integraDsr, setIntegraDsr] = useState(false);
  const [incidenceInssPatronal, setIncidenceInssPatronal] = useState(false);
  const [incidenceRat, setIncidenceRat] = useState(false);
  const [incidenceThirdParties, setIncidenceThirdParties] = useState(false);
  
  const [generatesBaseInss, setGeneratesBaseInss] = useState(false);
  const [generatesBaseIrrf, setGeneratesBaseIrrf] = useState(false);
  const [generatesBaseFgts, setGeneratesBaseFgts] = useState(false);
  
  const [esocialCode, setEsocialCode] = useState("");
  const [esocialDescription, setEsocialDescription] = useState("");

  // Simulador State
  const [simSalary, setSimSalary] = useState(3000.0);
  const [simDivisor, setSimDivisor] = useState(220);
  const [simQuantity, setSimQuantity] = useState(10);
  const [simFactor, setSimFactor] = useState(1.5);
  const [simResult, setSimResult] = useState<any>(null);

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

  const applyTemplate = (templateId: string) => {
    const template = RUBRIC_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    setName(template.title);
    setDescription(template.description);
    setType(template.type);
    setRubricKind(template.rubric_kind);
    setCalculationType(template.calculation_form);
    setCalculationBase(template.calculation_base || "");
    setPercentage(template.percentage ?? "");
    setDivisor(template.divisor ?? "");
    setFactor(template.factor ?? "");
    setQuantity(template.quantity ?? "");
    setFormula(template.formula || "");

    // Incidências
    setInss(template.defaultIncidences.inss);
    setIrrf(template.defaultIncidences.irrf);
    setFgts(template.defaultIncidences.fgts);
    setIntegraDsr(template.defaultIncidences.integra_dsr ?? false);
    setIncidenceInssPatronal(template.defaultIncidences.inss_patronal ?? false);
    setIncidenceRat(template.defaultIncidences.rat ?? false);
    setIncidenceThirdParties(template.defaultIncidences.terceiros ?? false);

    setGeneratesBaseInss(template.defaultIncidences.inss);
    setGeneratesBaseIrrf(template.defaultIncidences.irrf);
    setGeneratesBaseFgts(template.defaultIncidences.fgts);

    if (template.esocial_nature) {
      setEsocialNature(template.esocial_nature);
      setEsocialCode(template.esocial_nature);
      applyEsocialSuggestion(template.esocial_nature);
    }

    toast.success(`Modelo "${template.title}" aplicado com sucesso!`);
  };

  const applyEsocialSuggestion = (natureCode: string) => {
    const sug = getEsocialNatureSuggestion(natureCode);
    if (!sug) return;

    setEsocialDescription(sug.name);
    setInss(sug.inss);
    setIrrf(sug.irrf);
    setFgts(sug.fgts);
    setIntegraDsr(sug.integra_dsr);
    setIncidenceInssPatronal(sug.inss_patronal);
    setIncidenceRat(sug.rat);
    setIncidenceThirdParties(sug.terceiros);
    setLegalBasis(sug.legal_basis);

    setGeneratesBaseInss(sug.inss);
    setGeneratesBaseIrrf(sug.irrf);
    setGeneratesBaseFgts(sug.fgts);

    toast.info(`Incidências e fundamentação sugeridas pelo eSocial (${sug.code}) aplicadas!`);
  };

  const handleRunSimulation = () => {
    const rubricConfig: RubricConfig = {
      code,
      name,
      type,
      rubric_kind: rubricKind,
      calculation_form: calculationType as any,
      calculation_base: calculationBase,
      percentage: percentage === "" ? null : percentage,
      divisor: divisor === "" ? null : divisor,
      factor: factor === "" ? null : factor,
      quantity: quantity === "" ? null : quantity,
      formula,
      incidences: {
        inss,
        irrf,
        fgts,
        integra_dsr: integraDsr,
      },
    };

    const empContext: SimulationEmployeeContext = {
      salary: simSalary,
      minimum_wage: 1621.0,
      divisor: simDivisor,
      quantity: simQuantity,
      factor: simFactor,
      dias_uteis: 24,
      dias_inuteis: 4,
      custom_variables: {
        BASE_DSR: 350.0,
        BASE_HORA_EXTRA: simSalary,
        R101: simSalary,
      },
    };

    const result = simulateRubricCalculation(rubricConfig, empContext);
    setSimResult(result);
  };

  const openModal = async (r?: Rubric) => {
    setSimResult(null);
    if (r) {
      setEditingId(r.id);
      setCode(r.code);
      setName(r.name);
      setDescription(r.description || "");
      setType(r.type as any || "EARNING");
      setCategory(r.category || "SALARY");
      setRubricKind(r.rubric_kind || "OTHER");
      setOrigin(r.origin || "MANUAL");
      setCalculationType(r.calculation_form || r.calculation_type || "FIXO");
      setCalculationBase(r.calculation_base || "");
      setPercentage(r.percentage ?? "");
      setDivisor(r.divisor ?? "");
      setFactor(r.factor ?? "");
      setQuantity(r.quantity ?? "");
      setCalculationOrder(r.calculation_order ?? 50);
      setFormula(r.formula || "");
      
      setStatus(r.status || 'ACTIVE');
      setVersion(r.version || 1);
      setIsSystem(r.is_system || false);
      setEsocialNature(r.esocial_nature || r.esocial_code || "");
      setLegalBasis(r.legal_basis || "");
      setValidFrom(r.valid_from ? r.valid_from.split("T")[0] : new Date().toISOString().split("T")[0]);
      setValidTo(r.valid_to ? r.valid_to.split("T")[0] : "");

      setInss(r.incidence_inss || false);
      setIrrf(r.incidence_irrf || false);
      setFgts(r.incidence_fgts || false);
      setIntegraDsr(false);
      setIncidenceInssPatronal(r.incidence_inss_patronal || false);
      setIncidenceRat(r.incidence_rat || false);
      setIncidenceThirdParties(r.incidence_third_parties || false);
      setGeneratesBaseInss(r.generates_base_inss ?? r.generates_inss_base ?? false);
      setGeneratesBaseIrrf(r.generates_base_irrf ?? r.generates_irrf_base ?? false);
      setGeneratesBaseFgts(r.generates_base_fgts ?? r.generates_fgts_base ?? false);
      setEsocialCode(r.esocial_code || "");
      setEsocialDescription(r.esocial_description || "");
    } else {
      setEditingId(null);
      setCode("");
      setName("");
      setDescription("");
      setType("EARNING");
      setCategory("SALARY");
      setRubricKind("OTHER");
      setOrigin("MANUAL");
      setCalculationType("FIXO");
      setCalculationBase("");
      setPercentage("");
      setDivisor("");
      setFactor("");
      setQuantity("");
      setCalculationOrder(50);
      setFormula("");

      setStatus('ACTIVE');
      setVersion(1);
      setIsSystem(false);
      setEsocialNature("");
      setLegalBasis("");
      setValidFrom(new Date().toISOString().split("T")[0]);
      setValidTo("");

      setInss(false);
      setIrrf(false);
      setFgts(false);
      setIntegraDsr(false);
      setIncidenceInssPatronal(false);
      setIncidenceRat(false);
      setIncidenceThirdParties(false);
      setGeneratesBaseInss(false);
      setGeneratesBaseIrrf(false);
      setGeneratesBaseFgts(false);
      setEsocialCode("");
      setEsocialDescription("");
    }
    setActiveTab("basico");
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const rubricConfig: RubricConfig = {
        id: editingId || undefined,
        code,
        name,
        description,
        type,
        rubric_kind: rubricKind,
        calculation_form: calculationType as any,
        calculation_base: calculationBase,
        percentage: percentage === "" ? null : percentage,
        divisor: divisor === "" ? null : divisor,
        factor: factor === "" ? null : factor,
        quantity: quantity === "" ? null : quantity,
        formula,
        esocial_nature: esocialNature || esocialCode,
        legal_basis: legalBasis,
        incidences: {
          inss,
          irrf,
          fgts,
          integra_dsr: integraDsr,
        },
      };

      const existingForValidation = rubrics
        .filter((r) => r.id !== editingId)
        .map((r) => ({ code: r.code, name: r.name, formula: r.formula }));

      const validation = validateRubricConfig(rubricConfig, existingForValidation);

      if (!validation.isValid) {
        toast.error(`Inconsistência detectada: ${validation.errors[0]}`);
        setSaving(false);
        return;
      }

      if (validation.warnings.length > 0) {
        toast.warning(validation.warnings[0]);
      }

      const { data: userData } = await supabase.auth.getUser();
      const { data: tenantData } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", userData.user?.id)
        .single();

      if (!tenantData) {
        toast.error("Tenant não identificado.");
        setSaving(false);
        return;
      }

      const payload = {
        tenant_id: tenantData.tenant_id,
        code,
        name,
        description,
        type,
        rubric_type: type,
        rubric_kind: rubricKind,
        category,
        origin,
        calculation_type: calculationType,
        calculation_form: calculationType,
        calculation_base: calculationBase || null,
        percentage: percentage === "" ? null : percentage,
        divisor: divisor === "" ? null : divisor,
        factor: factor === "" ? null : factor,
        quantity: quantity === "" ? null : quantity,
        calculation_order: calculationOrder === "" ? 50 : calculationOrder,
        formula,
        status,
        version,
        is_system: isSystem,
        esocial_nature: esocialNature || esocialCode || null,
        legal_basis: legalBasis || null,
        valid_from: validFrom,
        valid_to: validTo || null,
        approved_by: status === 'ACTIVE' || status === 'APPROVED' ? userData.user?.id : null,
        approved_at: status === 'ACTIVE' || status === 'APPROVED' ? new Date().toISOString() : null,
        incidence_inss: inss,
        incidence_irrf: irrf,
        incidence_fgts: fgts,
        incidence_inss_patronal: incidenceInssPatronal,
        incidence_rat: incidenceRat,
        incidence_third_parties: incidenceThirdParties,
        generates_base_inss: generatesBaseInss,
        generates_base_irrf: generatesBaseIrrf,
        generates_base_fgts: generatesBaseFgts,
        generates_inss_base: generatesBaseInss,
        generates_irrf_base: generatesBaseIrrf,
        generates_fgts_base: generatesBaseFgts,
        esocial_code: esocialNature || esocialCode,
        esocial_description: esocialDescription,
        is_active: true,
      };

      let rubricId = editingId;

      if (editingId) {
        await supabase
          .from("payroll_rubrics")
          .update(payload)
          .eq("id", editingId);
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from("payroll_rubrics")
          .insert(payload)
          .select("id")
          .single();

        if (insertError) throw insertError;
        rubricId = inserted?.id;
      }

      // Sincronizar com rubric_incidences (Migration 00073)
      if (rubricId) {
        await supabase.from("rubric_incidences").upsert(
          {
            tenant_id: tenantData.tenant_id,
            rubric_id: rubricId,
            context: 'ALL',
            inss,
            irrf,
            fgts,
            irrf_mode: 'NORMAL',
            integra_dsr: integraDsr,
            inss_patronal: incidenceInssPatronal,
            rat: incidenceRat,
            terceiros: incidenceThirdParties,
          },
          { onConflict: 'rubric_id,context' }
        );
      }

      toast.success(editingId ? "Rubrica atualizada com sucesso!" : "Nova rubrica criada e ativada!");
      setIsModalOpen(false);
      fetchRubrics();
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao salvar a rubrica: ${err?.message || "Verifique se o código já não está em uso."}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNewVersion = async () => {
    if (!editingId) return;
    const currentRubric = rubrics.find((r) => r.id === editingId);
    if (!currentRubric) return;

    if (!await confirmDialog(
      `Criar nova versão (v${(currentRubric.version || 1) + 1}) para a rubrica ${currentRubric.code}?\n\nOs holerites passados continuarão preservados na versão anterior.`
    )) {
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const newVersionData = createNewRubricVersion(
        currentRubric,
        {
          percentage: percentage === "" ? null : percentage,
          divisor: divisor === "" ? null : divisor,
          factor: factor === "" ? null : factor,
          formula,
          legal_basis: legalBasis,
          valid_from: new Date().toISOString().split("T")[0],
        },
        userData.user?.id
      );

      delete newVersionData.id;

      const { error } = await supabase.from("payroll_rubrics").insert(newVersionData);
      if (error) throw error;

      toast.success(`Nova versão v${newVersionData.version} criada com status APPROVED!`);
      setIsModalOpen(false);
      fetchRubrics();
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao gerar nova versão: ${err?.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingId) return;
    if (!await confirmDialog("Tem certeza que deseja desativar esta rubrica?")) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("payroll_rubrics")
        .update({ is_active: false, status: 'RETIRED' })
        .eq("id", editingId);

      if (error) throw error;
      toast.success("Rubrica aposentada/desativada com sucesso.");
      setIsModalOpen(false);
      fetchRubrics();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao desativar a rubrica.");
    } finally {
      setSaving(false);
    }
  };

  const filtered = rubrics.filter(
    (r) =>
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.rubric_kind && r.rubric_kind.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="animate-fade-up max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display flex items-center gap-3">
            <Cpu className="text-primary-600" />
            Motor de Rubricas
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Motor de regras matemáticas, catálogo eSocial e governança orientada a dados.
          </p>
        </div>

        <button onClick={async () => openModal()} className="btn-primary">
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
              placeholder="Buscar por código, nome ou kind..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
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
                <th className="px-6 py-4">Status / Versão</th>
                <th className="px-6 py-4">Natureza (Tipo)</th>
                <th className="px-6 py-4">Regra de Cálculo</th>
                <th className="px-6 py-4">Ordem</th>
                <th className="px-6 py-4">Incidências</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-500 mb-2" />
                    Carregando motor...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500 font-bold">
                    Nenhuma rubrica encontrada.
                  </td>
                </tr>
              ) : (
                paginated.map((r) => (
                  <tr
                    key={r.id}
                    onClick={async () => openModal(r)}
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
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-900">{r.name}</p>
                            {r.is_system && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                Sistema
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-1">
                            {r.rubric_kind ? (
                              <span className="text-primary-600 font-extrabold">{r.rubric_kind}</span>
                            ) : (
                              r.category
                            )}
                            {r.esocial_nature && ` • eSocial ${r.esocial_nature}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider
                            ${
                              r.status === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.status === 'APPROVED'
                                  ? 'bg-blue-100 text-blue-800'
                                  : r.status === 'DRAFT'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-600'
                            }`}
                        >
                          {r.status || 'ACTIVE'}
                        </span>
                        <span className="text-[11px] font-bold text-slate-500">v{r.version || 1}</span>
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
                        {r.calculation_type === "DIAS" ? "Por Dias" : ""}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                        {r.calculation_order}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1.5 flex-wrap max-w-[150px]">
                        {r.incidence_inss && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">INSS</span>}
                        {r.incidence_irrf && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-200">IRRF</span>}
                        {r.incidence_fgts && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">FGTS</span>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {!loading && filtered.length > 0 && (
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
        )}
      </div>

      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 animate-in fade-in backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                  <Cpu size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
                    {editingId ? `Rubrica [${code}] - v${version}` : "Assistente de Nova Rubrica"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Definição orientada a dados com motor dinâmico e validações em tempo real.
                  </p>
                </div>
              </div>
              <button
                onClick={async () => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>

            {/* Abas */}
            <div className="flex border-b border-slate-200 px-6 shrink-0 bg-slate-50/70 pt-2 overflow-x-auto gap-2">
              <button
                type="button"
                onClick={async () => setActiveTab("basico")}
                className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all border-b-2 ${
                  activeTab === "basico"
                    ? "border-primary-600 text-primary-700 bg-white shadow-sm"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                1. Dados & Identificação
              </button>
              <button
                type="button"
                onClick={async () => setActiveTab("calculo")}
                className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all border-b-2 ${
                  activeTab === "calculo"
                    ? "border-primary-600 text-primary-700 bg-white shadow-sm"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                2. Regra Matemática
              </button>
              <button
                type="button"
                onClick={async () => setActiveTab("tributacao")}
                className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all border-b-2 ${
                  activeTab === "tributacao"
                    ? "border-primary-600 text-primary-700 bg-white shadow-sm"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                3. Incidências & eSocial
              </button>
              <button
                type="button"
                onClick={async () => {
                  setActiveTab("simulador");
                  handleRunSimulation();
                }}
                className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition-all border-b-2 flex items-center gap-1.5 ${
                  activeTab === "simulador"
                    ? "border-emerald-600 text-emerald-700 bg-white shadow-sm"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <Sparkles size={14} className="text-emerald-500" />
                4. Simulador em Tempo Real
              </button>
            </div>

            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto bg-white flex-1 space-y-6">
                
                {/* ABA 1: Dados Básicos */}
                {activeTab === "basico" && (
                  <div className="space-y-6 animate-in fade-in">
                    {/* Seletor de Templates (Apenas Nova Rubrica) */}
                    {!editingId && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                          <Sparkles size={14} className="text-primary-600" />
                          Modelos Predefinidos (Acelere a Criação):
                        </label>
                        <div className="flex gap-2 flex-wrap">
                          {RUBRIC_TEMPLATES.map((tmpl) => (
                            <button
                              key={tmpl.id}
                              type="button"
                              onClick={() => applyTemplate(tmpl.id)}
                              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:border-primary-500 hover:text-primary-600 hover:bg-primary-50/30 transition-all text-left"
                            >
                              {tmpl.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                          Código <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: 150"
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none font-mono text-sm"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                          Nome da Rubrica <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ex: Adicional de Produtividade"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none font-bold text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                          Status do Ciclo
                        </label>
                        <select
                          value={status}
                          onChange={(e) => setStatus(e.target.value as any)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none text-sm font-semibold"
                        >
                          <option value="DRAFT">DRAFT (Rascunho)</option>
                          <option value="APPROVED">APPROVED (Aprovado)</option>
                          <option value="ACTIVE">ACTIVE (Ativo)</option>
                          <option value="RETIRED">RETIRED (Aposentado)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                        Descrição / Finalidade do Evento
                      </label>
                      <textarea
                        rows={2}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Explique a finalidade da rubrica para conformidade contábil..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                          Tipo Financeiro <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={type}
                          onChange={(e) => setType(e.target.value as any)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none text-sm font-bold"
                        >
                          <option value="EARNING">Provento (+) Acréscimo</option>
                          <option value="DEDUCTION">Desconto (-) Redução</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                          Tipo do Motor (rubric_kind) <span className="text-rose-500">*</span>
                        </label>
                        <select
                          required
                          value={rubricKind}
                          onChange={(e) => setRubricKind(e.target.value as any)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none font-semibold text-slate-800 text-sm"
                        >
                          <option value="SALARY_BASE">Salário Base (SALARY_BASE)</option>
                          <option value="OVERTIME">Hora Extra (OVERTIME)</option>
                          <option value="DSR">DSR s/ Horas e Comissões (DSR)</option>
                          <option value="DSR_NOTURNO">DSR s/ Adicional Noturno (DSR_NOTURNO)</option>
                          <option value="ADIC_NOTURNO">Adicional Noturno (ADIC_NOTURNO)</option>
                          <option value="INSALUBRIDADE">Insalubridade (INSALUBRIDADE)</option>
                          <option value="PERICULOSIDADE">Periculosidade (PERICULOSIDADE)</option>
                          <option value="COMMISSION">Comissão / Produção (COMMISSION)</option>
                          <option value="ABSENCE">Falta Injustificada (ABSENCE)</option>
                          <option value="LATE">Atraso / Saída (LATE)</option>
                          <option value="FAMILY_SALARY">Salário-Família (FAMILY_SALARY)</option>
                          <option value="ALIMONY">Pensão Alimentícia (ALIMONY)</option>
                          <option value="LOAN">Empréstimo Consignado (LOAN)</option>
                          <option value="UNION">Contribuição Sindical (UNION)</option>
                          <option value="ADVANCE">Adiantamento Salarial (ADVANCE)</option>
                          <option value="BENEFIT">Benefício VT/VR/Plano (BENEFIT)</option>
                          <option value="VACATION">Férias e 1/3 (VACATION)</option>
                          <option value="THIRTEENTH">13º Salário (THIRTEENTH)</option>
                          <option value="TERMINATION">Verba Rescisória (TERMINATION)</option>
                          <option value="OTHER">Outros Eventos (OTHER)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                          Vigência Inicial <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={validFrom}
                          onChange={(e) => setValidFrom(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                          Vigência Final (Opcional)
                        </label>
                        <input
                          type="date"
                          value={validTo}
                          onChange={(e) => setValidTo(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ABA 2: Motor de Cálculo */}
                {activeTab === "calculo" && (
                  <div className="space-y-6 animate-in fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                          Ordem de Processamento (DAG) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          required
                          min="1"
                          value={calculationOrder}
                          onChange={(e) => setCalculationOrder(e.target.value === "" ? "" : parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none text-sm"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">
                          Salários (10), Adicionais (20), Encargos/Impostos (50+).
                        </p>
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                          Forma de Apuração do Valor <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={calculationType}
                          onChange={(e) => setCalculationType(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none text-sm font-semibold"
                        >
                          <option value="FIXO">Valor Fixo ou Lançamento Manual no Mês</option>
                          <option value="PERCENTUAL">% Percentual sobre Base de Cálculo</option>
                          <option value="FORMULA">Fórmula Matemática Parametrizada</option>
                        </select>
                      </div>
                    </div>

                    {calculationType === "PERCENTUAL" && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                            Base de Cálculo Aplicada
                          </label>
                          <select
                            value={calculationBase}
                            onChange={(e) => setCalculationBase(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                          >
                            <option value="SALARY">Salário Base Contratual (SALARY)</option>
                            <option value="MINIMUM_WAGE">Salário Mínimo Nacional (MINIMUM_WAGE)</option>
                            <option value="BASE_HORA_EXTRA">Base Horas Extras (BASE_HORA_EXTRA)</option>
                            <option value="BASE_DSR">Base de DSR (BASE_DSR)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                            Alíquota / Percentual (%)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Ex: 20"
                            value={percentage}
                            onChange={(e) => setPercentage(e.target.value === "" ? "" : parseFloat(e.target.value))}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono"
                          />
                        </div>
                      </div>
                    )}

                    {calculationType === "FORMULA" && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                            Expressão da Fórmula (AST Parser Seguro)
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Ex: (SALARY / DIVISOR) * FACTOR * QUANTITY"
                            value={formula}
                            onChange={(e) => setFormula(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                            Variáveis Publicadas do Sistema (Clique para Inserir):
                          </label>
                          <div className="flex gap-1.5 flex-wrap">
                            {PUBLISHED_VARIABLES.map((v) => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => setFormula((prev) => (prev ? `${prev} * ${v}` : v))}
                                className="px-2 py-1 bg-white border border-slate-200 rounded text-[11px] font-mono text-slate-700 hover:border-primary-400 hover:text-primary-600 transition-colors"
                              >
                                {v}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                              Divisor Padrão
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="220"
                              value={divisor}
                              onChange={(e) => setDivisor(e.target.value === "" ? "" : parseFloat(e.target.value))}
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                              Fator Multiplicador
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="1.5"
                              value={factor}
                              onChange={(e) => setFactor(e.target.value === "" ? "" : parseFloat(e.target.value))}
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                              Quantidade Padrão
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="1"
                              value={quantity}
                              onChange={(e) => setQuantity(e.target.value === "" ? "" : parseFloat(e.target.value))}
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ABA 3: Tributação & Incidências */}
                {activeTab === "tributacao" && (
                  <div className="space-y-6 animate-in fade-in">
                    {/* Assistente de Natureza eSocial */}
                    <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                          <FileText size={18} className="text-blue-600" />
                          Assistente de Natureza eSocial (Tabela 03)
                        </div>
                        {esocialNature && getEsocialNatureSuggestion(esocialNature) && (
                          <button
                            type="button"
                            onClick={() => applyEsocialSuggestion(esocialNature)}
                            className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors flex items-center gap-1 shadow-sm"
                          >
                            <Sparkles size={13} />
                            Aplicar Sugestões do eSocial
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-blue-900 uppercase tracking-widest mb-1">
                            Código de Natureza (Tabela 03)
                          </label>
                          <select
                            value={esocialNature}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEsocialNature(val);
                              setEsocialCode(val);
                              if (val) applyEsocialSuggestion(val);
                            }}
                            className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm font-semibold text-slate-800"
                          >
                            <option value="">Selecione a natureza da rubrica...</option>
                            {Object.entries(ESOCIAL_NATURE_SUGGESTIONS).map(([k, item]) => (
                              <option key={k} value={k}>
                                {k} - {item.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-blue-900 uppercase tracking-widest mb-1">
                            Fundamentação Legal Recomendada
                          </label>
                          <input
                            type="text"
                            placeholder="Ex: CLT art. 457; Lei 10.101/2000"
                            value={legalBasis}
                            onChange={(e) => setLegalBasis(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm font-medium"
                          />
                        </div>
                      </div>

                      {esocialNature && getEsocialNatureSuggestion(esocialNature) && (
                        <div className="text-xs text-blue-800 bg-white/80 p-3 rounded-lg border border-blue-100">
                          <strong>Justificativa Legal:</strong> {getEsocialNatureSuggestion(esocialNature)?.justification}
                        </div>
                      )}
                    </div>

                    {/* Matriz de Incidências */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 pb-2 border-b">
                          Incidências de Tributos (Trabalhador)
                        </h4>
                        <div className="space-y-2">
                          <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={inss}
                              onChange={(e) => {
                                setInss(e.target.checked);
                                setGeneratesBaseInss(e.target.checked);
                              }}
                              className="w-4 h-4 text-primary-600 rounded"
                            />
                            <div>
                              <span className="text-sm font-bold text-slate-800">Incide INSS Empregado</span>
                              <p className="text-[11px] text-slate-500">Agrega à base de cálculo da tabela progressiva de INSS.</p>
                            </div>
                          </label>

                          <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={irrf}
                              onChange={(e) => {
                                setIrrf(e.target.checked);
                                setGeneratesBaseIrrf(e.target.checked);
                              }}
                              className="w-4 h-4 text-primary-600 rounded"
                            />
                            <div>
                              <span className="text-sm font-bold text-slate-800">Incide IRRF</span>
                              <p className="text-[11px] text-slate-500">Agrega ao rendimento tributável bruto para cálculo do imposto de renda.</p>
                            </div>
                          </label>

                          <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={fgts}
                              onChange={(e) => {
                                setFgts(e.target.checked);
                                setGeneratesBaseFgts(e.target.checked);
                              }}
                              className="w-4 h-4 text-primary-600 rounded"
                            />
                            <div>
                              <span className="text-sm font-bold text-slate-800">Incide FGTS (8%)</span>
                              <p className="text-[11px] text-slate-500">Agrega à base de depósito do Fundo de Garantia.</p>
                            </div>
                          </label>

                          <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={integraDsr}
                              onChange={(e) => setIntegraDsr(e.target.checked)}
                              className="w-4 h-4 text-primary-600 rounded"
                            />
                            <div>
                              <span className="text-sm font-bold text-slate-800">Gera Reflexo no DSR (BASE_DSR)</span>
                              <p className="text-[11px] text-slate-500">Horas extras e variáveis habituais (Súmula 172 TST).</p>
                            </div>
                          </label>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 pb-2 border-b">
                          Encargos Patronais (Empresa)
                        </h4>
                        <div className="space-y-2">
                          <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={incidenceInssPatronal}
                              onChange={(e) => setIncidenceInssPatronal(e.target.checked)}
                              className="w-4 h-4 text-primary-600 rounded"
                            />
                            <div>
                              <span className="text-sm font-bold text-slate-800">INSS Patronal (20%)</span>
                              <p className="text-[11px] text-slate-500">Contribuição previdenciária patronal ordinária.</p>
                            </div>
                          </label>

                          <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={incidenceRat}
                              onChange={(e) => setIncidenceRat(e.target.checked)}
                              className="w-4 h-4 text-primary-600 rounded"
                            />
                            <div>
                              <span className="text-sm font-bold text-slate-800">RAT / FAP Acidentário</span>
                              <p className="text-[11px] text-slate-500">Risco Ambiental do Trabalho ajustado pelo FAP.</p>
                            </div>
                          </label>

                          <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={incidenceThirdParties}
                              onChange={(e) => setIncidenceThirdParties(e.target.checked)}
                              className="w-4 h-4 text-primary-600 rounded"
                            />
                            <div>
                              <span className="text-sm font-bold text-slate-800">Outras Entidades (Terceiros / Sistema S)</span>
                              <p className="text-[11px] text-slate-500">SESI, SENAI, INCRA, Salário-Educação, etc.</p>
                            </div>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ABA 4: Simulador em Tempo Real */}
                {activeTab === "simulador" && (
                  <div className="space-y-6 animate-in fade-in">
                    <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-5">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                        <div>
                          <h4 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                            <Play size={16} className="text-emerald-600 fill-emerald-600" />
                            Simulador com Colaborador de Teste
                          </h4>
                          <p className="text-xs text-emerald-800 mt-0.5">
                            Validação visual imediata do impacto da rubrica nas bases e no salário líquido.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={handleRunSimulation}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-sm"
                        >
                          <Play size={14} className="fill-white" />
                          Calcular Simulação
                        </button>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-emerald-900 uppercase tracking-widest mb-1">
                            Salário Base de Teste
                          </label>
                          <input
                            type="number"
                            step="100"
                            value={simSalary}
                            onChange={(e) => setSimSalary(parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg text-sm font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-emerald-900 uppercase tracking-widest mb-1">
                            Divisor de Horas
                          </label>
                          <input
                            type="number"
                            value={simDivisor}
                            onChange={(e) => setSimDivisor(parseInt(e.target.value) || 220)}
                            className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg text-sm font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-emerald-900 uppercase tracking-widest mb-1">
                            Quantidade Lançada
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            value={simQuantity}
                            onChange={(e) => setSimQuantity(parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg text-sm font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-emerald-900 uppercase tracking-widest mb-1">
                            Fator / Multiplicador
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={simFactor}
                            onChange={(e) => setSimFactor(parseFloat(e.target.value) || 1)}
                            className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg text-sm font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Resultado da Simulação */}
                    {simResult && (
                      <div className="space-y-4">
                        {simResult.success ? (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                Valor Calculado do Evento
                              </span>
                              <p className="text-2xl font-black text-slate-900 mt-1">
                                R$ {simResult.calculatedAmount.toFixed(2).replace('.', ',')}
                              </p>
                              <span className="text-[11px] font-bold text-slate-500">
                                {type === "EARNING" ? "Provento (+)" : "Desconto (-)"}
                              </span>
                            </div>

                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                Impacto no Salário Líquido
                              </span>
                              <p
                                className={`text-2xl font-black mt-1 ${
                                  simResult.netImpact >= 0 ? "text-emerald-600" : "text-rose-600"
                                }`}
                              >
                                {simResult.netImpact >= 0 ? "+" : ""} R${" "}
                                {simResult.netImpact.toFixed(2).replace('.', ',')}
                              </p>
                              <span className="text-[11px] font-bold text-slate-500">
                                Variação direta em folha
                              </span>
                            </div>

                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                Bases Tributárias Afetadas
                              </span>
                              <div className="mt-2 space-y-1 text-xs font-semibold">
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Base INSS:</span>
                                  <span className="font-mono text-slate-900">
                                    R$ {simResult.taxImpact.inss.toFixed(2).replace('.', ',')}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Base IRRF:</span>
                                  <span className="font-mono text-slate-900">
                                    R$ {simResult.taxImpact.irrf.toFixed(2).replace('.', ',')}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Base FGTS:</span>
                                  <span className="font-mono text-slate-900">
                                    R$ {simResult.taxImpact.fgts.toFixed(2).replace('.', ',')}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="md:col-span-3 bg-slate-900 text-slate-100 rounded-xl p-4 font-mono text-xs">
                              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block mb-1">
                                Memória de Cálculo Auditável:
                              </span>
                              <pre className="whitespace-pre-wrap font-mono text-emerald-400">
                                {simResult.calculationMemory}
                              </pre>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
                            <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={20} />
                            <div>
                              <h5 className="text-sm font-bold text-rose-900">Falha na Avaliação da Simulação</h5>
                              <p className="text-xs text-rose-700 mt-1">{simResult.error}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex justify-between items-center shrink-0 rounded-b-2xl">
                <div>
                  {editingId && status === 'ACTIVE' && (
                    <button
                      type="button"
                      onClick={handleCreateNewVersion}
                      disabled={saving}
                      className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors flex items-center gap-1.5"
                    >
                      <History size={14} />
                      Criar Nova Versão (v{version + 1})
                    </button>
                  )}
                </div>

                <div className="flex gap-3">
                  {editingId && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={saving}
                      className="px-4 py-2 font-bold text-sm text-rose-600 hover:text-rose-900 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      Desativar
                    </button>
                  )}
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
                    <span>{editingId ? "Salvar Alterações" : "Criar e Ativar Rubrica"}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
