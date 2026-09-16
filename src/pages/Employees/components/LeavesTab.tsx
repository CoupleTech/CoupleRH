import { useState, useEffect } from "react";
import { Plus, Stethoscope, CalendarDays, AlertTriangle, XCircle } from "lucide-react";
import { leaveService } from "../../../services/leaveService";
import LeaveWizard from "../../Leaves/Wizard";

interface LeavesTabProps {
  employee: any;
}

const LEAVE_TYPES: Record<string, { label: string; icon: any; color: string }> = {
  SICK_LEAVE: { label: "Atestado Médico", icon: Stethoscope, color: "text-blue-600 bg-blue-50 border-blue-100" },
  MATERNITY: { label: "Licença Maternidade", icon: CalendarDays, color: "text-pink-600 bg-pink-50 border-pink-100" },
  PATERNITY: { label: "Licença Paternidade", icon: CalendarDays, color: "text-sky-600 bg-sky-50 border-sky-100" },
  WORK_ACCIDENT: { label: "Acidente de Trabalho", icon: AlertTriangle, color: "text-red-600 bg-red-50 border-red-100" },
  UNJUSTIFIED_ABSENCE: { label: "Falta Injustificada", icon: XCircle, color: "text-orange-600 bg-orange-50 border-orange-100" },
  SUSPENSION: { label: "Suspensão", icon: AlertTriangle, color: "text-purple-600 bg-purple-50 border-purple-100" },
  OTHER: { label: "Outros", icon: CalendarDays, color: "text-slate-600 bg-slate-50 border-slate-100" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pendente", color: "bg-yellow-100 text-yellow-800" },
  APPROVED: { label: "Aprovado", color: "bg-emerald-100 text-emerald-800" },
  REJECTED: { label: "Rejeitado", color: "bg-red-100 text-red-800" },
};

export default function LeavesTab({ employee }: LeavesTabProps) {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (employee?.employment_contracts?.[0]?.id) {
      fetchLeaves(employee.employment_contracts[0].id);
    } else {
      setLoading(false);
    }
  }, [employee]);

  const fetchLeaves = async (contractId: string) => {
    try {
      const data = await leaveService.getLeavesByContract(contractId);
      setLeaves(data || []);
    } catch (error) {
      console.error("Erro ao buscar afastamentos:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateDays = (start: string, end: string | null) => {
    if (!end) return 1;
    const diffTime = Math.abs(new Date(end).getTime() - new Date(start).getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  return (
    <div className="space-y-6">
      {!isAdding ? (
        <>
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                Histórico de Afastamentos
              </h3>
              <p className="text-sm text-slate-500">
                Atestados médicos, licenças e faltas vinculadas ao contrato atual.
              </p>
            </div>
            <button
              onClick={() => setIsAdding(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={16} />
              Registrar Afastamento
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500">
              Carregando histórico...
            </div>
          ) : leaves.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
              <Stethoscope className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-slate-700 font-medium">Nenhum afastamento</h4>
              <p className="text-slate-500 text-sm mt-1">
                Este colaborador não possui registros de licenças ou atestados.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {leaves.map((leave) => {
                const typeConfig = LEAVE_TYPES[leave.leave_type] || LEAVE_TYPES.OTHER;
                const Icon = typeConfig.icon;
                const statusConfig = STATUS_CONFIG[leave.status];
                const days = calculateDays(leave.start_date, leave.end_date);

                return (
                  <div
                    key={leave.id}
                    className="p-5 border border-slate-200 rounded-xl hover:shadow-md transition-shadow bg-white flex items-start justify-between"
                  >
                    <div className="flex gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${typeConfig.color}`}>
                        <Icon size={24} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 flex items-center gap-2">
                          {typeConfig.label}
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                        </h4>
                        <div className="mt-1 flex gap-4 text-sm text-slate-600">
                          <div>
                            <strong>Início:</strong> {new Date(new Date(leave.start_date).getTime() + new Date(leave.start_date).getTimezoneOffset() * 60000).toLocaleDateString("pt-BR")}
                          </div>
                          {leave.end_date && (
                            <div>
                              <strong>Término:</strong> {new Date(new Date(leave.end_date).getTime() + new Date(leave.end_date).getTimezoneOffset() * 60000).toLocaleDateString("pt-BR")}
                            </div>
                          )}
                          <div>
                            <strong>Total:</strong> {days} dia(s)
                          </div>
                        </div>
                        {leave.icd_10_code && (
                          <div className="mt-2 text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded inline-block">
                            CID: {leave.icd_10_code}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="card p-6 border-l-4 border-l-primary-500">
          <LeaveWizard 
            inline 
            preselectedContractId={employee?.employment_contracts?.[0]?.id}
            onSaved={() => {
              setIsAdding(false);
              if (employee?.employment_contracts?.[0]?.id) {
                fetchLeaves(employee.employment_contracts[0].id);
              }
            }}
            onCancel={() => setIsAdding(false)}
          />
        </div>
      )}
    </div>
  );
}
