import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  Plus,
  Loader2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  X,
  ListPlus
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useCompany } from "../../contexts/CompanyContext";
import { toast } from 'sonner';
import { confirmDialog } from '../../components/ConfirmDialogProvider';

interface PayrollPeriod {
  id: string;
  month: number;
  year: number;
  type: string;
  status: string;
}

interface Contract {
  id: string;
  company_id: string;
  employee_name: string;
}

interface Rubric {
  id: string;
  code: string;
  name: string;
  type: string;
}

interface PayrollEvent {
  id: string;
  contract_id: string;
  company_id: string;
  employee_name: string;
  rubric_id: string;
  rubric_code: string;
  rubric_name: string;
  rubric_type: string;
  reference_value: number;
  quantity: number;
  calculated_amount: number;
  origin: string;
  notes: string;
}

export default function () {
  const { selectedCompanyId } = useCompany();
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [activePeriod, setActivePeriod] = useState<PayrollPeriod | null>(null);
  const [events, setEvents] = useState<PayrollEvent[]>([]);
  
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [selectedContractId, setSelectedContractId] = useState("");
  const [selectedRubricId, setSelectedRubricId] = useState("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [calculatedAmount, setCalculatedAmount] = useState<number | "">("");
  const [notes, setNotes] = useState("");

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  useEffect(() => {
    fetchInitialData();
  }, [selectedCompanyId]);

  const fetchInitialData = async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const { data: tenantData } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", userData.user?.id)
      .single();

    if (tenantData) {
      // 1. Fetch Periods
      let query = supabase
        .from("payroll_periods")
        .select("*")
        .eq("tenant_id", tenantData.tenant_id);
        
      if (selectedCompanyId) {
        query = query.eq("company_id", selectedCompanyId);
      }

      const { data: pData, error: pError } = await query
        .order("year", { ascending: false })
        .order("month", { ascending: false });

      if (pError) {
        console.error("Erro ao buscar payroll_periods:", pError);
        toast.error(`Erro Períodos: ${pError.message || '400 Bad Request'}`);
      }

      let currentPeriods = pData as PayrollPeriod[] || [];
      
      if (selectedCompanyId && (!currentPeriods || !currentPeriods.find(p => p.month === currentMonth && p.year === currentYear))) {
         const { error: insertError } = await supabase.from("payroll_periods").upsert({
          tenant_id: tenantData.tenant_id,
          company_id: selectedCompanyId,
          month: currentMonth,
          year: currentYear,
          type: "MONTHLY"
        }, { onConflict: 'tenant_id, company_id, month, year, type', ignoreDuplicates: true });
        
        if (insertError) {
          console.error("ERRO NO INSERT DO PERIODO:", insertError);
          toast.error(`Erro ao criar período atual no banco: ${insertError.message}`);
        }
        
        let updateQuery = supabase
          .from("payroll_periods")
          .select("*")
          .eq("tenant_id", tenantData.tenant_id);
          
        if (selectedCompanyId) {
          updateQuery = updateQuery.eq("company_id", selectedCompanyId);
        }
          
        const { data: updatedPData } = await updateQuery
          .order("year", { ascending: false })
          .order("month", { ascending: false });
          
        currentPeriods = (updatedPData as PayrollPeriod[]) || [];
      }
      
      setPeriods(currentPeriods);
      if (currentPeriods.length > 0) {
        selectPeriod(currentPeriods[0]);
      }

      // 2. Fetch Contracts
      const { data: cData } = await supabase
        .from("employment_contracts")
        .select(`
          id,
          company_id,
          workers (
            people (
              full_name
            )
          )
        `)
        .eq("tenant_id", tenantData.tenant_id)
        .eq("status", "ACTIVE");

      if (cData) {
        const formattedContracts = cData.map((c: any) => ({
          id: c.id,
          company_id: c.company_id,
          employee_name: c.workers?.people?.full_name || "Desconhecido",
        })).sort((a, b) => a.employee_name.localeCompare(b.employee_name));
        setContracts(formattedContracts);
      }

      // 3. Fetch Rubrics
      const { data: rData } = await supabase
        .from("payroll_rubrics")
        .select("id, code, name, type")
        .eq("tenant_id", tenantData.tenant_id)
        .eq("is_active", true)
        .order("code", { ascending: true });

      if (rData) {
        setRubrics(rData as Rubric[]);
      }
    }
    setLoading(false);
  };

  const selectPeriod = async (period: PayrollPeriod) => {
    setActivePeriod(period);
    fetchEvents(period.id);
  };

  const fetchEvents = async (periodId: string) => {
    setLoadingEvents(true);
    const { data, error } = await supabase
      .from("payroll_variable_events")
      .select(`
        id,
        contract_id,
        rubric_id,
        amount,
        quantity,
        reference,
        employment_contracts (
          company_id,
          workers (
            people (
              full_name
            )
          )
        ),
        payroll_rubrics (
          code,
          name,
          type
        )
      `)
      .eq("period_id", periodId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro na busca de eventos:", error);
      toast.error(`Erro Supabase: ${error.message || '400 Bad Request'}. Dica: Se acabou de criar a tabela, rode 'NOTIFY pgrst, "reload schema";' no SQL Editor.`);
    }

    if (!error && data) {
      const formatted = data.map((e: any) => ({
        id: e.id,
        contract_id: e.contract_id,
        company_id: e.employment_contracts?.company_id,
        employee_name: e.employment_contracts?.workers?.people?.full_name || "Desconhecido",
        rubric_id: e.rubric_id,
        rubric_code: e.payroll_rubrics?.code || "-",
        rubric_name: e.payroll_rubrics?.name || "-",
        rubric_type: e.payroll_rubrics?.type || "EARNING",
        reference_value: 0,
        quantity: e.quantity,
        calculated_amount: e.amount,
        origin: 'MANUAL',
        notes: e.reference || "",
      }));
      setEvents(formatted);
    }
    setLoadingEvents(false);
  };

  const openModal = async () => {
    setSelectedContractId("");
    setSelectedRubricId("");
    setQuantity("");
    setCalculatedAmount("");
    setNotes("");
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePeriod || !selectedContractId || !selectedRubricId) {
      toast.error("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: tenantData } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", userData.user?.id)
        .single();

      const payload = {
        tenant_id: tenantData?.tenant_id,
        period_id: activePeriod.id,
        contract_id: selectedContractId,
        rubric_id: selectedRubricId,
        quantity: quantity === "" ? null : quantity,
        amount: calculatedAmount === "" ? 0 : calculatedAmount,
        reference: notes
      };

      const { error } = await supabase.from("payroll_variable_events").insert(payload);
      
      if (error) throw error;

      setIsModalOpen(false);
      fetchEvents(activePeriod.id);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar lançamento.");
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async (id: string) => {
    if (!await confirmDialog("Deseja realmente excluir este lançamento?")) return;
    
    try {
      await supabase.from("payroll_variable_events").delete().eq("id", id);
      if (activePeriod) {
        fetchEvents(activePeriod.id);
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir lançamento.");
    }
  };

  const getMonthName = async (month: number) => {
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return months[month - 1];
  };

  const getPeriodTypeLabel = async (type: string) => {
    switch(type) {
      case 'MONTHLY': return 'Mensal';
      case 'ADVANCE': return 'Adiantamento';
      case '13TH': return '13º Salário';
      case 'THIRTEENTH_1': return '1ª Parcela 13º';
      case 'THIRTEENTH_2': return '2ª Parcela 13º';
      case 'VACATION': return 'Férias';
      case 'SEVERANCE': return 'Rescisão';
      default: return type;
    }
  };

  const filteredEvents = events.filter((e) => {
    if (selectedCompanyId && e.company_id !== selectedCompanyId) return false;
    return (
      e.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      e.rubric_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.rubric_code.includes(searchTerm)
    );
  });

  const filteredContracts = contracts.filter((c) => {
    if (selectedCompanyId && c.company_id !== selectedCompanyId) return false;
    return true;
  });

  return (
    <div className="animate-fade-up max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display flex items-center gap-3">
            <ListPlus className="text-primary-600" />
            Lançamentos Variáveis
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar: Competências */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sticky top-20">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Calendar size={18} className="text-slate-400" />
              Competências
            </h3>
            
            {loading ? (
              <div className="flex justify-center p-4">
                <Loader2 size={24} className="animate-spin text-primary-500" />
              </div>
            ) : (
              <div className="space-y-2">
                {periods.map((p) => (
                  <button
                    key={p.id}
                    onClick={async () => selectPeriod(p)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg text-sm transition-all ${
                      activePeriod?.id === p.id 
                        ? 'bg-primary-50 border border-primary-200 text-primary-700 shadow-sm' 
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{getMonthName(p.month)}/{p.year}</span>
                      <span className="text-xs px-1.5 py-0.5 bg-white/50 rounded-md font-medium">{getPeriodTypeLabel(p.type)}</span>
                    </div>
                    {(p.status === "OPEN" || p.status === "DRAFT") ? (
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Area: Lista de Lançamentos */}
        <div className="lg:col-span-3">
          <div className="panel-flush">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:w-96">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Buscar por colaborador ou rubrica..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <button 
                onClick={openModal} 
                disabled={activePeriod?.status !== "OPEN" && activePeriod?.status !== "DRAFT"}
                className="btn-primary whitespace-nowrap"
              >
                <Plus size={18} />
                <span>Novo Lançamento</span>
              </button>
            </div>

            <div className="overflow-x-auto min-h-[300px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                    <th className="px-6 py-4">Colaborador</th>
                    <th className="px-6 py-4">Rubrica / Evento</th>
                    <th className="px-6 py-4">Origem</th>
                    <th className="px-6 py-4">Quant. / Ref.</th>
                    <th className="px-6 py-4">Valor (R$)</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingEvents ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-500 mb-2" />
                        Carregando eventos...
                      </td>
                    </tr>
                  ) : filteredEvents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <FileText size={48} className="text-slate-200 mb-4" />
                          <p className="text-slate-500 font-bold">Nenhum evento lançado nesta competência.</p>
                          <p className="text-sm text-slate-400 mt-1">Os cálculos automáticos não aparecem aqui, apenas as variáveis inseridas.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredEvents.map((evt) => (
                      <tr key={evt.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900">{evt.employee_name}</p>
                          {evt.notes && (
                            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]" title={evt.notes}>{evt.notes}</p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {evt.rubric_code}
                            </span>
                            <span className="font-medium text-slate-700">{evt.rubric_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold border border-slate-200">
                            {evt.origin}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-medium text-slate-700">{evt.quantity || evt.reference_value || '-'}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`font-bold ${
                            evt.rubric_type === 'EARNING' ? 'text-emerald-600' :
                            evt.rubric_type === 'DEDUCTION' ? 'text-rose-600' : 'text-slate-600'
                          }`}>
                            {evt.calculated_amount > 0 ? `R$ ${evt.calculated_amount.toFixed(2)}` : '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={async () => deleteEvent(evt.id)}
                            className="text-slate-400 hover:text-rose-600 p-2 rounded-lg hover:bg-rose-50 transition-colors"
                            title="Excluir"
                          >
                            <X size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 animate-in fade-in backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
                <ListPlus size={20} className="text-primary-600" />
                Lançar Evento Variável
              </h3>
              <button
                onClick={async () => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="flex flex-col">
              <div className="p-6 space-y-4">
                <div className="bg-primary-50 p-3 rounded-lg border border-primary-100 flex items-start gap-2 mb-2">
                  <AlertCircle size={16} className="text-primary-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-primary-800">
                    Você está lançando no período <strong>{activePeriod ? `${getMonthName(activePeriod.month)}/${activePeriod.year}` : ''}</strong>.
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                    Colaborador *
                  </label>
                  <select
                    required
                    value={selectedContractId}
                    onChange={(e) => setSelectedContractId(e.target.value)}
                    className="input w-full"
                  >
                    <option value="">Selecione o colaborador...</option>
                    {filteredContracts.map(c => (
                      <option key={c.id} value={c.id}>{c.employee_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                    Rubrica (Evento) *
                  </label>
                  <select
                    required
                    value={selectedRubricId}
                    onChange={(e) => setSelectedRubricId(e.target.value)}
                    className="input w-full"
                  >
                    <option value="">Selecione a rubrica...</option>
                    {rubrics.map(r => (
                      <option key={r.id} value={r.id}>
                        [{r.code}] {r.name} {r.type === 'EARNING' ? '(+)' : r.type === 'DEDUCTION' ? '(-)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                      Quantidade / Referência
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Ex: 15 (horas)"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value === "" ? "" : parseFloat(e.target.value))}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                      Valor Manual (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={calculatedAmount}
                      onChange={(e) => setCalculatedAmount(e.target.value === "" ? "" : parseFloat(e.target.value))}
                      className="input w-full"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Preencha a <strong>Quantidade</strong> caso o motor vá calcular o valor, ou preencha o <strong>Valor Manual</strong> se for um lançamento fechado (ex: prêmio de R$ 500).
                </p>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                    Observação Interna
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Justificativa do lançamento..."
                    className="input w-full"
                  />
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex justify-end gap-3 rounded-b-xl">
                <button
                  type="button"
                  onClick={async () => setIsModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  <span>Salvar Evento</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
