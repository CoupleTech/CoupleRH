import { useState, useEffect } from "react";
import {
  Search,
  Send,
  CheckCircle,
  AlertOctagon,
  Clock,
  Activity,
  Loader2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Pagination } from "../../components/Pagination";
import {
  validateTransmissionAttempt,
  ESOCIAL_CONFIG,
} from "../../utils/esocialSimulation";

interface ESocialTransmission {
  id: string;
  event_type: string;
  status: string;
  receipt_number: string | null;
  error_message: string | null;
  transmitted_at: string | null;
  created_at: string;
}

export default function ESocialDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [transmissions, setTransmissions] = useState<ESocialTransmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTransmitting, setIsTransmitting] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    fetchTransmissions();
  }, []);

  const fetchTransmissions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("esocial_transmissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setTransmissions(data);
    }
    setLoading(false);
  };

  const forceTransmission = async () => {
    const check = validateTransmissionAttempt();
    if (!check.allowed) {
      alert(check.reason);
      return;
    }

    setIsTransmitting(true);
    const queued = transmissions.filter(
      (t) => t.status === "QUEUED" || t.status === "DRAFT",
    );

    for (const item of queued) {
      await supabase
        .from("esocial_transmissions")
        .update({
          status: "ACCEPTED",
          receipt_number: `1.2.000${Math.floor(Math.random() * 1000000)}`,
          transmitted_at: new Date().toISOString(),
        })
        .eq("id", item.id);
    }

    await fetchTransmissions();
    setIsTransmitting(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-widest bg-slate-100 text-slate-800">
            Rascunho
          </span>
        );
      case "QUEUED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-widest bg-amber-100 text-amber-800">
            <Clock size={14} /> Na Fila
          </span>
        );
      case "PROCESSING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-widest bg-blue-100 text-blue-800">
            <Loader2 className="animate-spin" size={14} /> Proc.
          </span>
        );
      case "ACCEPTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-widest bg-emerald-100 text-emerald-800">
            <CheckCircle size={14} /> Aceito
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-widest bg-rose-100 text-rose-800">
            <AlertOctagon size={14} /> Rejeitado
          </span>
        );
      default:
        return null;
    }
  };

  const filteredTransmissions = transmissions.filter(
    (t) =>
      t.event_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.status.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const totalPages = Math.ceil(filteredTransmissions.length / pageSize);
  const paginatedTransmissions = filteredTransmissions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const stats = {
    accepted: transmissions.filter((t) => t.status === "ACCEPTED").length,
    queued: transmissions.filter(
      (t) => t.status === "QUEUED" || t.status === "DRAFT",
    ).length,
    rejected: transmissions.filter((t) => t.status === "REJECTED").length,
  };

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-900 font-display">
              Mensageria eSocial
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
              <AlertTriangle size={13} className="text-amber-600" />
              Simulação: não transmite
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Visualização de eventos, validação de layouts XML e simulações de lotes
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={forceTransmission}
            disabled={true}
            title={ESOCIAL_CONFIG.TRANSMISSION_NOTICE}
            className="btn-primary opacity-60 cursor-not-allowed bg-slate-200 text-slate-500 border border-slate-300 hover:bg-slate-200 hover:text-slate-500 shadow-none"
          >
            <Send size={18} />
            <span>Transmissão Desativada (Fase P10)</span>
          </button>
        </div>
      </div>

      {/* Banner de Conformidade e Simulação (T26) */}
      <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3.5 shadow-sm">
        <div className="p-2 bg-amber-100 rounded-lg text-amber-700 mt-0.5 shrink-0">
          <AlertTriangle size={20} />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-sm font-bold text-amber-900">
              Painel em Modo de Demonstração / Simulação
            </h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-amber-200 text-amber-900">
              Ambiente Não Transmissor
            </span>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">
            Este módulo opera exclusivamente para validação e pré-visualização de arquivos. 
            Nenhuma informação é enviada à Receita Federal ou SERPRO. O botão de transmissão em lote 
            está desativado em produção para conformidade com o Roteiro de Produção (Fase P0). 
            A transmissão governamental oficial com certificado ICP-Brasil (A1) será disponibilizada na Fase P10.
          </p>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="panel p-6 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 text-accent-500/10 group-hover:text-accent-500/20 transition-colors">
            <CheckCircle size={100} />
          </div>
          <div className="relative z-10">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
              Aceitos (Simulação Local)
            </p>
            <p className="text-3xl font-extrabold text-slate-900 font-display">
              {stats.accepted}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Pré-validados localmente</p>
          </div>
        </div>
        <div className="panel p-6 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 text-amber-500/10 group-hover:text-amber-500/20 transition-colors">
            <Clock size={100} />
          </div>
          <div className="relative z-10">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
              Aguardando Envio
            </p>
            <p className="text-3xl font-extrabold text-slate-900 font-display">
              {stats.queued}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Em fila de processamento</p>
          </div>
        </div>
        <div className="panel p-6 relative overflow-hidden group border-rose-200 bg-rose-50/30">
          <div className="absolute -right-6 -top-6 text-rose-500/10 group-hover:text-rose-500/20 transition-colors">
            <AlertOctagon size={100} />
          </div>
          <div className="relative z-10">
            <p className="text-xs font-bold text-rose-600 uppercase tracking-widest mb-1">
              Inconsistências Locais
            </p>
            <p className="text-3xl font-extrabold text-rose-700 font-display">
              {stats.rejected}
            </p>
            <p className="text-[11px] text-rose-400 mt-1">Falhas de validação de layout</p>
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
              placeholder="Buscar por evento (ex: S-2200) ou recibo..."
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
                <th className="px-6 py-4">Evento</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Nº Recibo</th>
                <th className="px-6 py-4">Data/Hora de Envio</th>
                <th className="px-6 py-4">Erros</th>
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
                    Carregando transmissões...
                  </td>
                </tr>
              ) : filteredTransmissions.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-slate-500 font-bold"
                  >
                    Nenhum evento encontrado.
                  </td>
                </tr>
              ) : (
                paginatedTransmissions.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-slate-50 transition-colors group"
                  >
                    <td className="px-6 py-4 font-mono font-bold text-primary-700">
                      {t.event_type}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(t.status)}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">
                      {t.receipt_number || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {t.transmitted_at
                        ? new Date(t.transmitted_at).toLocaleString("pt-BR")
                        : "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-rose-600 font-medium">
                      {t.error_message || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {!loading && filteredTransmissions.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredTransmissions.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        )}
      </div>
    </div>
  );
}
