import { useState, useEffect } from "react";
import { Search, Plus, Loader2, Briefcase, Edit2, ChevronRight, Power, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useCompany } from "../../../contexts/CompanyContext";
import { Pagination } from "../../../components/Pagination";
import { toast } from 'sonner';
import { confirmDialog } from '..\..\..\components\ConfirmDialogProvider';

interface Position {
  id: string;
  title: string;
  cbo: string | null;
  level: string | null;
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
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    fetchPositions();
  }, [selectedCompanyId]);

  const fetchPositions = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("positions")
        .select(`
          id, 
          title, 
          cbo,
          level,
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

      const { data, error } = await query.order("title", { ascending: true });

      if (error) throw error;
      setPositions((data as any) || []);
    } catch (err) {
      console.error("Erro ao buscar cargos:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const { error } = await supabase
      .from("positions")
      .update({ status: newStatus })
      .eq("id", id);
      
    if (error) {
      toast.error("Erro ao alterar status.");
    } else {
      setPositions(positions.map(p => p.id === id ? { ...p, status: newStatus } : p));
    }
  };

  const handleDelete = async (id: string) => {
    if (!await confirmDialog("Deseja realmente excluir este cargo? Só será possível se não houver vínculos.")) return;
    
    const { error } = await supabase
      .from("positions")
      .delete()
      .eq("id", id);
      
    if (error) {
      if (error.code === '23503') {
        toast.error("Não é possível excluir este cargo pois ele está vinculado a um ou mais colaboradores.");
      } else {
        toast.error("Erro ao excluir cargo.");
      }
    } else {
      setPositions(positions.filter(p => p.id !== id));
    }
  };

  const filteredPositions = positions.filter(
    (p) =>
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.cbo && p.cbo.includes(searchTerm)) ||
      (p.level && p.level.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const totalPages = Math.ceil(filteredPositions.length / pageSize);
  const paginatedPositions = filteredPositions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Briefcase size={16} />
            <span>Organização</span>
            <ChevronRight size={14} />
            <span className="text-slate-900 font-medium">Cargos e CBO</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display">
            Cargos e CBO
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie o quadro de cargos da sua empresa para uso nas admissões.
          </p>
        </div>

        <button 
          onClick={async () => navigate("/cargos/novo")} 
          className="btn-primary"
        >
          <Plus size={18} />
          <span>Novo Cargo</span>
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por título, CBO ou nível..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
          </div>
        ) : filteredPositions.length > 0 ? (
          <>
            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cargo</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">CBO</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nível</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Empresa</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedPositions.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center text-primary-600">
                          <Briefcase size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{p.title}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm text-slate-700">{p.cbo || "-"}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600 capitalize">{p.level || "-"}</span>
                    </td>
                    <td className="px-6 py-4">
                      {p.companies ? (
                        <span className="text-sm text-slate-600">
                          {p.companies.trade_name || p.companies.corporate_name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                          Geral
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                        p.status === 'ACTIVE' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        {p.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={async () => navigate(`/cargos/${p.id}`)}
                          className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors cursor-pointer"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={async () => handleToggleStatus(p.id, p.status)}
                          className={`p-2 rounded-lg transition-colors cursor-pointer ${
                            p.status === 'ACTIVE' 
                              ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' 
                              : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={p.status === 'ACTIVE' ? "Inativar" : "Ativar"}
                        >
                          <Power size={16} />
                        </button>
                        <button 
                          onClick={async () => handleDelete(p.id)}
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
            totalItems={filteredPositions.length}
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
              <Briefcase className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">Nenhum cargo encontrado</h3>
            <p className="text-slate-500 max-w-sm mb-6">
              {searchTerm 
                ? "Não encontramos nenhum cargo correspondente à sua busca."
                : "Você ainda não cadastrou nenhum cargo. Comece criando o primeiro!"}
            </p>
            {!searchTerm && (
              <button 
                onClick={async () => navigate('/cargos/novo')}
                className="btn-primary"
              >
                <Plus size={18} />
                <span>Criar Primeiro Cargo</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
