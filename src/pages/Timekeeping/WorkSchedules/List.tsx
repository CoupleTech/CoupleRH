import { useState, useEffect } from "react";
import { 
  Building2, 
  Search, 
  Plus, 
  Edit2, 
  Loader2,
  ChevronRight,
  Clock,
  Power,
  Trash2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useCompany } from "../../../contexts/CompanyContext";

interface WorkSchedule {
  id: string;
  name: string;
  weekly_hours: number;
  divisor: number;
  status: string;
  company_id: string | null;
  companies?: {
    corporate_name: string;
    trade_name: string | null;
  };
}

export default function WorkSchedulesList() {
  const navigate = useNavigate();
  const { selectedCompanyId } = useCompany();
  const [searchTerm, setSearchTerm] = useState("");
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSchedules();
  }, [selectedCompanyId]);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("work_schedules")
        .select(`
          id,
          name,
          weekly_hours,
          divisor,
          status,
          company_id,
          companies (
            corporate_name,
            trade_name
          )
        `);
        
      if (selectedCompanyId) {
        query = query.or(`company_id.eq.${selectedCompanyId},company_id.is.null`);
      }

      const { data, error } = await query.order("name", { ascending: true });

      if (error) throw error;
      setSchedules((data as any) || []);
    } catch (err) {
      console.error("Erro ao buscar jornadas:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const { error } = await supabase
      .from("work_schedules")
      .update({ status: newStatus })
      .eq("id", id);
      
    if (error) {
      alert("Erro ao alterar status.");
    } else {
      setSchedules(schedules.map(s => s.id === id ? { ...s, status: newStatus } : s));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Deseja realmente excluir esta jornada? Só será possível se não houver vínculos.")) return;
    
    const { error } = await supabase
      .from("work_schedules")
      .delete()
      .eq("id", id);
      
    if (error) {
      if (error.code === '23503') {
        alert("Não é possível excluir esta jornada pois ela está vinculada a um ou mais colaboradores.");
      } else {
        alert("Erro ao excluir jornada.");
      }
    } else {
      setSchedules(schedules.filter(s => s.id !== id));
    }
  };

  const filteredSchedules = schedules.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Clock size={16} />
            <span>Ponto e Escalas</span>
            <ChevronRight size={14} />
            <span className="text-slate-900 font-medium">Jornadas de Trabalho</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 font-display tracking-tight">Jornadas de Trabalho</h1>
          <p className="text-sm text-slate-500 mt-1">Configure as regras de carga horária e horários diários.</p>
        </div>
        
        <button 
          onClick={() => navigate('/jornadas/nova')}
          className="btn-primary"
        >
          <Plus size={18} />
          <span>Nova Jornada</span>
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por nome da jornada..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
          />
        </div>
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
          </div>
        ) : filteredSchedules.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Jornada</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Carga Semanal</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Divisor</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Empresa</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredSchedules.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center text-primary-600 shrink-0">
                          <Clock size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{item.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm text-slate-700">{item.weekly_hours}h</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm text-slate-700">{item.divisor}</span>
                    </td>
                    <td className="px-6 py-4">
                      {item.companies ? (
                        <span className="text-sm text-slate-600">
                          {item.companies.trade_name || item.companies.corporate_name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                          Geral
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                        item.status === 'ACTIVE' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        {item.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => navigate(`/jornadas/${item.id}`)}
                          className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors cursor-pointer"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleToggleStatus(item.id, item.status)}
                          className={`p-2 rounded-lg transition-colors cursor-pointer ${
                            item.status === 'ACTIVE' 
                              ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' 
                              : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={item.status === 'ACTIVE' ? "Inativar" : "Ativar"}
                        >
                          <Power size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(item.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
              <Clock className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">Nenhuma jornada encontrada</h3>
            <p className="text-slate-500 max-w-sm mb-6">
              {searchTerm 
                ? "Não encontramos nenhuma jornada correspondente à sua busca."
                : "Você ainda não cadastrou nenhuma jornada de trabalho. Comece criando a primeira!"}
            </p>
            {!searchTerm && (
              <button 
                onClick={() => navigate('/jornadas/nova')}
                className="btn-primary"
              >
                <Plus size={18} />
                <span>Criar Primeira Jornada</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
