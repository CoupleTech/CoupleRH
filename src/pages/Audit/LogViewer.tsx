import { useState, useEffect } from "react";
import {
  Search,
  ShieldAlert,
  History,
  Activity,
  Database,
  Loader2,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Pagination } from "../../components/Pagination";

interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  entity_type: string;
  entity_id: string;
  actor_id: string;
  reason?: string;
  engine_version?: string;
}

export default function LogViewer() {
  const [searchTerm, setSearchTerm] = useState("");
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('audit_logs_view')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (data && !error) {
      setLogs(data as AuditLog[]);
    } else {
      console.error("Erro ao buscar logs de auditoria:", error);
      setLogs([]);
    }
    setLoading(false);
  };

  const getActionBadge = (action: string) => {
    if (action === "INSERT")
      return (
        <span className="inline-flex px-2 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-widest rounded-lg">
          Criação
        </span>
      );
    if (action === "UPDATE")
      return (
        <span className="inline-flex px-2 py-1 bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-widest rounded-lg">
          Modificação
        </span>
      );
    if (action === "DELETE")
      return (
        <span className="inline-flex px-2 py-1 bg-rose-100 text-rose-800 text-[10px] font-bold uppercase tracking-widest rounded-lg">
          Exclusão
        </span>
      );
    return (
      <span className="inline-flex px-2 py-1 bg-slate-100 text-slate-800 text-[10px] font-bold uppercase tracking-widest rounded-lg">
        {action}
      </span>
    );
  };

  const filteredLogs = logs.filter(
    (log) =>
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredLogs.length / pageSize);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="animate-fade-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display flex items-center gap-2">
            <ShieldAlert className="text-rose-600" size={28} />
            Trilha de Auditoria
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Logs imutáveis de ações críticas no sistema (LGPD & Compliance)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="panel p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Eventos (24h)
            </p>
            <p className="text-2xl font-black text-slate-900 mt-1">1,204</p>
          </div>
        </div>
        <div className="panel p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
            <History size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Retenção de Logs
            </p>
            <p className="text-2xl font-black text-slate-900 mt-1">5 Anos</p>
          </div>
        </div>
        <div className="panel p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
            <Database size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Status da Engine
            </p>
            <p className="text-2xl font-black text-slate-900 mt-1 text-emerald-600">
              Ativa
            </p>
          </div>
        </div>
      </div>

      <div className="panel-flush">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar por ID ou tipo de entidade..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                <th className="px-6 py-4">Data / Hora</th>
                <th className="px-6 py-4">Ação</th>
                <th className="px-6 py-4">Entidade Afetada</th>
                <th className="px-6 py-4">ID do Registro</th>
                <th className="px-6 py-4">Usuário / Ator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-500 mb-2" />
                    Buscando logs protegidos...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-slate-500 font-bold"
                  >
                    Nenhum log encontrado.
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50 transition-colors font-mono text-sm"
                  >
                    <td className="px-6 py-4 text-slate-600">
                      {new Date(log.timestamp).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-6 py-4">{getActionBadge(log.action)}</td>
                    <td className="px-6 py-4 text-slate-800 font-semibold">
                      {log.entity_type}
                      {log.reason && (
                        <div className="text-[10px] text-slate-400 mt-0.5 max-w-[200px] truncate" title={log.reason}>
                          Motivo: {log.reason}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {log.entity_id}
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-xs truncate max-w-[150px]">
                      {log.actor_id === '00000000-0000-0000-0000-000000000000' ? (
                        <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold">SYSTEM</span>
                      ) : (
                        log.actor_id
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && filteredLogs.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredLogs.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
        />
      )}
    </div>
  );
}
