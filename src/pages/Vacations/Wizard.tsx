import { useState, useEffect } from "react";
import { ArrowLeft, Check, CalendarDays, Save, Search, AlertCircle, Loader2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { vacationService } from "../../services/vacationService";
import { useCompany } from "../../contexts/CompanyContext";

interface VacationWizardProps {
  inline?: boolean;
  preselectedPeriodId?: string;
  onSaved?: () => void;
  onCancel?: () => void;
}

export default function VacationWizard({ inline = false, preselectedPeriodId, onSaved, onCancel }: VacationWizardProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedCompanyId } = useCompany();
  const initialPeriodId = preselectedPeriodId || searchParams.get('periodId');
  
  const [step, setStep] = useState(initialPeriodId ? 2 : 1);
  const [vestingPeriods, setVestingPeriods] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);

  const [vacationDays, setVacationDays] = useState(30);
  const [sellDays, setSellDays] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [generateReceipt, setGenerateReceipt] = useState(true);
  const [saving, setSaving] = useState(false);

  const totalSteps = 3;

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await vacationService.getEnrichedVestingPeriods();

        if (data) {
          setVestingPeriods(data);
          if (initialPeriodId) {
            const found = data.find((p: any) => p.id === initialPeriodId);
            if (found) {
              setSelectedPeriod(found);
            } else {
              setStep(1);
            }
          }
        }
      } catch (error) {
        console.error("Erro ao buscar períodos:", error);
      }
      setLoadingData(false);
    }
    fetchData();
  }, [initialPeriodId]);

  const filteredPeriods = vestingPeriods.filter((period) => {
    const contract = period.employment_contracts;
    if (selectedCompanyId && contract?.company_id !== selectedCompanyId) return false;

    const name = contract?.workers?.people?.full_name?.toLowerCase() || "";
    const cpf = contract?.workers?.people?.cpf?.toLowerCase() || "";
    return (
      name.includes(searchTerm.toLowerCase()) ||
      cpf.includes(searchTerm.toLowerCase())
    );
  });

  const steps = [
    { number: 1, title: "Colaborador e Período" },
    { number: 2, title: "Programação de Datas" },
    { number: 3, title: "Revisão e Aprovação" },
  ];

  const handleNext = () => {
    if (step === 1 && !selectedPeriod) {
      alert("Selecione um período aquisitivo antes de prosseguir.");
      return;
    }
    if (step === 2 && !startDate) {
      alert("Informe a data de início das férias.");
      return;
    }
    setStep((s) => s + 1);
  };

  const calculateReturnDate = () => {
    if (!startDate) return "";
    const date = new Date(startDate);
    const actualDays = vacationDays;
    date.setDate(date.getDate() + actualDays); // The return date is the day AFTER the vacation ends
    // Using string manipulation or locale string that doesn't shift by timezone
    return new Date(
      date.getTime() + date.getTimezoneOffset() * 60000,
    ).toLocaleDateString("pt-BR");
  };

  const handleSaveVacation = async () => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: tenantData } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", userData.user?.id)
        .single();

      if (!tenantData) throw new Error("Tenant não encontrado");

      const actualDaysTaken = vacationDays;
      const abono = sellDays ? 10 : 0;

      const dateEnd = new Date(startDate);
      // Data fim = startDate + dias gozados - 1
      dateEnd.setDate(dateEnd.getDate() + actualDaysTaken - 1);

      const { error: requestError } = await supabase
        .from("vacation_requests")
        .insert({
          tenant_id: tenantData.tenant_id,
          vesting_period_id: selectedPeriod.id,
          start_date: startDate,
          end_date: dateEnd.toISOString().split("T")[0],
          days_taken: actualDaysTaken,
          cash_allowance_days: abono,
          status: "REQUESTED", // Ou APPROVED_MANAGER se o RH já estiver aprovando direto
        });

      if (requestError) throw requestError;

      // Update vesting period
      const newTaken = selectedPeriod.taken_days + actualDaysTaken + abono;
      const newStatus =
        newTaken >= selectedPeriod.earned_days
          ? "COMPLETED"
          : "PARTIALLY_TAKEN";

      const { error: updateError } = await supabase
        .from("vacation_vesting_periods")
        .update({
          taken_days: newTaken,
          status: newStatus,
        })
        .eq("id", selectedPeriod.id);

      if (updateError) throw updateError;

      // Gerar Recibo de Férias
      if (generateReceipt) {
        const fStart = new Date(startDate);
        const fMonth = fStart.getMonth() + 1;
        const fYear = fStart.getFullYear();

        // 1. Busca ou cria o período VACATION do mês
        let { data: vPeriod } = await supabase
          .from('payroll_periods')
          .select('id')
          .eq('tenant_id', tenantData.tenant_id)
          .eq('company_id', selectedCompanyId)
          .eq('type', 'VACATION')
          .eq('month', fMonth)
          .eq('year', fYear)
          .single();

        if (!vPeriod) {
          const { data: newVPeriod, error: pError } = await supabase
            .from('payroll_periods')
            .insert({
              tenant_id: tenantData.tenant_id,
              company_id: selectedCompanyId,
              month: fMonth,
              year: fYear,
              type: 'VACATION',
              payment_date: new Date(fStart.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 dias antes
              status: 'OPEN'
            })
            .select('id')
            .single();
            
          if (pError) throw pError;
          vPeriod = newVPeriod;
        }

        // 2. Aciona o Motor de Folha
        const { error: invokeError } = await supabase.functions.invoke('payroll-engine', {
          body: {
            period_id: vPeriod.id,
            contract_id: selectedPeriod.contract_id
          }
        });
        
        if (invokeError) throw new Error("Erro ao gerar recibo de férias: " + invokeError.message);
      }

      // 3. RH Paperless - Gerar Documentos de Férias para Assinatura
      const workerId = selectedPeriod.employment_contracts?.workers?.id;
      if (workerId) {
        const documents = [
          {
            tenant_id: tenantData.tenant_id,
            worker_id: workerId,
            title: `Aviso de Férias - ${new Date(startDate).toLocaleDateString("pt-BR")}`,
            status: 'PENDING_SIGNATURE',
            requires_employee_signature: true,
            document_type: 'VACATION_NOTICE',
            metadata: {
              vacationDays: actualDaysTaken,
              sellDays,
              startDate,
              returnDate: calculateReturnDate(),
              vestingPeriodId: selectedPeriod.id
            }
          }
        ];

        if (generateReceipt) {
          documents.push({
            tenant_id: tenantData.tenant_id,
            worker_id: workerId,
            title: `Recibo de Férias - ${new Date(startDate).toLocaleDateString("pt-BR")}`,
            status: 'PENDING_SIGNATURE',
            requires_employee_signature: true,
            document_type: 'VACATION_RECEIPT',
            metadata: {
              vacationDays: actualDaysTaken,
              sellDays,
              startDate,
              returnDate: calculateReturnDate(),
              vestingPeriodId: selectedPeriod.id
            }
          });
        }

        const { error: docsError } = await supabase
          .from('employee_documents')
          .insert(documents);

        if (docsError) throw new Error("Erro ao gerar documentos para assinatura: " + docsError.message);
      }

      if (!inline) {
        alert("Férias programadas com sucesso!" + (generateReceipt ? " Recibo gerado com sucesso." : ""));
        navigate("/ferias");
      }
      if (onSaved) onSaved();
    } catch (e: any) {
      console.error(e);
      alert(`Erro ao programar férias: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`animate-fade-up max-w-4xl mx-auto ${inline ? '' : 'p-0'}`}>
      {!inline && (
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate("/ferias")} className="btn-ghost p-2">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 font-display">
              Programar Férias
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Conceda e fracione os períodos aquisitivos abertos
            </p>
          </div>
        </div>
      )}

      {loadingData ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-slate-500 font-medium">Carregando dados do colaborador...</p>
        </div>
      ) : (
        <>
          {/* Stepper Progress */}
          <div className={`mb-12 mt-4 px-4 ${inline && step === 2 && initialPeriodId ? 'hidden' : ''}`}>
            <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 rounded-full z-0"></div>
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary-600 rounded-full z-0 transition-all duration-300"
            style={{ width: `${((step - 1) / (totalSteps - 1)) * 100}%` }}
          ></div>

          {steps.map((s) => (
            <div
              key={s.number}
              className="relative z-10 flex flex-col items-center gap-2"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-colors
                ${
                  step > s.number
                    ? "bg-primary-600 border-primary-600 text-white"
                    : step === s.number
                      ? "bg-white border-primary-600 text-primary-600"
                      : "bg-white border-slate-300 text-slate-400"
                }
              `}
              >
                {step > s.number ? <Check size={18} /> : s.number}
              </div>
              <span
                className={`text-xs font-semibold absolute -bottom-10 w-36 text-center left-1/2 -translate-x-1/2 leading-tight
                ${step >= s.number ? "text-slate-800" : "text-slate-400"}`}
              >
                {s.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Form Area */}
      <div className="panel p-6 lg:p-8 mt-12 min-h-[400px]">
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4">
              Selecione o Período Aquisitivo
            </h2>

            <div className="relative w-full mb-6">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar por nome ou CPF..."
                className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
              {filteredPeriods.map((period) => {
                const name =
                  period.employment_contracts?.workers?.people?.full_name ||
                  "Desconhecido";
                const isSelected = selectedPeriod?.id === period.id;
                const availableDays = period.earned_days - period.taken_days;

                return (
                  <div
                    key={period.id}
                    onClick={() => setSelectedPeriod(period)}
                    className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary-500 bg-primary-50 ring-1 ring-primary-500"
                        : "border-slate-200 bg-white hover:border-primary-300 hover:bg-slate-50"
                    }`}
                  >
                    <div>
                      <p className="font-bold text-slate-900">{name}</p>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Aquisitivo:{" "}
                        {new Date(period.start_date).toLocaleDateString(
                          "pt-BR",
                        )}{" "}
                        a{" "}
                        {new Date(period.end_date).toLocaleDateString("pt-BR")}
                      </p>
                      <p className="text-xs font-semibold text-amber-600 mt-1">
                        Saldo: {availableDays} dias disponíveis
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="text-primary-600" size={24} />
                    )}
                  </div>
                );
              })}
              {filteredPeriods.length === 0 && (
                <p className="text-center text-slate-500 py-4">
                  Nenhum período aquisitivo disponível para gozo encontrado.
                </p>
              )}
            </div>
          </div>
        )}

        {step === 2 && !selectedPeriod && (
          <div className="text-center py-12 animate-in fade-in">
            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900 mb-2">Período não encontrado</h3>
            <p className="text-slate-500 mb-6">O período selecionado não foi encontrado ou ocorreu um erro.</p>
            <button onClick={() => { setStep(1); navigate('/ferias/novo'); }} className="btn-primary">
              Voltar para Seleção
            </button>
          </div>
        )}

        {step === 2 && selectedPeriod && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2 mb-4 flex justify-between items-center">
              Programação de Férias
              {selectedPeriod.status === 'IN_PROGRESS' && (
                <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-1 rounded-full flex items-center gap-1">
                  <AlertCircle size={12} /> Ainda não completou 1 ano (Período em andamento)
                </span>
              )}
            </h2>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 flex justify-between items-center">
              <div>
                <p className="text-xs uppercase tracking-widest font-bold text-slate-500 mb-1">
                  Saldo do Colaborador
                </p>
                <p className="font-bold text-slate-800 text-lg">
                  {(Number(selectedPeriod?.earned_days) || 0) - (Number(selectedPeriod?.taken_days) || 0)}{" "}
                  dias
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-widest font-bold text-slate-500 mb-1">
                  Limite Concessivo
                </p>
                <p className="font-bold text-rose-600 text-lg">
                  {selectedPeriod?.concessive_end_date 
                    ? new Date(selectedPeriod.concessive_end_date).toLocaleDateString("pt-BR")
                    : "Não definido"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="input-label">Dias de Férias a Gozar</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-900 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  value={vacationDays}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setVacationDays(val);
                    if (
                      val !== 20 ||
                      selectedPeriod?.earned_days - selectedPeriod?.taken_days <
                        30
                    ) {
                      setSellDays(false);
                    }
                  }}
                >
                  {(() => {
                    const earned = Number(selectedPeriod?.earned_days) || 30;
                    const taken = Number(selectedPeriod?.taken_days) || 0;
                    const balance = selectedPeriod ? earned - taken : 30;
                    const isFirst = selectedPeriod ? taken === 0 : true;
                    const options = [30, 20, 15, 14, 10, 5];

                    return options
                      .filter((opt) => {
                        if (opt > balance) return false;
                        if (isFirst && opt < 14) return false; // Primeiro período mínimo 14 dias
                        if (!isFirst && opt < 5) return false; // Demais períodos mínimo 5 dias
                        return true;
                      })
                      .map((opt) => (
                        <option key={opt} value={opt}>
                          {opt} dias {opt === balance ? "(Saldo total)" : ""}
                        </option>
                      ));
                  })()}
                </select>
              </div>

              <div>
                <label className="input-label">
                  Abono Pecuniário ("Vender" Férias)?
                </label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-900 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  value={sellDays ? "yes" : "no"}
                  onChange={(e) => setSellDays(e.target.value === "yes")}
                  disabled={
                    vacationDays !== 20 ||
                    ((Number(selectedPeriod?.earned_days) || 30) - (Number(selectedPeriod?.taken_days) || 0) < 30)
                  }
                >
                  <option value="no">Não (Apenas descanso)</option>
                  <option value="yes">Sim, vender 1/3 (10 dias)</option>
                </select>
              </div>

              <div>
                <label className="input-label">Data de Início do Gozo</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 focus:ring-2 focus:ring-primary-500 outline-none"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <p className="text-xs text-amber-600 font-semibold mt-1">
                  Não pode iniciar em véspera de feriado ou DSR.
                </p>
              </div>

              <div>
                <label className="input-label">Data Prevista de Retorno</label>
                <input
                  type="text"
                  disabled
                  value={calculateReturnDate()}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-500"
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-lg font-bold text-emerald-700 border-b border-emerald-100 pb-2 mb-4 flex items-center gap-2">
              <CalendarDays size={20} /> Resumo das Férias
            </h2>

            <div className="p-5 border border-slate-200 rounded-xl bg-slate-50">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-500">
                    Colaborador
                  </p>
                  <p className="font-bold text-slate-800">
                    {
                      selectedPeriod?.employment_contracts?.workers?.people
                        ?.full_name
                    }
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-500">
                    Período Aquisitivo
                  </p>
                  <p className="font-bold text-slate-800">
                    {new Date(selectedPeriod?.start_date).toLocaleDateString(
                      "pt-BR",
                    )}{" "}
                    a{" "}
                    {new Date(selectedPeriod?.end_date).toLocaleDateString(
                      "pt-BR",
                    )}
                  </p>
                </div>
                <div className="mt-4">
                  <p className="text-sm font-semibold text-slate-500">
                    Início e Retorno
                  </p>
                  <p className="font-bold text-primary-700">
                    {new Date(
                      new Date(startDate).getTime() +
                        new Date(startDate).getTimezoneOffset() * 60000,
                    ).toLocaleDateString("pt-BR")}{" "}
                    até {calculateReturnDate()}
                  </p>
                </div>
                <div className="mt-4">
                  <p className="text-sm font-semibold text-slate-500">
                    Composição
                  </p>
                  <p className="font-bold text-slate-800">
                    {vacationDays} dias de descanso{" "}
                    {sellDays ? "+ 10 dias abono" : ""}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-primary-50 rounded-lg border border-primary-100 flex items-start gap-3">
              <input
                type="checkbox"
                id="generateReceipt"
                checked={generateReceipt}
                onChange={(e) => setGenerateReceipt(e.target.checked)}
                className="mt-1"
              />
              <label htmlFor="generateReceipt" className="text-sm text-primary-900 font-medium cursor-pointer">
                Gerar Recibo de Férias Imediatamente
                <p className="text-xs text-primary-700 font-normal mt-1">
                  O sistema criará o recibo e calculará o 1/3 constitucional, abono e impostos para este colaborador.
                </p>
              </label>
            </div>

            <p className="text-sm text-slate-600 mt-4 leading-relaxed">
              O aviso de férias deve ser comunicado ao empregado por escrito com
              antecedência de, no mínimo, 30 dias. O pagamento (férias + 1/3 e
              abono se houver) deve ocorrer até 2 dias úteis antes do início do
              respectivo período.
            </p>
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between mt-6 border-t border-slate-100 pt-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep(step - 1)}
            disabled={step === (inline && initialPeriodId ? 2 : 1)}
            className={`btn-secondary ${step === (inline && initialPeriodId ? 2 : 1) ? "opacity-0 pointer-events-none" : ""}`}
          >
            Voltar
          </button>

          {inline && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium"
            >
              Cancelar
            </button>
          )}
        </div>

        {step < totalSteps ? (
          <button onClick={handleNext} className="btn-primary">
            Próximo Passo
          </button>
        ) : (
          <button
            onClick={handleSaveVacation}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            <span>Programar Férias</span>
          </button>
        )}
      </div>
        </>
      )}
    </div>
  );
}
