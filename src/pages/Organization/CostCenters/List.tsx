import { useState, useEffect } from "react";
import { 
  Building2, 
  Search, 
  Plus, 
  Edit2, 
  Loader2,
  ChevronRight,
  Landmark,
  Power,
  Trash2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useCompany } from "../../../contexts/CompanyContext";
import { Pagination } from "../../../components/Pagination";
import { toast } from 'sonner';
import { confirmDialog } from '../../../components/ConfirmDialogProvider';

interface CostCenter {
  id: string;
  code: string;
  name: string;
  status: string;
  company_id: string | null;
  companies?: {
    corporate_name: string;
    trade_name: string | null;
  };
}

export default function () {
  const navigate = useNavigate();
  const { selectedCompanyId } = useCompany();
  const [searchTerm, setSearchTerm] = useState("");
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    fetchCostCenters();
  }, [selectedCompanyId]);

  const fetchCostCenters = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("cost_centers")
        .select(`
          id,
          code,
          name,
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

      const { data, error } = await query.order("code", { ascending: true });

      if (error) throw error;
      setCostCenters((data as any) || []);
    } catch (err) {
      console.error("Erro ao buscar centros de custo:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const { error } = await supabase
      .from("cost_centers")
      .update({ status: newStatus })
      .eq("id", id);
      
    if (error) {
      toast.error("Erro ao alterar status.");
    } else {
      setCostCenters(costCenters.map(c => c.id === id ? { ...c, status: newStatus } : c));
    }
  };

  const handleDelete = async (id: string) => {
    if (!await confirmDialog("Deseja realmente excluir este centro de custo? Só será possível se não houver vínculos.")) return;
    
    const { error } = await supabase
      .from("cost_centers")
      .delete()
      .eq("id", id);
      
    if (error) {
      if (error.code === '23503') {
        toast.error("Não é possível excluir este centro de custo pois ele está vinculado a um ou mais colaboradores ou locais.");
      } else {
        toast.error("Erro ao excluir centro de custo.");
      }
    } else {
      setCostCenters(costCenters.filter(c => c.id !== id));
    }
  };

  const filteredCostCenters = costCenters.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredCostCenters.length / pageSize);
  const paginatedCostCenters = filteredCostCenters.slice(
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
            <span className="text-slate-900 font-medium">Centros de Custo</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 font-display tracking-tight">Centros de Custo</h1>
          <p className="text-sm text-slate-500 mt-1">Gerencie os centros de custo para rateio financeiro e contábil.</p>
        </div>
        
        <button 
          onClick={async () => navigate('/centros-de-custo/novo')}
          className="btn-primary"
        >
          <Plus size={18} />
          <span>Novo Centro de Custo</span>
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por nome ou código..." 
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
        ) : filteredCostCenters.length > 0 ? (
          <>
            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Centro de Custo</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Código</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Empresa</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedCostCenters.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center text-primary-600">
                          <Landmark size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{item.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm text-slate-700">{item.code}</span>
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
                          onClick={async () => navigate(`/centros-de-custo/${item.id}`)}
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
            totalItems={filteredCostCenters.length}
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
              <Landmark className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">Nenhum centro de custo encontrado</h3>
            <p className="text-slate-500 max-w-sm mb-6">
              {searchTerm 
                ? "Não encontramos nenhum centro de custo correspondente à sua busca."
                : "Você ainda não cadastrou nenhum centro de custo. Comece criando o primeiro!"}
            </p>
            {!searchTerm && (
              <button 
                onClick={async () => navigate('/centros-de-custo/novo')}
                className="btn-primary"
              >
                <Plus size={18} />
                <span>Criar Primeiro Centro de Custo</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
