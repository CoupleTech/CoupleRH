import { useState, useEffect } from "react";
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  Lock, 
  Smartphone, 
  Clock, 
  Key, 
  Check, 
  Copy, 
  X, 
  AlertTriangle, 
  LogOut, 
  Laptop, 
  Loader2 
} from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "../../../components/ConfirmDialogProvider";
import { 
  SecuritySettingsService, 
  TIMEOUT_OPTIONS, 
  type TenantSecuritySettings, 
  type MfaFactor, 
  type TotpEnrollmentData 
} from "../../../services/settings/securitySettingsService";
import type { UserRole } from "../../../services/security/rbacService";

const AVAILABLE_ROLES: { role: UserRole; name: string }[] = [
  { role: 'system_admin', name: 'Administrador Global' },
  { role: 'tenant_admin', name: 'Administrador do Tenant' },
  { role: 'dp_analyst', name: 'Analista de DP' },
  { role: 'manager', name: 'Gestor de Equipe' },
  { role: 'accountant', name: 'Contador / Fiscal' },
  { role: 'auditor', name: 'Auditor de Conformidade' },
  { role: 'sst_specialist', name: 'Especialista SST' },
  { role: 'employee', name: 'Colaborador' },
];

export default function SecurityAndMfaTab() {
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Tenant Security Settings State
  const [sessionTimeout, setSessionTimeout] = useState<number>(60);
  const [requiredMfaRoles, setRequiredMfaRoles] = useState<UserRole[]>(['system_admin', 'tenant_admin', 'dp_analyst']);
  const [maxLoginAttempts, setMaxLoginAttempts] = useState<number>(5);

  // User MFA State
  const [hasActiveMfa, setHasActiveMfa] = useState(false);
  const [factors, setFactors] = useState<MfaFactor[]>([]);
  const [assuranceLevel, setAssuranceLevel] = useState<'aal1' | 'aal2'>('aal1');

  // MFA Enrollment Modal State
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [enrollData, setEnrollData] = useState<TotpEnrollmentData | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [settings, mfaStatus] = await Promise.all([
        SecuritySettingsService.fetchSecuritySettings(),
        SecuritySettingsService.listUserMfaFactors(),
      ]);

      setSessionTimeout(settings.session_timeout_minutes);
      setRequiredMfaRoles(settings.require_mfa_roles);
      setMaxLoginAttempts(settings.max_login_attempts);

      setHasActiveMfa(mfaStatus.hasActiveMfa);
      setFactors(mfaStatus.factors);
      setAssuranceLevel(mfaStatus.assuranceLevel);
    } catch (err) {
      console.error("Erro ao carregar governança de segurança:", err);
      toast.error("Falha ao carregar parâmetros de segurança.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true);
      await SecuritySettingsService.updateSecuritySettings({
        session_timeout_minutes: sessionTimeout,
        require_mfa_roles: requiredMfaRoles,
        max_login_attempts: maxLoginAttempts,
      });

      toast.success("Políticas corporativas de segurança salvas com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar políticas de segurança.");
    } finally {
      setSavingSettings(false);
    }
  };

  const toggleRoleRequirement = (role: UserRole) => {
    if (requiredMfaRoles.includes(role)) {
      setRequiredMfaRoles(requiredMfaRoles.filter(r => r !== role));
    } else {
      setRequiredMfaRoles([...requiredMfaRoles, role]);
    }
  };

  const handleStartEnrollment = async () => {
    try {
      setEnrolling(true);
      const data = await SecuritySettingsService.enrollTotp('CoupleRH - Dispositivo Principal');
      setEnrollData(data);
      setVerificationCode("");
      setCopiedSecret(false);
      setIsEnrollModalOpen(true);
    } catch (err: any) {
      toast.error(err.message || "Falha ao gerar credencial MFA.");
    } finally {
      setEnrolling(false);
    }
  };

  const handleVerifyEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollData || !verificationCode.trim()) return;

    try {
      setVerifying(true);
      await SecuritySettingsService.verifyTotpCode(enrollData.factorId, verificationCode);
      toast.success("Autenticação em Duas Etapas (TOTP) ativada com sucesso!");
      setIsEnrollModalOpen(false);
      setEnrollData(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Código inválido. Tente novamente.");
    } finally {
      setVerifying(false);
    }
  };

  const handleUnenrollFactor = async (factorId: string) => {
    if (await confirmDialog("Tem certeza que deseja desativar o aplicativo autenticador? Sua conta perderá a proteção de segundo fator.")) {
      try {
        await SecuritySettingsService.unenrollTotp(factorId);
        toast.success("Fator MFA removido com sucesso.");
        await loadData();
      } catch (err: any) {
        toast.error(err.message || "Erro ao desvincular MFA.");
      }
    }
  };

  const handleCopySecret = () => {
    if (enrollData?.secret) {
      navigator.clipboard.writeText(enrollData.secret);
      setCopiedSecret(true);
      toast.success("Chave secreta copiada!");
      setTimeout(() => setCopiedSecret(false), 3000);
    }
  };

  if (loading) {
    return (
      <div className="card p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 size={32} className="animate-spin text-blue-600" />
        <p className="text-sm font-medium text-slate-600">Carregando governança de segurança e MFA...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      {/* 1. Header do Painel */}
      <div className="card overflow-hidden">
        <div className="p-6 bg-slate-50/50 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Shield size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-display">
                Segurança, MFA e Políticas de Acesso
              </h2>
              <p className="text-sm text-slate-500">
                Autenticação multifator (TOTP), proteção contra acessos indevidos e limites de inatividade.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* 2. Seção de Autenticação em Duas Etapas (MFA) */}
          <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  hasActiveMfa ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                }`}>
                  {hasActiveMfa ? <ShieldCheck size={22} /> : <ShieldAlert size={22} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-800">
                      Autenticação em Duas Etapas (MFA / TOTP)
                    </h3>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                      hasActiveMfa ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {hasActiveMfa ? 'Ativado (AAL2)' : 'Não Configurado (AAL1)'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Proteja sua conta exigindo um código de 6 dígitos gerado no celular (Google Authenticator, 1Password, Authy) além da sua senha.
                  </p>
                </div>
              </div>

              <div>
                {!hasActiveMfa ? (
                  <button
                    onClick={handleStartEnrollment}
                    disabled={enrolling}
                    className="btn-primary py-2 px-4 shadow-sm text-xs font-bold flex items-center gap-2 whitespace-nowrap"
                  >
                    {enrolling ? <Loader2 size={14} className="animate-spin" /> : <Smartphone size={14} />}
                    <span>Configurar Autenticador</span>
                  </button>
                ) : (
                  <button
                    onClick={() => factors[0] && handleUnenrollFactor(factors[0].id)}
                    className="px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-200"
                  >
                    Desativar MFA
                  </button>
                )}
              </div>
            </div>

            {hasActiveMfa && factors.length > 0 && (
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 bg-slate-50/60 p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <Smartphone size={14} className="text-slate-400" />
                  <span><strong>Dispositivo:</strong> {factors[0].friendly_name || 'Autenticador Padrão'}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500">Cadastrado em {new Date(factors[0].created_at).toLocaleDateString('pt-BR')}</span>
                </div>
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <Check size={14} /> Ativo e Verificado
                </span>
              </div>
            )}
          </div>

          {/* 3. Políticas Corporativas do Tenant */}
          <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Lock size={16} className="text-blue-600" />
                Políticas Corporativas de Segurança (Tenant)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Defina as regras de controle de acesso obrigatórias para todos os usuários desta organização.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Timeout de Sessão */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Clock size={14} className="text-slate-400" />
                  Tempo Limite de Inatividade da Sessão
                </label>
                <select
                  value={sessionTimeout}
                  onChange={e => setSessionTimeout(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                >
                  {TIMEOUT_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Após esse período sem interação, a sessão do usuário é encerrada automaticamente.
                </p>
              </div>

              {/* Tentativas de Login */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-slate-400" />
                  Limite de Tentativas Consecutivas de Login
                </label>
                <input
                  type="number"
                  min="3"
                  max="10"
                  value={maxLoginAttempts}
                  onChange={e => setMaxLoginAttempts(Math.max(3, Math.min(10, parseInt(e.target.value, 10) || 5)))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Bloqueio preventivo temporário caso ocorram erros seguidos de senha (3 a 10).
                </p>
              </div>
            </div>

            {/* Exigência Obrigatória de MFA por Papel */}
            <div className="pt-4 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Exigência Obrigatória de MFA por Papel (RBAC P8)
              </label>
              <p className="text-xs text-slate-500 mb-3">
                Usuários com os papéis marcados abaixo serão obrigados a configurar autenticação em duas etapas para operar:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                {AVAILABLE_ROLES.map(({ role, name }) => {
                  const isChecked = requiredMfaRoles.includes(role);
                  return (
                    <label
                      key={role}
                      onClick={() => toggleRoleRequirement(role)}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                        isChecked 
                          ? 'bg-blue-50/50 border-blue-300 text-blue-900 font-bold' 
                          : 'bg-slate-50/50 border-slate-200 text-slate-600 hover:bg-slate-100/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                      />
                      <span className="text-xs">{name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Botão de Salvar Políticas */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="btn-primary py-2 px-5 text-sm font-bold shadow-sm flex items-center gap-2"
              >
                {savingSettings ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Salvando Políticas...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Salvar Políticas de Segurança</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 4. Detalhes da Sessão Atual */}
          <div className="border border-slate-200 rounded-xl p-5 bg-white space-y-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Laptop size={16} className="text-slate-600" />
              Sessão Atual
            </h3>

            <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between text-xs text-slate-600">
              <div className="space-y-1">
                <p>
                  <strong>Nível de Autenticação:</strong>{' '}
                  <span className="font-semibold text-slate-800">{assuranceLevel === 'aal2' ? 'Segundo Fator Validado (AAL2)' : 'Senha Padrão (AAL1)'}</span>
                </p>
                <p className="text-slate-400">
                  Dispositivo Local · Navegador Ativo
                </p>
              </div>

              <button
                onClick={async () => {
                  if (await confirmDialog("Deseja realmente encerrar a sessão deste navegador?")) {
                    await SecuritySettingsService.signOut();
                    window.location.href = '/login';
                  }
                }}
                className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <LogOut size={13} />
                <span>Encerrar Sessão</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Configuração TOTP (Enrollment) */}
      {isEnrollModalOpen && enrollData && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Smartphone size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800 font-display">Configurar Autenticador</h2>
                  <p className="text-xs text-slate-500">Google Authenticator, Authy ou 1Password</p>
                </div>
              </div>
              <button
                onClick={() => { setIsEnrollModalOpen(false); setEnrollData(null); }}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleVerifyEnrollment} className="p-6 space-y-4">
              <div className="text-xs text-slate-600 space-y-1">
                <p><strong>1. Escaneie o QR Code abaixo</strong> com o aplicativo autenticador do seu celular:</p>
              </div>

              {/* Renderização do QR Code SVG */}
              <div className="flex justify-center p-4 bg-slate-50 border border-slate-200 rounded-xl">
                {enrollData.qrCode.startsWith('<svg') ? (
                  <div 
                    dangerouslySetInnerHTML={{ __html: enrollData.qrCode }} 
                    className="w-48 h-48 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                  />
                ) : (
                  <img src={enrollData.qrCode} alt="MFA QR Code" className="w-48 h-48 object-contain" />
                )}
              </div>

              {/* Chave Manual para quem não consegue ler o QR Code */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Ou digite a chave manualmente:</label>
                <div className="flex items-center gap-2 p-2 bg-slate-100 rounded-lg text-xs font-mono text-slate-800 justify-between">
                  <span className="truncate">{enrollData.secret}</span>
                  <button
                    type="button"
                    onClick={handleCopySecret}
                    className="text-blue-600 hover:text-blue-800 p-1 shrink-0"
                    title="Copiar Chave Secreta"
                  >
                    {copiedSecret ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* Input do Código de 6 Dígitos */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  2. Digite o código de 6 dígitos gerado no app:
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={verificationCode}
                  onChange={e => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full text-center tracking-[0.3em] font-mono text-xl py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold"
                  autoFocus
                  required
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => { setIsEnrollModalOpen(false); setEnrollData(null); }}
                  disabled={verifying}
                  className="flex-1 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={verifying || verificationCode.length !== 6}
                  className="flex-1 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {verifying ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  <span>Validar e Ativar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
