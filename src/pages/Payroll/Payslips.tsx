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
import { Pagination } from "../../components/Pagination";
import { useCompany } from "../../contexts/CompanyContext";
import { toast } from 'sonner';

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
    positions?: {
      title: string;
      cbo?: string;
    };
    workers: {
      esocial_matricula?: string;
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
  const { selectedCompanyId, companies } = useCompany();
  const currentCompany = companies.find((c: any) => c.id === selectedCompanyId);
  const [searchTerm, setSearchTerm] = useState("");
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);
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
            positions (
              title,
              cbo
            ),
            workers (
              esocial_matricula,
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

  const totalPages = Math.ceil(filteredPayslips.length / pageSize);
  const paginatedPayslips = filteredPayslips.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

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
                paginatedPayslips.map((slip) => {
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
                        {slip.employment_contracts?.positions?.title || "-"}
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
                              toast.error("Recurso de baixar PDF será ativado após integração com a lib de relatórios. Por enquanto use a Visualização e imprima.");
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
        
        {!loading && filteredPayslips.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredPayslips.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        )}
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

            <div className="p-8 overflow-y-auto bg-slate-50 print:p-0 print:bg-white print:overflow-visible">
              {/* Estilos modernos para tela, mas mantendo a simplicidade na impressão */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-sm text-slate-700 print:border-none print:shadow-none print:p-4 print:text-black print:font-mono">
                
                {/* Cabeçalho Empresa */}
                <div className="flex justify-between items-start border-b border-slate-200 pb-6 mb-6 print:border-black print:pb-4 print:mb-4 print:border-b-2">
                  <div className="flex gap-4 items-center">
                    <div className="w-16 h-16 bg-primary-50 rounded-xl flex items-center justify-center border border-primary-100 print:hidden">
                      <FileText className="text-primary-600 w-8 h-8" />
                    </div>
                    <div>
                      <h2 className="font-display font-bold text-xl text-slate-900 print:text-lg">RECIBO DE PAGAMENTO DE SALÁRIO</h2>
                      <p className="text-slate-500 font-medium mt-1 print:text-black">{currentCompany?.company_name || currentCompany?.trade_name || 'EMPRESA NÃO ENCONTRADA'}</p>
                      <p className="text-slate-400 text-xs mt-0.5 print:text-black">CNPJ: {currentCompany?.cnpj?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") || '00.000.000/0001-00'}</p>
                    </div>
                  </div>
                  <div className="text-right bg-slate-50 p-4 rounded-xl border border-slate-100 print:bg-transparent print:border-none print:p-0">
                    <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1 print:text-black">Competência</p>
                    <p className="font-bold text-lg text-slate-900 print:text-base">
                      {periods.find(p => p.id === selectedPeriod)?.month.toString().padStart(2, '0')}/{periods.find(p => p.id === selectedPeriod)?.year}
                    </p>
                    <p className="text-slate-400 text-xs mt-2 print:text-black print:mt-1">
                      Recibo No. <span className="font-mono text-slate-600">{selectedPayslip.id.split('-')[0].toUpperCase()}</span>
                    </p>
                  </div>
                </div>

                {/* Dados do Funcionário */}
                <div className="grid grid-cols-2 gap-6 border-b border-slate-200 pb-6 mb-6 print:border-black print:pb-4 print:mb-4 print:border-b-2">
                  <div className="space-y-1">
                    <div className="flex text-sm">
                      <span className="text-slate-400 w-16 print:text-black print:font-bold">Cód:</span>
                      <span className="font-medium text-slate-900 print:text-black">{selectedPayslip.employment_contracts?.workers?.esocial_matricula || 'N/A'}</span>
                    </div>
                    <div className="flex text-sm">
                      <span className="text-slate-400 w-16 print:text-black print:font-bold">Nome:</span>
                      <span className="font-bold text-slate-900 print:text-black">{selectedPayslip.employment_contracts?.workers?.people?.full_name}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex text-sm">
                      <span className="text-slate-400 w-16 print:text-black print:font-bold">CBO:</span>
                      <span className="font-medium text-slate-900 print:text-black">{selectedPayslip.employment_contracts?.positions?.cbo || '0000-00'}</span>
                    </div>
                    <div className="flex text-sm">
                      <span className="text-slate-400 w-16 print:text-black print:font-bold">Cargo:</span>
                      <span className="font-medium text-slate-900 print:text-black">{selectedPayslip.employment_contracts?.positions?.title}</span>
                    </div>
                  </div>
                </div>

                {/* Tabela de Rubricas */}
                <div className="rounded-xl border border-slate-200 overflow-hidden mb-6 print:border-none print:rounded-none">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 print:bg-transparent">
                      <tr className="border-b border-slate-200 print:border-black print:border-b">
                        <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-16 print:text-black print:p-1">Cód</th>
                        <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider print:text-black print:p-1">Descrição</th>
                        <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right w-24 print:text-black print:p-1">Ref.</th>
                        <th className="py-3 px-4 text-xs font-semibold text-emerald-600 uppercase tracking-wider text-right w-32 print:text-black print:p-1">Vencimentos</th>
                        <th className="py-3 px-4 text-xs font-semibold text-rose-600 uppercase tracking-wider text-right w-32 print:text-black print:p-1">Descontos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 print:divide-transparent">
                      {loadingItems ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-500">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Carregando itens...
                          </td>
                        </tr>
                      ) : payslipItems.filter(item => item.type !== 'BASE').map(item => (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors print:hover:bg-transparent print:border-none">
                          <td className="py-2.5 px-4 font-mono text-xs text-slate-500 print:text-black print:p-1">{item.rubrics.code}</td>
                          <td className="py-2.5 px-4 font-medium text-slate-700 print:text-black print:p-1">{item.rubrics.name}</td>
                          <td className="py-2.5 px-4 text-right text-slate-500 print:text-black print:p-1">{item.reference}</td>
                          <td className="py-2.5 px-4 text-right text-emerald-600 font-medium print:text-black print:p-1">
                            {item.type === 'EARNING' ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(item.amount) : ''}
                          </td>
                          <td className="py-2.5 px-4 text-right text-rose-600 font-medium print:text-black print:p-1">
                            {item.type === 'DEDUCTION' ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(item.amount) : ''}
                          </td>
                        </tr>
                      ))}
                      {/* Linhas de Preenchimento para manter o layout */}
                      {[...Array(Math.max(0, 8 - payslipItems.length))].map((_, i) => (
                         <tr key={`fill-${i}`} className="print:hidden">
                           <td className="py-2.5 px-4">&nbsp;</td><td></td><td></td><td></td><td></td>
                         </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Resumo e Totais */}
                <div className="flex border border-slate-200 rounded-xl overflow-hidden mb-6 bg-slate-50 print:border-t-2 print:border-black print:rounded-none print:bg-transparent print:border-x-0 print:border-b-0">
                  <div className="w-1/2 p-6 flex flex-col justify-center bg-white print:p-2 print:border-none">
                    <p className="font-semibold text-slate-700 mb-2 print:text-black print:mb-1">Mensagem:</p>
                    <p className="text-sm text-slate-500 italic print:text-black print:text-xs">Reconheço ter recebido a importância líquida discriminada neste recibo.</p>
                  </div>
                  <div className="w-1/2 p-6 border-l border-slate-200 print:border-l-2 print:border-black print:p-2">
                    <div className="flex justify-between items-center mb-3 text-sm print:mb-1">
                      <span className="text-slate-500 font-medium print:text-black">Total Vencimentos:</span>
                      <span className="font-bold text-emerald-600 print:text-black">
                        {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(selectedPayslip.total_earnings || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mb-4 text-sm print:mb-1">
                      <span className="text-slate-500 font-medium print:text-black">Total Descontos:</span>
                      <span className="font-bold text-rose-600 print:text-black">
                        {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(selectedPayslip.total_deductions || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-4 border-t border-slate-200 print:border-black print:pt-2">
                      <span className="font-bold text-slate-900 text-lg print:text-black print:text-base">Líquido a Receber</span>
                      <span className="font-bold text-primary-600 text-xl print:text-black print:text-lg">
                        R$ {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(selectedPayslip.net_salary || 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Rodapé de Bases */}
                <div className="bg-slate-100 rounded-xl p-4 flex justify-between text-sm border border-slate-200 print:bg-transparent print:border-t-2 print:border-black print:border-x-0 print:border-b-0 print:rounded-none print:p-2 print:mt-4">
                  <div className="flex flex-col">
                    <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1 print:text-black print:font-bold">Base INSS</span>
                    <span className="font-medium text-slate-700 print:text-black">{new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(selectedPayslip.base_inss || 0)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1 print:text-black print:font-bold">Base FGTS</span>
                    <span className="font-medium text-slate-700 print:text-black">{new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(selectedPayslip.base_fgts || 0)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1 print:text-black print:font-bold">FGTS Mês</span>
                    <span className="font-medium text-slate-700 print:text-black">{new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(selectedPayslip.fgts_month || 0)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1 print:text-black print:font-bold">Base IRRF</span>
                    <span className="font-medium text-slate-700 print:text-black">{new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(selectedPayslip.base_irrf || 0)}</span>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>,
        document.body
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
        </div>,
        document.body
      )}

    </div>
  );
}
