import { useState, useEffect } from "react";
import { 
  Save, 
  ArrowLeft,
  Loader2,
  AlertCircle,
  Clock,
  CalendarDays
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../contexts/AuthContext";
import { useCompany } from "../../../contexts/CompanyContext";

interface Shift {
  day: number; // 0=Dom, 1=Seg...
  is_working_day: boolean;
  entry: string;
  interval_start: string;
  interval_end: string;
  exit: string;
}

const DEFAULT_SHIFTS: Shift[] = [
  { day: 1, is_working_day: true, entry: "08:00", interval_start: "12:00", interval_end: "13:00", exit: "17:00" }, // Seg
  { day: 2, is_working_day: true, entry: "08:00", interval_start: "12:00", interval_end: "13:00", exit: "17:00" }, // Ter
  { day: 3, is_working_day: true, entry: "08:00", interval_start: "12:00", interval_end: "13:00", exit: "17:00" }, // Qua
  { day: 4, is_working_day: true, entry: "08:00", interval_start: "12:00", interval_end: "13:00", exit: "17:00" }, // Qui
  { day: 5, is_working_day: true, entry: "08:00", interval_start: "12:00", interval_end: "13:00", exit: "17:00" }, // Sex
  { day: 6, is_working_day: false, entry: "", interval_start: "", interval_end: "", exit: "" }, // Sab
  { day: 0, is_working_day: false, entry: "", interval_start: "", interval_end: "", exit: "" }, // Dom
];

const DAYS_NAMES = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

export default function WorkScheduleForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedCompanyId, companies } = useCompany();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!id);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [formData, setFormData] = useState({
    company_id: selectedCompanyId || "",
    name: "",
    weekly_hours: 44,
    monthly_hours: 220,
    standard_tolerance: 10,
    divisor: 220,
    status: "ACTIVE"
  });

  const [shifts, setShifts] = useState<Shift[]>(DEFAULT_SHIFTS);

  useEffect(() => {
    if (id) {
      fetchSchedule();
    }
  }, [id]);

  const fetchSchedule = async () => {
    try {
      const { data, error } = await supabase
        .from("work_schedules")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      if (data) {
        setFormData({
          company_id: data.company_id || "",
          name: data.name,
          weekly_hours: Number(data.weekly_hours),
          monthly_hours: Number(data.monthly_hours),
          standard_tolerance: data.standard_tolerance,
          divisor: data.divisor,
          status: data.status
        });
        
        if (data.shifts && Array.isArray(data.shifts) && data.shifts.length > 0) {
          // Garante a ordem correta para exibição (Seg a Dom)
          const sortedShifts = [...data.shifts].sort((a, b) => {
            const getOrder = (day: number) => day === 0 ? 7 : day;
            return getOrder(a.day) - getOrder(b.day);
          });
          setShifts(sortedShifts);
        }
      }
    } catch (err) {
      console.error("Erro ao buscar jornada:", err);
      setErrorMsg("Não foi possível carregar os dados da jornada.");
    } finally {
      setFetching(false);
    }
  };

  const updateShift = (index: number, field: keyof Shift, value: any) => {
    const newShifts = [...shifts];
    newShifts[index] = { ...newShifts[index], [field]: value };
    setShifts(newShifts);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
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
        company_id: formData.company_id || null, // null se for geral
        name: formData.name,
        weekly_hours: formData.weekly_hours,
        monthly_hours: formData.monthly_hours,
        standard_tolerance: formData.standard_tolerance,
        divisor: formData.divisor,
        shifts: shifts,
        status: formData.status,
      };

      if (id) {
        const { error } = await supabase
          .from("work_schedules")
          .update(payload)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("work_schedules")
          .insert([payload]);
        if (error) throw error;
      }

      navigate("/jornadas");
    } catch (err: any) {
      console.error("Erro ao salvar jornada:", err);
      setErrorMsg(err.message || "Ocorreu um erro ao salvar a jornada.");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/jornadas')}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-display tracking-tight">
            {id ? 'Editar Jornada' : 'Nova Jornada'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure as regras e horários de trabalho.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="text-red-500 mt-0.5" size={18} />
          <p className="text-sm text-red-700">{errorMsg}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* PARTE 1: Configurações Gerais */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-6 pb-2 border-b border-slate-100">
            <Clock className="text-primary-500" size={18} />
            <h2 className="text-base font-semibold text-slate-800">Regras da Jornada</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-1.5 md:col-span-3">
              <label className="text-sm font-medium text-slate-700">
                Empresa Vinculada
              </label>
              <select
                className="input"
                value={formData.company_id}
                onChange={(e) =>
                  setFormData({ ...formData, company_id: e.target.value })
                }
              >
                <option value="">Geral (Todas as empresas)</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.trade_name || c.corporate_name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">
                Se for uma jornada padrão (ex: CLT Administrativo) aplicável a todas as filiais, deixe como "Geral".
              </p>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">
                Nome da Jornada <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Comercial 44h (Seg a Sáb)"
                className="input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Status</label>
              <select
                className="input"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                Horas Semanais <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  required
                  className="input pr-8"
                  value={formData.weekly_hours}
                  onChange={(e) => setFormData({ ...formData, weekly_hours: Number(e.target.value) })}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">h</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                Horas Mensais (Referência) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  required
                  className="input pr-8"
                  value={formData.monthly_hours}
                  onChange={(e) => setFormData({ ...formData, monthly_hours: Number(e.target.value) })}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">h</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                Divisor (Cálculo de Hora) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                className="input"
                value={formData.divisor}
                onChange={(e) => setFormData({ ...formData, divisor: Number(e.target.value) })}
              />
              <p className="text-[11px] text-slate-400">Padrão: 220 para 44h sem.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                Tolerância de Ponto (Minutos) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  required
                  className="input pr-12"
                  value={formData.standard_tolerance}
                  onChange={(e) => setFormData({ ...formData, standard_tolerance: Number(e.target.value) })}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">min</span>
              </div>
              <p className="text-[11px] text-slate-400">Limites art. 58 CLT (ex: 10 min diários)</p>
            </div>
          </div>
        </div>

        {/* PARTE 2: Horários Diários */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <CalendarDays className="text-primary-500" size={18} />
              <h2 className="text-base font-semibold text-slate-800">Grade de Horários Diários</h2>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Dia da Semana</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 text-center">Trabalho?</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Entrada</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Saída Intervalo</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Retorno Intervalo</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500">Saída</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shifts.map((shift, index) => (
                  <tr key={index} className={`transition-colors ${!shift.is_working_day ? 'bg-slate-50' : 'bg-white'}`}>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium ${!shift.is_working_day ? 'text-slate-400' : 'text-slate-800'}`}>
                        {DAYS_NAMES[shift.day]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input 
                        type="checkbox"
                        className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-600"
                        checked={shift.is_working_day}
                        onChange={(e) => updateShift(index, 'is_working_day', e.target.checked)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="time"
                        className="input py-1.5 text-sm"
                        disabled={!shift.is_working_day}
                        value={shift.entry}
                        onChange={(e) => updateShift(index, 'entry', e.target.value)}
                        required={shift.is_working_day}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="time"
                        className="input py-1.5 text-sm"
                        disabled={!shift.is_working_day}
                        value={shift.interval_start}
                        onChange={(e) => updateShift(index, 'interval_start', e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="time"
                        className="input py-1.5 text-sm"
                        disabled={!shift.is_working_day}
                        value={shift.interval_end}
                        onChange={(e) => updateShift(index, 'interval_end', e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="time"
                        className="input py-1.5 text-sm"
                        disabled={!shift.is_working_day}
                        value={shift.exit}
                        onChange={(e) => updateShift(index, 'exit', e.target.value)}
                        required={shift.is_working_day}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/jornadas')}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
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
            <span>{id ? 'Salvar Alterações' : 'Cadastrar Jornada'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
