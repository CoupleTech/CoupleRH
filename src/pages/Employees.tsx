import { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Filter,
  ChevronRight,
  Loader2,
  User,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { formatDate } from "../lib/dateUtils";

interface EmployeeContract {
  id: string;
  status: string;
  admission_date: string;
  contract_type: string;
  workers: {
    esocial_matricula: string;
    people: {
      full_name: string;
      cpf: string;
    };
  } | null;
  departments: { name: string } | null;
  positions: { title: string } | null;
}

export default function Employees() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [employees, setEmployees] = useState<EmployeeContract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("employment_contracts")
      .select(
        `
        id,
        status,
        admission_date,
        contract_type,
        workers (
          esocial_matricula,
          people (
            full_name,
            cpf
          )
        ),
        departments (name),
        positions (title)
      `,
      )
      .order("created_at", { ascending: false });

    if (!error && data) {
      setEmployees(data as any);
    }
    setLoading(false);
  };

  const filteredEmployees = employees.filter((emp) => {
    const term = searchTerm.toLowerCase();
    const name = emp.workers?.people?.full_name?.toLowerCase() || "";
    const cpf = emp.workers?.people?.cpf?.toLowerCase() || "";
    const matricula = emp.workers?.esocial_matricula?.toLowerCase() || "";
    return (
      name.includes(term) || cpf.includes(term) || matricula.includes(term)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <span className="badge-success">Ativo</span>;
      case "INACTIVE":
        return <span className="badge-danger">Desligado</span>;
      case "VACATION":
        return <span className="badge-warning">Férias</span>;
      case "SUSPENDED":
        return <span className="badge-info">Suspenso</span>;
      default:
        return <span className="badge-neutral">{status}</span>;
    }
  };

  return (
    <div className="animate-fade-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display">
            Colaboradores
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie trabalhadores ativos e processos admissionais
          </p>
        </div>

        <button
          onClick={() => navigate("/funcionarios/novo")}
          className="btn-primary"
        >
          <Plus size={16} />
          <span>Novo Colaborador</span>
        </button>
      </div>

      <div className="panel-flush">
        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar por nome, CPF ou matrícula..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="btn-secondary w-full sm:w-auto">
            <Filter size={14} />
            Filtros
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="table-header px-6 py-3.5">Colaborador</th>
                <th className="table-header px-6 py-3.5">
                  Cargo / Departamento
                </th>
                <th className="table-header px-6 py-3.5">Status</th>
                <th className="table-header px-6 py-3.5">Admissão</th>
                <th className="table-header px-6 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <Loader2 className="w-7 h-7 animate-spin mx-auto text-primary-500 mb-3" />
                    <p className="text-sm text-slate-400 font-medium">
                      Carregando colaboradores...
                    </p>
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <Users size={32} className="text-slate-200 mx-auto mb-3" />
                    <p className="text-sm text-slate-500 font-medium">
                      Nenhum colaborador encontrado
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Ajuste os critérios de busca ou cadastre um novo
                      colaborador
                    </p>
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => {
                  const name = emp.workers?.people?.full_name || "Desconhecido";
                  return (
                    <tr
                      key={emp.id}
                      className="table-row group cursor-pointer"
                      onClick={() => navigate(`/funcionarios/${emp.id}`)}
                    >
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
                            {name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 group-hover:text-primary-600 transition-colors">
                              {name}
                            </p>
                            <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <User size={10} />{" "}
                              {emp.workers?.esocial_matricula ||
                                "Sem matrícula"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <p className="font-medium text-slate-700">
                          {emp.positions?.title || "Sem Cargo"}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {emp.departments?.name || "Sem Departamento"}
                        </p>
                      </td>
                      <td className="table-cell">
                        {getStatusBadge(emp.status)}
                      </td>
                      <td className="table-cell">
                        <span className="text-sm font-medium text-slate-700 tabular-nums">
                          {formatDate(emp.admission_date)}
                        </span>
                      </td>
                      <td className="table-cell text-right">
                        <button className="p-1.5 text-slate-300 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                          <ChevronRight size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
