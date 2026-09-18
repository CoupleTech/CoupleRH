import { useState, useEffect } from "react";
import {
  Users,
  Building2,
  AlertOctagon,
  TrendingUp,
  CheckCircle,
  Activity,
  ChevronRight,
  Loader2,
  Calculator,
  CalendarDays,
  Clock,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeEmployees: 0,
    companies: 0,
    rejectedEsocial: 0,
  });
  const [biData, setBiData] = useState<any>({
    headcount_evolution: [],
    turnover: [],
    absenteeism: [],
    salary_distribution: []
  });



  const fetchDashboardData = async () => {
    setLoading(true);

    const [
      { count: empCount },
      { count: compCount },
      { count: esocialFailed },
      { data: recentActivity },
      { data: biAnalytics }
    ] = await Promise.all([
      supabase.from("employment_contracts").select("*", { count: "exact", head: true }).eq("status", "ACTIVE"),
      supabase.from("companies").select("*", { count: "exact", head: true }),
      supabase.from("esocial_transmissions").select("*", { count: "exact", head: true }).eq("status", "REJECTED"),
      supabase.from("esocial_transmissions").select("*").order("created_at", { ascending: false }).limit(5),
      supabase.rpc("get_bi_dashboard_analytics")
    ]);

    setStats({
      activeEmployees: empCount || 0,
      companies: compCount || 0,
      rejectedEsocial: esocialFailed || 0,
    });

    if (recentActivity) setRecentTransmissions(recentActivity);
    if (biAnalytics) setBiData(biAnalytics);
    
    setLoading(false);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const statusColor = (status: string) => {
    switch (status) {
      case "ACCEPTED":
        return "badge-success";
      case "REJECTED":
        return "badge-danger";
      case "PROCESSING":
        return "badge-warning";
      default:
        return "badge-neutral";
    }
  };

  const now = new Date();
  const greeting =
    now.getHours() < 12
      ? "Bom dia"
      : now.getHours() < 18
        ? "Boa tarde"
        : "Boa noite";
  const monthName = now.toLocaleString("pt-BR", { month: "long" });

  return (
    <div className="animate-fade-up">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-slate-900 font-display">
          {greeting} 👋
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Painel operacional · Competência {monthName} {now.getFullYear()}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            <p className="text-sm text-slate-400 font-medium">
              Carregando dados...
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="kpi-card animate-fade-up stagger-1 group hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 rounded-lg bg-primary-50 text-primary-500">
                  <Users size={18} />
                </div>
                <span className="badge-info">Ativos</span>
              </div>
              <p className="kpi-value">{stats.activeEmployees}</p>
              <p className="kpi-label mt-1">Colaboradores</p>
            </div>

            <div className="kpi-card animate-fade-up stagger-2 group hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 rounded-lg bg-emerald-50 text-emerald-500">
                  <Building2 size={18} />
                </div>
                <span className="badge-success">Ativas</span>
              </div>
              <p className="kpi-value">{stats.companies}</p>
              <p className="kpi-label mt-1">Empresas</p>
            </div>

            <div
              className={`kpi-card animate-fade-up stagger-3 group hover:shadow-md transition-shadow ${stats.rejectedEsocial > 0 ? "ring-1 ring-red-200" : ""}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className={`p-2 rounded-lg ${stats.rejectedEsocial > 0 ? "bg-red-50 text-red-500" : "bg-slate-50 text-slate-400"}`}
                >
                  <AlertOctagon size={18} />
                </div>
                {stats.rejectedEsocial > 0 ? (
                  <span className="badge-danger animate-pulse-ring">
                    Atenção
                  </span>
                ) : (
                  <span className="badge-success">OK</span>
                )}
              </div>
              <p
                className={`kpi-value ${stats.rejectedEsocial > 0 ? "text-red-600" : ""}`}
              >
                {stats.rejectedEsocial}
              </p>
              <p className="kpi-label mt-1">Rejeições eSocial</p>
            </div>

            <div className="kpi-card animate-fade-up stagger-4 group hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 rounded-lg bg-amber-50 text-amber-500">
                  <Calculator size={18} />
                </div>
                <span className="badge-neutral">Folha</span>
              </div>
              <p className="kpi-value text-slate-400 text-2xl">—</p>
              <p className="kpi-label mt-1">Competência aberta</p>
            </div>
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Chart Area */}
            <div className="lg:col-span-3 panel-flush flex flex-col">
              <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-900 font-display text-sm">
                    Evolução do Quadro
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Últimos 7 meses
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-1 rounded-md">
                  <TrendingUp size={12} />
                  Crescendo
                </div>
              </div>
              <div className="p-6 flex-1 flex flex-col justify-end min-h-[280px]">
                <div className="flex items-end justify-between gap-3 h-44">
                  {(biData.headcount_evolution.length > 0 ? biData.headcount_evolution : Array.from({length: 7}).map(() => ({month: '', count: 0}))).map(
                    (item: any, i: number, arr: any[]) => {
                      const maxHeadcount = Math.max(...arr.map(d => d.count), 10);
                      const height = Math.max(10, Math.min(100, (item.count / maxHeadcount) * 100));
                      const isCurrent = i === arr.length - 1;
                      
                      return (
                        <div
                          key={i}
                          className="flex flex-col items-center gap-2 flex-1 group"
                        >
                          <span
                            className={`text-[11px] font-bold tabular-nums transition-opacity ${isCurrent ? "text-primary-600 opacity-100" : "text-slate-400 opacity-0 group-hover:opacity-100"}`}
                          >
                            {item.count}
                          </span>
                          <div
                            className={`w-full rounded-t-md transition-all duration-300 ${
                              isCurrent
                                ? "bg-primary-500 shadow-sm shadow-primary-500/20"
                                : "bg-slate-200 group-hover:bg-primary-300"
                            }`}
                            style={{ height: `${height}%` }}
                          />
                          <span
                            className={`text-[10px] font-semibold uppercase ${isCurrent ? "text-primary-600" : "text-slate-400"}`}
                          >
                            {item.month.substring(0,2)}
                          </span>
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            </div>

            {/* Recent eSocial */}
            <div className="lg:col-span-2 panel-flush flex flex-col">
              <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-900 font-display text-sm">
                    eSocial
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Transmissões recentes
                  </p>
                </div>
                <Activity size={16} className="text-slate-400" />
              </div>
              <div className="flex-1 overflow-auto">
                {recentTransmissions.length === 0 ? (
                  <div className="p-8 text-center">
                    <Activity
                      size={32}
                      className="text-slate-200 mx-auto mb-3"
                    />
                    <p className="text-sm text-slate-400 font-medium">
                      Nenhuma transmissão recente
                    </p>
                    <p className="text-xs text-slate-300 mt-1">
                      Eventos aparecerão aqui quando processados
                    </p>
                  </div>
                ) : (
                  <ul>
                    {recentTransmissions.map((t, idx) => (
                      <li
                        key={t.id}
                        className={`px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors ${idx < recentTransmissions.length - 1 ? "border-b border-slate-100" : ""}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-bold text-slate-800 font-mono">
                              {t.event_type}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono tabular-nums">
                            {new Date(t.created_at).toLocaleString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <span className={statusColor(t.status)}>
                          {t.status === "ACCEPTED" && <CheckCircle size={11} />}
                          {t.status === "REJECTED" && (
                            <AlertOctagon size={11} />
                          )}
                          {t.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <Link
                to="/esocial"
                className="px-5 py-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-xs font-semibold text-primary-500 hover:text-primary-600 hover:bg-primary-50/50 transition-colors"
              >
                Ver central eSocial <ChevronRight size={14} />
              </Link>
            </div>
          </div>

          {/* Novos Painéis de BI */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            
            {/* Turnover */}
            <div className="panel-flush flex flex-col">
              <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-900 font-display text-sm">Turnover</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Admissões vs Rescisões</p>
                </div>
                <div className="p-1.5 bg-indigo-50 text-indigo-500 rounded-md">
                  <Activity size={14} />
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-center">
                <div className="space-y-4">
                  {(biData.turnover || []).slice(-4).map((item: any, i: number) => {
                    const maxEvents = Math.max(...biData.turnover.map((d:any) => d.admissions + d.resignations), 10);
                    const admWidth = (item.admissions / maxEvents) * 100;
                    const resWidth = (item.resignations / maxEvents) * 100;
                    
                    return (
                      <div key={i} className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-slate-700">{item.month}</span>
                          <span className="font-medium text-slate-500">{item.rate}% Tx</span>
                        </div>
                        <div className="flex w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                          <div className="bg-emerald-400 h-full transition-all" style={{width: `${admWidth}%`}} title={`Admissões: ${item.admissions}`} />
                          <div className="bg-rose-400 h-full transition-all" style={{width: `${resWidth}%`}} title={`Demissões: ${item.resignations}`} />
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>{item.admissions} adm</span>
                          <span>{item.resignations} dem</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Absenteísmo */}
            <div className="panel-flush flex flex-col">
              <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-900 font-display text-sm">Absenteísmo</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Afastamentos e Faltas</p>
                </div>
                <div className="p-1.5 bg-rose-50 text-rose-500 rounded-md">
                  <Clock size={14} />
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-end min-h-[220px]">
                <div className="flex items-end justify-between gap-2 h-36">
                  {(biData.absenteeism || []).slice(-6).map((item: any, i: number, arr: any[]) => {
                      const maxRate = Math.max(...arr.map(d => d.rate), 5);
                      const height = Math.max(5, Math.min(100, (item.rate / maxRate) * 100));
                      
                      return (
                        <div key={i} className="flex flex-col items-center gap-2 flex-1 group">
                          <span className="text-[10px] font-bold text-slate-400 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                            {item.rate}%
                          </span>
                          <div
                            className="w-full rounded-t-sm bg-rose-200 group-hover:bg-rose-400 transition-all duration-300"
                            style={{ height: `${height}%` }}
                          />
                          <span className="text-[10px] font-semibold text-slate-400 uppercase">
                            {item.month.substring(0,2)}
                          </span>
                        </div>
                      );
                  })}
                </div>
              </div>
            </div>

            {/* Distribuição Salarial */}
            <div className="panel-flush flex flex-col">
              <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-900 font-display text-sm">Salários</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Distribuição do quadro ativo</p>
                </div>
                <div className="p-1.5 bg-amber-50 text-amber-500 rounded-md">
                  <Building2 size={14} />
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-center">
                <div className="space-y-4">
                  {biData.salary_distribution && biData.salary_distribution.length > 0 ? (
                    biData.salary_distribution.map((item: any, i: number) => {
                      const maxCount = Math.max(...biData.salary_distribution.map((d:any) => d.count), 1);
                      const width = Math.max(5, (item.count / maxCount) * 100);
                      
                      return (
                        <div key={i} className="flex flex-col gap-1.5">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-slate-600">{item.range}</span>
                            <span className="font-bold text-slate-800">{item.count}</span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="bg-amber-400 h-full rounded-full transition-all duration-500" 
                              style={{width: `${width}%`}}
                            />
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="text-center text-slate-400 text-sm">Sem dados salariais</div>
                  )}
                </div>
              </div>
            </div>
            
          </div>

          {/* Quick Actions */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link
              to="/folha/processamento"
              className="panel p-4 flex items-center gap-3 hover:shadow-md hover:border-primary-200 transition-all group"
            >
              <div className="p-2.5 rounded-lg bg-primary-50 text-primary-500 group-hover:bg-primary-500 group-hover:text-white transition-colors">
                <Calculator size={18} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  Processar Folha
                </p>
                <p className="text-xs text-slate-400">Abrir motor de cálculo</p>
              </div>
              <ChevronRight
                size={16}
                className="ml-auto text-slate-300 group-hover:text-primary-500 transition-colors"
              />
            </Link>
            <Link
              to="/funcionarios"
              className="panel p-4 flex items-center gap-3 hover:shadow-md hover:border-primary-200 transition-all group"
            >
              <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                <Users size={18} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  Colaboradores
                </p>
                <p className="text-xs text-slate-400">Gestão de pessoal</p>
              </div>
              <ChevronRight
                size={16}
                className="ml-auto text-slate-300 group-hover:text-emerald-500 transition-colors"
              />
            </Link>
            <Link
              to="/ferias"
              className="panel p-4 flex items-center gap-3 hover:shadow-md hover:border-primary-200 transition-all group"
            >
              <div className="p-2.5 rounded-lg bg-amber-50 text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                <CalendarDays size={18} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Férias</p>
                <p className="text-xs text-slate-400">Programação e controle</p>
              </div>
              <ChevronRight
                size={16}
                className="ml-auto text-slate-300 group-hover:text-amber-500 transition-colors"
              />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
