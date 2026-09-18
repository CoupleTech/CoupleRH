import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Check,
  Stethoscope,
  Save,
  Search,
  Upload,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { leaveService } from "../../services/leaveService";
import { toast } from 'sonner';

interface LeaveWizardProps {
  inline?: boolean;
  preselectedContractId?: string;
  onSaved?: () => void;
  onCancel?: () => void;
}

export default function LeaveWizard({ inline = false, preselectedContractId, onSaved, onCancel }: LeaveWizardProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [employees, setEmployees] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);

  const [leaveType, setLeaveType] = useState("");
  const [icdCode, setIcdCode] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  const totalSteps = 4;

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase
        .from("employment_contracts")
        .select(
          `
          id,
          status,
          tenant_id,
          workers (
            people (
              full_name,
              cpf
            )
          )
        `,
        )
        .eq("status", "ACTIVE");

      if (data) {
        setEmployees(data);
        if (preselectedContractId) {
          const emp = data.find((e: any) => e.id === preselectedContractId);
          if (emp) {
            setSelectedEmployee(emp);
            setStep(2);
          }
        }
      }
    }
    fetchData();
  }, [preselectedContractId]);

  const filteredEmployees = employees.filter((emp) => {
    const name = emp.workers?.people?.full_name?.toLowerCase() || "";
    const cpf = emp.workers?.people?.cpf?.toLowerCase() || "";
    return (
      name.includes(searchTerm.toLowerCase()) ||
      cpf.includes(searchTerm.toLowerCase())
    );
  });

  const steps = [
    { number: 1, title: "Colaborador" },
    { number: 2, title: "Motivo e Atestado" },
    { number: 3, title: "Período" },
    { number: 4, title: "Revisão" },
  ];

  const handleNext = () => {
    if (step === 1 && !selectedEmployee) {
      toast.error("Selecione um colaborador antes de prosseguir.");
      return;
    }
    if (step === 2 && !leaveType) {
      toast.error("Selecione o tipo de afastamento.");
      return;
    }
    if (step === 3 && !startDate) {
      toast.error("Informe a data de início do afastamento.");
      return;
    }
    setStep((s) => s + 1);
  };

  const getLeaveTypeName = (type: string) => {
    switch (type) {
      case "SICK_LEAVE":
        return "Atestado Médico (Doença)";
      case "MATERNITY":
        return "Licença Maternidade";
      case "PATERNITY":
        return "Licença Paternidade";
      case "WORK_ACCIDENT":
        return "Acidente de Trabalho";
      case "SUSPENSION":
        return "Suspensão Disciplinar";
      default:
        return "Outros";
    }
  };

  const calculateDays = () => {
    if (!startDate || !endDate) return 1;
    const diffTime = Math.abs(
      new Date(endDate).getTime() - new Date(startDate).getTime(),
    );
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await leaveService.createLeave({
        contract_id: selectedEmployee.id,
        tenant_id: selectedEmployee.tenant_id || (await supabase.auth.getUser()).data.user?.id, 
        leave_type: leaveType,
        icd_10_code: icdCode || null,
        start_date: startDate,
        end_date: endDate || null,
        return_date: endDate ? new Date(new Date(endDate).getTime() + 86400000).toISOString().split('T')[0] : null,
        status: "APPROVED",
      });
      if (!inline) {
        navigate("/afastamentos");
      }
      if (onSaved) onSaved();
    } catch (error) {
      console.error("Erro ao salvar afastamento:", error);
      toast.error("Ocorreu um erro ao salvar o afastamento.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`animate-fade-up max-w-4xl mx-auto ${inline ? '' : 'p-0'}`}>
      {!inline && (
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate("/afastamentos")}
            className="btn-ghost p-2"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 font-display">
              Registrar Afastamento
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Lançamento de atestados, licenças e comunicações ao eSocial (S-2230)
            </p>
          </div>
        </div>
      )}

      {/* Stepper Progress */}
      <div className={`mb-8 ${inline && step === 2 && preselectedContractId ? 'hidden' : ''}`}>
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 rounded-full z-0"></div>
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary-600 rounded-full z-0 transition-all duration-300"
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
                    ? "bg-primary-600 border-primary-600 text-white"
                    : step === s.number
                      ? "bg-white border-primary-600 text-primary-600"
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
      <div className="panel p-6 lg:p-8 mt-12 min-h-[400px]">
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
                className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
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
                        ? "border-primary-500 bg-primary-50 ring-1 ring-primary-500"
                        : "border-slate-200 bg-white hover:border-primary-300 hover:bg-slate-50"
                    }`}
                  >
                    <div>
                      <p className="font-bold text-slate-900">{name}</p>
                      <p className="text-sm text-slate-500 mt-0.5">Ativo</p>
                    </div>
                    {isSelected && (
                      <Check className="text-primary-600" size={24} />
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
              Motivo e Dados do Atestado
            </h2>

            <div className="grid grid-cols-2 gap-6">
              <div className="col-span-2">
                <label className="input-label">
                  Tipo de Afastamento / Licença
                </label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-900 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  <option value="SICK_LEAVE">
                    Atestado Médico (Doença não ocupacional)
                  </option>
                  <option value="WORK_ACCIDENT">Acidente de Trabalho</option>
                  <option value="MATERNITY">Licença Maternidade</option>
                  <option value="PATERNITY">Licença Paternidade</option>
                  <option value="SUSPENSION">Suspensão Disciplinar</option>
                </select>
              </div>

              {(leaveType === "SICK_LEAVE" ||
                leaveType === "WORK_ACCIDENT") && (
                <>
                  <div className="col-span-2">
                    <label className="input-label">
                      Código CID-10 (Opcional - Sigilo Médico)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Ex: J01.9"
                        className="w-32 px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 focus:ring-2 focus:ring-primary-500 outline-none uppercase"
                        value={icdCode}
                        onChange={(e) => setIcdCode(e.target.value)}
                      />
                      <div className="flex-1 text-xs text-slate-500 bg-amber-50 border border-amber-100 p-2 rounded-lg">
                        <strong>Atenção:</strong> A inserção do CID depende de
                        autorização do empregado. O gestor direto não terá
                        acesso a este campo, sendo restrito ao DP e Médico do
                        Trabalho (LGPD).
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 text-sm text-slate-500 mt-2">
                    <em>Nota: O atestado físico original deve ser arquivado na pasta do colaborador no RH, conforme regra padrão. Não é necessário anexo digital.</em>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4">
              Período de Afastamento
            </h2>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="input-label">Data de Início</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 focus:ring-2 focus:ring-primary-500 outline-none"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div>
                <label className="input-label">Data de Retorno Prevista</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 focus:ring-2 focus:ring-primary-500 outline-none"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {startDate && endDate && (
              <div className="mt-4 p-4 bg-primary-50 border border-primary-100 rounded-xl">
                <p className="text-primary-800 font-medium">
                  Total: <strong>{calculateDays()} dia(s)</strong> de
                  afastamento.
                </p>
                {leaveType === "SICK_LEAVE" && calculateDays() > 15 && (
                  <p className="text-xs text-rose-600 mt-2 font-bold">
                    Atestados superiores a 15 dias consecutivos pelo mesmo CID
                    requerem encaminhamento ao INSS e geram envio imediato do
                    evento S-2230 ao eSocial.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-lg font-bold text-emerald-700 border-b border-emerald-100 pb-2 mb-4 flex items-center gap-2">
              <Stethoscope size={20} /> Resumo do Afastamento
            </h2>

            <div className="p-5 border border-slate-200 rounded-xl bg-slate-50">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-500">
                    Colaborador
                  </p>
                  <p className="font-bold text-slate-800">
                    {selectedEmployee?.workers?.people?.full_name}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-500">Motivo</p>
                  <p className="font-bold text-slate-800">
                    {getLeaveTypeName(leaveType)}
                  </p>
                </div>
                <div className="mt-4">
                  <p className="text-sm font-semibold text-slate-500">
                    Período
                  </p>
                  <p className="font-bold text-primary-700">
                    {new Date(startDate).toLocaleDateString("pt-BR")} até{" "}
                    {new Date(endDate || startDate).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="mt-4">
                  <p className="text-sm font-semibold text-slate-500">
                    Sigilo Médico
                  </p>
                  <p className="font-bold text-slate-800">
                    {icdCode ? "CID Registrado" : "Sem CID"}
                  </p>
                </div>
              </div>
            </div>

            <p className="text-sm text-slate-600 mt-4 leading-relaxed">
              O lançamento de afastamentos pode alterar as regras de apuração do
              Ponto, paralisar períodos aquisitivos de férias (dependendo da
              quantidade de dias no ano) e suspender descontos de benefícios na
              folha.
            </p>
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between mt-6 border-t border-slate-100 pt-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep(step - 1)}
            disabled={step === (inline && preselectedContractId ? 2 : 1)}
            className={`btn-secondary ${step === (inline && preselectedContractId ? 2 : 1) ? "opacity-0 pointer-events-none" : ""}`}
          >
            Voltar
          </button>
          
          {inline && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium"
            >
              Cancelar
            </button>
          )}
        </div>

        {step < totalSteps ? (
          <button onClick={handleNext} className="btn-primary">
            Próximo Passo
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? (
              <span className="flex items-center gap-2">Gravando...</span>
            ) : (
              <>
                <Save size={18} />
                <span>Gravar Afastamento</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
