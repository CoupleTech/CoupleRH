import { useState, useEffect } from "react";
import { 
  Search, 
  Plus, 
  Edit2, 
  Loader2,
  ChevronRight,
  CalendarDays,
  CalendarHeart,
  Power,
  Trash2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useCompany } from "../../../contexts/CompanyContext";
import { Pagination } from "../../../components/Pagination";

interface Holiday {
  id: string;
  name: string;
  date: string;
  type: string;
  status: string;
  company_id: string | null;
  companies?: {
    corporate_name: string;
    trade_name: string | null;
  };
}

const HOLIDAY_TYPES: Record<string, { label: string, color: string }> = {
  'NACIONAL': { label: 'Nacional', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  'ESTADUAL': { label: 'Estadual', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  'MUNICIPAL': { label: 'Municipal', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  'EMPRESA': { label: 'Empresa', color: 'bg-orange-50 text-orange-700 border-orange-200' },
};

export default function HolidaysList() {
  const navigate = useNavigate();
  const { selectedCompanyId } = useCompany();
  const [searchTerm, setSearchTerm] = useState("");
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Filtros de Mês/Ano
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  useEffect(() => {
    fetchHolidays();
  }, [selectedCompanyId, selectedYear]);

  const fetchHolidays = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("holidays")
        .select(`
          id,
          name,
          date,
          type,
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

      // Filtra pelo ano selecionado
      query = query
        .gte('date', `${selectedYear}-01-01`)
        .lte('date', `${selectedYear}-12-31`)
        .order("date", { ascending: true });

      const { data, error } = await query;

      if (error) throw error;
      setHolidays((data as any) || []);
    } catch (err) {
      console.error("Erro ao buscar feriados:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const { error } = await supabase
      .from("holidays")
      .update({ status: newStatus })
      .eq("id", id);
      
    if (error) {
      alert("Erro ao alterar status.");
    } else {
      setHolidays(holidays.map(h => h.id === id ? { ...h, status: newStatus } : h));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Deseja realmente excluir este feriado? Só será possível se não houver vínculos.")) return;
    
    const { error } = await supabase
      .from("holidays")
      .delete()
      .eq("id", id);
      
    if (error) {
      if (error.code === '23503') {
        alert("Não é possível excluir este feriado pois ele está vinculado a outros registros.");
      } else {
        alert("Erro ao excluir feriado.");
      }
    } else {
      setHolidays(holidays.filter(h => h.id !== id));
    }
  };

  const filteredHolidays = holidays.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredHolidays.length / pageSize);
  const paginatedHolidays = filteredHolidays.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <CalendarDays size={16} />
            <span>Ponto e Escalas</span>
            <ChevronRight size={14} />
            <span className="text-slate-900 font-medium">Feriados</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 font-display tracking-tight">Feriados e Recessos</h1>
          <p className="text-sm text-slate-500 mt-1">Gerencie os feriados nacionais, municipais e dias de folga da empresa.</p>
        </div>
        
        <button 
          onClick={() => navigate('/feriados/novo')}
          className="btn-primary"
        >
          <Plus size={18} />
          <span>Novo Feriado</span>
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nome do feriado..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
            />
          </div>
          
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="w-full sm:w-40 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
          >
            {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
          </div>
        ) : filteredHolidays.length > 0 ? (
          <>
            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Feriado</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Empresa</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedHolidays.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm text-slate-700">
                        {new Date(item.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center text-primary-600 shrink-0">
                          <CalendarHeart size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{item.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${HOLIDAY_TYPES[item.type]?.color || 'bg-slate-100 text-slate-700'}`}>
                        {HOLIDAY_TYPES[item.type]?.label || item.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {item.companies ? (
                        <span className="text-sm text-slate-600">
                          {item.companies.trade_name || item.companies.corporate_name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                          Todas (Geral)
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
                          onClick={() => navigate(`/feriados/${item.id}`)}
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
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredHolidays.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        </>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
              <CalendarHeart className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">Nenhum feriado encontrado</h3>
            <p className="text-slate-500 max-w-sm mb-6">
              {searchTerm 
                ? "Não encontramos nenhum feriado correspondente à sua busca."
                : `Você ainda não cadastrou nenhum feriado para ${selectedYear}.`}
            </p>
            {!searchTerm && (
              <button 
                onClick={() => navigate('/feriados/novo')}
                className="btn-primary"
              >
                <Plus size={18} />
                <span>Cadastrar Primeiro Feriado</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
