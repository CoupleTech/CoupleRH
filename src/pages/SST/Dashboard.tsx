import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  ShieldAlert,
  HeartPulse,
  HardHat,
  FileBadge,
  Loader2,
  Plus,
  X,
  Trash2
} from "lucide-react";
import { supabase } from "../../lib/supabase";

interface HealthExam {
  id: string;
  exam_type: string;
  exam_date: string;
  doctor_crm: string;
  doctor_name: string;
  result: string;
  employment_contracts: {
    workers: {
      people: {
        full_name: string;
      };
    };
  } | null;
}

export default function SstDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [exams, setExams] = useState<HealthExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sst_health_exams")
      .select(
        `
        *,
        employment_contracts (
          workers (
            people (
              full_name
            )
          )
        )
      `,
      )
      .order("created_at", { ascending: false });

    if (!error && data) {
      setExams(data as any);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Deseja realmente excluir este ASO?")) return;
    
    const { error } = await supabase
      .from("sst_health_exams")
      .delete()
      .eq("id", id);
      
    if (error) {
      alert("Erro ao excluir ASO.");
    } else {
      setExams(exams.filter(e => e.id !== id));
    }
  };

  const filteredExams = exams.filter((exam) => {
    const name = exam.employment_contracts?.workers?.people?.full_name || "";
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="animate-fade-up relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display">
            Saúde e Segurança (SST)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gestão de Exames, Riscos Ambientais e EPIs (S-2210, S-2220, S-2240)
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg font-bold shadow-sm hover:bg-emerald-700 transition-colors"
        >
          <HeartPulse size={18} />
          <span>Registrar Novo ASO</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <button className="card p-6 hover:border-primary-300 hover:shadow-md transition-all text-left">
          <div className="bg-primary-50 w-12 h-12 rounded-lg flex items-center justify-center text-primary-600 mb-4">
            <HeartPulse size={24} />
          </div>
          <h3 className="font-bold text-slate-900 text-lg mb-1 font-display">
            Exames Médicos (ASO)
          </h3>
          <p className="text-sm text-slate-500">
            Controle de periódicos, admissionais e demissionais.
          </p>
        </button>

        <button className="card p-6 hover:border-amber-300 hover:shadow-md transition-all text-left">
          <div className="bg-amber-50 w-12 h-12 rounded-lg flex items-center justify-center text-amber-600 mb-4">
            <ShieldAlert size={24} />
          </div>
          <h3 className="font-bold text-slate-900 text-lg mb-1 font-display">
            Ambientes e Riscos
          </h3>
          <p className="text-sm text-slate-500">
            Mapeamento de insalubridade e periculosidade.
          </p>
        </button>

        <button className="card p-6 hover:border-rose-300 hover:shadow-md transition-all text-left">
          <div className="bg-rose-50 w-12 h-12 rounded-lg flex items-center justify-center text-rose-600 mb-4">
            <HardHat size={24} />
          </div>
          <h3 className="font-bold text-slate-900 text-lg mb-1 font-display">
            EPI / EPC
          </h3>
          <p className="text-sm text-slate-500">
            Entrega de equipamentos e assinaturas eletrônicas.
          </p>
        </button>
      </div>

      <div className="card-flush">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 font-display">
            <FileBadge size={20} className="text-primary-600" /> Últimos ASOs
          </h2>
          <div className="relative w-full md:w-96">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar colaborador..."
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
                <th className="px-6 py-4">Colaborador</th>
                <th className="px-6 py-4">Tipo do Exame</th>
                <th className="px-6 py-4">Data Realizada</th>
                <th className="px-6 py-4">Médico (CRM)</th>
                <th className="px-6 py-4">Resultado</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-500 mb-2" />
                    Carregando exames médicos...
                  </td>
                </tr>
              ) : filteredExams.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-slate-500 font-medium"
                  >
                    Nenhum ASO encontrado.
                  </td>
                </tr>
              ) : (
                filteredExams.map((exam) => {
                  const name =
                    exam.employment_contracts?.workers?.people?.full_name ||
                    "Funcionário Desconhecido";
                  const typeMap: any = {
                    ADMISSIONAL: "Admissional",
                    PERIODIC: "Periódico",
                    RETURN_TO_WORK: "Retorno ao Trabalho",
                    CHANGE_OF_RISK: "Mudança de Risco",
                    DEMISSIONAL: "Demissional",
                  };

                  return (
                    <tr
                      key={exam.id}
                      className="hover:bg-slate-50 transition-colors group"
                    >
                      <td className="px-6 py-4 font-bold text-slate-800">
                        {name}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-600">
                        {typeMap[exam.exam_type] || exam.exam_type}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {new Date(exam.exam_date).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {exam.doctor_name} <br />
                        <span className="text-xs text-slate-400">
                          {exam.doctor_crm}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {exam.result === "FIT" ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-widest">
                            APTO
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-lg bg-rose-100 text-rose-800 text-[10px] font-bold uppercase tracking-widest">
                            INAPTO
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button className="text-sm text-primary-600 font-bold hover:underline">
                            Ver PDF
                          </button>
                          <button 
                            onClick={() => handleDelete(exam.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Simples de Novo ASO */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 animate-in fade-in backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h2 className="font-bold text-slate-900 font-display flex items-center gap-2">
                <HeartPulse className="text-primary-600" size={18} />
                Registrar Novo ASO
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-500 mb-6">
                Selecione o funcionário e preencha os dados do exame clínico
                para transmitir o evento S-2220 ao eSocial.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-700 mb-1.5">
                    Funcionário (Contrato)
                  </label>
                  <select className="block w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500">
                    <option>Selecione um funcionário ativo...</option>
                    {/* Aqui entraríamos com a lista real de contracts */}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-700 mb-1.5">
                      Tipo de Exame
                    </label>
                    <select className="block w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500">
                      <option value="ADMISSIONAL">Admissional</option>
                      <option value="PERIODIC">Periódico</option>
                      <option value="DEMISSIONAL">Demissional</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-700 mb-1.5">
                      Data do Exame
                    </label>
                    <input
                      type="date"
                      className="block w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-700 mb-1.5">
                      Nome do Médico
                    </label>
                    <input
                      type="text"
                      placeholder="Dr. Nome"
                      className="block w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest font-bold text-slate-700 mb-1.5">
                      CRM do Médico
                    </label>
                    <input
                      type="text"
                      placeholder="CRM/UF"
                      className="block w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 rounded-b-lg">
              <button
                onClick={() => setIsModalOpen(false)}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={() => setIsModalOpen(false)}
                className="btn-primary"
              >
                Salvar ASO (Gerar S-2220)
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
