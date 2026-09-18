import { useState, useEffect } from "react";
import { 
  Building2, 
  Search, 
  Plus, 
  Edit2, 
  Loader2,
  ChevronRight,
  FileText,
  Check,
  X,
  Power,
  Trash2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useCompany } from "../../../contexts/CompanyContext";
import { Pagination } from "../../../components/Pagination";
import { toast } from 'sonner';
import { confirmDialog } from '..\..\..\components\ConfirmDialogProvider';

interface ContractType {
  id: string;
  name: string;
  category: string;
  term_type: string;
  default_days: number | null;
  has_fgts: boolean;
  has_13th: boolean;
  has_vacation: boolean;
  status: string;
  company_id: string | null;
  companies?: {
    corporate_name: string;
    trade_name: string | null;
  };
}

const CATEGORY_COLORS: Record<string, string> = {
  'CLT': 'bg-blue-50 text-blue-700 border-blue-200',
  'ESTAGIO': 'bg-purple-50 text-purple-700 border-purple-200',
  'APRENDIZ': 'bg-pink-50 text-pink-700 border-pink-200',
  'TEMPORARIO': 'bg-amber-50 text-amber-700 border-amber-200',
  'PJ': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'OUTROS': 'bg-slate-50 text-slate-700 border-slate-200',
};

export default function () {
  const navigate = useNavigate();
  const { selectedCompanyId } = useCompany();
  const [searchTerm, setSearchTerm] = useState("");
  const [contractTypes, setContractTypes] = useState<ContractType[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    fetchContractTypes();
  }, [selectedCompanyId]);

  const fetchContractTypes = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("contract_types")
        .select(`
          *,
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
      setContractTypes((data as any) || []);
    } catch (err) {
      console.error("Erro ao buscar tipos de contrato:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const { error } = await supabase
      .from("contract_types")
      .update({ status: newStatus })
      .eq("id", id);
      
    if (error) {
      toast.error("Erro ao alterar status.");
    } else {
      setContractTypes(contractTypes.map(c => c.id === id ? { ...c, status: newStatus } : c));
    }
  };

  const handleDelete = async (id: string) => {
    if (!await confirmDialog("Deseja realmente excluir este tipo de contrato? Só será possível se não houver vínculos.")) return;
    
    const { error } = await supabase
      .from("contract_types")
      .delete()
      .eq("id", id);
      
    if (error) {
      if (error.code === '23503') {
        toast.error("Não é possível excluir este tipo de contrato pois ele está vinculado a um ou mais colaboradores.");
      } else {
        toast.error("Erro ao excluir tipo de contrato.");
      }
    } else {
      setContractTypes(contractTypes.filter(c => c.id !== id));
    }
  };

  const filteredContracts = contractTypes.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredContracts.length / pageSize);
  const paginatedContracts = filteredContracts.slice(
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
            <span className="text-slate-900 font-medium">Tipos de Contrato</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 font-display tracking-tight">Tipos de Contrato</h1>
          <p className="text-sm text-slate-500 mt-1">Gerencie os modelos de contrato e suas regras de cálculo.</p>
        </div>
        
        <button 
          onClick={async () => navigate('/tipos-de-contrato/novo')}
          className="btn-primary"
        >
          <Plus size={18} />
          <span>Novo Modelo</span>
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por nome do modelo..." 
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
        ) : filteredContracts.length > 0 ? (
          <>
            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Modelo / Nome</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Prazo</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Direitos Base</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Empresa</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedContracts.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center text-primary-600 shrink-0">
                          <FileText size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{item.name}</p>
                          <span className={`mt-1 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${CATEGORY_COLORS[item.category] || CATEGORY_COLORS['OUTROS']}`}>
                            {item.category}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-700 block">
                        {item.term_type === 'DETERMINADO' ? 'Determinado' : 'Indeterminado'}
                      </span>
                      {item.term_type === 'DETERMINADO' && item.default_days && (
                        <span className="text-xs text-slate-400 block">{item.default_days} dias</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <span className="text-xs flex items-center gap-1" title="Férias">
                          {item.has_vacation ? <Check size={14} className="text-emerald-500"/> : <X size={14} className="text-red-400"/>} Fér
                        </span>
                        <span className="text-xs flex items-center gap-1" title="13º Salário">
                          {item.has_13th ? <Check size={14} className="text-emerald-500"/> : <X size={14} className="text-red-400"/>} 13º
                        </span>
                        <span className="text-xs flex items-center gap-1" title="FGTS">
                          {item.has_fgts ? <Check size={14} className="text-emerald-500"/> : <X size={14} className="text-red-400"/>} FGTS
                        </span>
                      </div>
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
                          onClick={async () => navigate(`/tipos-de-contrato/${item.id}`)}
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
            totalItems={filteredContracts.length}
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
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">Nenhum contrato encontrado</h3>
            <p className="text-slate-500 max-w-sm mb-6">
              {searchTerm 
                ? "Não encontramos nenhum modelo correspondente à sua busca."
                : "Você ainda não cadastrou nenhum tipo de contrato. Comece criando o primeiro!"}
            </p>
            {!searchTerm && (
              <button 
                onClick={async () => navigate('/tipos-de-contrato/novo')}
                className="btn-primary"
              >
                <Plus size={18} />
                <span>Criar Primeiro Modelo</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
