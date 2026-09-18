import { useState, useEffect } from "react";
import { 
  Users, 
  Search, 
  Plus, 
  ChevronRight,
  Loader2,
  Building2,
  Briefcase
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useCompany } from "../../contexts/CompanyContext";
import { Pagination } from "../../components/Pagination";

interface WorkerData {
  id: string;
  esocial_matricula: string;
  person: {
    full_name: string;
    cpf: string;
  };
  contract?: {
    id: string;
    status: string;
    position?: { title: string };
    department?: { name: string };
  };
}

export default function EmployeesList() {
  const navigate = useNavigate();
  const { selectedCompanyId } = useCompany();
  const [searchTerm, setSearchTerm] = useState("");
  const [workers, setWorkers] = useState<WorkerData[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (selectedCompanyId) {
      fetchWorkers();
    }
  }, [selectedCompanyId]);

  const fetchWorkers = async () => {
    setLoading(true);
    try {
      // 1. Busca os workers e suas pessoas físicas
      const { data: workersData, error: workersError } = await supabase
        .from("workers")
        .select(`
          id,
          esocial_matricula,
          person_id,
          people (full_name, cpf)
        `)
        .eq('company_id', selectedCompanyId);

      if (workersError) throw workersError;

      // 2. Busca o contrato atual (ativo) para cada worker
      if (workersData && workersData.length > 0) {
        const workerIds = workersData.map(w => w.id);
        const { data: contractsData, error: contractsError } = await supabase
          .from("employment_contracts")
          .select(`
            id,
            worker_id,
            status,
            positions (title),
            departments (name)
          `)
          .in('worker_id', workerIds)
          .eq('status', 'ACTIVE');
          
        if (contractsError) throw contractsError;

        // Mescla os dados
        const merged: WorkerData[] = workersData.map((w: any) => {
          const contract = contractsData?.find(c => c.worker_id === w.id);
          return {
            id: w.id,
            esocial_matricula: w.esocial_matricula,
            person: w.people,
            contract: contract ? {
              id: contract.id,
              status: contract.status,
              position: Array.isArray(contract.positions) ? contract.positions[0] : contract.positions,
              department: Array.isArray(contract.departments) ? contract.departments[0] : contract.departments
            } : undefined
          };
        });

        setWorkers(merged);
      } else {
        setWorkers([]);
      }
    } catch (err) {
      console.error("Erro ao buscar funcionários:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredWorkers = workers.filter(
    (item) =>
      item.person.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.person.cpf.includes(searchTerm)
  );

  const totalPages = Math.ceil(filteredWorkers.length / pageSize);
  const paginatedWorkers = filteredWorkers.slice(
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
            <span className="text-slate-900 font-medium">Colaboradores</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 font-display tracking-tight">Quadro de Funcionários</h1>
          <p className="text-sm text-slate-500 mt-1">Gerencie as pessoas, contratos e o histórico funcional.</p>
        </div>
        
        <button 
          onClick={() => navigate('/funcionarios/novo')}
          className="btn-primary"
        >
          <Plus size={18} />
          <span>Novo Empregado</span>
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por nome ou CPF..." 
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
        ) : filteredWorkers.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-200">
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Colaborador</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Matrícula (eSocial)</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cargo / Setor</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginatedWorkers.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer" onClick={() => navigate(`/funcionarios/${item.id}`)}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold shrink-0">
                          {item.person.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{item.person.full_name}</p>
                          <span className="text-xs text-slate-500">CPF: {item.person.cpf}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-mono text-slate-600">{item.esocial_matricula || 'Sem matrícula'}</span>
                    </td>
                    <td className="px-6 py-4">
                      {item.contract ? (
                        <div>
                          <p className="text-sm text-slate-900">{item.contract.position?.title || 'Sem cargo'}</p>
                          <p className="text-xs text-slate-500">{item.contract.department?.name || 'Sem departamento'}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Sem contrato ativo</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                        item.contract?.status === 'ACTIVE' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        {item.contract?.status === 'ACTIVE' ? 'Ativo' : 'Inativo/Sem Contrato'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        className="text-sm font-medium text-primary-600 hover:text-primary-700"
                      >
                        Ver Perfil
                      </button>
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
              totalItems={filteredWorkers.length}
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
              <Users className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">Nenhum colaborador encontrado</h3>
            <p className="text-slate-500 max-w-sm mb-6">
              {searchTerm 
                ? "Não encontramos ninguém correspondente à sua busca."
                : "Você ainda não possui funcionários cadastrados nesta empresa."}
            </p>
            {!searchTerm && (
              <button 
                onClick={() => navigate('/funcionarios/novo')}
                className="btn-primary"
              >
                <Plus size={18} />
                <span>Cadastrar Primeiro Empregado</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
