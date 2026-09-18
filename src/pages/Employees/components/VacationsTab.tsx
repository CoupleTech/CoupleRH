import { useState, useEffect } from "react";
import { Plus, Calendar, AlertCircle } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { vacationService } from "../../../services/vacationService";
import VacationWizard from "../../Vacations/Wizard";
import { toast } from 'sonner';

interface VacationsTabProps {
  workerId: string | null;
  contract: any | null;
  onSaved: () => void;
}

export default function VacationsTab({ workerId, contract, onSaved }: VacationsTabProps) {
  const [vestingPeriods, setVestingPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPeriodId, setExpandedPeriodId] = useState<string | null>(null);

  useEffect(() => {
    if (contract?.id) {
      fetchVestingPeriods();
    } else {
      setLoading(false);
    }
  }, [contract]);

  const fetchVestingPeriods = async () => {
    try {
      setLoading(true);
      const periods = await vacationService.getVestingPeriodsByContract(contract.id);
      setVestingPeriods(periods);
    } catch (error) {
      console.error("Erro ao buscar períodos aquisitivos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePeriod = async () => {
    try {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      const { data: tenantData } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", userData.user?.id)
        .single();

      let start = new Date(contract.admission_date);
      if (vestingPeriods && vestingPeriods.length > 0) {
        // Encontra a maior data de fim
        const lastEnd = new Date(Math.max(...vestingPeriods.map(p => new Date(p.end_date).getTime())));
        start = new Date(lastEnd);
        start.setDate(start.getDate() + 1);
      }

      const end = new Date(start);
      end.setFullYear(end.getFullYear() + 1);
      end.setDate(end.getDate() - 1);

      const concStart = new Date(end);
      concStart.setDate(concStart.getDate() + 1);
      const concEnd = new Date(concStart);
      concEnd.setFullYear(concEnd.getFullYear() + 1);
      concEnd.setDate(concEnd.getDate() - 1);

      await vacationService.createVestingPeriod({
        tenant_id: tenantData?.tenant_id,
        contract_id: contract.id,
        start_date: start.toISOString().split("T")[0],
        end_date: end.toISOString().split("T")[0],
        concessive_start_date: concStart.toISOString().split("T")[0],
        concessive_end_date: concEnd.toISOString().split("T")[0],
        earned_days: 30,
        status: "ACQUIRED"
      });

      await fetchVestingPeriods();
    } catch (e: any) {
      toast.error("Erro ao gerar período: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!workerId || !contract) {
    return (
      <div className="card p-8 text-center bg-slate-50 border-dashed">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="text-slate-400" size={24} />
        </div>
        <h3 className="text-lg font-medium text-slate-900 mb-1">
          Nenhum contrato ativo
        </h3>
        <p className="text-slate-500 max-w-md mx-auto">
          Para gerenciar férias, é necessário que o empregado tenha um contrato vinculado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-display">Períodos Aquisitivos</h2>
          <p className="text-sm text-slate-500">Histórico de direitos a férias do empregado.</p>
        </div>
        <button 
          onClick={handleCreatePeriod}
          disabled={loading}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus size={18} />
          <span>Novo Período</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : vestingPeriods.length === 0 ? (
        <div className="card p-12 text-center bg-slate-50 border-dashed">
          <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center mx-auto mb-4">
            <Calendar className="text-slate-400" size={24} />
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">
            Nenhum período aquisitivo
          </h3>
          <p className="text-slate-500">
            Este contrato ainda não possui períodos aquisitivos registrados.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {vestingPeriods.map((period) => (
            <div key={period.id} className="card p-5 border-l-4 border-l-primary-500 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-slate-800">
                    Período Aquisitivo: {new Date(period.start_date).toLocaleDateString()} a {new Date(period.end_date).toLocaleDateString()}
                  </h3>
                  <div className="flex gap-4 mt-2 text-sm text-slate-600">
                    <div>
                      <span className="font-medium">Direito:</span> {period.earned_days} dias
                    </div>
                    <div>
                      <span className="font-medium">Gozados:</span> {period.taken_days} dias
                    </div>
                    <div>
                      <span className="font-medium">Saldo:</span> {period.earned_days - period.taken_days - period.lost_days} dias
                    </div>
                  </div>
                </div>
                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                  period.status === 'ACQUIRED' ? 'bg-green-100 text-green-700' :
                  period.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                  period.status === 'COMPLETED' ? 'bg-slate-100 text-slate-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {period.status}
                </span>
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-100">
                {expandedPeriodId === period.id ? (
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mt-2">
                    <h4 className="text-base font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-200">
                      Agendar Férias
                    </h4>
                    <VacationWizard 
                      inline 
                      preselectedPeriodId={period.id}
                      onSaved={() => {
                        setExpandedPeriodId(null);
                        fetchVestingPeriods();
                      }}
                      onCancel={() => setExpandedPeriodId(null)}
                    />
                  </div>
                ) : (
                  <button 
                    onClick={() => setExpandedPeriodId(period.id)}
                    className="text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
                  >
                    <Plus size={16} />
                    Agendar Férias
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
