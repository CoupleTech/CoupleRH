import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Check,
  AlertTriangle,
  Save,
  Calculator,
  Search,
  Calendar,
  FileText,
  ChevronRight,
  X,
  DollarSign,
  Percent,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { generateTRCT, type TRCTResult } from "../../lib/trctEngine";
import { useCompany } from "../../contexts/CompanyContext";

export default function OffboardingWizard() {
  const navigate = useNavigate();
  const { selectedCompanyId } = useCompany();
  const [step, setStep] = useState(1);
  const [employees, setEmployees] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [showTRCT, setShowTRCT] = useState(false);
  const [noticeDate, setNoticeDate] = useState("");
  const [resignationDate, setResignationDate] = useState("");
  const [noticeType, setNoticeType] = useState<
    "worked" | "indemnified" | "waived" | "mixed"
  >("worked");
  const [resignationReason, setResignationReason] = useState("");
  const [mediasAdicionais, setMediasAdicionais] = useState<number>(0);
  const [trctResult, setTrctResult] = useState<TRCTResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const totalSteps = 4;

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase
        .from("employment_contracts")
        .select(
          `
          id,
          status,
          base_salary,
          admission_date,
          company_id,
          workers (
            people (
              full_name,
              cpf
            )
          ),
          positions (title)
        `,
        )
        .eq("status", "ACTIVE");

      if (data) setEmployees(data);
    }
    fetchData();
  }, []);

  const filteredEmployees = employees.filter((emp) => {
    if (selectedCompanyId && emp.company_id !== selectedCompanyId) return false;
    
    const name = emp.workers?.people?.full_name?.toLowerCase() || "";
    const cpf = emp.workers?.people?.cpf?.toLowerCase() || "";
    return (
      name.includes(searchTerm.toLowerCase()) ||
      cpf.includes(searchTerm.toLowerCase())
    );
  });

  const steps = [
    { number: 1, title: "Colaborador" },
    { number: 2, title: "Motivo e Datas" },
    { number: 3, title: "Aviso Prévio" },
    { number: 4, title: "Revisão" },
  ];

  const handleNext = () => {
    if (step === 1 && !selectedEmployee) {
      alert("Selecione um colaborador antes de prosseguir.");
      return;
    }
    if (step === 2 && (!resignationDate || !resignationReason)) {
      alert("Preencha o motivo e a data efetiva do desligamento.");
      return;
    }
    setStep((s) => s + 1);
  };

  const handleSimulate = () => {
    if (!selectedEmployee || !resignationDate) {
      alert("Preencha a Data Efetiva do Desligamento no Passo 2.");
      return;
    }
    const result = generateTRCT({
      baseSalary: selectedEmployee.base_salary,
      mediasAdicionais,
      admissionDate: selectedEmployee.admission_date,
      noticeDate: noticeDate || resignationDate,
      terminationDate: resignationDate,
      noticeType,
      reason: resignationReason,
    });
    setTrctResult(result);
    setShowTRCT(true);
  };

  const handleSaveTRCT = async () => {
    if (!selectedEmployee || !trctResult) return;
    setIsSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: tenantData } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", userData.user?.id)
        .single();

      if (tenantData) {
        // Map termination_reason to enum
        const reasonMap: Record<string, string> = {
          "1": "WITHOUT_JUST_CAUSE_BY_EMPLOYER",
          "2": "BY_EMPLOYEE",
          "3": "WITH_JUST_CAUSE_BY_EMPLOYER",
          "4": "CONTRACT_EXPIRATION",
          "5": "MUTUAL_AGREEMENT",
        };
        const reasonEnum = reasonMap[resignationReason] || "WITHOUT_JUST_CAUSE_BY_EMPLOYER";

        // Map noticeType to enum
        const noticeMap: Record<string, string> = {
          "worked": "WORKED",
          "indemnified": "INDEMNIFIED",
          "waived": "WAIVED",
          "mixed": "WORKED",
        };
        const noticeEnum = noticeMap[noticeType] || "WORKED";

        // Create termination record
        const { error: terminationError } = await supabase.from("terminations").insert({
          tenant_id: tenantData.tenant_id,
          contract_id: selectedEmployee.id,
          termination_reason: reasonEnum,
          notice_period_type: noticeEnum,
          notice_date: noticeDate || resignationDate,
          last_working_day: resignationDate,
          fgts_fine_percentage: (trctResult.encargos.percentualMulta * 100),
          status: "CALCULATED",
          calculated_trct: trctResult,
        });

        if (terminationError) throw terminationError;

        // Update contract status
        const { error: contractError } = await supabase
          .from("employment_contracts")
          .update({ status: noticeType === "worked" ? "NOTICE_PERIOD" : "TERMINATED" })
          .eq("id", selectedEmployee.id);

        if (contractError) throw contractError;

        alert("Rescisão calculada e salva com sucesso!");
        navigate("/desligamentos");
      }
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao salvar a rescisão: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="animate-fade-up max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate("/desligamentos")}
          className="btn-ghost p-2"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display">
            Novo Desligamento
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Siga o fluxo para calcular e registrar a rescisão no eSocial
          </p>
        </div>
      </div>

      {/* Stepper Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 rounded-full z-0"></div>
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-rose-600 rounded-full z-0 transition-all duration-300"
            style={{ width: `${((step - 1) / (totalSteps - 1)) * 100}%` }}
          ></div>

          {steps.map((s) => (
            <div
              key={s.number}
              className="relative z-10 flex flex-col items-center gap-2"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-colors
                ${
                  step > s.number
                    ? "bg-rose-600 border-rose-600 text-white"
                    : step === s.number
                      ? "bg-white border-rose-600 text-rose-600"
                      : "bg-white border-slate-300 text-slate-400"
                }
              `}
              >
                {step > s.number ? <Check size={18} /> : s.number}
              </div>
              <span
                className={`text-xs font-semibold absolute -bottom-6 w-32 text-center left-1/2 -translate-x-1/2
                ${step >= s.number ? "text-slate-800" : "text-slate-400"}`}
              >
                {s.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Form Area */}
      <div className="glass panel p-0 mt-12 min-h-[400px]">
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4">
              Selecione o Colaborador
            </h2>

            <div className="relative w-full mb-6">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar por nome ou CPF..."
                className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
              {filteredEmployees.map((emp) => {
                const name = emp.workers?.people?.full_name || "Desconhecido";
                const isSelected = selectedEmployee?.id === emp.id;

                return (
                  <div
                    key={emp.id}
                    onClick={() => setSelectedEmployee(emp)}
                    className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? "border-rose-500 bg-rose-50 ring-1 ring-rose-500"
                        : "border-slate-200 bg-white hover:border-rose-300 hover:bg-slate-50"
                    }`}
                  >
                    <div>
                      <p className="font-bold text-slate-900">{name}</p>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {emp.positions?.title || "Sem Cargo"}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="text-rose-600" size={24} />
                    )}
                  </div>
                );
              })}
              {filteredEmployees.length === 0 && (
                <p className="text-center text-slate-500 py-4">
                  Nenhum colaborador ativo encontrado.
                </p>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4">
              Motivo e Datas da Rescisão
            </h2>
            <div className="grid grid-cols-2 gap-6">
              <div className="col-span-2">
                <label className="input-label">
                  Motivo do Desligamento (Tabela eSocial)
                </label>
                <select
                  value={resignationReason}
                  onChange={(e) => {
                    setResignationReason(e.target.value);
                    if (e.target.value === "3" || e.target.value === "4")
                      setNoticeType("waived");
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                >
                  <option value="">Selecione o motivo...</option>
                  <option value="1">
                    Rescisão sem justa causa pelo empregador
                  </option>
                  <option value="2">Rescisão por pedido de demissão</option>
                  <option value="3">Rescisão por justa causa</option>
                  <option value="4">
                    Término de contrato por prazo determinado
                  </option>
                  <option value="5">
                    Rescisão por acordo entre as partes (Reforma Trabalhista)
                  </option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="input-label">
                  Médias Rescisórias (Comissões, H.E., Adicionais)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">
                    R$
                  </span>
                  <input
                    type="number"
                    value={mediasAdicionais || ""}
                    onChange={(e) =>
                      setMediasAdicionais(Number(e.target.value))
                    }
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg bg-slate-50 focus:ring-2 focus:ring-rose-500 outline-none"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <label className="input-label">
                  Data da Comunicação (Aviso)
                </label>
                <input
                  type="date"
                  value={noticeDate}
                  onChange={(e) => setNoticeDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>
              <div>
                <label className="input-label">
                  Data Efetiva do Desligamento
                </label>
                <input
                  type="date"
                  value={resignationDate}
                  onChange={(e) => setResignationDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4">
              Aviso Prévio
            </h2>
            <p className="text-sm text-slate-600 mb-4">
              Configure como será cumprido o aviso prévio do colaborador.
            </p>

            <div className="grid grid-cols-1 gap-4">
              {[
                {
                  id: "worked",
                  title: "Aviso Prévio Trabalhado",
                  desc: "O colaborador continuará trabalhando até o último dia efetivo.",
                },
                {
                  id: "indemnified",
                  title: "Aviso Prévio Indenizado (ou Descontado)",
                  desc: "Pode ser indenizado pelo empregador ou descontado em caso de pedido de demissão sem cumprimento.",
                },
                {
                  id: "waived",
                  title: "Aviso Prévio Dispensado/Não Aplicável",
                  desc: "Não haverá cumprimento nem desconto/indenização.",
                },
                {
                  id: "mixed",
                  title: "Aviso Prévio Misto",
                  desc: "Parte do aviso foi trabalhada e o restante será indenizado/descontado.",
                },
              ].map((opt) => {
                const isDisabled =
                  (resignationReason === "3" || resignationReason === "4") &&
                  opt.id !== "waived";
                return (
                  <label
                    key={opt.id}
                    className={`flex items-start gap-4 p-4 border rounded-xl transition-colors ${
                      isDisabled
                        ? "opacity-50 border-slate-100 bg-slate-50 cursor-not-allowed"
                        : "border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer"
                    }`}
                  >
                    <input
                      type="radio"
                      name="notice_type"
                      checked={noticeType === opt.id}
                      onChange={() => setNoticeType(opt.id as any)}
                      disabled={isDisabled}
                      className="mt-1 w-4 h-4 text-rose-600 focus:ring-rose-500"
                    />
                    <div>
                      <p className="font-semibold text-slate-800">
                        {opt.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">{opt.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-lg font-bold text-rose-700 border-b border-rose-100 pb-2 mb-4 flex items-center gap-2">
              <AlertTriangle size={20} /> Resumo do Desligamento
            </h2>
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-5 mb-6">
              <h3 className="font-bold text-rose-900 mb-4">
                Atenção aos Prazos (eSocial - S-2299)
              </h3>
              <ul className="list-disc list-inside text-sm text-rose-800 space-y-2">
                <li>
                  O desligamento deve ser enviado ao eSocial até o 10º dia
                  seguinte ou o dia do pagamento da rescisão.
                </li>
                <li>
                  O pagamento das verbas rescisórias vence em até 10 dias
                  contados a partir do término do contrato.
                </li>
              </ul>
            </div>

            <div className="p-4 border border-slate-200 rounded-xl bg-slate-50">
              <p className="text-sm font-semibold text-slate-800">
                Colaborador Selecionado:
              </p>
              <p className="text-slate-600 mb-2">
                {selectedEmployee?.workers?.people?.full_name}
              </p>

              <div className="mt-4 flex gap-4">
                <button
                  onClick={handleSimulate}
                  className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium shadow-sm hover:bg-slate-50 text-sm transition-colors"
                >
                  <Calculator size={16} /> Simular TRCT (Prévia)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={() => setStep(step - 1)}
          disabled={step === 1}
          className={`px-6 py-2.5 rounded-lg font-medium transition-colors ${step === 1 ? "opacity-0 cursor-default" : "text-slate-600 bg-white border border-slate-200 hover:bg-slate-50"}`}
        >
          Voltar
        </button>

        {step < totalSteps ? (
          <button
            onClick={handleNext}
            className="px-6 py-2.5 rounded-lg font-medium text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-sm"
          >
            Próximo Passo
          </button>
        ) : (
          <button
            onClick={() => navigate("/desligamentos")}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-white bg-rose-700 hover:bg-rose-800 transition-colors shadow-sm"
          >
            <Save size={18} />
            Confirmar Desligamento
          </button>
        )}
      </div>

      {/* TRCT Simulation Modal */}
      {showTRCT && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-500 rounded-lg">
                  <Calculator size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">
                    Simulação de TRCT
                  </h3>
                  <p className="text-xs text-slate-400">
                    Termo de Rescisão do Contrato de Trabalho
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTRCT(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
              <div className="mb-6 p-4 bg-white border border-slate-200 rounded-xl">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="block text-slate-500 font-medium text-xs uppercase tracking-wider mb-1">
                      Colaborador
                    </span>
                    <span className="font-bold text-slate-800">
                      {selectedEmployee?.workers?.people?.full_name}
                    </span>
                  </div>
                  <div>
                    <span className="block text-slate-500 font-medium text-xs uppercase tracking-wider mb-1">
                      Salário Base
                    </span>
                    <span className="font-bold text-slate-800">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(selectedEmployee?.base_salary || 3500)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2 text-sm uppercase tracking-wider">
                  <DollarSign size={16} className="text-emerald-600" />
                  Proventos (A Receber)
                </h4>
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-100">
                      <tr className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-700">
                          Saldo de Salário (
                          {trctResult?.proventos.saldoSalario.dias || 0} dias)
                        </td>
                        <td className="px-4 py-3 text-right text-slate-900 font-mono">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(
                            trctResult?.proventos.saldoSalario.valor || 0,
                          )}
                        </td>
                      </tr>
                      {trctResult?.proventos.avisoIndenizado.valor ? (
                        <tr className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-700">
                            Aviso Prévio Indenizado (
                            {trctResult.proventos.avisoIndenizado.dias} dias)
                          </td>
                          <td className="px-4 py-3 text-right text-slate-900 font-mono">
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(
                              trctResult.proventos.avisoIndenizado.valor,
                            )}
                          </td>
                        </tr>
                      ) : null}
                      <tr className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-700">
                          13º Salário Proporcional (
                          {trctResult?.proventos.decimoTerceiro.avos || 0}/12)
                        </td>
                        <td className="px-4 py-3 text-right text-slate-900 font-mono">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(
                            trctResult?.proventos.decimoTerceiro.valor || 0,
                          )}
                        </td>
                      </tr>
                      {trctResult?.proventos.decimoTerceiroAviso.valor ? (
                        <tr className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-700">
                            13º s/ Aviso Indenizado (
                            {trctResult.proventos.decimoTerceiroAviso.avos}/12)
                          </td>
                          <td className="px-4 py-3 text-right text-slate-900 font-mono">
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(
                              trctResult.proventos.decimoTerceiroAviso.valor,
                            )}
                          </td>
                        </tr>
                      ) : null}
                      <tr className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-700">
                          Férias Proporcionais (
                          {trctResult?.proventos.feriasProporcionais.avos || 0}
                          /12)
                        </td>
                        <td className="px-4 py-3 text-right text-slate-900 font-mono">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(
                            trctResult?.proventos.feriasProporcionais.valor ||
                              0,
                          )}
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-700">
                          1/3 de Férias
                        </td>
                        <td className="px-4 py-3 text-right text-slate-900 font-mono">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(
                            trctResult?.proventos.umTercoFerias.valor || 0,
                          )}
                        </td>
                      </tr>
                    </tbody>
                    <tfoot className="bg-emerald-50 border-t border-emerald-100">
                      <tr>
                        <td className="px-4 py-3 font-bold text-emerald-900">
                          Total de Proventos
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-700 font-mono">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(trctResult?.totais.bruto || 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2 mt-6 text-sm uppercase tracking-wider">
                  <Percent size={16} className="text-rose-600" />
                  Descontos
                </h4>
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-100">
                      {trctResult?.descontos.inssSaldo.valor ? (
                        <tr className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-700">
                            INSS s/ Saldo de Salário
                          </td>
                          <td className="px-4 py-3 text-right text-rose-600 font-mono">
                            -{" "}
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(trctResult.descontos.inssSaldo.valor)}
                          </td>
                        </tr>
                      ) : null}
                      {trctResult?.descontos.inssDecimo.valor ? (
                        <tr className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-700">
                            INSS s/ 13º Salário
                          </td>
                          <td className="px-4 py-3 text-right text-rose-600 font-mono">
                            -{" "}
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(trctResult.descontos.inssDecimo.valor)}
                          </td>
                        </tr>
                      ) : null}
                      {trctResult?.descontos.irrf.valor ? (
                        <tr className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-700">
                            IRRF s/ Verbas
                          </td>
                          <td className="px-4 py-3 text-right text-rose-600 font-mono">
                            -{" "}
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(trctResult.descontos.irrf.valor)}
                          </td>
                        </tr>
                      ) : null}
                      {trctResult?.descontos.avisoDescontado.valor ? (
                        <tr className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-700">
                            Desconto Aviso Prévio Não Cumprido
                          </td>
                          <td className="px-4 py-3 text-right text-rose-600 font-mono">
                            -{" "}
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(
                              trctResult.descontos.avisoDescontado.valor,
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                    <tfoot className="bg-rose-50 border-t border-rose-100">
                      <tr>
                        <td className="px-4 py-3 font-bold text-rose-900">
                          Total de Descontos
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-rose-700 font-mono">
                          -{" "}
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(trctResult?.totais.descontos || 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="space-y-4 mt-8 pt-6 border-t border-slate-200">
                <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2 text-sm uppercase tracking-wider">
                  <FileText size={16} className="text-blue-600" />
                  Encargos da Rescisão (FGTS)
                </h4>
                <div className="bg-slate-800 rounded-xl overflow-hidden shadow-inner">
                  <table className="w-full text-sm text-slate-300">
                    <tbody className="divide-y divide-slate-700/50">
                      <tr>
                        <td className="px-4 py-3 font-medium">
                          FGTS Mês da Rescisão (8%)
                        </td>
                        <td className="px-4 py-3 text-right text-blue-300 font-mono">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(trctResult?.encargos.fgtsMes || 0)}
                        </td>
                      </tr>
                      {trctResult?.encargos.fgtsAviso ? (
                        <tr>
                          <td className="px-4 py-3 font-medium">
                            FGTS s/ Aviso Indenizado
                          </td>
                          <td className="px-4 py-3 text-right text-blue-300 font-mono">
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(trctResult.encargos.fgtsAviso)}
                          </td>
                        </tr>
                      ) : null}
                      <tr>
                        <td className="px-4 py-3 font-medium">
                          FGTS s/ 13º Salário
                        </td>
                        <td className="px-4 py-3 text-right text-blue-300 font-mono">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(trctResult?.encargos.fgtsDecimo || 0)}
                        </td>
                      </tr>
                      {trctResult?.encargos.multaFGTS ? (
                        <tr className="bg-slate-700/30">
                          <td className="px-4 py-3 font-bold text-white">
                            Multa Rescisória (
                            {(
                              trctResult?.encargos.percentualMulta * 100
                            ).toFixed(0)}
                            %)
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-blue-400 font-mono">
                            {new Intl.NumberFormat("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            }).format(trctResult.encargos.multaFGTS)}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  A multa rescisória e os depósitos do mês são recolhidos via
                  guia GRRF/FGTS Digital e não compõem o valor líquido direto em
                  conta, exceto nos regimes de saque apropriados.
                </p>
              </div>
            </div>

            <div className="p-5 bg-slate-100 border-t border-slate-200 shrink-0">
              <div className="flex justify-between items-center mb-4">
                <span className="font-semibold text-slate-600 uppercase tracking-widest text-xs">
                  Valor Líquido da Rescisão
                </span>
                <span className="text-3xl font-black text-slate-900 font-mono">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(trctResult?.totais.liquido || 0)}
                </span>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowTRCT(false)}
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-lg font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Fechar Simulação
                </button>
                <button
                  onClick={handleSaveTRCT}
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-lg font-medium text-white bg-rose-600 hover:bg-rose-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? "Salvando..." : "Confirmar Desligamento"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
