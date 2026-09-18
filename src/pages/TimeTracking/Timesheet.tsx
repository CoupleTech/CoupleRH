import { useState, useEffect } from "react";
import {
  Search,
  Save,
  CheckCircle,
  AlertCircle,
  Loader2,
  Calendar,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useCompany } from "../../contexts/CompanyContext";
import { Pagination } from "../../components/Pagination";

interface PayrollPeriod {
  id: string;
  month: number;
  year: number;
  type: string;
  status: string;
}

interface Contract {
  id: string;
  worker_name: string;
}

interface Rubric {
  id: string;
  code: string;
}

// Mapa de códigos que usaremos na UI
const TARGET_CODES = {
  FALTAS: '801',
  ATRASOS: '802',
  HE50: '150',
  HE60: '151',
  HE100: '160',
  ADICIONAL_NOTURNO: '301'
};

export default function Timesheet() {
  const { selectedCompanyId } = useCompany();
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [activePeriodId, setActivePeriodId] = useState<string>("");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  
  // Estado para armazenar os inputs: { contract_id: { rubric_code: amount } }
  const [eventsData, setEventsData] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    fetchInitialData();
  }, [selectedCompanyId]);

  useEffect(() => {
    if (activePeriodId) {
      fetchEvents();
    }
  }, [activePeriodId, contracts]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: tenantData } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", userData.user?.id)
        .single();

      if (!tenantData) return;

      // Buscar períodos
      let query = supabase
        .from("payroll_periods")
        .select("id, month, year, type, status")
        .eq("tenant_id", tenantData.tenant_id)
        .eq("type", "MONTHLY")
        .order("year", { ascending: false })
        .order("month", { ascending: false });

      if (selectedCompanyId) {
        query = query.eq("company_id", selectedCompanyId);
      }

      const { data: periodsData } = await query;
      if (periodsData && periodsData.length > 0) {
        setPeriods(periodsData);
        setActivePeriodId(periodsData[0].id);
      }

      // Buscar rubricas alvo
      const { data: rubricsData } = await supabase
        .from("payroll_rubrics")
        .select("id, code")
        .eq("tenant_id", tenantData.tenant_id)
        .in("code", Object.values(TARGET_CODES));
        
      if (rubricsData) setRubrics(rubricsData);

      // Buscar contratos ativos
      let contractsQuery = supabase
        .from("employment_contracts")
        .select(`
          id,
          workers (
            people ( full_name )
          )
        `)
        .eq("tenant_id", tenantData.tenant_id)
        .eq("status", "ACTIVE");

      if (selectedCompanyId) {
        contractsQuery = contractsQuery.eq("company_id", selectedCompanyId);
      }

      const { data: contractsData } = await contractsQuery;
      if (contractsData) {
        setContracts(contractsData.map((c: any) => ({
          id: c.id,
          worker_name: c.workers?.people?.full_name || "Desconhecido"
        })).sort((a, b) => a.worker_name.localeCompare(b.worker_name)));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    if (!activePeriodId || contracts.length === 0) return;
    
    const { data: events } = await supabase
      .from("payroll_variable_events")
      .select("contract_id, amount, quantity, rubric_id")
      .eq("period_id", activePeriodId);

    const initialData: Record<string, Record<string, number>> = {};
    
    // Inicializar com zeros
    contracts.forEach(c => {
      initialData[c.id] = {
        [TARGET_CODES.FALTAS]: 0,
        [TARGET_CODES.ATRASOS]: 0,
        [TARGET_CODES.HE50]: 0,
        [TARGET_CODES.HE60]: 0,
        [TARGET_CODES.HE100]: 0,
        [TARGET_CODES.ADICIONAL_NOTURNO]: 0
      };
    });

    // Popular com eventos do banco
    if (events && rubrics.length > 0) {
      events.forEach(ev => {
        const rubric = rubrics.find(r => r.id === ev.rubric_id);
        if (rubric && Object.values(TARGET_CODES).includes(rubric.code)) {
          if (initialData[ev.contract_id]) {
            initialData[ev.contract_id][rubric.code] = Number(ev.quantity) || Number(ev.amount);
          }
        }
      });
    }

    setEventsData(initialData);
  };

  const handleInputChange = (contractId: string, code: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setEventsData(prev => ({
      ...prev,
      [contractId]: {
        ...prev[contractId],
        [code]: numValue >= 0 ? numValue : 0
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccessMsg("");
    setErrorMsg("");

    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: tenantData } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", userData.user?.id)
        .single();

      if (!tenantData) throw new Error("Tenant não encontrado");

      // Primeiro, deletar eventos variáveis antigos para esses códigos na competência
      // Para evitar duplicação ou manter valores zerados que foram removidos
      const rubricIds = rubrics.map(r => r.id);
      if (rubricIds.length > 0) {
        await supabase
          .from("payroll_variable_events")
          .delete()
          .eq("period_id", activePeriodId)
          .in("rubric_id", rubricIds);
      }

      // Preparar inserts apenas para values > 0
      const inserts = [];
      for (const contractId of Object.keys(eventsData)) {
        for (const code of Object.keys(eventsData[contractId])) {
          const amount = eventsData[contractId][code];
          if (amount > 0) {
            const rubric = rubrics.find(r => r.code === code);
            if (rubric) {
              inserts.push({
                tenant_id: tenantData.tenant_id,
                period_id: activePeriodId,
                contract_id: contractId,
                rubric_id: rubric.id,
                amount: 0,
                quantity: amount,
                reference: 'ESPELHO_PONTO'
              });
            }
          }
        }
      }

      if (inserts.length > 0) {
        const { error } = await supabase.from("payroll_variable_events").insert(inserts);
        if (error) throw error;
      }

      setSuccessMsg("Fechamento do Espelho de Ponto salvo com sucesso! O Motor de Folha já lerá essas informações.");
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Erro ao salvar os lançamentos: " + (err.message || "Desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const filteredContracts = contracts.filter((c) =>
    c.worker_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredContracts.length / pageSize);
  const paginatedContracts = filteredContracts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="animate-fade-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display">
            Espelho de Ponto (Lançamentos Dinâmicos)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Lance rapidamente as Faltas, Atrasos e Horas Extras do mês para processamento na folha.
          </p>
        </div>

        <button 
          onClick={handleSave}
          disabled={saving || loading || !activePeriodId}
          className="btn-primary"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          <span>Salvar Fechamento</span>
        </button>
      </div>

      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
          <CheckCircle className="text-emerald-500 mt-0.5" size={18} />
          <p className="text-sm text-emerald-700 font-medium">{successMsg}</p>
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="text-red-500 mt-0.5" size={18} />
          <p className="text-sm text-red-700">{errorMsg}</p>
        </div>
      )}

      <div className="panel p-4 border-b-0 rounded-b-none grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <Calendar size={16} className="text-primary-500" />
            Competência
          </label>
          <select
            className="input w-full md:max-w-xs"
            value={activePeriodId}
            onChange={(e) => setActivePeriodId(e.target.value)}
            disabled={loading}
          >
            <option value="">Selecione...</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {String(p.month).padStart(2, "0")}/{p.year} {p.status === "CLOSED" ? "(Fechada)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
           <label className="text-sm font-medium text-slate-700">Buscar Colaborador</label>
           <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Digite o nome..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="panel rounded-t-none overflow-x-auto shadow-sm min-h-[400px]">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
              <th className="px-6 py-4 sticky left-0 bg-slate-50 z-10 shadow-[inset_-1px_0_0_0_#e2e8f0]">Colaborador</th>
              <th className="px-4 py-4 w-28 text-center text-rose-600">Faltas (Dias)</th>
              <th className="px-4 py-4 w-28 text-center text-orange-600">Atrasos (Hs)</th>
              <th className="px-4 py-4 w-28 text-center text-emerald-600">H.E 50% (Hs)</th>
              <th className="px-4 py-4 w-28 text-center text-emerald-600">H.E 60% (Hs)</th>
              <th className="px-4 py-4 w-28 text-center text-emerald-700">H.E 100% (Hs)</th>
              <th className="px-4 py-4 w-28 text-center text-indigo-600">Adic. Noturno (Hs)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-500 mb-2" />
                  Carregando contratos e lançamentos...
                </td>
              </tr>
            ) : filteredContracts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-bold">
                  Nenhum colaborador encontrado para esta empresa.
                </td>
              </tr>
            ) : (
              paginatedContracts.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-3 font-bold text-slate-800 sticky left-0 bg-white group-hover:bg-slate-50 z-10 shadow-[inset_-1px_0_0_0_#e2e8f0]">
                    {c.worker_name}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input 
                      type="number" 
                      min="0" 
                      step="any"
                      placeholder="0"
                      className="w-full text-center py-1.5 px-1 border border-slate-200 rounded-md focus:ring-rose-500 focus:border-rose-500" 
                      value={eventsData[c.id]?.[TARGET_CODES.FALTAS] || ""}
                      onChange={(e) => handleInputChange(c.id, TARGET_CODES.FALTAS, e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input 
                      type="number" 
                      min="0" 
                      step="any"
                      placeholder="0"
                      className="w-full text-center py-1.5 px-1 border border-slate-200 rounded-md focus:ring-orange-500 focus:border-orange-500" 
                      value={eventsData[c.id]?.[TARGET_CODES.ATRASOS] || ""}
                      onChange={(e) => handleInputChange(c.id, TARGET_CODES.ATRASOS, e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input 
                      type="number" 
                      min="0" 
                      step="any"
                      placeholder="0"
                      className="w-full text-center py-1.5 px-1 border border-slate-200 rounded-md focus:ring-emerald-500 focus:border-emerald-500" 
                      value={eventsData[c.id]?.[TARGET_CODES.HE50] || ""}
                      onChange={(e) => handleInputChange(c.id, TARGET_CODES.HE50, e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input 
                      type="number" 
                      min="0" 
                      step="any"
                      placeholder="0"
                      className="w-full text-center py-1.5 px-1 border border-slate-200 rounded-md focus:ring-emerald-600 focus:border-emerald-600" 
                      value={eventsData[c.id]?.[TARGET_CODES.HE60] || ""}
                      onChange={(e) => handleInputChange(c.id, TARGET_CODES.HE60, e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input 
                      type="number" 
                      min="0" 
                      step="any"
                      placeholder="0"
                      className="w-full text-center py-1.5 px-1 border border-slate-200 rounded-md focus:ring-emerald-700 focus:border-emerald-700" 
                      value={eventsData[c.id]?.[TARGET_CODES.HE100] || ""}
                      onChange={(e) => handleInputChange(c.id, TARGET_CODES.HE100, e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input 
                      type="number" 
                      min="0" 
                      step="any"
                      placeholder="0"
                      className="w-full text-center py-1.5 px-1 border border-slate-200 rounded-md focus:ring-indigo-500 focus:border-indigo-500" 
                      value={eventsData[c.id]?.[TARGET_CODES.ADICIONAL_NOTURNO] || ""}
                      onChange={(e) => handleInputChange(c.id, TARGET_CODES.ADICIONAL_NOTURNO, e.target.value)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {!loading && filteredContracts.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredContracts.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
        />
      )}
    </div>
  );
}
