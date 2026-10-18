import { useState, useEffect } from "react";
import { 
  Bell, 
  Mail, 
  MessageSquare, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  FileText, 
  Activity, 
  Save, 
  Loader2, 
  Smartphone,
  Info
} from "lucide-react";
import { toast } from "sonner";
import { 
  NotificationSettingsService, 
  DEFAULT_NOTIFICATION_SETTINGS, 
  type TenantNotificationSettings 
} from "../../../services/settings/notificationSettingsService";

export default function NotificationsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Gatilhos e Prazos
  const [notifyVacationWarning, setNotifyVacationWarning] = useState<boolean>(true);
  const [vacationWarningDays, setVacationWarningDays] = useState<15 | 30 | 45 | 60>(30);

  const [notifyTimesheetCutoff, setNotifyTimesheetCutoff] = useState<boolean>(true);
  const [timesheetCutoffDays, setTimesheetCutoffDays] = useState<number>(3);

  const [notifyAsoExpiration, setNotifyAsoExpiration] = useState<boolean>(true);
  const [asoExpirationDays, setAsoExpirationDays] = useState<15 | 30 | 45 | 60>(30);

  // Alertas Operacionais
  const [notifySalaryAdvances, setNotifySalaryAdvances] = useState<boolean>(true);
  const [notifyPayrollDivergences, setNotifyPayrollDivergences] = useState<boolean>(true);
  const [notifyEsocialInconsistencies, setNotifyEsocialInconsistencies] = useState<boolean>(true);

  // Canais de Notificação
  const [inAppEnabled, setInAppEnabled] = useState<boolean>(true);
  const [emailEnabled, setEmailEnabled] = useState<boolean>(true);
  const [dpEmail, setDpEmail] = useState<string>("");
  const [whatsappEnabled, setWhatsappEnabled] = useState<boolean>(false);
  const [dpPhone, setDpPhone] = useState<string>("");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const settings = await NotificationSettingsService.getSettings();
      setNotifyVacationWarning(settings.notify_vacation_warning);
      setVacationWarningDays(settings.vacation_warning_days);
      setNotifyTimesheetCutoff(settings.notify_timesheet_cutoff);
      setTimesheetCutoffDays(settings.timesheet_cutoff_warning_days);
      setNotifyAsoExpiration(settings.notify_aso_expiration);
      setAsoExpirationDays(settings.aso_expiration_warning_days);
      setNotifySalaryAdvances(settings.notify_salary_advances);
      setNotifyPayrollDivergences(settings.notify_payroll_divergences);
      setNotifyEsocialInconsistencies(settings.notify_esocial_inconsistencies);
      setInAppEnabled(settings.in_app_notifications_enabled);
      setEmailEnabled(settings.email_notifications_enabled);
      setDpEmail(settings.dp_notification_email || "");
      setWhatsappEnabled(settings.whatsapp_notifications_enabled);
      setDpPhone(settings.dp_notification_phone || "");
    } catch (err) {
      console.error("Erro ao carregar configurações de notificação:", err);
      toast.error("Não foi possível carregar as preferências de notificação.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const payload: TenantNotificationSettings = {
      notify_vacation_warning: notifyVacationWarning,
      vacation_warning_days: vacationWarningDays,
      notify_timesheet_cutoff: notifyTimesheetCutoff,
      timesheet_cutoff_warning_days: timesheetCutoffDays,
      notify_aso_expiration: notifyAsoExpiration,
      aso_expiration_warning_days: asoExpirationDays,
      notify_salary_advances: notifySalaryAdvances,
      notify_payroll_divergences: notifyPayrollDivergences,
      notify_esocial_inconsistencies: notifyEsocialInconsistencies,
      in_app_notifications_enabled: inAppEnabled,
      email_notifications_enabled: emailEnabled,
      dp_notification_email: dpEmail.trim() || null,
      whatsapp_notifications_enabled: whatsappEnabled,
      dp_notification_phone: dpPhone.trim() || null
    };

    const validation = NotificationSettingsService.validate(payload);
    if (!validation.valid) {
      toast.error(validation.error || "Dados de notificação inválidos.");
      return;
    }

    try {
      setSaving(true);
      const result = await NotificationSettingsService.saveSettings(payload);
      if (result.success) {
        toast.success("Configurações de notificações e alertas salvas com sucesso!");
      } else {
        toast.error(result.error || "Erro ao salvar preferências de notificação.");
      }
    } catch (err: any) {
      toast.error(err.message || "Falha inesperada ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="card p-12 flex flex-col items-center justify-center text-slate-500 space-y-3">
        <Loader2 className="animate-spin text-primary-500" size={32} />
        <p className="text-sm font-medium">Carregando governança de notificações...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-200">
      {/* Cabeçalho da Aba */}
      <div className="card overflow-hidden">
        <div className="p-6 bg-slate-50/50 border-b border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <Bell size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 font-display">
                  Notificações & Alertas Corporativos
                </h2>
                <p className="text-sm text-slate-500">
                  Parametrização de gatilhos automáticos de conformidade legal CLT, SST, ponto e canais corporativos.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start md:self-auto">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 size={13} className="text-emerald-500" /> Monitor Ativo
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Seção 1: Gatilhos de Conformidade Legal e Prazos */}
          <div>
            <div className="mb-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Calendar size={16} className="text-primary-500" />
                Prazos & Conformidade Trabalhista (CLT / SST)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure com que antecedência os alertas de prazos legais devem ser disparados para o Departamento Pessoal.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card 1: Férias CLT */}
              <div className={`p-4 rounded-xl border transition-all ${
                notifyVacationWarning ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-50/60 border-slate-200/60 opacity-70'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Clock size={15} />
                    </div>
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Vencimento de Férias
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifyVacationWarning}
                    onChange={e => setNotifyVacationWarning(e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500 cursor-pointer"
                  />
                </div>
                <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                  Aviso para evitar o pagamento de férias em dobro (Art. 134/135 CLT - aviso mínimo de 30 dias).
                </p>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase">
                    Antecedência do Alerta
                  </label>
                  <select
                    disabled={!notifyVacationWarning}
                    value={vacationWarningDays}
                    onChange={e => setVacationWarningDays(Number(e.target.value) as any)}
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50"
                  >
                    <option value={15}>15 dias antes</option>
                    <option value={30}>30 dias antes (Recomendado CLT)</option>
                    <option value={45}>45 dias antes</option>
                    <option value={60}>60 dias antes (Gestão Estratégica)</option>
                  </select>
                </div>
              </div>

              {/* Card 2: Fechamento de Ponto */}
              <div className={`p-4 rounded-xl border transition-all ${
                notifyTimesheetCutoff ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-50/60 border-slate-200/60 opacity-70'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md bg-sky-50 text-sky-600 flex items-center justify-center">
                      <Calendar size={15} />
                    </div>
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Corte de Ponto
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifyTimesheetCutoff}
                    onChange={e => setNotifyTimesheetCutoff(e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500 cursor-pointer"
                  />
                </div>
                <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                  Aviso aos gestores para aprovação de espelhos e tratamento de inconsistências antes do corte da folha.
                </p>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase">
                    Dias antes do corte
                  </label>
                  <select
                    disabled={!notifyTimesheetCutoff}
                    value={timesheetCutoffDays}
                    onChange={e => setTimesheetCutoffDays(Number(e.target.value))}
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50"
                  >
                    <option value={1}>1 dia antes do corte</option>
                    <option value={2}>2 dias antes do corte</option>
                    <option value={3}>3 dias antes do corte (Padrão)</option>
                    <option value={5}>5 dias antes do corte</option>
                    <option value={7}>7 dias antes do corte</option>
                  </select>
                </div>
              </div>

              {/* Card 3: ASO / SST */}
              <div className={`p-4 rounded-xl border transition-all ${
                notifyAsoExpiration ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-50/60 border-slate-200/60 opacity-70'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Activity size={15} />
                    </div>
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Vencimento ASO / SST
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifyAsoExpiration}
                    onChange={e => setNotifyAsoExpiration(e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500 cursor-pointer"
                  />
                </div>
                <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                  Monitoramento de exames periódicos da NR-7 para evitar autos de infração e bloqueios de admissão/retorno.
                </p>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase">
                    Antecedência do Alerta
                  </label>
                  <select
                    disabled={!notifyAsoExpiration}
                    value={asoExpirationDays}
                    onChange={e => setAsoExpirationDays(Number(e.target.value) as any)}
                    className="w-full text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50"
                  >
                    <option value={15}>15 dias antes</option>
                    <option value={30}>30 dias antes (Recomendado NR-7)</option>
                    <option value={45}>45 dias antes</option>
                    <option value={60}>60 dias antes</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Seção 2: Alertas Operacionais da Folha e eSocial */}
          <div className="pt-6 border-t border-slate-200">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert size={16} className="text-indigo-500" />
                Alertas de Folha, Adiantamentos & eSocial
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Notificações instantâneas em caso de divergências cadastrais, bloqueios no motor de folha ou requisições.
              </p>
            </div>

            <div className="space-y-3">
              <label className="flex items-start justify-between p-4 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
                <div className="space-y-0.5 pr-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={15} className="text-amber-500 shrink-0" />
                    <span className="text-sm font-semibold text-slate-900">
                      Divergências e Erros de Cálculo na Folha
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Notifica imediatamente a equipe caso um cálculo gere status de erro (HTTP 422), memória inconsistente ou ausência de parâmetros legais.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={notifyPayrollDivergences}
                  onChange={e => setNotifyPayrollDivergences(e.target.checked)}
                  className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500 mt-1 cursor-pointer shrink-0"
                />
              </label>

              <label className="flex items-start justify-between p-4 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
                <div className="space-y-0.5 pr-4">
                  <div className="flex items-center gap-2">
                    <FileText size={15} className="text-indigo-500 shrink-0" />
                    <span className="text-sm font-semibold text-slate-900">
                      Inconsistências Pré-Validação eSocial
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Alerta sobre eventos pendentes de transmissão (S-1200, S-1210, S-2200) com divergências de CPF, PIS ou alíquotas FPAS/RAT.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={notifyEsocialInconsistencies}
                  onChange={e => setNotifyEsocialInconsistencies(e.target.checked)}
                  className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500 mt-1 cursor-pointer shrink-0"
                />
              </label>

              <label className="flex items-start justify-between p-4 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">
                <div className="space-y-0.5 pr-4">
                  <div className="flex items-center gap-2">
                    <Activity size={15} className="text-teal-500 shrink-0" />
                    <span className="text-sm font-semibold text-slate-900">
                      Solicitações de Adiantamento Salarial e Consignados
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Avisa quando um colaborador solicitar adiantamento quinzenal ou houver novo contrato de consignado provisionado no adiantamento.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={notifySalaryAdvances}
                  onChange={e => setNotifySalaryAdvances(e.target.checked)}
                  className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500 mt-1 cursor-pointer shrink-0"
                />
              </label>
            </div>
          </div>

          {/* Seção 3: Canais de Envio e Contatos Corporativos */}
          <div className="pt-6 border-t border-slate-200">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Mail size={16} className="text-emerald-500" />
                Canais de Envio & Destinatários Corporativos
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Defina como e para quem os resumos operacionais e avisos urgentes serão entregues.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Canal In-App */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell size={18} className="text-primary-600" />
                    <span className="text-xs font-bold text-slate-900">In-App (Central do Sistema)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={inAppEnabled}
                    onChange={e => setInAppEnabled(e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500 cursor-pointer"
                  />
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Exibe avisos flutuantes e badge no sino do cabeçalho da plataforma para analistas e gestores conectados.
                </p>
              </div>

              {/* Canal E-mail */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail size={18} className="text-indigo-600" />
                    <span className="text-xs font-bold text-slate-900">E-mail Corporativo (DP/RH)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailEnabled}
                    onChange={e => setEmailEnabled(e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500 cursor-pointer"
                  />
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Envia resumos consolidados semanais e avisos críticos de prazos para a caixa de entrada da equipe.
                </p>
                <div>
                  <input
                    type="email"
                    disabled={!emailEnabled}
                    placeholder="dp@empresa.com.br"
                    value={dpEmail}
                    onChange={e => setDpEmail(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">E-mail corporativo da equipe responsável.</p>
                </div>
              </div>

              {/* Canal WhatsApp */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone size={18} className="text-emerald-600" />
                    <span className="text-xs font-bold text-slate-900">WhatsApp Corporativo</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={whatsappEnabled}
                    onChange={e => setWhatsappEnabled(e.target.checked)}
                    className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500 cursor-pointer"
                  />
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Notificações instantâneas de urgência (bloqueios de folha ou vencimentos imediatos de ASO/Férias).
                </p>
                <div>
                  <input
                    type="tel"
                    disabled={!whatsappEnabled}
                    placeholder="(11) 98765-4321"
                    value={dpPhone}
                    onChange={e => setDpPhone(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500/20 disabled:opacity-50"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Número com DDD para envio automatizado.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Nota de Auditoria e Governança */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
            <Info size={18} className="text-slate-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 space-y-1">
              <span className="font-semibold text-slate-800">Governança & Rastreabilidade Forense (T29):</span>
              <p>
                Qualquer modificação nos parâmetros de alerta ou canais corporativos é registrada de forma imutável 
                na tabela de auditoria <code className="bg-slate-200 px-1 py-0.5 rounded text-[11px]">audit.logs</code>, 
                vinculada ao seu IP, identificador de usuário e timestamp auditável.
              </p>
            </div>
          </div>

          {/* Botão de Salvar */}
          <div className="pt-6 border-t border-slate-200 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary py-2.5 px-6 shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              <span>{saving ? "Salvando Alertas..." : "Salvar Configurações de Notificações"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
