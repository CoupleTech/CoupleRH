import { useState, useEffect } from "react";
import {
  Search,
  PenTool,
  CheckCircle,
  Clock,
  ShieldCheck,
  Download,
  Loader2,
  Lock
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Pagination } from "../../components/Pagination";

interface EmployeeDocument {
  id: string;
  title: string;
  status: string;
  document_hash: string | null;
  created_at: string;
  workers: {
    people: {
      full_name: string;
    };
  } | null;
}

export default function SignaturesVault() {
  const [searchTerm, setSearchTerm] = useState("");
  const [docs, setDocs] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    fetchDocs();
  }, []);

  const fetchDocs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("employee_documents")
      .select(
        `
        id,
        title,
        status,
        document_hash,
        created_at,
        workers (
          people (
            full_name
          )
        )
      `,
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setDocs(data as any);
    }
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING_SIGNATURE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-amber-100 text-amber-800">
            <Clock size={12} /> Aguardando Assinatura
          </span>
        );
      case "PARTIALLY_SIGNED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-blue-100 text-blue-800">
            <PenTool size={12} /> Faltam Assinaturas
          </span>
        );
      case "SIGNED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-emerald-100 text-emerald-800">
            <CheckCircle size={12} /> Assinado
          </span>
        );
      case "CANCELED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-slate-100 text-slate-800">
            Cancelado
          </span>
        );
      default:
        return null;
    }
  };

  const filteredDocs = docs.filter((doc) => {
    const name = doc.workers?.people?.full_name || "";
    return (
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const totalPages = Math.ceil(filteredDocs.length / pageSize);
  const paginatedDocs = filteredDocs.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="animate-fade-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display">
            Cofre de Assinaturas
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Acompanhe as pendências e a validade jurídica dos documentos
          </p>
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
              placeholder="Buscar por nome ou documento..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                <th className="px-6 py-4">Documento / Vínculo</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Data de Emissão</th>
                <th className="px-6 py-4">Validade / Hash</th>
                <th className="px-6 py-4 text-right">Ações</th>
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
                    Carregando documentos...
                  </td>
                </tr>
              ) : filteredDocs.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-slate-500 font-bold"
                  >
                    Nenhum documento encontrado no cofre.
                  </td>
                </tr>
              ) : (
                paginatedDocs.map((doc) => {
                  const name = doc.workers?.people?.full_name || "Colaborador";
                  return (
                    <tr
                      key={doc.id}
                      className="hover:bg-slate-50 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-900 font-display">
                          {doc.title}
                        </p>
                        <p className="text-[10px] uppercase tracking-widest text-slate-500 mt-1 font-bold">
                          {name}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(doc.status)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {new Date(doc.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-6 py-4">
                        {doc.document_hash ? (
                          <div
                            className="flex items-center gap-1.5 text-emerald-600"
                            title={`Hash SHA-256: ${doc.document_hash}`}
                          >
                            <ShieldCheck size={16} />
                            <span className="text-xs font-mono truncate w-24">
                              {doc.document_hash.substring(0, 12)}...
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            Aguardando...
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          className="text-slate-400 hover:text-primary-600 p-1.5 rounded-lg hover:bg-primary-50 transition-colors"
                          title="Baixar PDF"
                        >
                          <Download size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {!loading && filteredDocs.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredDocs.length}
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
