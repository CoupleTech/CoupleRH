import { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Building,
  Loader2,
  ChevronRight,
  Building2,
  Edit2,
  Trash2,
  Power
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useCompany } from "../../../contexts/CompanyContext";

interface Department {
  id: string;
  name: string;
  code: string | null;
  status: string;
  companies: {
    corporate_name: string;
    trade_name: string | null;
  } | null;
}

export default function DepartmentsList() {
  const navigate = useNavigate();
  const { selectedCompanyId } = useCompany();
  const [searchTerm, setSearchTerm] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDepartments();
  }, [selectedCompanyId]);

  const fetchDepartments = async () => {
    setLoading(true);
    // Realizamos um join (select associado) com companies para exibir o nome da empresa
    let query = supabase
      .from("departments")
      .select(`
        id,
        name,
        code,
        status,
        company_id,
        companies (
          corporate_name,
          trade_name
        )
      `);
      
    // Filtra pelo company_id selecionado (ou exibe os gerais que tem company_id = null)
    // Se quiser que a listagem mostre apenas os da empresa atual + gerais:
    if (selectedCompanyId) {
      query = query.or(`company_id.eq.${selectedCompanyId},company_id.is.null`);
    }

    const { data, error } = await query.order("name", { ascending: true });

    if (!error && data) {
      setDepartments(data as any);
    } else if (error) {
      console.error("Erro ao buscar departamentos:", error);
    }
    setLoading(false);
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const { error } = await supabase
      .from("departments")
      .update({ status: newStatus })
      .eq("id", id);
      
    if (error) {
      alert("Erro ao alterar status.");
    } else {
      setDepartments(departments.map(d => d.id === id ? { ...d, status: newStatus } : d));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Deseja realmente excluir este departamento? Só será possível se não houver vínculos.")) return;
    
    const { error } = await supabase
      .from("departments")
      .delete()
      .eq("id", id);
      
    if (error) {
      if (error.code === '23503') {
        alert("Não é possível excluir este departamento pois ele está vinculado a um ou mais colaboradores ou setores.");
      } else {
        alert("Erro ao excluir departamento.");
      }
    } else {
      setDepartments(departments.filter(d => d.id !== id));
    }
  };

  const filteredDepartments = departments.filter((d) => {
    const term = searchTerm.toLowerCase();
    const matchName = d.name.toLowerCase().includes(term);
    const matchCode = d.code?.toLowerCase().includes(term);
    const matchCompany = d.companies?.corporate_name?.toLowerCase().includes(term);
    return matchName || matchCode || matchCompany;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Building2 size={16} />
            <span>Organização</span>
            <ChevronRight size={14} />
            <span className="text-slate-900 font-medium">Departamentos</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 font-display tracking-tight">Departamentos</h1>
          <p className="text-sm text-slate-500 mt-1">Gerencie as unidades organizacionais das empresas.</p>
        </div>
        
        <button 
          onClick={() => navigate('/departamentos/novo')}
          className="btn-primary"
        >
          <Plus size={18} />
          <span>Novo Departamento</span>
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por nome, código ou empresa..." 
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
        ) : filteredDepartments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Departamento</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Código</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Empresa</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredDepartments.map((dept) => (
                  <tr key={dept.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center text-primary-600">
                          <Building size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{dept.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm text-slate-600 tabular-nums">
                        {dept.code || <span className="text-slate-300">—</span>}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {dept.companies ? (
                        <span className="text-sm text-slate-600">
                          {dept.companies.trade_name || dept.companies.corporate_name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                          Geral
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                        dept.status === 'ACTIVE' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        {dept.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => navigate(`/departamentos/${dept.id}`)}
                          className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors cursor-pointer"
                          title="Editar"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleToggleStatus(dept.id, dept.status)}
                          className={`p-2 rounded-lg transition-colors cursor-pointer ${
                            dept.status === 'ACTIVE' 
                              ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' 
                              : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={dept.status === 'ACTIVE' ? "Inativar" : "Ativar"}
                        >
                          <Power size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(dept.id)}
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
              <Building className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">Nenhum departamento encontrado</h3>
            <p className="text-slate-500 max-w-sm mb-6">
              {searchTerm 
                ? "Não encontramos nenhum departamento correspondente à sua busca."
                : "Você ainda não possui departamentos cadastrados. Clique no botão acima para adicionar o primeiro."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
