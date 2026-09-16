import { useState, useEffect } from "react";
import { ArrowLeft, TrendingUp, Loader2, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

interface MovementsProps {
  inline?: boolean;
  preselectedContractId?: string;
  onSaved?: () => void;
  onCancel?: () => void;
}

export default function Movements({ inline = false, preselectedContractId, onSaved, onCancel }: MovementsProps) {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  const [selectedEmployee, setSelectedEmployee] = useState(preselectedContractId || "");
  const [movementType, setMovementType] = useState("SALARY"); // SALARY, POSITION, DEPARTMENT, SHIFT
  const [newValue, setNewValue] = useState("");
  const [reason, setReason] = useState("");
  const [eventDate, setEventDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (preselectedContractId) {
      setSelectedEmployee(preselectedContractId);
    }
  }, [preselectedContractId]);

  const fetchData = async () => {
    setFetching(true);
    const [empRes, posRes, depRes] = await Promise.all([
      supabase
        .from("employment_contracts")
        .select(
          "id, base_salary, position_id, department_id, workers(people(full_name))",
        )
        .eq("status", "ACTIVE"),
      supabase.from("positions").select("id, title"),
      supabase.from("departments").select("id, name"),
    ]);

    if (empRes.data) setEmployees(empRes.data);
    if (posRes.data) setPositions(posRes.data);
    if (depRes.data) setDepartments(depRes.data);
    setFetching(false);
  };

  const getOldValue = () => {
    if (!selectedEmployee) return "";
    const emp = employees.find((e) => e.id === selectedEmployee);
    if (!emp) return "";

    if (movementType === "SALARY") return emp.base_salary;
    if (movementType === "POSITION") {
      const pos = positions.find((p) => p.id === emp.position_id);
      return pos ? pos.title : "Nenhum";
    }
    if (movementType === "DEPARTMENT") {
      const dep = departments.find((d) => d.id === emp.department_id);
      return dep ? dep.name : "Nenhum";
    }
    return "";
  };

  const handleSave = async () => {
    if (!selectedEmployee || !newValue || !reason) {
      alert(
        "Preencha todos os campos obrigatórios (Colaborador, Novo Valor, Motivo).",
      );
      return;
    }

    setLoading(true);

    // 1. Atualizar o cadastro principal
    const updatePayload: any = {};
    if (movementType === "SALARY") updatePayload.base_salary = Number(newValue);
    if (movementType === "POSITION") updatePayload.position_id = newValue;
    if (movementType === "DEPARTMENT") updatePayload.department_id = newValue;

    const { data: userData } = await supabase.auth.getUser();
    const { data: tenantData } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", userData.user?.id)
      .single();

    const { error: updateError } = await supabase
      .from("employment_contracts")
      .update(updatePayload)
      .eq("id", selectedEmployee);

    if (updateError) {
      alert("Erro ao atualizar dados do funcionário.");
      setLoading(false);
      return;
    }

    // 2. Inserir no histórico
    const { error: historyError } = await supabase
      .from("employment_contract_history")
      .insert({
        tenant_id: tenantData?.tenant_id,
        employment_contract_id: selectedEmployee,
        event_type: movementType,
        old_value: String(getOldValue()),
        new_value: newValue,
        reason,
        event_date: eventDate,
      });

    if (historyError) {
      console.error(historyError);
      alert(
        `Erro ao salvar histórico: ${historyError.message} - ${historyError.details}`,
      );
    } else {
      if (!inline) {
        alert("Movimentação registrada com sucesso!");
        setSelectedEmployee("");
      }
      setNewValue("");
      setReason("");
      fetchData(); // recarrega para ter os valores velhos atualizados
      if (onSaved) onSaved();
    }

    setLoading(false);
  };

  const typeLabels: Record<string, { icon: string; label: string }> = {
    SALARY: { icon: "💰", label: "Aumento Salarial" },
    POSITION: { icon: "📊", label: "Promoção / Troca de Cargo" },
    DEPARTMENT: { icon: "🏢", label: "Transferência de Departamento" },
    SHIFT: { icon: "🕐", label: "Troca de Turno" },
  };

  return (
    <div className={`animate-fade-up max-w-4xl mx-auto ${inline ? '' : 'p-0'}`}>
      {!inline && (
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate("/funcionarios")}
            className="btn-ghost p-2"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 font-display">
              Movimentação de Colaboradores
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Registre promoções, aumentos salariais e trocas de área
            </p>
          </div>
        </div>
      )}

      <div className={`panel ${inline ? 'border-none shadow-none bg-transparent' : 'p-0'}`}>
        {fetching ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="w-7 h-7 animate-spin text-primary-500" />
          </div>
        ) : (
          <div className="p-6 lg:p-8 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="sm:col-span-2">
                <label className="input-label">Selecione o Colaborador</label>
                <select
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="input"
                  disabled={inline && !!preselectedContractId}
                >
                  <option value="">Selecione...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.workers?.people?.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="input-label">Tipo de Movimentação</label>
                <select
                  value={movementType}
                  onChange={(e) => {
                    setMovementType(e.target.value);
                    setNewValue("");
                  }}
                  className="input"
                >
                  <option value="SALARY">Aumento Salarial</option>
                  <option value="POSITION">Promoção / Troca de Cargo</option>
                  <option value="DEPARTMENT">
                    Transferência de Departamento
                  </option>
                  <option value="SHIFT">Troca de Turno</option>
                </select>
              </div>

              <div>
                <label className="input-label">Data Efetiva</label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="input"
                />
              </div>
            </div>

            {selectedEmployee && (
              <div className="p-5 bg-primary-50/50 border border-primary-100 rounded-lg grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <p className="text-[11px] font-semibold text-primary-600 uppercase tracking-wider mb-1.5">
                    Valor/Status Atual
                  </p>
                  <p className="font-bold text-slate-900 font-display text-lg">
                    {movementType === "SALARY" && getOldValue()
                      ? `R$ ${Number(getOldValue()).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                      : getOldValue() || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Novo Valor/Status
                  </p>
                  {movementType === "SALARY" && (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                        R$
                      </span>
                      <input
                        type="number"
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        className="input pl-9"
                      />
                    </div>
                  )}
                  {movementType === "POSITION" && (
                    <select
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      className="input"
                    >
                      <option value="">Selecione o novo cargo...</option>
                      {positions.map((pos) => (
                        <option key={pos.id} value={pos.id}>
                          {pos.title}
                        </option>
                      ))}
                    </select>
                  )}
                  {movementType === "DEPARTMENT" && (
                    <select
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      className="input"
                    >
                      <option value="">Selecione o novo departamento...</option>
                      {departments.map((dep) => (
                        <option key={dep.id} value={dep.id}>
                          {dep.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {movementType === "SHIFT" && (
                    <input
                      type="text"
                      placeholder="Ex: Turno da Noite"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      className="input"
                    />
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="input-label">Motivo / Justificativa</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: Aumento por mérito após avaliação de desempenho..."
                className="input min-h-[100px] resize-y"
              />
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-6 gap-3">
              {inline && onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium"
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={loading}
                className="btn-primary"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Confirmar e Salvar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
