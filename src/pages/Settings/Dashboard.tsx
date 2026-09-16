import { useState } from "react";
import { Settings, Shield, Bell, Key, Database, Save, Clock, Calendar, CheckCircle2, Server, Download, Lock, Mail, Upload, FileKey, AlertTriangle, Plus, Users } from "lucide-react";
import RolesAndProfilesTab from "./components/RolesAndProfilesTab";

type Tab = 'gerais' | 'perfis' | 'seguranca' | 'notificacoes' | 'certificados' | 'exportar';

export default function SettingsDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('gerais');

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

              <div className="p-6 space-y-8">
                <div className="grid grid-cols-2 gap-8">
                  <div className="col-span-2 md:col-span-1">
                    <label className="flex items-center gap-2 text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                      <Clock size={14} className="text-slate-400" />
                      Fuso Horário Padrão
                    </label>
                    <select className="w-full pl-3 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm text-slate-900 font-medium">
                      <option value="America/Sao_Paulo">Horário de Brasília (America/Sao_Paulo)</option>
                      <option value="America/Manaus">Amazonas (America/Manaus)</option>
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
                      defaultValue="25"
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm text-slate-900 font-medium"
                    />
                    <p className="text-xs text-slate-500 mt-2">
                      Define o corte mensal para apuração de horas extras e banco.
                    </p>
                  </div>

                  <div className="col-span-2">
                    <label className="flex items-center gap-2 text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                      <Server size={14} className="text-slate-400" />
                      Ambiente de Transmissão eSocial
                    </label>
                    <div className="relative">
                      <select className="w-full pl-3 pr-8 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm text-slate-900 font-bold appearance-none">
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
                  <button className="btn-primary py-2.5 px-6 shadow-md hover:shadow-lg transition-all">
                    <Save size={18} />
                    <span>Salvar Preferências</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'perfis' && (
            <RolesAndProfilesTab />
          )}

          {activeTab === 'seguranca' && (
            <div className="card overflow-hidden animate-in fade-in slide-in-from-bottom-2">
              <div className="p-6 bg-slate-50/50 border-b border-slate-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <Lock size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 font-display">
                      Segurança e Acessos
                    </h2>
                    <p className="text-sm text-slate-500">
                      Políticas de senha, autenticação em duas etapas (MFA) e restrições de IP.
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-center py-12 text-slate-400">
                  <div className="text-center">
                    <Shield size={48} className="mx-auto mb-4 opacity-50" />
                    <p className="font-medium">Módulo de Segurança em Desenvolvimento</p>
                    <p className="text-sm mt-1">As configurações de SSO e MFA estarão disponíveis na próxima fase.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notificacoes' && (
            <div className="card overflow-hidden animate-in fade-in slide-in-from-bottom-2">
              <div className="p-6 bg-slate-50/50 border-b border-slate-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                    <Mail size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 font-display">
                      Notificações do Sistema
                    </h2>
                    <p className="text-sm text-slate-500">
                      Configuração de envio de e-mails, alertas de vencimento de férias e fechamento de ponto.
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-4">
                {['Alertar 30 dias antes do vencimento de Férias', 'Aviso de Fechamento de Ponto pendente', 'Notificar sobre reajustes salariais automáticos', 'Alertar sobre inconsistências no eSocial'].map((item, i) => (
                  <label key={i} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                    <span className="text-sm font-medium text-slate-700">{item}</span>
                    <input type="checkbox" defaultChecked className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500" />
                  </label>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'certificados' && (
            <div className="card overflow-hidden animate-in fade-in slide-in-from-bottom-2">
              <div className="p-6 bg-slate-50/50 border-b border-slate-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
                    <FileKey size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 font-display">
                      Certificados eSocial (A1)
                    </h2>
                    <p className="text-sm text-slate-500">
                      Upload e gestão do certificado digital usado para transmissão ao governo.
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50">
                  <Upload size={32} className="mx-auto text-slate-400 mb-3" />
                  <h3 className="text-sm font-bold text-slate-900 mb-1">Nenhum certificado instalado</h3>
                  <p className="text-xs text-slate-500 mb-4">Faça o upload do arquivo .pfx para habilitar as transmissões.</p>
                  <button className="btn-primary mx-auto">
                    <Plus size={16} /> Upload Certificado A1
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'exportar' && (
            <div className="card overflow-hidden animate-in fade-in slide-in-from-bottom-2">
              <div className="p-6 bg-slate-50/50 border-b border-slate-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center">
                    <Database size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 font-display">
                      Exportação e Backups
                    </h2>
                    <p className="text-sm text-slate-500">
                      Extração de dados para auditorias, LGPD ou backups de segurança.
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="p-4 border border-slate-200 rounded-lg flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Backup Completo (Banco de Dados)</h3>
                    <p className="text-xs text-slate-500">Gera um dump criptografado de todos os dados do seu Tenant.</p>
                  </div>
                  <button className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-bold transition-colors flex items-center gap-2">
                    <Download size={16} /> Gerar
                  </button>
                </div>
                <div className="p-4 border border-slate-200 rounded-lg flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Relatório LGPD</h3>
                    <p className="text-xs text-slate-500">Exporta os logs de acesso a dados sensíveis de todos os colaboradores.</p>
                  </div>
                  <button className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-bold transition-colors flex items-center gap-2">
                    <Download size={16} /> Gerar
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
