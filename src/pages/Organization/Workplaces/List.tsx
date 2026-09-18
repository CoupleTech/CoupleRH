import { useState, useEffect } from "react";
import { 
  Building2, 
  Search, 
  Plus, 
  Edit2, 
  Loader2,
  ChevronRight,
  MapPin,
  Power,
  Trash2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useCompany } from "../../../contexts/CompanyContext";
import { Pagination } from "../../../components/Pagination";
import { toast } from 'sonner';

interface Workplace {
  id: string;
  name: string;
  address: string | null;
  status: string;
  company_id: string;
  cost_center_id: string | null;
  companies: {
    corporate_name: string;
    trade_name: string | null;
  };
  cost_centers?: {
    name: string;
    code: string;
  };
}

export default function () {
  const navigate = useNavigate();
  const { selectedCompanyId } = useCompany();
  const [searchTerm, setSearchTerm] = useState("");
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    fetchWorkplaces();
  }, [selectedCompanyId]);

  const fetchWorkplaces = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("workplaces")
        .select(`
          id,
          name,
          address,
          status,
          company_id,
          cost_center_id,
          companies (
            corporate_name,
            trade_name
          ),
          cost_centers (
            name,
            code
          )
        `);
        
      if (selectedCompanyId) {
        query = query.eq("company_id", selectedCompanyId);
      }

      const { data, error } = await query.order("name", { ascending: true });

      if (error) throw error;
      setWorkplaces((data as any) || []);
    } catch (err) {
      console.error("Erro ao buscar lotações:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const { error } = await supabase
      .from("workplaces")
      .update({ status: newStatus })
      .eq("id", id);
      
    if (error) {
      toast.error("Erro ao alterar status.");
    } else {
      setWorkplaces(workplaces.map(w => w.id === id ? { ...w, status: newStatus } : w));
    }
  };

  const handleDelete = async (id: string) => {
    if (!await confirmDialog("Deseja realmente excluir esta lotação? Só será possível se não houver vínculos.")) return;
    
    const { error } = await supabase
      .from("workplaces")
      .delete()
      .eq("id", id);
      
    if (error) {
      if (error.code === '23503') {
        toast.error("Não é possível excluir esta lotação pois ela está vinculada a um ou mais colaboradores.");
      } else {
        toast.error("Erro ao excluir lotação.");
      }
    } else {
      setWorkplaces(workplaces.filter(w => w.id !== id));
    }
  };

  const filteredWorkplaces = workplaces.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.cost_centers?.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredWorkplaces.length / pageSize);
  const paginatedWorkplaces = filteredWorkplaces.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Building2 size={16} />
            <span>Organização</span>
            <ChevronRight size={14} />
            <span className="text-slate-900 font-medium">Lotações</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 font-display tracking-tight">Lotações / Locais</h1>
          <p className="text-sm text-slate-500 mt-1">Gerencie os locais de trabalho e lotações da empresa.</p>
        </div>
        
        <button 
          onClick={async () => navigate('/lotacoes/nova')}
          className="btn-primary"
        >
          <Plus size={18} />
          <span>Nova Lotação</span>
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por nome ou centro de custo..." 
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
        ) : filteredWorkplaces.length > 0 ? (
          <>
            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Lotação</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Centro de Custo</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Empresa</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedWorkplaces.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center text-primary-600 shrink-0">
                          <MapPin size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{item.name}</p>
                          {item.address && (
                            <p className="text-xs text-slate-500 line-clamp-1">{item.address}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {item.cost_centers ? (
                        <div>
                          <span className="text-sm text-slate-600 block">{item.cost_centers.name}</span>
                          <span className="text-xs text-slate-400 font-mono block">{item.cost_centers.code}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600">
                        {item.companies.trade_name || item.companies.corporate_name}
                      </span>
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
                          onClick={async () => navigate(`/lotacoes/${item.id}`)}
                          className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors cursor-pointer"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={async () => handleToggleStatus(item.id, item.status)}
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
                          onClick={async () => handleDelete(item.id)}
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
            totalItems={filteredWorkplaces.length}
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
              <MapPin className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">Nenhuma lotação encontrada</h3>
            <p className="text-slate-500 max-w-sm mb-6">
              {searchTerm 
                ? "Não encontramos nenhuma lotação correspondente à sua busca."
                : "Você ainda não cadastrou nenhuma lotação. Comece criando a primeira!"}
            </p>
            {!searchTerm && (
              <button 
                onClick={async () => navigate('/lotacoes/nova')}
                className="btn-primary"
              >
                <Plus size={18} />
                <span>Criar Primeira Lotação</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
