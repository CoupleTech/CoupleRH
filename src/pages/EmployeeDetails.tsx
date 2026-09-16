import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  User,
  Briefcase,
  FileText,
  ShieldAlert,
  Loader2,
  Edit,
  History,
  X,
  Save,
  TrendingUp,
  Gift,
  Receipt,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { formatDate } from "../lib/dateUtils";
import EmployeeBenefitsTab from "./EmployeeBenefitsTab";
import EmployeeDeductionsTab from "./EmployeeDeductionsTab";
import EmployeeFixedEventsTab from "./EmployeeFixedEventsTab";

export default function EmployeeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "civis" | "contrato" | "prontuario" | "historico" | "beneficios" | "descontos" | "adicionais"
  >("civis");
  const [historyEvents, setHistoryEvents] = useState<any[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    fetchEmployee();
  }, [id]);

  const fetchEmployee = async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("employment_contracts")
      .select(
        `
        *,
        workers (
          esocial_matricula,
          people (*)
        ),
        departments (name),
        positions (title)
      `,
      )
      .eq("id", id)
      .single();

    if (!error && data) {
      setEmployee(data);
      setEditData(data.workers.people); // Pre-fill edit form

      const { data: histData } = await supabase
        .from("employment_contract_history")
        .select("*")
        .eq("employment_contract_id", id)
        .order("event_date", { ascending: false });

      if (histData) setHistoryEvents(histData);
    }
    setLoading(false);
  };

  const handleSaveEdit = async () => {
    setSavingEdit(true);
    const { error } = await supabase
      .from("people")
      .update({
        zip_code: editData.zip_code,
        street: editData.street,
        number: editData.number,
        complement: editData.complement,
        neighborhood: editData.neighborhood,
        city: editData.city,
        state: editData.state,
      })
      .eq("id", employee.workers.people.id);

    if (!error) {
      setShowEditModal(false);
      fetchEmployee();
    } else {
      alert("Erro ao salvar os dados.");
    }
    setSavingEdit(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center p-8 text-slate-500">
        Colaborador não encontrado.
      </div>
    );
  }

  const person = employee.workers?.people;
  const name = person?.full_name || "Desconhecido";

  return (
    <div className="animate-fade-up max-w-5xl mx-auto">
      {/* Header Profile */}
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate("/funcionarios")}
          className="btn-ghost p-2"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3 font-display">
            {name}
            <span
              className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-lg border 
              ${employee.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-rose-100 text-rose-800 border-rose-200"}
            `}
            >
              {employee.status === "ACTIVE" ? "Ativo" : "Inativo"}
            </span>
          </h1>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-1">
            Matrícula eSocial: {employee.workers?.esocial_matricula || "N/A"} •{" "}
            {employee.positions?.title || "Sem Cargo"}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-lg mb-8 w-fit">
        <button
          onClick={() => setActiveTab("civis")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === "civis" ? "bg-white shadow-sm text-primary-700 border border-slate-200" : "text-slate-600 hover:bg-slate-200/50"}`}
        >
          <User size={16} /> Dados Civis (Pessoa)
        </button>
        <button
          onClick={() => setActiveTab("contrato")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === "contrato" ? "bg-white shadow-sm text-primary-700 border border-slate-200" : "text-slate-600 hover:bg-slate-200/50"}`}
        >
          <Briefcase size={16} /> Vínculos e Contrato
        </button>
        <button
          onClick={() => setActiveTab("beneficios")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === "beneficios" ? "bg-white shadow-sm text-primary-700 border border-slate-200" : "text-slate-600 hover:bg-slate-200/50"}`}
        >
          <Gift size={16} /> Benefícios
        </button>
        <button
          onClick={() => setActiveTab("adicionais")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === "adicionais" ? "bg-white shadow-sm text-primary-700 border border-slate-200" : "text-slate-600 hover:bg-slate-200/50"}`}
        >
          <TrendingUp size={16} /> Adicionais / Fixos
        </button>
        <button
          onClick={() => setActiveTab("descontos")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === "descontos" ? "bg-white shadow-sm text-primary-700 border border-slate-200" : "text-slate-600 hover:bg-slate-200/50"}`}
        >
          <Receipt size={16} /> Descontos / Retenções
        </button>
        <button
          onClick={() => setActiveTab("prontuario")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === "prontuario" ? "bg-white shadow-sm text-primary-700 border border-slate-200" : "text-slate-600 hover:bg-slate-200/50"}`}
        >
          <FileText size={16} /> Prontuário / GED
        </button>
        <button
          onClick={() => setActiveTab("historico")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === "historico" ? "bg-white shadow-sm text-primary-700 border border-slate-200" : "text-slate-600 hover:bg-slate-200/50"}`}
        >
          <History size={16} /> Histórico / Linha do Tempo
        </button>
      </div>

      {/* Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {activeTab === "civis" && (
            <div className="space-y-6 animate-in fade-in">
              <div className="panel bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2 font-display">
                  Informações Pessoais
                </h2>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Nome Completo
                    </label>
                    <p className="font-medium text-slate-900 mt-1">
                      {person?.full_name}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Nome Social
                    </label>
                    <p className="font-medium text-slate-400 mt-1 italic">
                      {person?.social_name || "Não informado"}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      CPF
                    </label>
                    <p className="font-medium text-slate-900 mt-1">
                      {person?.cpf}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      RG
                    </label>
                    <p className="font-medium text-slate-900 mt-1">
                      {person?.rg || "-"}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Gênero
                    </label>
                    <p className="font-medium text-slate-900 mt-1">
                      {person?.gender || "-"}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Data de Nascimento
                    </label>
                    <p className="font-medium text-slate-900 mt-1">
                      {formatDate(person?.birth_date)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="panel bg-white p-6 rounded-lg shadow-sm border border-slate-200 relative">
                <button
                  onClick={() => setShowEditModal(true)}
                  className="absolute top-6 right-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary-600 hover:text-primary-800 transition-colors bg-primary-50 px-3 py-1.5 rounded-lg border border-primary-100"
                >
                  <Edit size={14} /> Editar Dados
                </button>
                <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2 font-display">
                  Endereço Residencial
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="lg:col-span-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      CEP
                    </label>
                    <p className="font-medium text-slate-900 mt-1">
                      {person?.zip_code || "-"}
                    </p>
                  </div>
                  <div className="lg:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Logradouro
                    </label>
                    <p className="font-medium text-slate-900 mt-1">
                      {person?.street || "-"}
                    </p>
                  </div>
                  <div className="lg:col-span-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Número
                    </label>
                    <p className="font-medium text-slate-900 mt-1">
                      {person?.number || "-"}
                    </p>
                  </div>
                  <div className="lg:col-span-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Complemento
                    </label>
                    <p className="font-medium text-slate-900 mt-1">
                      {person?.complement || "-"}
                    </p>
                  </div>
                  <div className="lg:col-span-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Bairro
                    </label>
                    <p className="font-medium text-slate-900 mt-1">
                      {person?.neighborhood || "-"}
                    </p>
                  </div>
                  <div className="lg:col-span-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Cidade
                    </label>
                    <p className="font-medium text-slate-900 mt-1">
                      {person?.city || "-"}
                    </p>
                  </div>
                  <div className="lg:col-span-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Estado
                    </label>
                    <p className="font-medium text-slate-900 mt-1">
                      {person?.state || "-"}
                    </p>
                  </div>
                  <div className="lg:col-span-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      País
                    </label>
                    <p className="font-medium text-slate-900 mt-1">
                      {person?.country || "-"}
                    </p>
                  </div>
                  <div className="lg:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Ponto de Referência
                    </label>
                    <p className="font-medium text-slate-900 mt-1">
                      {person?.reference_point || "-"}
                    </p>
                  </div>
                  <div className="lg:col-span-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Tipo de Residência
                    </label>
                    <p className="font-medium text-slate-900 mt-1">
                      {person?.residence_type || "-"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "contrato" && (
            <div className="space-y-6 animate-in fade-in">
              <div className="panel bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2 font-display">
                  Vínculo e Remuneração
                </h2>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Data de Admissão
                    </label>
                    <p className="font-medium text-slate-900 mt-1">
                      {formatDate(employee.admission_date)}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Departamento
                    </label>
                    <p className="font-medium text-slate-900 mt-1">
                      {employee.departments?.name || "-"}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Cargo
                    </label>
                    <p className="font-medium text-slate-900 mt-1">
                      {employee.positions?.title || "-"}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Salário Base
                    </label>
                    <p className="font-medium text-slate-900 mt-1">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(employee.base_salary)}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Carga Horária (Mensal)
                    </label>
                    <p className="font-medium text-slate-900 mt-1">
                      {employee.workload_hours
                        ? `${employee.workload_hours}h`
                        : "-"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "beneficios" && (
            <div className="animate-in fade-in">
              <EmployeeBenefitsTab contractId={employee.id} />
            </div>
          )}

          {activeTab === "adicionais" && (
            <div className="animate-in fade-in">
              <EmployeeFixedEventsTab contractId={employee.id} />
            </div>
          )}

          {activeTab === "descontos" && (
            <div className="animate-in fade-in">
              <EmployeeDeductionsTab contractId={employee.id} />
            </div>
          )}

          {activeTab === "prontuario" && (
            <div className="space-y-6 animate-in fade-in">
              <div className="panel bg-white p-6 rounded-lg shadow-sm border border-slate-200 text-center py-12">
                <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-slate-900 font-bold mb-1">
                  Nenhum documento anexado
                </h3>
                <p className="text-slate-500 text-sm">
                  Os arquivos e termos de admissão aparecerão aqui.
                </p>
              </div>
            </div>
          )}

          {activeTab === "historico" && (
            <div className="space-y-6 animate-in fade-in">
              <div className="panel bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2 font-display">
                  Linha do Tempo
                </h2>

                {historyEvents.length === 0 ? (
                  <p className="text-sm text-slate-500 italic text-center py-8">
                    Nenhum registro de movimentação encontrado para este
                    colaborador.
                  </p>
                ) : (
                  <div className="relative border-l border-slate-200 ml-4 space-y-8 pb-4">
                    {historyEvents.map((ev: any, idx: number) => (
                      <div key={ev.id} className="relative pl-8">
                        <div className="absolute -left-[21px] top-1 bg-white border-2 border-primary-500 rounded-full w-10 h-10 flex items-center justify-center text-primary-600 shadow-sm">
                          <TrendingUp size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            {formatDate(ev.event_date)}
                          </p>
                          <h4 className="text-sm font-bold text-slate-800 mt-1">
                            {ev.event_type === "SALARY" && "Alteração Salarial"}
                            {ev.event_type === "POSITION" &&
                              "Alteração de Cargo"}
                            {ev.event_type === "DEPARTMENT" &&
                              "Alteração de Departamento"}
                            {ev.event_type === "SHIFT" && "Alteração de Turno"}
                          </h4>
                          <div className="flex items-center gap-3 mt-2 text-sm">
                            <span className="text-slate-500 line-through decoration-slate-300">
                              {ev.event_type === "SALARY"
                                ? `R$ ${ev.old_value}`
                                : ev.old_value}
                            </span>
                            <ArrowLeft
                              size={14}
                              className="text-slate-300 rotate-180"
                            />
                            <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">
                              {ev.event_type === "SALARY"
                                ? `R$ ${ev.new_value}`
                                : ev.new_value}
                            </span>
                          </div>
                          {ev.reason && (
                            <p className="text-sm text-slate-500 mt-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                              {ev.reason}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 p-6 rounded-lg shadow-sm">
            <h2 className="text-[10px] font-bold text-amber-800 mb-2 flex items-center gap-2 uppercase tracking-widest">
              <ShieldAlert size={16} /> LGPD Status
            </h2>
            <p className="text-xs text-amber-700 leading-relaxed mb-4">
              Os dados civis expostos nesta tela são confidenciais e seu acesso
              está registrado em log de auditoria vinculado ao seu usuário.
            </p>
            <div className="bg-amber-100/50 rounded-lg p-3 text-[10px] uppercase tracking-widest font-bold text-amber-900 border border-amber-200/60">
              Último acesso: Agora
              <br />
              Registro ID: {id?.substring(0, 8)}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Edição (Popup) */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-xl overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Edit size={18} className="text-primary-600" />
                Editar Dados Civis
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">
                      Logradouro
                    </label>
                    <input
                      type="text"
                      value={editData.street || ""}
                      onChange={(e) =>
                        setEditData({ ...editData, street: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">
                      Número
                    </label>
                    <input
                      type="text"
                      value={editData.number || ""}
                      onChange={(e) =>
                        setEditData({ ...editData, number: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">
                      CEP
                    </label>
                    <input
                      type="text"
                      value={editData.zip_code || ""}
                      onChange={(e) =>
                        setEditData({ ...editData, zip_code: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">
                      Bairro
                    </label>
                    <input
                      type="text"
                      value={editData.neighborhood || ""}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          neighborhood: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 block">
                      Cidade / UF
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editData.city || ""}
                        onChange={(e) =>
                          setEditData({ ...editData, city: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                      />
                      <input
                        type="text"
                        value={editData.state || ""}
                        onChange={(e) =>
                          setEditData({ ...editData, state: e.target.value })
                        }
                        className="w-16 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none text-center uppercase"
                        maxLength={2}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-lg">
              <button
                onClick={() => setShowEditModal(false)}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="btn-primary"
              >
                {savingEdit ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Salvar Alterações</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
