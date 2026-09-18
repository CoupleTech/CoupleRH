import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  Plus,
  Stethoscope,
  FileWarning,
  CheckCircle,
  Loader2,
  ChevronRight,
  Edit2,
  Trash2,
  Power,
  X,
  FileText,
  CalendarDays
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { leaveService } from "../../services/leaveService";
import { useCompany } from "../../contexts/CompanyContext";
import { supabase } from "../../lib/supabase";
import { Pagination } from "../../components/Pagination";

interface Leave {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string | null;
  status: string;
  icd_10_code: string | null;
  employment_contracts: {
    workers: {
      people: {
        full_name: string;
      };
    } | null;
  } | null;
}

export default function LeavesList() {
  const navigate = useNavigate();
  const { selectedCompanyId } = useCompany();
  const [searchTerm, setSearchTerm] = useState("");
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);
  const [selectedLeaveView, setSelectedLeaveView] = useState<Leave | null>(null);

  useEffect(() => {
    fetchLeaves();
  }, [selectedCompanyId]);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const data = await leaveService.getEnrichedLeaves();
      setLeaves(data || []);
    } catch (error) {
      console.error("Erro ao buscar afastamentos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'APPROVED' ? 'PENDING' : 'APPROVED';
    const { error } = await supabase
      .from("leaves")
      .update({ status: newStatus })
      .eq("id", id);
      
    if (error) {
      alert("Erro ao alterar status.");
    } else {
      setLeaves(leaves.map(l => l.id === id ? { ...l, status: newStatus } : l));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Deseja realmente excluir este afastamento?")) return;
    
    const { error } = await supabase
      .from("leaves")
      .delete()
      .eq("id", id);
      
    if (error) {
      alert("Erro ao excluir afastamento.");
    } else {
      setLeaves(leaves.filter(l => l.id !== id));
    }
  };

  const getLeaveTypeName = (type: string) => {
    switch (type) {
      case "SICK_LEAVE":
        return "Atestado Médico (Doença)";
      case "MATERNITY":
        return "Licença Maternidade";
      case "PATERNITY":
        return "Licença Paternidade";
      case "WORK_ACCIDENT":
        return "Acidente de Trabalho";
      case "UNJUSTIFIED_ABSENCE":
        return "Falta Injustificada";
      case "SUSPENSION":
        return "Suspensão";
      default:
        return "Outros";
    }
  };

  const calculateDays = (start: string, end: string | null) => {
    if (!end) return 1;
    const diffTime = Math.abs(
      new Date(end).getTime() - new Date(start).getTime(),
    );
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1; // Inclusive
  };

  const filteredLeaves = leaves.filter((l) => {
    const contract = l.employment_contracts as any;
    if (selectedCompanyId && contract?.company_id !== selectedCompanyId) return false;
    const name = contract?.workers?.people?.full_name || "";
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const totalPages = Math.ceil(filteredLeaves.length / pageSize);
  const paginatedLeaves = filteredLeaves.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Stethoscope size={16} />
            <span>Gestão e Rotinas</span>
            <ChevronRight size={14} />
            <span className="text-slate-900 font-medium">Afastamentos</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 font-display tracking-tight">Afastamentos e Atestados</h1>
          <p className="text-sm text-slate-500 mt-1">Controle de licenças, faltas e envio para o eSocial (S-2230).</p>
        </div>
        
        <button 
          onClick={() => navigate('/afastamentos/novo')}
          className="btn-primary"
        >
          <Plus size={18} />
          <span>Registrar Afastamento</span>
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por colaborador..." 
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
        ) : filteredLeaves.length > 0 ? (
          <>
            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Colaborador</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Motivo / Tipo</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Período</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Sigilo Médico (CID)</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedLeaves.map((leave) => {
                  const name = leave.employment_contracts?.workers?.people?.full_name || "Desconhecido";
                  const days = calculateDays(leave.start_date, leave.end_date);

                  return (
                    <tr key={leave.id} className="hover:bg-slate-50/50 transition-colors group">
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
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Stethoscope size={16} className="text-slate-400" />
                          <span>{getLeaveTypeName(leave.leave_type)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-slate-700">
                          {new Date(leave.start_date).toLocaleDateString("pt-BR")}
                        </span>
                        <span className="text-xs text-slate-400 ml-1">
                          ({days} dia{days > 1 ? "s" : ""})
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {leave.icd_10_code ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            CID Restrito (Visualizar)
                          </span>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {leave.status === "APPROVED" ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border bg-emerald-50 text-emerald-700 border-emerald-200">
                            <CheckCircle size={14} className="mr-1" /> Aceito
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border bg-amber-50 text-amber-700 border-amber-200">
                            <FileWarning size={14} className="mr-1" /> Pendente RH
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => setSelectedLeaveView(leave)}
                            className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors cursor-pointer"
                            title="Visualizar Detalhes"
                          >
                            <FileText size={16} />
                          </button>
                          <button 
                            onClick={() => handleToggleStatus(leave.id, leave.status)}
                            className={`p-2 rounded-lg transition-colors cursor-pointer ${
                              leave.status === 'APPROVED' 
                                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' 
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={leave.status === 'APPROVED' ? "Mover para Pendente" : "Aprovar"}
                          >
                            <Power size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(leave.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredLeaves.length}
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
              <Stethoscope className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-1">Nenhum afastamento encontrado</h3>
            <p className="text-slate-500 max-w-sm mb-6">
              {searchTerm 
                ? "Não encontramos nenhum afastamento correspondente à sua busca."
                : "Você ainda não possui afastamentos cadastrados."}
            </p>
          </div>
        )}
      </div>

      {selectedLeaveView && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 animate-in fade-in backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="font-bold text-slate-900 font-display flex items-center gap-2">
                <FileText className="text-primary-600" size={18} />
                Detalhes do Afastamento
              </h2>
              <button
                onClick={() => setSelectedLeaveView(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">Colaborador</p>
                <p className="font-bold text-slate-900 text-lg">
                  {selectedLeaveView.employment_contracts?.workers?.people?.full_name || "Desconhecido"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">Motivo / Tipo</p>
                  <p className="font-medium text-slate-700 flex items-center gap-2">
                    <Stethoscope size={16} className="text-slate-400" />
                    {getLeaveTypeName(selectedLeaveView.leave_type)}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">Status</p>
                  {selectedLeaveView.status === "APPROVED" ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                      <CheckCircle size={12} className="mr-1" /> Aprovado
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                      <FileWarning size={12} className="mr-1" /> Pendente
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">Data Início</p>
                  <p className="font-medium text-slate-800 flex items-center gap-2">
                    <CalendarDays size={16} className="text-slate-400" />
                    {new Date(selectedLeaveView.start_date).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">Data Fim Prevista</p>
                  <p className="font-medium text-slate-800 flex items-center gap-2">
                    <CalendarDays size={16} className="text-slate-400" />
                    {selectedLeaveView.end_date ? new Date(selectedLeaveView.end_date).toLocaleDateString("pt-BR") : "Não definida"}
                  </p>
                </div>
              </div>

              <div className="bg-primary-50 p-4 rounded-lg border border-primary-100 flex items-center justify-between">
                <div>
                  <p className="text-primary-800 font-bold">Total de Dias</p>
                  <p className="text-sm text-primary-600">Afastamento registrado</p>
                </div>
                <div className="text-2xl font-extrabold text-primary-700">
                  {calculateDays(selectedLeaveView.start_date, selectedLeaveView.end_date)} dias
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">Código CID (Sigilo Médico)</p>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 font-mono text-sm text-slate-700">
                  {selectedLeaveView.icd_10_code ? selectedLeaveView.icd_10_code.toUpperCase() : "Não Informado / Restrito"}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedLeaveView(null)}
                className="btn-secondary"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
