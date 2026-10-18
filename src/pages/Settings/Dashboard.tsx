import { useState, useEffect } from "react";
import { Settings, Shield, Bell, Key, Database, Save, Clock, Calendar, CheckCircle2, Server, Download, Lock, Mail, Upload, FileKey, AlertTriangle, Plus, Users, Loader2, Activity } from "lucide-react";
import RolesAndProfilesTab from "./components/RolesAndProfilesTab";
import SecurityAndMfaTab from "./components/SecurityAndMfaTab";
import NotificationsTab from "./components/NotificationsTab";
import CertificatesTab from "./components/CertificatesTab";
import ExportDataTab from "./components/ExportDataTab";
import { OperationalAlertsPanel } from "../../components/observability/OperationalAlertsPanel";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { TenantSettingsService, SUPPORTED_TIMEZONES } from "../../services/settings/tenantSettingsService";

type Tab = 'gerais' | 'perfis' | 'seguranca' | 'notificacoes' | 'certificados' | 'exportar' | 'alertas';

export default function SettingsDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('gerais');

  // Estados da Aba 1 (Gerais)
  const [tenantId, setTenantId] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [timezone, setTimezone] = useState<string>('America/Sao_Paulo');
  const [cutoffDay, setCutoffDay] = useState<number>(25);
  const [esocialEnv, setEsocialEnv] = useState<'producao' | 'restrita'>('producao');
  const [loadingGeneral, setLoadingGeneral] = useState<boolean>(true);
  const [savingGeneral, setSavingGeneral] = useState<boolean>(false);

  useEffect(() => {
    async function loadGeneralSettings() {
      try {
        setLoadingGeneral(true);
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          setUserId(authData.user.id);
        }

        const { data: tenantUsers } = await supabase.from('tenant_users').select('tenant_id').limit(1).maybeSingle();
        const tid = tenantUsers?.tenant_id || '';
        setTenantId(tid);
        if (tid) {
          const settings = await TenantSettingsService.fetchSettings(tid);
          setTimezone(settings.timezone);
          setCutoffDay(settings.timesheet_cutoff_day);
          setEsocialEnv(settings.esocial_environment);
        }
      } catch (err: any) {
        console.error('Erro ao carregar configurações gerais:', err);
        toast.error('Erro ao carregar configurações gerais: ' + (err.message || ''));
      } finally {
        setLoadingGeneral(false);
      }
    }
    loadGeneralSettings();
  }, []);

  const handleSaveGeneralSettings = async () => {
    if (!tenantId) {
      toast.error('Tenant não identificado.');
      return;
    }
    setSavingGeneral(true);
    try {
      await TenantSettingsService.saveSettings(tenantId, {
        timezone,
        timesheet_cutoff_day: Number(cutoffDay),
        esocial_environment: esocialEnv
      });
      toast.success('Preferências gerais salvas com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar preferências gerais.');
    } finally {
      setSavingGeneral(false);
    }
  };

  const getTabClass = (tab: Tab) => {
    return activeTab === tab
      ? "w-full flex items-center gap-3 px-4 py-3 bg-primary-50 text-primary-700 rounded-xl font-bold text-sm shadow-sm transition-colors text-left border border-primary-100"
      : "w-full flex items-center gap-3 px-4 py-3 bg-transparent text-slate-600 hover:bg-slate-50 rounded-xl font-medium text-sm transition-colors text-left border border-transparent hover:border-slate-200";
  };

  const getIconClass = (tab: Tab) => {
    return activeTab === tab ? "text-primary-600" : "text-slate-400";
  };

  return (
    <div className="animate-fade-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display">
            Configurações Globais
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Preferências, segurança e parâmetros gerais do tenant
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Sidebar Settings Menu */}
        <div className="col-span-1 space-y-1">
          <button onClick={() => setActiveTab('gerais')} className={getTabClass('gerais')}>
            <Settings size={18} className={getIconClass('gerais')} /> Gerais
          </button>
          <button onClick={() => setActiveTab('perfis')} className={getTabClass('perfis')}>
            <Users size={18} className={getIconClass('perfis')} /> Acessos e Perfis
          </button>
          <button onClick={() => setActiveTab('seguranca')} className={getTabClass('seguranca')}>
            <Shield size={18} className={getIconClass('seguranca')} /> Segurança (MFA)
          </button>
          <button onClick={() => setActiveTab('notificacoes')} className={getTabClass('notificacoes')}>
            <Bell size={18} className={getIconClass('notificacoes')} /> Notificações
          </button>
          <button onClick={() => setActiveTab('certificados')} className={getTabClass('certificados')}>
            <Key size={18} className={getIconClass('certificados')} /> Certificados eSocial
          </button>
          <button onClick={() => setActiveTab('exportar')} className={getTabClass('exportar')}>
            <Database size={18} className={getIconClass('exportar')} /> Exportar Dados
          </button>
          <button onClick={() => setActiveTab('alertas')} className={getTabClass('alertas')}>
            <Activity size={18} className={getIconClass('alertas')} /> Alertas & Observabilidade
          </button>
        </div>

        {/* Content Area */}
        <div className="col-span-1 md:col-span-3">
          
          {activeTab === 'gerais' && (
            <div className="card overflow-hidden animate-in fade-in slide-in-from-bottom-2">
              <div className="p-6 bg-slate-50/50 border-b border-slate-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center">
                    <Settings size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 font-display">
                      Parâmetros Gerais do Tenant
                    </h2>
                    <p className="text-sm text-slate-500">
                      Estas configurações afetam todas as empresas e filiais vinculadas a esta conta.
                    </p>
                  </div>
                </div>
              </div>

              {loadingGeneral ? (
                <div className="p-12 flex flex-col items-center justify-center text-slate-400">
                  <Loader2 size={32} className="animate-spin text-primary-500 mb-3" />
                  <p className="text-sm font-medium text-slate-600">Carregando configurações do tenant...</p>
                </div>
              ) : (
                <div className="p-6 space-y-8">
                  <div className="grid grid-cols-2 gap-8">
                    <div className="col-span-2 md:col-span-1">
                      <label className="flex items-center gap-2 text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                        <Clock size={14} className="text-slate-400" />
                        Fuso Horário Padrão
                      </label>
                      <select 
                        value={timezone}
                        onChange={e => setTimezone(e.target.value)}
                        className="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm text-slate-900 font-medium"
                      >
                        {SUPPORTED_TIMEZONES.map(tz => (
                          <option key={tz.value} value={tz.value}>{tz.label}</option>
                        ))}
                      </select>
                      <p className="text-xs text-slate-500 mt-2">
                        Usado para marcação de ponto e logs de auditoria.
                      </p>
                    </div>

                    <div className="col-span-2 md:col-span-1">
                      <label className="flex items-center gap-2 text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                        <Calendar size={14} className="text-slate-400" />
                        Dia de Fechamento do Ponto
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={cutoffDay}
                        onChange={e => {
                          const val = parseInt(e.target.value, 10);
                          setCutoffDay(isNaN(val) ? 1 : Math.max(1, Math.min(31, val)));
                        }}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm text-slate-900 font-medium"
                      />
                      <p className="text-xs text-slate-500 mt-2">
                        Define o corte mensal para apuração de horas extras e banco de horas (1 a 31).
                      </p>
                    </div>

                    <div className="col-span-2">
                      <label className="flex items-center gap-2 text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                        <Server size={14} className="text-slate-400" />
                        Ambiente de Transmissão eSocial
                      </label>
                      <div className="relative">
                        <select 
                          value={esocialEnv}
                          onChange={e => setEsocialEnv(e.target.value as any)}
                          className="w-full pl-3 pr-8 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm text-slate-900 font-bold appearance-none"
                        >
                          <option value="producao">Produção (Ambiente Oficial e Eventos Reais)</option>
                          <option value="restrita">Produção Restrita (Ambiente de Testes)</option>
                        </select>
                        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                          <CheckCircle2 size={16} className="text-emerald-500" />
                        </div>
                      </div>
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                        <Shield className="text-amber-600 mt-0.5 shrink-0" size={16} />
                        <p className="text-xs text-amber-800 leading-relaxed">
                          <strong>Atenção:</strong> Mudar para "Produção Restrita" fará com que os eventos sejam enviados ao governo apenas em modo de teste, sem validade jurídica. Use apenas durante a implantação inicial.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-200 flex justify-end">
                    <button 
                      onClick={handleSaveGeneralSettings}
                      disabled={savingGeneral || loadingGeneral}
                      className="btn-primary py-2.5 px-6 shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingGeneral ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                      <span>{savingGeneral ? 'Salvando...' : 'Salvar Preferências'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'perfis' && (
            <RolesAndProfilesTab />
          )}

          {activeTab === 'seguranca' && (
            <SecurityAndMfaTab />
          )}

          {activeTab === 'notificacoes' && (
            <NotificationsTab />
          )}

          {activeTab === 'certificados' && (
            <CertificatesTab />
          )}

          {activeTab === 'exportar' && (
            <ExportDataTab />
          )}

          {activeTab === 'alertas' && (
            <div className="card p-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950 rounded-lg text-indigo-600 dark:text-indigo-400">
                  <Activity size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                    Monitoramento Operacional & Alertas de Incidentes
                  </h3>
                  <p className="text-xs text-slate-500">
                    Acompanhamento em tempo real de falhas nos motores de folha de pagamento e ingestão de ponto (REP/AFD).
                  </p>
                </div>
              </div>

              <OperationalAlertsPanel
                tenantId={tenantId || 'unknown'}
                userId={userId || 'unknown'}
              />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
