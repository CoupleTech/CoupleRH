import { useState, useEffect } from "react";
import { Search, UserMinus, ChevronRight, Loader2, Edit2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

interface TerminatedContract {
  id: string;
  resignation_date: string;
  workers: {
    people: {
      full_name: string;
    };
  } | null;
}

export default function TerminationsList() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [terminations, setTerminations] = useState<TerminatedContract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTerminations();
  }, []);

  const fetchTerminations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("employment_contracts")
      .select(
        `
        id,
        resignation_date,
        workers (
          people (
            full_name
          )
        )
      `,
      )
      .eq("status", "INACTIVE")
      .order("resignation_date", { ascending: false });

    if (!error && data) {
      setTerminations(data as any);
    }
    setLoading(false);
  };

  const filteredTerminations = terminations.filter((t) => {
    const name = t.workers?.people?.full_name || "";
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <UserMinus size={16} />
            <span>Desligamentos</span>
            <ChevronRight size={14} />
            <span className="text-slate-900 font-medium">Processos</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 font-display tracking-tight">Desligamentos</h1>
          <p className="text-sm text-slate-500 mt-1">Cálculo de rescisão, aviso prévio e workflow de saída.</p>
        </div>
        
        <button 
          onClick={() => navigate('/desligamentos/novo')}
          className="btn-danger"
        >
          <UserMinus size={18} />
          <span>Iniciar Desligamento</span>
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar ex-colaborador..." 
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
        ) : filteredTerminations.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Colaborador</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Último Dia Trabalhado</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status TRCT</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredTerminations.map((term) => {
                  const name = term.workers?.people?.full_name || "Desconhecido";
                  return (
                    <tr key={term.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm shrink-0">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm text-slate-600 tabular-nums">
                          {term.resignation_date
                            ? new Date(term.resignation_date).toLocaleDateString("pt-BR")
                            : "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border bg-slate-50 text-slate-600 border-slate-200">
                          Concluído
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors cursor-pointer"
                            title="Editar / Visualizar"
                          >
                            <Edit2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
              <UserMinus className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">Nenhum processo de desligamento encontrado</h3>
            <p className="text-slate-500 max-w-sm mb-6">
              {searchTerm 
                ? "Não encontramos nenhum desligamento correspondente à sua busca."
                : "Você ainda não possui processos de rescisão cadastrados."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
