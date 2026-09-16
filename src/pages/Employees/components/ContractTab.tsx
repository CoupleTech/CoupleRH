import { useState, useEffect } from "react";
import { Save, Loader2, AlertCircle, Briefcase } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../contexts/AuthContext";
import { useCompany } from "../../../contexts/CompanyContext";

export default function ContractTab({ workerId, contracts, onSaved }: any) {
  const { user } = useAuth();
  const { selectedCompanyId } = useCompany();
  const [loading, setLoading] = useState(false);
  const [fetchingAux, setFetchingAux] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const contract = contracts?.[0] || null;

  // Auxiliares para Selects
  const [departments, setDepartments] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [workplaces, setWorkplaces] = useState<any[]>([]);
  const [workSchedules, setWorkSchedules] = useState<any[]>([]);
  const [contractTypes, setContractTypes] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    workplace_id: "",
    department_id: "",
    position_id: "",
    work_schedule_id: "",
    contract_type_id: "",
    cost_center_id: "",
    admission_date: "",
    base_salary: "",
    status: "ACTIVE",
    receives_advance: true
  });

  useEffect(() => {
    if (selectedCompanyId) {
      fetchAuxiliaryData();
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    if (contract) {
      setFormData({
        workplace_id: contract.workplace_id || contract.establishment_id || "",
        department_id: contract.department_id || "",
        position_id: contract.position_id || "",
        work_schedule_id: contract.work_schedule_id || "",
        contract_type_id: contract.contract_type_id || "",
        cost_center_id: contract.cost_center_id || "",
        admission_date: contract.admission_date || "",
        base_salary: contract.base_salary ? String(contract.base_salary) : "",
        status: contract.status || "ACTIVE",
        receives_advance: contract.receives_advance ?? true
      });
    }
  }, [contract]);

  const fetchAuxiliaryData = async () => {
    setFetchingAux(true);
    try {
      const companyFilter = `company_id.eq.${selectedCompanyId},company_id.is.null`;

      const [depsRes, posRes, workpRes, schedRes, typeRes, costRes] = await Promise.all([
        supabase.from("departments").select("id, name").eq("company_id", selectedCompanyId).order("name"),
        supabase.from("positions").select("id, title").or(companyFilter).order("title"),
        supabase.from("workplaces").select("id, name").eq("company_id", selectedCompanyId).order("name"),
        supabase.from("work_schedules").select("id, name").or(companyFilter).order("name"),
        supabase.from("contract_types").select("id, name").or(companyFilter).order("name"),
        supabase.from("cost_centers").select("id, name, code").or(companyFilter).order("name"),
      ]);

      setDepartments(depsRes.data || []);
      setPositions(posRes.data || []);
      setWorkplaces(workpRes.data || []);
      setWorkSchedules(schedRes.data || []);
      setContractTypes(typeRes.data || []);
      setCostCenters(costRes.data || []);
    } catch (err) {
      console.error("Erro ao buscar dados auxiliares:", err);
    } finally {
      setFetchingAux(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCompanyId || !workerId) return;
    
    setErrorMsg("");
    setLoading(true);

    try {
      const { data: tenantData } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!tenantData) throw new Error("Tenant não encontrado");

      const payload = {
        tenant_id: tenantData.tenant_id,
        worker_id: workerId,
        company_id: selectedCompanyId,
        workplace_id: formData.workplace_id || null,
        department_id: formData.department_id || null,
        position_id: formData.position_id || null,
        work_schedule_id: formData.work_schedule_id || null,
        contract_type_id: formData.contract_type_id || null,
        cost_center_id: formData.cost_center_id || null,
        admission_date: formData.admission_date,
        base_salary: Number(formData.base_salary),
        status: formData.status,
        receives_advance: formData.receives_advance
      };

      if (contract) {
        // Atualiza contrato existente
        const { error } = await supabase
          .from("employment_contracts")
          .update(payload)
          .eq("id", contract.id);
          
        if (error) throw error;
      } else {
        // Cria novo contrato
        const { error } = await supabase
          .from("employment_contracts")
          .insert([payload]);

        if (error) throw error;
      }

      onSaved(); // Atualiza a tela inteira (Profile)

    } catch (err: any) {
      console.error("Erro ao salvar contrato:", err);
      setErrorMsg(err.message || "Ocorreu um erro ao salvar os dados.");
    } finally {
      setLoading(false);
    }
  };

  if (fetchingAux) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="text-red-500 mt-0.5" size={18} />
          <p className="text-sm text-red-700">{errorMsg}</p>
        </div>
      )}

      {/* Dados Principais do Contrato */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-6 pb-2 border-b border-slate-100">
          <Briefcase className="text-primary-500" size={18} />
          <h2 className="text-base font-semibold text-slate-800">Contrato de Trabalho</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Tipo de Contrato (Regra) <span className="text-red-500">*</span></label>
            <select
              required
              className="input"
              value={formData.contract_type_id}
              onChange={(e) => setFormData({ ...formData, contract_type_id: e.target.value })}
            >
              <option value="">Selecione...</option>
              {contractTypes.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Lotação / Local de Trabalho <span className="text-red-500">*</span></label>
            <select
              required
              className="input"
              value={formData.workplace_id}
              onChange={(e) => setFormData({ ...formData, workplace_id: e.target.value })}
            >
              <option value="">Selecione...</option>
              {workplaces.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Data de Admissão <span className="text-red-500">*</span></label>
            <input
              type="date"
              required
              className="input"
              value={formData.admission_date}
              onChange={(e) => setFormData({ ...formData, admission_date: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Status</label>
            <select
              className="input"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="ACTIVE">Ativo (Trabalhando)</option>
              <option value="VACATION">Férias</option>
              <option value="SUSPENDED">Afastado/Suspenso</option>
              <option value="INACTIVE">Inativo (Desligado)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Relacionamentos da Estrutura */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-6 pb-2 border-b border-slate-100">Estrutura e Pagamento</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Cargo <span className="text-red-500">*</span></label>
            <select
              required
              className="input"
              value={formData.position_id}
              onChange={(e) => setFormData({ ...formData, position_id: e.target.value })}
            >
              <option value="">Selecione...</option>
              {positions.map(item => (
                <option key={item.id} value={item.id}>{item.title}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Departamento / Setor <span className="text-red-500">*</span></label>
            <select
              required
              className="input"
              value={formData.department_id}
              onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
            >
              <option value="">Selecione...</option>
              {departments.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Jornada de Trabalho <span className="text-red-500">*</span></label>
            <select
              required
              className="input"
              value={formData.work_schedule_id}
              onChange={(e) => setFormData({ ...formData, work_schedule_id: e.target.value })}
            >
              <option value="">Selecione...</option>
              {workSchedules.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Centro de Custo</label>
            <select
              className="input"
              value={formData.cost_center_id}
              onChange={(e) => setFormData({ ...formData, cost_center_id: e.target.value })}
            >
              <option value="">Nenhum (Geral)</option>
              {costCenters.map(item => (
                <option key={item.id} value={item.id}>{item.code ? `${item.code} - ` : ''}{item.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium text-slate-700">Salário Base (Bruto) <span className="text-red-500">*</span></label>
            <div className="relative max-w-sm flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-500">
              <span className="pl-3 pr-2 text-slate-500 bg-slate-50 h-full flex items-center border-r border-slate-200">R$</span>
              <input
                type="number"
                step="0.01"
                required
                className="w-full py-2 px-3 focus:outline-none bg-transparent"
                placeholder="0.00"
                value={formData.base_salary}
                onChange={(e) => setFormData({ ...formData, base_salary: e.target.value })}
              />
            </div>
            {!contract && (
              <p className="text-[11px] text-slate-400 mt-1">Este salário criará o registro inicial no histórico do colaborador.</p>
            )}
          </div>
        </div>
        
        <div className="mt-6 mb-2 pb-6 border-b border-slate-100 flex items-start gap-3 bg-slate-50 p-4 rounded-lg border">
          <input
            type="checkbox"
            id="receivesAdvance"
            name="receivesAdvance"
            checked={formData.receives_advance}
            onChange={(e) => setFormData({ ...formData, receives_advance: e.target.checked })}
            className="w-5 h-5 text-primary-600 rounded border-slate-300 focus:ring-primary-500 mt-0.5"
          />
          <div>
            <label htmlFor="receivesAdvance" className="font-medium text-slate-900 cursor-pointer block">
              Recebe Adiantamento Quinzenal (Vale)
            </label>
            <p className="text-sm text-slate-500">
              Se marcado, este colaborador terá um adiantamento de 40% gerado automaticamente na folha de adiantamento.
            </p>
          </div>
        </div>
      </div>

    </form>
  );
}
