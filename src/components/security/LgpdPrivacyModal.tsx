import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  FileText,
  Download,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Building2,
  RefreshCw,
  Send,
  X,
  Eye,
  Info
} from 'lucide-react';
import {
  LGPDService,
  LgpdRequestType,
  RetentionDomain
} from '../../services/security/lgpdService';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

interface LgpdPrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  workerId: string;
  tenantId: string;
  employeeName: string;
  employeeCpf: string;
}

export const LgpdPrivacyModal: React.FC<LgpdPrivacyModalProps> = ({
  isOpen,
  onClose,
  workerId,
  tenantId,
  employeeName,
  employeeCpf
}) => {
  const [activeTab, setActiveTab] = useState<'dossier' | 'consents' | 'sharing' | 'requests'>('dossier');
  const [loading, setLoading] = useState(false);
  const [dossierData, setDossierData] = useState<any>(null);
  const [sharingList, setSharingList] = useState<any[]>([]);
  const [subjectRequests, setSubjectRequests] = useState<any[]>([]);
  const [consentsList, setConsentsList] = useState<any[]>([]);

  // Formulário de nova solicitação
  const [newReqType, setNewReqType] = useState<LgpdRequestType>(LgpdRequestType.ACCESS_DATA);
  const [newReqJustification, setNewReqJustification] = useState('');
  const [submittingReq, setSubmittingReq] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadLgpdData();
    }
  }, [isOpen, workerId, tenantId]);

  const loadLgpdData = async () => {
    setLoading(true);
    try {
      // 1. Tentar carregar via RPC do Dossiê
      const { data: rpcDossier, error: rpcErr } = await supabase.rpc('get_my_lgpd_dossier');
      if (!rpcErr && rpcDossier) {
        setDossierData(rpcDossier);
        if (rpcDossier.consentimentos) setConsentsList(rpcDossier.consentimentos);
        if (rpcDossier.solicitacoes_titular) setSubjectRequests(rpcDossier.solicitacoes_titular);
      } else {
        // Fallback local via queries seguras
        const { data: consents } = await supabase
          .from('lgpd_consents')
          .select('*')
          .order('granted_at', { ascending: false });
        if (consents) setConsentsList(consents);

        const { data: requests } = await supabase
          .from('lgpd_subject_requests')
          .select('*')
          .eq('worker_id', workerId)
          .order('requested_at', { ascending: false });
        if (requests) setSubjectRequests(requests);
      }

      // 2. Carregar compartilhamentos oficiais
      const sharings = await LGPDService.fetchDataSharingRegistry(tenantId);
      setSharingList(sharings || []);
    } catch (err: any) {
      console.warn('Erro ao carregar dados LGPD:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadDossier = () => {
    try {
      const exportPayload = dossierData || {
        generatedAt: new Date().toISOString(),
        titular: {
          nomeCompleto: employeeName,
          cpfMascarado: LGPDService.maskCpf(employeeCpf)
        },
        aviso: 'Dossiê do Titular gerado em conformidade com o Art. 18 da Lei nº 13.709/2018 (LGPD).'
      };

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dossie_lgpd_${employeeName.toLowerCase().replace(/\s+/g, '_')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Dossiê do Titular baixado com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao baixar dossiê: ' + err.message);
    }
  };

  const handleRevokeConsent = async (consentId?: string, category?: string) => {
    try {
      if (consentId) {
        await supabase
          .from('lgpd_consents')
          .update({
            revoked_at: new Date().toISOString(),
            revocation_reason: 'Revogação voluntária pelo colaborador no Portal'
          })
          .eq('id', consentId);
      }

      toast.success(`Consentimento para "${category || 'este item'}" foi revogado com sucesso.`);
      loadLgpdData();
    } catch (err: any) {
      toast.error('Erro ao revogar consentimento: ' + err.message);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReqJustification.trim() || newReqJustification.trim().length < 10) {
      toast.error('Por favor, descreva o motivo da sua solicitação com pelo menos 10 caracteres.');
      return;
    }

    setSubmittingReq(true);
    try {
      const res = await LGPDService.submitSubjectRequest({
        tenant_id: tenantId,
        worker_id: workerId,
        request_type: newReqType,
        justification: newReqJustification.trim()
      });

      if (!res.success) {
        throw new Error(res.error || 'Falha ao registrar solicitação.');
      }

      toast.success('Sua solicitação de direito do titular foi registrada com sucesso! O DPO/RH responderá em até 15 dias.');
      setNewReqJustification('');
      loadLgpdData();
      setActiveTab('requests');
    } catch (err: any) {
      toast.error('Erro ao registrar solicitação: ' + err.message);
    } finally {
      setSubmittingReq(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-3xl my-8 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
              <ShieldCheck size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white font-display">Privacidade & Meus Dados</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  LGPD Art. 18
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Transparência, controle de consentimentos e governança dos seus dados pessoais
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Abas */}
        <div className="flex border-b border-slate-100 bg-slate-50/80 px-6 gap-2 shrink-0 overflow-x-auto py-2">
          <button
            onClick={() => setActiveTab('dossier')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'dossier'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <FileText size={15} />
            Meus Dados (Dossiê)
          </button>
          <button
            onClick={() => setActiveTab('consents')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'consents'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <Lock size={15} />
            Consentimentos ({consentsList.length})
          </button>
          <button
            onClick={() => setActiveTab('sharing')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'sharing'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <Building2 size={15} />
            Compartilhamento Legal
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'requests'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <Shield size={15} />
            Solicitações ({subjectRequests.length})
          </button>
        </div>

        {/* Conteúdo scrollável */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700">
          {/* ABA 1: DOSSIÊ */}
          {activeTab === 'dossier' && (
            <div className="space-y-5 animate-fade-in">
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3">
                <Info size={18} className="text-indigo-600 shrink-0 mt-0.5" />
                <div className="text-xs text-indigo-950 leading-relaxed">
                  <p className="font-bold mb-0.5">Direito de Acesso e Portabilidade (Art. 18, II e V da LGPD)</p>
                  Você tem o direito de obter cópia integral de todos os seus dados cadastrais, contratuais e funcionais armazenados no CoupleRH, com dados sensíveis devidamente protegidos.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-4 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Titular</span>
                  <p className="text-sm font-bold text-slate-900">{employeeName}</p>
                  <p className="text-xs text-slate-500 font-mono">
                    CPF: {LGPDService.maskCpf(employeeCpf)}
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-4 space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Base Legal Predominante</span>
                  <p className="text-sm font-bold text-slate-900">Obrigação Legal & Execução de Contrato</p>
                  <p className="text-xs text-slate-500">
                    Art. 7º, II e V da LGPD (CLT, eSocial, Previdência e FGTS)
                  </p>
                </div>
              </div>

              {/* Políticas de Retenção */}
              <div className="border border-slate-200 rounded-2xl p-4 space-y-3 bg-white">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Lock size={14} className="text-slate-400" />
                  Prazos Legais de Guarda e Retenção de Dados
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="font-bold text-slate-800 block">Folha & Ponto</span>
                    <span className="text-indigo-600 font-extrabold text-sm block my-0.5">5 Anos</span>
                    <span className="text-[10px] text-slate-500">CLT Art. 11 / Portaria 671</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="font-bold text-slate-800 block">Saúde Ocupacional</span>
                    <span className="text-indigo-600 font-extrabold text-sm block my-0.5">20 Anos</span>
                    <span className="text-[10px] text-slate-500">NR-7 / Prontuários e PPP</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="font-bold text-slate-800 block">FGTS / Aposentadoria</span>
                    <span className="text-indigo-600 font-extrabold text-sm block my-0.5">30 Anos</span>
                    <span className="text-[10px] text-slate-500">Súmula 362 do TST</span>
                  </div>
                </div>
              </div>

              {/* Botão de Exportação */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleDownloadDossier}
                  className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  <Download size={16} />
                  Baixar Dossiê Completo em JSON (LGPD Art. 18)
                </button>
              </div>
            </div>
          )}

          {/* ABA 2: CONSENTIMENTOS */}
          {activeTab === 'consents' && (
            <div className="space-y-4 animate-fade-in">
              <p className="text-xs text-slate-500 leading-relaxed">
                Abaixo estão listadas as atividades que utilizam a sua autorização voluntária (Art. 7º, I da LGPD). Conforme o Art. 8º §5º, você pode revogar qualquer consentimento a qualquer momento.
              </p>

              {consentsList.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/70 space-y-2">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-500" />
                  <p className="text-sm font-bold text-slate-800">Seus dados são protegidos por base legal primária</p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Nenhum consentimento acessório pendente. Seus dados trabalhistas são processados exclusivamente para cumprimento do contrato de trabalho e obrigações da CLT/eSocial.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {consentsList.map((c, i) => {
                    const isRevoked = !!c.revoked_at;
                    return (
                      <div
                        key={c.id || i}
                        className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isRevoked
                            ? 'bg-slate-50 border-slate-200/60 opacity-60'
                            : 'bg-white border-slate-200 hover:border-indigo-200'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900">{c.category || c.data_category}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isRevoked
                                  ? 'bg-slate-200 text-slate-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {isRevoked ? 'Revogado' : 'Ativo'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600">{c.purpose || c.processing_purpose}</p>
                          <p className="text-[10px] text-slate-400">
                            Concedido em: {new Date(c.granted_at).toLocaleDateString('pt-BR')}
                            {isRevoked && ` · Revogado em: ${new Date(c.revoked_at).toLocaleDateString('pt-BR')}`}
                          </p>
                        </div>

                        {!isRevoked && (
                          <button
                            type="button"
                            onClick={() => handleRevokeConsent(c.id, c.category || c.data_category)}
                            className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold shrink-0 transition-colors"
                          >
                            Revogar Autorização
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ABA 3: COMPARTILHAMENTO LEGAL */}
          {activeTab === 'sharing' && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-950">
                <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold mb-0.5">Informação sobre Compartilhamento (Art. 18, VII da LGPD)</p>
                  Por força da legislação trabalhista, previdenciária e tributária brasileira, a empresa compartilha dados funcionais e de remuneração estritamente com os órgãos públicos e agentes financeiros homologados.
                </div>
              </div>

              <div className="space-y-3">
                {sharingList.map((item, idx) => (
                  <div key={idx} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <Building2 size={14} className="text-indigo-600" />
                        {item.recipient_name}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {item.legal_basis === 'LEGAL_OBLIGATION'
                          ? 'Obrigação Legal'
                          : item.legal_basis === 'CONTRACT_EXECUTION'
                          ? 'Execução de Contrato'
                          : item.legal_basis}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{item.purpose}</p>
                    <p className="text-[11px] text-slate-400 bg-slate-50 p-2 rounded-xl">
                      <span className="font-semibold text-slate-600">Dados compartilhados:</span> {item.data_shared}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ABA 4: SOLICITAÇÕES DO TITULAR */}
          {activeTab === 'requests' && (
            <div className="space-y-6 animate-fade-in">
              {/* Formulário de abertura */}
              <form onSubmit={handleSubmitRequest} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Send size={14} className="text-indigo-600" />
                  Abrir Nova Solicitação ao Encarregado de Dados (DPO)
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Tipo de Direito</label>
                    <select
                      value={newReqType}
                      onChange={(e) => setNewReqType(e.target.value as LgpdRequestType)}
                      className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    >
                      <option value={LgpdRequestType.ACCESS_DATA}>Acesso aos Dados (Cópia Integral)</option>
                      <option value={LgpdRequestType.CONFIRMATION}>Confirmação de Tratamento</option>
                      <option value={LgpdRequestType.CORRECTION}>Correção de Dados Incompletos ou Inexatos</option>
                      <option value={LgpdRequestType.PORTABILITY}>Portabilidade dos Dados</option>
                      <option value={LgpdRequestType.ANONYMIZATION}>Anonimização / Eliminação de Dados</option>
                      <option value={LgpdRequestType.REVOCATION_CONSENT}>Revogação Geral de Consentimentos</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">Prazo Legal de Resposta</label>
                    <div className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-500 font-medium">
                      Até 15 dias corridos (Art. 19, II LGPD)
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Justificativa ou Detalhes da Solicitação
                  </label>
                  <textarea
                    rows={2}
                    value={newReqJustification}
                    onChange={(e) => setNewReqJustification(e.target.value)}
                    placeholder="Descreva claramente sua solicitação (mínimo de 10 caracteres)..."
                    className="w-full text-xs bg-white border border-slate-300 rounded-xl p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submittingReq}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    {submittingReq ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                    Enviar Solicitação Formal
                  </button>
                </div>
              </form>

              {/* Histórico */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Histórico de Solicitações ({subjectRequests.length})
                </h4>
                {subjectRequests.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Nenhuma solicitação aberta até o momento.</p>
                ) : (
                  subjectRequests.map((req, i) => (
                    <div key={req.id || i} className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{req.type || req.request_type}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            req.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-700'
                              : req.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {req.status === 'COMPLETED'
                            ? 'Concluída'
                            : req.status === 'REJECTED'
                            ? 'Indeferida'
                            : 'Em Análise'}
                        </span>
                      </div>
                      <p className="text-slate-600">{req.justification}</p>
                      {req.response_notes && (
                        <p className="p-2 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-700">
                          <span className="font-semibold text-slate-900">Resposta do DPO:</span> {req.response_notes}
                        </p>
                      )}
                      <p className="text-[10px] text-slate-400">
                        Aberto em: {new Date(req.requested_at).toLocaleDateString('pt-BR')}
                        {req.responded_at && ` · Respondido em: ${new Date(req.responded_at).toLocaleDateString('pt-BR')}`}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
