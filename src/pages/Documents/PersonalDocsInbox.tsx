import { useState, useEffect } from "react";
import {
  Search,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  Loader2,
  AlertCircle
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Pagination } from "../../components/Pagination";
import { toast } from 'sonner';

interface PersonalDocument {
  id: string;
  document_type: string;
  status: string;
  file_url: string;
  created_at: string;
  updated_at: string;
  worker_id: string;
  workers: {
    people: {
      full_name: string;
    };
  } | null;
}

export default async function PersonalDocsInbox() {
  const [searchTerm, setSearchTerm] = useState("");
  const [docs, setDocs] = useState<PersonalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

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
    
    // Busca todos os documentos que precisam de atenção (SUBMITTED ou recentes)
    const { data, error } = await supabase
      .from("worker_personal_documents")
      .select(`
        id,
        document_type,
        status,
        file_url,
        created_at,
        updated_at,
        worker_id,
        workers (
          people (
            full_name
          )
        )
      `)
      .order("updated_at", { ascending: false });

    if (!error && data) {
      setDocs(data as any);
    }
    setLoading(false);
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    if (status === 'REJECTED') {
      const confirmed = await confirmDialog("Tem certeza que deseja rejeitar este documento? O colaborador terá que reenviar.");
      if (!confirmed) return;
    }

    setProcessingId(id);
    try {
      const { error } = await supabase.rpc('update_worker_document_status', {
        p_document_id: id,
        p_status: status
      });

      if (error) throw error;
      await fetchDocs();
    } catch (err) {
      toast.error("Erro ao atualizar o documento.");
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = async (status: string) => {
    switch (status) {
      case "SUBMITTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-amber-100 text-amber-800">
            <Clock size={12} /> Para Análise
          </span>
        );
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-emerald-100 text-emerald-800">
            <CheckCircle size={12} /> Aprovado
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-rose-100 text-rose-800">
            <AlertCircle size={12} /> Rejeitado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-slate-100 text-slate-800">
            {status}
          </span>
        );
    }
  };

  const filteredDocs = docs.filter((doc) => {
    const name = doc.workers?.people?.full_name || "";
    return (
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.document_type.toLowerCase().includes(searchTerm.toLowerCase())
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
            Recepção de Documentos
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Audite e aprove os documentos pessoais enviados pelos colaboradores
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
              placeholder="Buscar por colaborador ou documento..."
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
                <th className="px-6 py-4">Colaborador / Tipo</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Enviado em</th>
                <th className="px-6 py-4 text-right">Análise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-500 mb-2" />
                    Carregando documentos...
                  </td>
                </tr>
              ) : filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500 font-bold">
                    Nenhum documento encontrado.
                  </td>
                </tr>
              ) : (
                paginatedDocs.map((doc) => {
                  const name = doc.workers?.people?.full_name || "Desconhecido";
                  return (
                    <tr key={doc.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-900 font-display">
                          {name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 text-slate-500">
                          <FileText size={14} />
                          <span className="text-[11px] font-bold uppercase tracking-widest">
                            {doc.document_type}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(doc.status)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {new Date(doc.updated_at).toLocaleDateString("pt-BR", {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <a 
                            href={doc.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                            title="Visualizar/Baixar"
                          >
                            <Download size={18} />
                          </a>
                          
                          {doc.status === 'SUBMITTED' && (
                            <>
                              <button
                                disabled={processingId === doc.id}
                                onClick={async () => handleUpdateStatus(doc.id, 'APPROVED')}
                                className="flex items-center justify-center w-8 h-8 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                                title="Aprovar"
                              >
                                {processingId === doc.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={18} />}
                              </button>
                              <button
                                disabled={processingId === doc.id}
                                onClick={async () => handleUpdateStatus(doc.id, 'REJECTED')}
                                className="flex items-center justify-center w-8 h-8 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                                title="Rejeitar"
                              >
                                {processingId === doc.id ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={18} />}
                              </button>
                            </>
                          )}
                        </div>
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
