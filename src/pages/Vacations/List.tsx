import { useState, useEffect } from "react";
import {
  Search,
  Plus,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
  CalendarSync,
  FileText,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { vacationService } from "../../services/vacationService";
import { useCompany } from "../../contexts/CompanyContext";

interface VacationVesting {
  id: string;
  start_date: string;
  end_date: string;
  concessive_end_date: string;
  earned_days: number;
  taken_days: number;
  status: string;
  employment_contracts: {
    workers: {
      people: {
        full_name: string;
      };
    } | null;
  } | null;
}

interface VacationRequest {
  id: string;
  start_date: string;
  end_date: string;
  days_taken: number;
  cash_allowance_days: number;
  status: string;
  vacation_vesting_periods: {
    employment_contracts: {
      workers: {
        people: {
          full_name: string;
        };
      } | null;
    } | null;
  } | null;
}

export default function VacationsList() {
  const navigate = useNavigate();
  const { selectedCompanyId } = useCompany();
  const [searchTerm, setSearchTerm] = useState("");
  const [vacations, setVacations] = useState<VacationVesting[]>([]);
  const [requests, setRequests] = useState<VacationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<"aquisitivos" | "programadas">(
    "aquisitivos",
  );

  useEffect(() => {
    fetchVacations();
  }, [activeTab, selectedCompanyId]);

  const fetchVacations = async () => {
    setLoading(true);
    try {
      if (activeTab === "aquisitivos") {
        const data = await vacationService.getEnrichedVestingPeriods();
        setVacations(data as any);
      } else {
        const data = await vacationService.getEnrichedRequests();
        setRequests(data as any);
      }
    } catch (error) {
      console.error("Erro ao buscar férias:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateVestingPeriods = async () => {
    setGenerating(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: tenantData } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", userData.user?.id)
        .single();

      if (!tenantData) throw new Error("Tenant não encontrado");

      const { data: contracts } = await supabase
        .from("employment_contracts")
        .select("id, admission_date")
        .eq("tenant_id", tenantData.tenant_id)
        .eq("status", "ACTIVE");

      let count = 0;
      if (contracts) {
        for (const contract of contracts) {
          const { data: existing } = await supabase
            .from("vacation_vesting_periods")
            .select("id")
            .eq("contract_id", contract.id);

          if (!existing || existing.length === 0) {
            const start = new Date(contract.admission_date);
            const end = new Date(start);
            end.setFullYear(end.getFullYear() + 1);

            const concStart = new Date(end);
            const concEnd = new Date(end);
            concEnd.setFullYear(concEnd.getFullYear() + 1);

            await supabase.from("vacation_vesting_periods").insert({
              tenant_id: tenantData.tenant_id,
              contract_id: contract.id,
              start_date: start.toISOString().split("T")[0],
              end_date: end.toISOString().split("T")[0],
              concessive_start_date: concStart.toISOString().split("T")[0],
              concessive_end_date: concEnd.toISOString().split("T")[0],
              earned_days: 30,
              status: "ACQUIRED",
            });
            count++;
          }
        }
      }
      alert(
        `Processamento concluído. ${count} novos períodos aquisitivos gerados.`,
      );
      fetchVacations();
    } catch (e: any) {
      console.error(e);
      alert(`Erro ao gerar períodos: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "IN_PROGRESS":
        return (
          <span className="badge-info">
            <Clock size={12} /> Em Andamento
          </span>
        );
      case "ACQUIRED":
        return (
          <span className="badge-success">
            <CheckCircle size={12} /> Adquirido
          </span>
        );
      case "PARTIALLY_TAKEN":
        return (
          <span className="badge-warning">
            <Clock size={12} /> Gozo Parcial
          </span>
        );
      case "COMPLETED":
        return <span className="badge-neutral">Concluído</span>;
      case "EXPIRED":
        return (
          <span className="badge-danger">
            <AlertCircle size={12} /> Vencido
          </span>
        );
      case "REQUESTED":
        return (
          <span className="badge-info">
            <Clock size={12} /> Solicitado
          </span>
        );
      case "APPROVED_MANAGER":
      case "APPROVED_DP":
        return (
          <span className="badge-success">
            <CheckCircle size={12} /> Aprovado
          </span>
        );
      default:
        return <span className="badge-neutral">{status}</span>;
    }
  };

  const filteredVacations = vacations.filter((vac) => {
    const contract = vac.employment_contracts as any;
    if (selectedCompanyId && contract?.company_id !== selectedCompanyId) return false;
    const name = contract?.workers?.people?.full_name || "";
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const filteredRequests = requests.filter((req) => {
    const contract = req.vacation_vesting_periods?.employment_contracts as any;
    if (selectedCompanyId && contract?.company_id !== selectedCompanyId) return false;
    const name = contract?.workers?.people?.full_name || "";
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="animate-fade-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display">
            Gestão de Férias
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Acompanhe os períodos aquisitivos e evite pagamentos em dobro
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={generateVestingPeriods}
            disabled={generating}
            className="btn-secondary"
          >
            {generating ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <CalendarSync size={18} />
            )}
            <span>Gerar Períodos</span>
          </button>
          <button
            onClick={() => navigate("/ferias/novo")}
            className="btn-primary"
          >
            <Plus size={18} />
            <span>Programar Férias</span>
          </button>
        </div>
      </div>

      <div className="flex space-x-1 border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab("aquisitivos")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-t-sm transition-colors ${activeTab === "aquisitivos" ? "bg-white shadow-[0_-2px_0_0_#0ea5e9] text-primary-700 border-t border-l border-r border-slate-200" : "text-slate-600 hover:bg-slate-100 border border-transparent"}`}
        >
          <CalendarSync size={16} /> Períodos Aquisitivos
        </button>
        <button
          onClick={() => setActiveTab("programadas")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-t-sm transition-colors ${activeTab === "programadas" ? "bg-white shadow-[0_-2px_0_0_#0ea5e9] text-primary-700 border-t border-l border-r border-slate-200" : "text-slate-600 hover:bg-slate-100 border border-transparent"}`}
        >
          <FileText size={16} /> Férias Programadas
        </button>
      </div>

      <div className="panel p-4 border-b-0 rounded-b-none">
        <div className="relative w-full md:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar por colaborador..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="panel rounded-t-none overflow-x-auto shadow-sm min-h-[300px]">
        <table className="w-full text-left border-collapse">
          <thead>
            {activeTab === "aquisitivos" ? (
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                <th className="px-6 py-4">Colaborador / Período Aquisitivo</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Dias (Adquiridos / Gozados)</th>
                <th className="px-6 py-4">Data Limite Concessiva</th>
              </tr>
            ) : (
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                <th className="px-6 py-4">Colaborador</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Dias de Gozo</th>
                <th className="px-6 py-4">Data de Início</th>
                <th className="px-6 py-4">Data de Retorno</th>
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-12 text-center text-slate-500"
                >
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-500 mb-2" />
                  Carregando...
                </td>
              </tr>
            ) : activeTab === "aquisitivos" ? (
              filteredVacations.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-slate-500 font-bold"
                  >
                    Nenhum período aquisitivo encontrado.
                  </td>
                </tr>
              ) : (
                filteredVacations.map((vac) => {
                  const name =
                    vac.employment_contracts?.workers?.people?.full_name ||
                    "Desconhecido";
                  const periodStart = vac.start_date
                    ? new Date(vac.start_date).getFullYear()
                    : "";
                  const periodEnd = vac.end_date
                    ? new Date(vac.end_date).getFullYear()
                    : "";

                  const limitDate = new Date(vac.concessive_end_date);
                  const isNearLimit =
                    (limitDate.getTime() - new Date().getTime()) /
                      (1000 * 3600 * 24) <
                    60;

                  return (
                    <tr
                      key={vac.id}
                      className="hover:bg-slate-50 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 font-bold border border-amber-100 uppercase">
                            {name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 font-display">
                              {name}
                            </p>
                            <p className="text-[10px] uppercase tracking-widest text-slate-500 mt-1 font-bold">
                              Período: {periodStart}/{periodEnd}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(vac.status)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-700">
                          {vac.taken_days}
                        </span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className="text-slate-500 font-medium">
                          {vac.earned_days} dias
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`font-bold ${isNearLimit ? "text-rose-600" : "text-slate-700"}`}
                        >
                          {limitDate.toLocaleDateString("pt-BR")}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )
            ) : filteredRequests.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-12 text-center text-slate-500 font-bold"
                >
                  Nenhuma programação de férias encontrada.
                </td>
              </tr>
            ) : (
              filteredRequests.map((req) => {
                const name =
                  req.vacation_vesting_periods?.employment_contracts?.workers
                    ?.people?.full_name || "Desconhecido";
                // To fix timezone issues just extract date string
                const getLocal = (d: string) => {
                  const dt = new Date(d);
                  dt.setMinutes(dt.getMinutes() + dt.getTimezoneOffset());
                  return dt.toLocaleDateString("pt-BR");
                };
                return (
                  <tr
                    key={req.id}
                    className="hover:bg-slate-50 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold border border-emerald-100 uppercase">
                          {name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 font-display">
                            {name}
                          </p>
                          {req.cash_allowance_days > 0 && (
                            <p className="text-[10px] uppercase tracking-widest text-amber-600 mt-1 font-bold">
                              Vendeu 10 dias (Abono)
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(req.status)}</td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-700">
                        {req.days_taken} dias
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-700">
                        {getLocal(req.start_date)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-700">
                        {getLocal(req.end_date)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
