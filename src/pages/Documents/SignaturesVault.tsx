import React, { useState, useEffect } from "react";
import {
  Search,
  PenTool,
  CheckCircle,
  Clock,
  ShieldCheck,
  Download,
  Loader2,
  ExternalLink,
  Send,
  AlertTriangle,
  XCircle,
  FileText,
  Filter,
  Eye,
  X,
  Share2
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Pagination } from "../../components/Pagination";
import { DocumentComplianceService } from "../../services/documents/documentComplianceService";
import { toast } from "sonner";

interface EmployeeDocument {
  id: string;
  title: string;
  doc_type: string;
  status: string;
  verification_code: string;
  hash_original: string | null;
  hash_signed: string | null;
  signed_at: string | null;
  due_at: string | null;
  created_at: string;
  signed_file_url?: string | null;
  workers: {
    people: {
      full_name: string;
      email?: string;
      phone?: string;
    };
  } | null;
}

export default function SignaturesVault() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [docs, setDocs] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<EmployeeDocument | null>(null);
  const [sendingReminder, setSendingReminder] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter]);

  useEffect(() => {
    fetchDocs();
  }, []);

  const fetchDocs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("employee_documents")
      .select(`
        id,
        title,
        doc_type,
        status,
        verification_code,
        hash_original,
        hash_signed,
        signed_at,
        due_at,
        created_at,
        signed_file_url,
        workers (
          people (
            full_name,
            email,
            phone
          )
        )
      `)
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
            <Clock size={12} className="text-amber-600" /> Aguardando
          </span>
        );
      case "PARTIALLY_SIGNED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-800 border border-blue-200">
            <PenTool size={12} className="text-blue-600" /> Parcial
          </span>
        );
      case "SIGNED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle size={12} className="text-emerald-600" /> Assinado
          </span>
        );
      case "CONTESTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-800 border border-rose-200">
            <AlertTriangle size={12} className="text-rose-600" /> Contestado
          </span>
        );
      case "REFUSED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-800 border border-purple-200">
            <XCircle size={12} className="text-purple-600" /> Recusado
          </span>
        );
      case "CANCELED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
            Cancelado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const handleSendReminder = async (doc: EmployeeDocument, channel: 'WHATSAPP' | 'EMAIL') => {
    setSendingReminder(true);
    try {
      const workerName = doc.workers?.people?.full_name || 'Colaborador';
      const notification = DocumentComplianceService.generateNotificationMessage(
        channel,
        workerName,
        doc.title,
        doc.verification_code || doc.id,
        doc.due_at || undefined
      );

      // Registra evento de lembrete em document_events
      await supabase.from('document_events').insert({
        document_id: doc.id,
        event: channel === 'WHATSAPP' ? 'NOTIFIED_WHATSAPP' : 'NOTIFIED_EMAIL',
        meta: {
          channel,
          notificationTitle: notification.title,
          sentBy: 'DP_PANEL'
        }
      });

      if (channel === 'WHATSAPP') {
        const encodedText = encodeURIComponent(notification.message);
        window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
        toast.success(`Mensagem de lembrete gerada para envio via WhatsApp!`);
      } else {
        toast.success(`Lembrete por e-mail registrado com sucesso para ${workerName}!`);
      }
    } catch {
      toast.error('Erro ao registrar lembrete.');
    } finally {
      setSendingReminder(false);
    }
  };

  const filteredDocs = docs.filter((doc) => {
    const name = doc.workers?.people?.full_name || "";
    const matchesSearch =
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.verification_code || "").toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "ALL" || doc.status === statusFilter;
    const matchesType = typeFilter === "ALL" || doc.doc_type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const totalPages = Math.ceil(filteredDocs.length / pageSize);
  const paginatedDocs = filteredDocs.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Totais para cards
  const countPending = docs.filter(d => d.status === 'PENDING_SIGNATURE').length;
  const countSigned = docs.filter(d => d.status === 'SIGNED').length;
  const countContested = docs.filter(d => d.status === 'CONTESTED' || d.status === 'REFUSED').length;

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display">
            Cofre de Assinaturas e Documentos
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestão unificada de pendências, trilhas forenses de integridade e evidências legais
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total de Documentos</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1 font-display">{docs.length}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-xs bg-amber-50/20">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Aguardando Assinatura</p>
          <p className="text-2xl font-extrabold text-amber-800 mt-1 font-display">{countPending}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-xs bg-emerald-50/20">
          <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Assinados com Sucesso</p>
          <p className="text-2xl font-extrabold text-emerald-800 mt-1 font-display">{countSigned}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-rose-200/80 shadow-xs bg-rose-50/20">
          <p className="text-xs font-semibold text-rose-700 uppercase tracking-wider">Contestações / Recusas</p>
          <p className="text-2xl font-extrabold text-rose-800 mt-1 font-display">{countContested}</p>
        </div>
      </div>

      {/* Panel */}
      <div className="panel-flush">
        {/* Filters Bar */}
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/50">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por colaborador, documento ou código..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-medium text-slate-800"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-primary-500"
            >
              <option value="ALL">Todos os Status</option>
              <option value="PENDING_SIGNATURE">Aguardando Assinatura</option>
              <option value="SIGNED">Assinados</option>
              <option value="CONTESTED">Contestados</option>
              <option value="REFUSED">Recusados</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-primary-500"
            >
              <option value="ALL">Todos os Tipos</option>
              <option value="PAYSLIP">Holerites</option>
              <option value="VACATION_NOTICE">Avisos de Férias</option>
              <option value="VACATION_RECEIPT">Recibos de Férias</option>
              <option value="TIMESHEET">Espelhos de Ponto</option>
              <option value="TIME_BANK_AGREEMENT">Acordos de Banco de Horas</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto min-h-[350px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                <th className="px-6 py-3.5">Documento & Colaborador</th>
                <th className="px-6 py-3.5">Código / Tipo</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Integridade H1/H2</th>
                <th className="px-6 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <Loader2 className="w-7 h-7 animate-spin mx-auto text-primary-500 mb-2" />
                    Carregando cofre de documentos...
                  </td>
                </tr>
              ) : filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium">
                    Nenhum documento encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                paginatedDocs.map((doc) => {
                  const name = doc.workers?.people?.full_name || "Colaborador";
                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-900 text-xs font-display flex items-center gap-1.5">
                          <FileText size={14} className="text-slate-400 group-hover:text-primary-600 transition-colors" />
                          {doc.title}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 font-medium">{name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs font-bold text-primary-700 bg-primary-50/80 px-2 py-0.5 rounded-md border border-primary-100">
                          {doc.verification_code || "—"}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">{doc.doc_type}</p>
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(doc.status)}</td>
                      <td className="px-6 py-4">
                        {doc.hash_signed ? (
                          <div className="flex items-center gap-1.5 text-emerald-700 font-mono text-[11px]" title={`H2: ${doc.hash_signed}`}>
                            <ShieldCheck size={14} />
                            <span className="truncate w-24">{doc.hash_signed.substring(0, 10)}...</span>
                          </div>
                        ) : doc.hash_original ? (
                          <div className="flex items-center gap-1.5 text-slate-600 font-mono text-[11px]" title={`H1: ${doc.hash_original}`}>
                            <Clock size={14} className="text-slate-400" />
                            <span className="truncate w-24">{doc.hash_original.substring(0, 10)}...</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Pendente</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelectedDoc(doc)}
                            className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="Ver Trilha Forense / Detalhes"
                          >
                            <Eye size={16} />
                          </button>
                          {doc.verification_code && (
                            <a
                              href={`/verificar/${doc.verification_code}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Abrir Verificador Público"
                            >
                              <ExternalLink size={16} />
                            </a>
                          )}
                          {doc.status === 'PENDING_SIGNATURE' && (
                            <button
                              onClick={() => handleSendReminder(doc, 'WHATSAPP')}
                              disabled={sendingReminder}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Enviar Lembrete por WhatsApp"
                            >
                              <Share2 size={16} />
                            </button>
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

        {/* Pagination */}
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

      {/* Modal: Detalhes do Documento e Trilha Forense */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-slate-100 overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-display">Trilha Forense do Documento</h3>
                  <p className="text-xs text-slate-500">{selectedDoc.verification_code || selectedDoc.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Documento:</span>
                  <span className="font-bold text-slate-800">{selectedDoc.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Colaborador:</span>
                  <span className="font-bold text-slate-800">{selectedDoc.workers?.people?.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span>{getStatusBadge(selectedDoc.status)}</span>
                </div>
                {selectedDoc.signed_at && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Data da Assinatura:</span>
                    <span className="font-semibold text-emerald-700">
                      {new Date(selectedDoc.signed_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                )}
              </div>

              {/* Hashes */}
              <div className="space-y-2">
                <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">Hashes Criptográficos (SHA-256)</p>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-700 break-all">
                  <span className="text-slate-400 block text-[9px] uppercase">H1 Original:</span>
                  {selectedDoc.hash_original || 'Não gravado'}
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-700 break-all">
                  <span className="text-slate-400 block text-[9px] uppercase">H2 Assinado:</span>
                  {selectedDoc.hash_signed || 'Aguardando assinatura'}
                </div>
              </div>

              {/* Ações de Lembrete */}
              {selectedDoc.status === 'PENDING_SIGNATURE' && (
                <div className="pt-2 border-t border-slate-100 flex gap-2">
                  <button
                    onClick={() => handleSendReminder(selectedDoc, 'WHATSAPP')}
                    disabled={sendingReminder}
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Send size={14} /> Reenviar no WhatsApp
                  </button>
                  <button
                    onClick={() => handleSendReminder(selectedDoc, 'EMAIL')}
                    disabled={sendingReminder}
                    className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    Notificar por E-mail
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
