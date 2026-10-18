import { useState, useEffect } from "react";
import { 
  FileKey, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  Building2, 
  Calendar, 
  Shield, 
  Trash2, 
  RefreshCw, 
  Loader2, 
  Plus, 
  Info,
  Server
} from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "../../../components/ConfirmDialogProvider";
import { 
  CertificateService, 
  type TenantCertificate, 
  type CertificateStatus 
} from "../../../services/settings/certificateService";
import UploadCertificateModal from "./UploadCertificateModal";
import { supabase } from "../../../lib/supabase";

export default function CertificatesTab() {
  const [loading, setLoading] = useState(true);
  const [activeCert, setActiveCert] = useState<TenantCertificate | null>(null);
  const [environment, setEnvironment] = useState<'producao' | 'restrita'>('producao');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<{ cnpj: string; name: string }>({ cnpj: "", name: "" });

  useEffect(() => {
    loadData();
  }, [environment]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Carregar certificado ativo
      const cert = await CertificateService.getActiveCertificate(environment);
      setActiveCert(cert);

      // Carregar dados da empresa (CNPJ e Razão Social)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: tu } = await supabase
          .from('tenant_users')
          .select('tenant_id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        if (tu?.tenant_id) {
          const { data: comp } = await supabase
            .from('companies')
            .select('cnpj, corporate_name')
            .eq('tenant_id', tu.tenant_id)
            .limit(1)
            .maybeSingle();

          if (comp) {
            setCompanyInfo({
              cnpj: CertificateService.formatCNPJ(comp.cnpj || ""),
              name: comp.corporate_name || ""
            });
          }
        }
      }
    } catch (err) {
      console.error("Erro ao carregar dados do certificado:", err);
      toast.error("Não foi possível carregar as informações do certificado.");
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!activeCert) return;

    confirmDialog({
      title: "Revogar Certificado Digital",
      message: "Tem certeza de que deseja desativar este certificado digital? Transmissões do eSocial que exigem assinatura ficarão inoperantes até a instalação de um novo certificado.",
      confirmText: "Sim, Desativar",
      cancelText: "Cancelar",
      danger: true,
      onConfirm: async () => {
        try {
          setRevoking(true);
          const res = await CertificateService.revokeCertificate(
            activeCert.id,
            "Desativado manualmente pelo gestor na tela de configurações"
          );
          if (res.success) {
            toast.success("Certificado desativado com sucesso!");
            loadData();
          } else {
            toast.error(res.error || "Erro ao desativar certificado.");
          }
        } catch (err: any) {
          toast.error(err.message || "Erro inesperado ao desativar.");
        } finally {
          setRevoking(false);
        }
      }
    });
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch {
      return isoStr;
    }
  };

  if (loading) {
    return (
      <div className="card p-12 flex flex-col items-center justify-center text-slate-500 space-y-3">
        <Loader2 className="animate-spin text-primary-500" size={32} />
        <p className="text-sm font-medium">Carregando governança de certificados digitais...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
      {/* Cabeçalho da Aba */}
      <div className="card overflow-hidden">
        <div className="p-6 bg-slate-50/50 border-b border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <FileKey size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 font-display">
                  Certificados Digitais eSocial (A1)
                </h2>
                <p className="text-sm text-slate-500">
                  Gestão do certificado digital ICP-Brasil (.pfx) utilizado para assinar eventos e transmitir dados ao governo.
                </p>
              </div>
            </div>

            {/* Seletor de Ambiente */}
            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl self-start md:self-auto">
              <button
                onClick={() => setEnvironment('producao')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  environment === 'producao'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Produção Oficial
              </button>
              <button
                onClick={() => setEnvironment('restrita')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  environment === 'restrita'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Produção Restrita (Testes)
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {!activeCert ? (
            /* Estado Vazio: Nenhum certificado instalado */
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-10 text-center bg-slate-50/60 max-w-xl mx-auto space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center border border-slate-200">
                <Upload size={28} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 mb-1 font-display">
                  Nenhum Certificado A1 Ativo em {environment === 'producao' ? 'Produção' : 'Produção Restrita'}
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  Para assinar e transmitir eventos de admissão (S-2200), folha (S-1200) e SST (S-2220/S-2240) à Receita Federal, faça o upload do arquivo .pfx.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="btn-primary mx-auto py-2.5 px-6 shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
              >
                <Plus size={16} />
                <span>Instalar Certificado A1</span>
              </button>
            </div>
          ) : (
            /* Estado Ativo: Detalhes do Certificado Instalado */
            <div className="space-y-6">
              {/* Card Principal de Vigência */}
              <div className={`p-6 rounded-2xl border transition-all ${
                activeCert.status === 'VALID' 
                  ? 'bg-emerald-50/40 border-emerald-200' 
                  : activeCert.status === 'EXPIRING_SOON'
                  ? 'bg-amber-50/50 border-amber-200'
                  : 'bg-rose-50/50 border-rose-200'
              }`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200/60">
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                      activeCert.status === 'VALID' 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : activeCert.status === 'EXPIRING_SOON'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}>
                      <FileKey size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-slate-900 font-display">
                          {activeCert.subject_name}
                        </h3>
                        {activeCert.status === 'VALID' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 size={12} /> Certificado Válido
                          </span>
                        )}
                        {activeCert.status === 'EXPIRING_SOON' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 animate-pulse">
                            <AlertTriangle size={12} /> Expira em Breve ({Math.max(0, Math.floor(activeCert.days_remaining))} dias)
                          </span>
                        )}
                        {activeCert.status === 'EXPIRED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                            <ShieldAlert size={12} /> Certificado Expirado
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        Arquivo: <span className="font-semibold">{activeCert.filename}</span> · CNPJ: <span className="font-semibold">{CertificateService.formatCNPJ(activeCert.cnpj)}</span>
                      </p>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw size={14} className="text-slate-500" />
                      Substituir A1
                    </button>
                    <button
                      onClick={handleRevoke}
                      disabled={revoking}
                      className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg text-xs font-bold text-rose-700 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {revoking ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      Revogar
                    </button>
                  </div>
                </div>

                {/* Grade de Metadados ICP-Brasil */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-5">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Autoridade Emissora
                    </span>
                    <p className="text-xs font-bold text-slate-800 truncate" title={activeCert.issuer}>
                      {activeCert.issuer}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Número de Série
                    </span>
                    <p className="text-xs font-bold text-slate-800 font-mono truncate" title={activeCert.serial_number}>
                      {activeCert.serial_number}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Vigência Inicial
                    </span>
                    <p className="text-xs font-bold text-slate-800">
                      {formatDate(activeCert.valid_from)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Data de Expiração
                    </span>
                    <p className={`text-xs font-bold ${
                      activeCert.status === 'EXPIRED' ? 'text-rose-600' : 'text-slate-800'
                    }`}>
                      {formatDate(activeCert.valid_to)}
                    </p>
                  </div>
                </div>

                {/* Barra de Progresso de Dias Restantes */}
                <div className="mt-5 pt-4 border-t border-slate-200/60">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-600 mb-1.5">
                    <span>Validade do Certificado: <strong>{Math.max(0, Math.floor(activeCert.days_remaining))} dias restantes</strong></span>
                    <span>Expira em {formatDate(activeCert.valid_to)}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        activeCert.status === 'VALID' 
                          ? 'bg-emerald-500' 
                          : activeCert.status === 'EXPIRING_SOON'
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{
                        width: `${Math.max(0, Math.min(100, (activeCert.days_remaining / 365) * 100))}%`
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Informações Técnicas e de Conformidade */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
                <Info size={18} className="text-slate-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-600 space-y-1">
                  <span className="font-semibold text-slate-800">Assinatura de Eventos eSocial:</span>
                  <p>
                    Este certificado digital A1 é utilizado pelas Edge Functions do sistema para a assinatura 
                    de lotes XML (S-1200, S-1210, S-2200, S-2299) sob o protocolo TLS com validação de cadeia ICP-Brasil. 
                    Todas as transmissões e substituições de chave são registradas em trilha de auditoria forense T29.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Instalação/Upload */}
      <UploadCertificateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          loadData();
        }}
        defaultCnpj={companyInfo.cnpj}
        defaultCompanyName={companyInfo.name}
        environment={environment}
      />
    </div>
  );
}
