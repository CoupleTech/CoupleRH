import { useState, useEffect } from "react";
import { Plus, Save, Loader2, AlertCircle, Clock, CalendarDays, X } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../contexts/AuthContext";
import { useCompany } from "../../../contexts/CompanyContext";

export default function ScaleTab({ contractId, scales = [], onSaved }: any) {
  const { user } = useAuth();
  const { selectedCompanyId } = useCompany();
  
  const [loading, setLoading] = useState(false);
  const [fetchingAux, setFetchingAux] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  
  const [workSchedules, setWorkSchedules] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    work_schedule_id: "",
    cycle_type: "WEEKLY",
    worked_days: "",
    free_days: "",
    weekly_schedule: [1, 2, 3, 4, 5], // Padrão: Seg a Sex
    start_date: "",
    end_date: ""
  });

  const DAYS_OF_WEEK = [
    { value: 0, label: "Dom" },
    { value: 1, label: "Seg" },
    { value: 2, label: "Ter" },
    { value: 3, label: "Qua" },
    { value: 4, label: "Qui" },
    { value: 5, label: "Sex" },
    { value: 6, label: "Sáb" }
  ];

  useEffect(() => {
    if (selectedCompanyId && isAdding) {
      fetchAuxiliaryData();
    }
  }, [selectedCompanyId, isAdding]);

  const fetchAuxiliaryData = async () => {
    setFetchingAux(true);
    try {
      const companyFilter = `company_id.eq.${selectedCompanyId},company_id.is.null`;
      const { data, error } = await supabase
        .from("work_schedules")
        .select("id, name")
        .or(companyFilter)
        .order("name");

      if (error) throw error;
      setWorkSchedules(data || []);
    } catch (err) {
      console.error("Erro ao buscar work_schedules:", err);
    } finally {
      setFetchingAux(false);
    }
  };

  const handleDayToggle = (dayValue: number) => {
    setFormData(prev => {
      const current = prev.weekly_schedule;
      if (current.includes(dayValue)) {
        return { ...prev, weekly_schedule: current.filter(d => d !== dayValue) };
      } else {
        return { ...prev, weekly_schedule: [...current, dayValue].sort() };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCompanyId || !contractId) return;
    
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
        contract_id: contractId,
        work_schedule_id: formData.work_schedule_id,
        cycle_type: formData.cycle_type,
        worked_days: ['12X36', '24X48', 'CUSTOM'].includes(formData.cycle_type) ? (Number(formData.worked_days) || null) : null,
        free_days: ['12X36', '24X48', 'CUSTOM'].includes(formData.cycle_type) ? (Number(formData.free_days) || null) : null,
        weekly_schedule: formData.cycle_type === 'WEEKLY' ? formData.weekly_schedule : null,
        start_date: formData.start_date,
        end_date: formData.end_date || null
      };

      const { error } = await supabase
        .from("employee_scales")
        .insert([payload]);

      if (error) throw error;

      setIsAdding(false);
      onSaved();

    } catch (err: any) {
      console.error("Erro ao salvar escala:", err);
      setErrorMsg(err.message || "Ocorreu um erro ao salvar os dados.");
    } finally {
      setLoading(false);
    }
  };

  if (!contractId) {
    return (
      <div className="card p-8 flex flex-col items-center justify-center text-center">
        <Clock className="w-12 h-12 text-slate-300 mb-4" />
        <h3 className="text-lg font-medium text-slate-800 mb-2">Contrato Ausente</h3>
        <p className="text-slate-500 max-w-md">
          Para definir escalas, você precisa primeiro salvar os dados de Contrato e Vínculo deste empregado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Listagem de Escalas Atuais */}
      {!isAdding && (
        <div className="card p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-base font-semibold text-slate-800">Histórico de Escalas</h2>
            <button
              onClick={() => setIsAdding(true)}
              className="btn-primary py-1.5 px-3 text-sm"
            >
              <Plus size={16} />
              Nova Escala
            </button>
          </div>

          {scales.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl">
              <CalendarDays className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Nenhuma escala cadastrada.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="pb-3 font-medium">Início</th>
                    <th className="pb-3 font-medium">Fim</th>
                    <th className="pb-3 font-medium">Ciclo</th>
                    <th className="pb-3 font-medium">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scales.map((s: any) => (
                    <tr key={s.id} className="text-slate-700">
                      <td className="py-3">
                        {new Date(s.start_date).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-3">
                        {s.end_date ? new Date(s.end_date).toLocaleDateString('pt-BR') : 'Até o momento'}
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-medium">
                          {s.cycle_type === 'WEEKLY' ? 'Semanal' : 
                           s.cycle_type === 'CUSTOM' ? 'Personalizado' : 
                           s.cycle_type}
                        </span>
                      </td>
                      <td className="py-3">
                        {s.cycle_type === 'WEEKLY' ? (
                          <span>Dias da semana: {s.weekly_schedule?.map((d: any) => {
                            const dayObj = DAYS_OF_WEEK.find(dw => dw.value === Number(d));
                            return dayObj ? dayObj.label : d;
                          }).join(', ')}</span>
                        ) : (
                          <span>Trabalha {s.worked_days} dia(s) / Folga {s.free_days} dia(s)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Formulário de Adição */}
      {isAdding && (
        <div className="card p-6 border-l-4 border-l-primary-500">
          <div className="flex justify-between items-center mb-6 pb-2 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-800">Nova Escala</h2>
            <button
              onClick={() => setIsAdding(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </button>
          </div>

          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="text-red-500 mt-0.5" size={18} />
              <p className="text-sm text-red-700">{errorMsg}</p>
            </div>
          )}

          {fetchingAux ? (
            <div className="flex justify-center p-6">
              <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Jornada de Trabalho (Base) <span className="text-red-500">*</span></label>
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
                  <label className="text-sm font-medium text-slate-700">Tipo de Ciclo <span className="text-red-500">*</span></label>
                  <select
                    required
                    className="input"
                    value={formData.cycle_type}
                    onChange={(e) => setFormData({ ...formData, cycle_type: e.target.value })}
                  >
                    <option value="WEEKLY">Semanal Fixo (Dias marcados)</option>
                    <option value="12X36">12x36 (Trabalha 1, folga 1)</option>
                    <option value="24X48">24x48 (Trabalha 1, folga 2)</option>
                    <option value="CUSTOM">Personalizado</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Data de Início (Vigência) <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    required
                    className="input"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>

                {formData.cycle_type === 'WEEKLY' ? (
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-sm font-medium text-slate-700">Dias Trabalhados <span className="text-red-500">*</span></label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {DAYS_OF_WEEK.map(day => {
                        const isSelected = formData.weekly_schedule.includes(day.value);
                        return (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => handleDayToggle(day.value)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              isSelected 
                                ? 'bg-primary-500 text-white' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Dias Trabalhados (Ciclo)</label>
                      <input
                        type="number"
                        min="1"
                        className="input"
                        placeholder="Ex: 1"
                        value={formData.worked_days}
                        onChange={(e) => setFormData({ ...formData, worked_days: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-700">Dias de Folga (Ciclo)</label>
                      <input
                        type="number"
                        min="1"
                        className="input"
                        placeholder="Ex: 1"
                        value={formData.free_days}
                        onChange={(e) => setFormData({ ...formData, free_days: e.target.value })}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Save size={18} />
                    )}
                    <span>Salvar Escala</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
