import {
  CalendarDays,
  FileText,
  Clock,
  DollarSign,
  ChevronRight,
  ShieldCheck,
  Bell,
} from "lucide-react";

export default function EmployeePortal() {
  return (
    <div className="animate-fade-up max-w-5xl mx-auto space-y-6">
      {/* Header Profile */}
      <div className="glass bg-white rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start gap-6 border border-slate-200/60 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl -mr-20 -mt-20"></div>

        <div className="w-24 h-24 rounded-full bg-slate-100 border-4 border-white shadow-md flex items-center justify-center text-3xl text-slate-400 font-bold shrink-0 z-10">
          R
        </div>

        <div className="flex-1 text-center md:text-left z-10">
          <h1 className="text-2xl font-extrabold text-slate-900 font-display">
            Rafael Costa
          </h1>
          <p className="text-slate-500 font-medium">
            Desenvolvedor Frontend Sênior
          </p>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mt-4">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Vínculo Ativo
            </span>
            <span className="text-sm text-slate-500">Admissão: 10/01/2023</span>
            <span className="text-sm text-slate-500 border-l border-slate-300 pl-4">
              Matrícula: 10452
            </span>
          </div>
        </div>

        <div className="z-10 flex gap-2">
          <button className="p-2.5 rounded-full bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors relative">
            <Bell size={20} />
            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white"></span>
          </button>
        </div>
      </div>

      {/* Quick Actions / Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: "Meu Holerite",
            desc: "Outubro / 2024",
            icon: <DollarSign size={24} className="text-emerald-600" />,
            bg: "bg-emerald-50",
          },
          {
            title: "Bater Ponto",
            desc: "14:32 (Última: 12:00)",
            icon: <Clock size={24} className="text-indigo-600" />,
            bg: "bg-indigo-50",
          },
          {
            title: "Minhas Férias",
            desc: "12 dias disponíveis",
            icon: <CalendarDays size={24} className="text-amber-600" />,
            bg: "bg-amber-50",
          },
          {
            title: "Meus Documentos",
            desc: "1 pendência",
            icon: <FileText size={24} className="text-rose-600" />,
            bg: "bg-rose-50",
          },
        ].map((item, idx) => (
          <button
            key={idx}
            className="glass bg-white p-5 rounded-xl border border-slate-200 hover:border-primary-300 hover:shadow-md transition-all text-left group"
          >
            <div
              className={`w-12 h-12 rounded-lg ${item.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
            >
              {item.icon}
            </div>
            <h3 className="font-bold text-slate-800">{item.title}</h3>
            <p className="text-sm text-slate-500 mt-1">{item.desc}</p>
          </button>
        ))}
      </div>

      {/* Widgets Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Documentos Pendentes */}
        <div className="glass bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="text-primary-600" size={20} />
              Assinaturas Pendentes
            </h2>
            <button className="text-sm text-primary-600 font-medium hover:underline">
              Ver todos
            </button>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-lg border border-amber-200 bg-amber-50/50 flex items-center justify-between group">
              <div>
                <h4 className="font-bold text-slate-800 text-sm">
                  Atualização de Política de Segurança
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Emitido em 24/10/2024
                </p>
              </div>
              <button className="flex items-center gap-1 text-sm font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-md transition-colors">
                Assinar <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Férias Resumo */}
        <div className="glass bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <CalendarDays className="text-primary-600" size={20} />
              Resumo de Férias
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm font-medium mb-1">
                <span className="text-slate-600">
                  Período Aquisitivo (2023/2024)
                </span>
                <span className="text-slate-800">12 dias restantes</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5">
                <div
                  className="bg-emerald-500 h-2.5 rounded-full"
                  style={{ width: "60%" }}
                ></div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Você já gozou 18 dias deste período. O limite concessivo encerra
                em 09/01/2025.
              </p>
            </div>

            <button className="w-full py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors mt-2">
              Solicitar Férias
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
