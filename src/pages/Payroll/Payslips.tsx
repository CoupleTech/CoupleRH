import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  FileText,
  Download,
  Eye,
  ExternalLink,
  Loader2,
  Calendar,
  X,
  Code
} from "lucide-react";
import { supabase } from "../../lib/supabase";

interface PayrollPeriod {
  id: string;
  month: number;
  year: number;
  type: string;
  status: string;
}

interface PayslipPreview {
  id: string;
  net_salary: number;
  total_earnings: number;
  total_deductions: number;
  base_inss: number;
  base_irrf: number;
  base_fgts: number;
  fgts_month: number;
  status: string;
  employment_contracts: {
    role: string;
    workers: {
      people: {
        full_name: string;
      };
    };
  };
}

interface PayslipItem {
  id: string;
  type: string;
  amount: number;
  reference: string;
  rubrics: {
    code: string;
    name: string;
  };
}

export default function Payslips() {
  const [searchTerm, setSearchTerm] = useState("");
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [payslips, setPayslips] = useState<PayslipPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPeriods, setLoadingPeriods] = useState(true);

  // Modal de Holerite
  const [isHoleriteModalOpen, setIsHoleriteModalOpen] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipPreview | null>(null);
  const [payslipItems, setPayslipItems] = useState<PayslipItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Modal de Memória
  const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
  const [memoryLog, setMemoryLog] = useState<any[]>([]);
  const [loadingMemory, setLoadingMemory] = useState(false);

  useEffect(() => {
    fetchPeriods();
  }, []);

  useEffect(() => {
    if (selectedPeriod) {
      fetchPayslips(selectedPeriod);
    } else {
      setPayslips([]);
    }
  }, [selectedPeriod]);

  const fetchPeriods = async () => {
    setLoadingPeriods(true);
    const { data: userData } = await supabase.auth.getUser();
    const { data: tenantData } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", userData.user?.id)
      .single();

    if (tenantData) {
      const { data, error } = await supabase
        .from("payroll_periods")
        .select("id, month, year, type, status")
        .eq("tenant_id", tenantData.tenant_id)
        .order("year", { ascending: false })
        .order("month", { ascending: false });

      if (!error && data && data.length > 0) {
        setPeriods(data as PayrollPeriod[]);
        setSelectedPeriod(data[0].id); // Seleciona o mais recente
      }
    }
    setLoadingPeriods(false);
  };

  const fetchPayslips = async (periodId: string) => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const { data: tenantData } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", userData.user?.id)
      .single();

    if (tenantData) {
      const { data, error } = await supabase
        .from("payslips")
        .select(`
          id,
          net_salary,
          total_earnings,
          total_deductions,
          base_inss,
          base_irrf,
          base_fgts,
          fgts_month,
          status,
          employment_contracts (
            role,
            workers (
              people (
                full_name
              )
            )
          )
        `)
        .eq("tenant_id", tenantData.tenant_id)
        .eq("period_id", periodId);

      if (!error && data) {
        // Ordenação manual por nome
        const sorted = (data as any[]).sort((a, b) => {
          const nameA = a.employment_contracts?.workers?.people?.full_name || "";
          const nameB = b.employment_contracts?.workers?.people?.full_name || "";
          return nameA.localeCompare(nameB);
        });
        setPayslips(sorted);
      }
    }
    setLoading(false);
  };

  const openHolerite = async (slip: PayslipPreview) => {
    setSelectedPayslip(slip);
    setIsHoleriteModalOpen(true);
    setLoadingItems(true);

    const { data, error } = await supabase
      .from("payslip_items")
      .select(`
        id,
        type,
        amount,
        reference,
        payroll_rubrics:rubric_id (
          code,
          name
        )
      `)
      .eq("payslip_id", slip.id);

    if (!error && data) {
      // Map para adequar aos tipos (as foreign keys são devolvidas como objetos)
      const formatted = data.map((item: any) => ({
        id: item.id,
        type: item.type,
        amount: item.amount,
        reference: item.reference,
        rubrics: {
          code: item.payroll_rubrics?.code || "",
          name: item.payroll_rubrics?.name || ""
        }
      }));
      setPayslipItems(formatted);
    } else {
      setPayslipItems([]);
    }
    setLoadingItems(false);
  };

  const openMemory = async (slip: PayslipPreview) => {
    setSelectedPayslip(slip);
    setIsMemoryModalOpen(true);
    setLoadingMemory(true);

    const { data, error } = await supabase
      .from("payroll_memory_calc")
      .select("logs")
      .eq("payslip_id", slip.id)
      .maybeSingle();

    if (!error && data && data.logs) {
      try {
         // Tenta parse se for string json, ou já usa se for array de objetos (jsonb)
         const logsArray = typeof data.logs === 'string' ? JSON.parse(data.logs) : data.logs;
         setMemoryLog(Array.isArray(logsArray) ? logsArray : []);
      } catch (e) {
         setMemoryLog([]);
      }
    } else {
      setMemoryLog([]);
    }
    setLoadingMemory(false);
  };

  const getPeriodLabel = (p: PayrollPeriod) => {
    const month = p.month.toString().padStart(2, "0");
    const types = {
      MONTHLY: "Mensal",
      ADVANCE: "Adiantamento",
      VACATION: "Férias",
      THIRTEENTH: "13º Salário",
      SEVERANCE: "Rescisão"
    };
    const t = types[p.type as keyof typeof types] || p.type;
    return `${month}/${p.year} - ${t}`;
  };

  const filteredPayslips = payslips.filter((c) => {
    const name = c.employment_contracts?.workers?.people?.full_name || "";
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="animate-fade-up max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display flex items-center gap-2">
            <FileText className="text-primary-600" />
            Holerites Gerados
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Conferência detalhada e recibos da folha processada
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
              placeholder="Buscar por colaborador..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <Calendar className="text-slate-400" size={18} />
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              disabled={loadingPeriods}
              className="bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-lg px-4 py-2 focus:outline-none focus:border-primary-500"
            >
              {loadingPeriods ? (
                <option value="">Carregando...</option>
              ) : periods.length === 0 ? (
                <option value="">Nenhum período calculado</option>
              ) : (
                periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {getPeriodLabel(p)}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                <th className="px-6 py-4">Colaborador</th>
                <th className="px-6 py-4">Cargo</th>
                <th className="px-6 py-4 text-right">Líquido Final</th>
                <th className="px-6 py-4 text-center">Status</th>
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
                    Buscando recibos...
                  </td>
                </tr>
              ) : filteredPayslips.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-slate-500 font-bold"
                  >
                    {periods.length === 0 
                      ? "Processe a folha para gerar holerites."
                      : "Nenhum holerite encontrado neste período."}
                  </td>
                </tr>
              ) : (
                filteredPayslips.map((slip) => {
                  const name =
                    slip.employment_contracts?.workers?.people?.full_name || "Desconhecido";
                  return (
                    <tr
                      key={slip.id}
                      className="hover:bg-slate-50 transition-colors group"
                    >
                      <td className="px-6 py-4 font-bold text-slate-800">
                        {name}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {slip.employment_contracts?.role || "-"}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900 text-right">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(slip.net_salary || 0)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${
                          slip.status === 'CALCULATED' ? 'bg-primary-50 text-primary-700' :
                          slip.status === 'CLOSED' ? 'bg-emerald-50 text-emerald-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {slip.status === 'CALCULATED' ? 'Calculado' : slip.status === 'CLOSED' ? 'Fechado' : slip.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openHolerite(slip)}
                            className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="Visualizar Holerite"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => openMemory(slip)}
                            className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            title="Ver Memória de Cálculo (Auditoria)"
                          >
                            <ExternalLink size={18} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedPayslip(slip);
                              // Um set timeout rápido apenas para garantir que a interface atualiza (ou imprimiríamos o dom atual).
                              // Numa versão final, teríamos uma lib de PDF (ex: react-to-pdf).
                              alert("Recurso de baixar PDF será ativado após integração com a lib de relatórios. Por enquanto use a Visualização e imprima.");
                            }}
                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Baixar PDF"
                          >
                            <Download size={18} />
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

      {/* MODAL DE HOLERITE */}
      {isHoleriteModalOpen && selectedPayslip && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-white rounded-t-xl shrink-0">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText size={20} className="text-primary-600" />
                Recibo de Pagamento - {selectedPayslip.employment_contracts?.workers?.people?.full_name}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="btn-primary py-1.5 px-3 text-xs"
                >
                  Imprimir
                </button>
                <button
                  onClick={() => setIsHoleriteModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 p-2"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-8 overflow-y-auto print:p-0 print:overflow-visible">
              {/* Estilos específicos para impressão, garantindo o visual de holerite em A4 */}
              <div className="border-2 border-black p-4 text-sm font-mono text-black print:border-none">
                
                <div className="flex justify-between border-b-2 border-black pb-4 mb-4">
                  <div>
                    <h2 className="font-bold text-lg">RECIBO DE PAGAMENTO DE SALÁRIO</h2>
                    <p>EMPRESA DEMONSTRAÇÃO LTDA</p>
                    <p>CNPJ: 00.000.000/0001-00</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">Competência: {periods.find(p => p.id === selectedPeriod)?.month.toString().padStart(2, '0')}/{periods.find(p => p.id === selectedPeriod)?.year}</p>
                    <p>Recibo No. {selectedPayslip.id.split('-')[0].toUpperCase()}</p>
                  </div>
                </div>

                <div className="flex justify-between border-b-2 border-black pb-4 mb-4">
                  <div>
                    <p><span className="font-bold">Cód:</span> 0001</p>
                    <p><span className="font-bold">Nome:</span> {selectedPayslip.employment_contracts?.workers?.people?.full_name}</p>
                  </div>
                  <div>
                    <p><span className="font-bold">CBO:</span> 0000-00</p>
                    <p><span className="font-bold">Cargo:</span> {selectedPayslip.employment_contracts?.role}</p>
                  </div>
                </div>

                <table className="w-full text-left mb-4">
                  <thead>
                    <tr className="border-b border-black">
                      <th className="py-2 w-16">Cód</th>
                      <th className="py-2">Descrição</th>
                      <th className="py-2 text-right w-24">Ref.</th>
                      <th className="py-2 text-right w-32">Vencimentos</th>
                      <th className="py-2 text-right w-32">Descontos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingItems ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Carregando itens...
                        </td>
                      </tr>
                    ) : payslipItems.filter(item => item.type !== 'BASE').map(item => (
                      <tr key={item.id} className="border-b border-gray-200">
                        <td className="py-1">{item.rubrics.code}</td>
                        <td className="py-1">{item.rubrics.name}</td>
                        <td className="py-1 text-right">{item.reference}</td>
                        <td className="py-1 text-right">
                          {item.type === 'EARNING' ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(item.amount) : ''}
                        </td>
                        <td className="py-1 text-right">
                          {item.type === 'DEDUCTION' ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(item.amount) : ''}
                        </td>
                      </tr>
                    ))}
                    {/* Linhas de Preenchimento para manter o layout */}
                    {[...Array(Math.max(0, 10 - payslipItems.length))].map((_, i) => (
                       <tr key={`fill-${i}`}>
                         <td className="py-1">&nbsp;</td><td></td><td></td><td></td><td></td>
                       </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex border-t-2 border-black pt-2 mb-4 justify-between">
                  <div className="w-1/2 pr-4">
                    <p className="font-bold mb-2">Mensagem:</p>
                    <p className="text-xs text-gray-600">Reconheço ter recebido a importância líquida discriminada neste recibo.</p>
                  </div>
                  <div className="w-1/2 border-l-2 border-black pl-4">
                    <div className="flex justify-between mb-1">
                      <span>Total Vencimentos:</span>
                      <span className="font-bold">{new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(selectedPayslip.total_earnings || 0)}</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span>Total Descontos:</span>
                      <span className="font-bold">{new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(selectedPayslip.total_deductions || 0)}</span>
                    </div>
                    <div className="flex justify-between text-lg mt-2 pt-2 border-t border-black">
                      <span className="font-bold">Líquido a Receber ⇨</span>
                      <span className="font-bold">R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(selectedPayslip.net_salary || 0)}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t-2 border-black pt-2 flex text-xs justify-between mt-4">
                  <div>
                    <span className="font-bold">Base INSS: </span>
                    {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(selectedPayslip.base_inss || 0)}
                  </div>
                  <div>
                    <span className="font-bold">Base FGTS: </span>
                    {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(selectedPayslip.base_fgts || 0)}
                  </div>
                  <div>
                    <span className="font-bold">FGTS Mês: </span>
                    {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(selectedPayslip.fgts_month || 0)}
                  </div>
                  <div>
                    <span className="font-bold">Base IRRF: </span>
                    {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(selectedPayslip.base_irrf || 0)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DA MEMÓRIA DE CÁLCULO */}
      {isMemoryModalOpen && selectedPayslip && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-900 rounded-t-xl shrink-0">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Code size={20} className="text-primary-400" />
                Auditoria do Motor (Memória de Cálculo)
              </h3>
              <button
                onClick={() => setIsMemoryModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-[#0d1117] p-6 font-mono text-sm">
              {loadingMemory ? (
                <div className="flex items-center justify-center text-primary-400 h-full">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : memoryLog.length === 0 ? (
                <div className="text-slate-500 text-center mt-10">
                  Nenhuma memória de cálculo armazenada para este recibo.
                </div>
              ) : (
                <div className="space-y-4">
                  {memoryLog.map((log, index) => (
                    <div key={index} className="border border-slate-800 rounded bg-[#161b22] p-4 text-slate-300">
                      <div className="text-primary-400 font-bold mb-2">[{log.step}]</div>
                      <pre className="whitespace-pre-wrap overflow-x-auto text-[13px] leading-relaxed">
                        {log.details ? JSON.stringify(log.details, null, 2) : log.message || "Execução concluída"}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 rounded-b-xl shrink-0 flex justify-end">
              <button
                onClick={() => setIsMemoryModalOpen(false)}
                className="btn-secondary"
              >
                Fechar Auditoria
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
