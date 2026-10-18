import { supabase } from "../../lib/supabase";
import type { UserRole } from "../security/rbacService";

export interface TenantSecuritySettings {
  session_timeout_minutes: number;
  require_mfa_roles: UserRole[];
  max_login_attempts: number;
}

export const TenantSecuritySettings = {} as const;

export interface MfaFactor {
  id: string;
  status: 'verified' | 'unverified';
  friendly_name?: string;
  factor_type: 'totp';
  created_at: string;
}

export const MfaFactor = {} as const;

export interface TotpEnrollmentData {
  factorId: string;
  qrCode: string; // SVG or data URL
  secret: string;
  uri: string;
}

export const TotpEnrollmentData = {} as const;

export const TIMEOUT_OPTIONS = [
  { value: 15, label: "15 minutos (Alta Segurança)" },
  { value: 30, label: "30 minutos" },
  { value: 60, label: "1 hora (Padrão Corporativo)" },
  { value: 120, label: "2 horas" },
  { value: 240, label: "4 horas" },
  { value: 480, label: "8 horas (Turno Completo)" },
] as const;

export const DEFAULT_SECURITY_SETTINGS: TenantSecuritySettings = {
  session_timeout_minutes: 60,
  require_mfa_roles: ['system_admin', 'tenant_admin', 'dp_analyst'],
  max_login_attempts: 5,
};

/**
 * Verifica se um determinado papel exige autenticação em dois fatores
 */
export function isMfaRequiredForRole(
  role: UserRole | string | null | undefined, 
  requiredRoles: (UserRole | string)[] = DEFAULT_SECURITY_SETTINGS.require_mfa_roles
): boolean {
  if (!role) return false;
  return requiredRoles.includes(role);
}

/**
 * Retorna o rótulo amigável para o timeout de sessão
 */
export function getTimeoutLabel(minutes: number): string {
  const match = TIMEOUT_OPTIONS.find(o => o.value === minutes);
  return match ? match.label : `${minutes} minutos`;
}

export const SecuritySettingsService = {
  /**
   * Obtém as configurações corporativas de segurança e MFA do tenant
   */
  async fetchSecuritySettings(): Promise<TenantSecuritySettings> {
    try {
      const { data, error } = await supabase
        .from('tenant_settings')
        .select('session_timeout_minutes, require_mfa_roles, max_login_attempts')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn("Erro ao buscar tenant_settings de segurança, usando padrões:", error);
        return { ...DEFAULT_SECURITY_SETTINGS };
      }

      if (!data) {
        return { ...DEFAULT_SECURITY_SETTINGS };
      }

      return {
        session_timeout_minutes: data.session_timeout_minutes || 60,
        require_mfa_roles: (data.require_mfa_roles as UserRole[]) || DEFAULT_SECURITY_SETTINGS.require_mfa_roles,
        max_login_attempts: data.max_login_attempts || 5,
      };
    } catch (err) {
      console.error("Falha ao obter parâmetros de segurança:", err);
      return { ...DEFAULT_SECURITY_SETTINGS };
    }
  },

  /**
   * Atualiza as políticas corporativas de segurança no Supabase
   */
  async updateSecuritySettings(settings: TenantSecuritySettings): Promise<void> {
    try {
      // 1. Tentar via RPC dedicada
      const { error: rpcError } = await supabase.rpc('update_tenant_security_settings', {
        p_session_timeout: settings.session_timeout_minutes,
        p_require_mfa_roles: settings.require_mfa_roles,
        p_max_login_attempts: settings.max_login_attempts,
      });

      if (!rpcError) return;

      // 2. Fallback de update direto
      const { data: tenantUsers } = await supabase.from('tenant_users').select('tenant_id').limit(1);
      const tenantId = tenantUsers?.[0]?.tenant_id;
      if (!tenantId) throw new Error("Tenant não localizado para o usuário.");

      const { error: updateError } = await supabase
        .from('tenant_settings')
        .upsert({
          tenant_id: tenantId,
          session_timeout_minutes: settings.session_timeout_minutes,
          require_mfa_roles: settings.require_mfa_roles,
          max_login_attempts: settings.max_login_attempts,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'tenant_id' });

      if (updateError) throw updateError;
    } catch (err) {
      console.error("Erro ao salvar políticas de segurança:", err);
      throw err;
    }
  },

  /**
   * Lista os fatores de autenticação MFA (TOTP) registrados para o usuário atual
   */
  async listUserMfaFactors(): Promise<{
    hasActiveMfa: boolean;
    factors: MfaFactor[];
    assuranceLevel: 'aal1' | 'aal2';
  }> {
    try {
      const [factorsRes, aalRes] = await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);

      if (factorsRes.error) throw factorsRes.error;

      const totpFactors = (factorsRes.data?.totp || []) as MfaFactor[];
      const hasActiveMfa = totpFactors.some(f => f.status === 'verified');
      const assuranceLevel = (aalRes.data?.currentLevel || 'aal1') as 'aal1' | 'aal2';

      return {
        hasActiveMfa,
        factors: totpFactors,
        assuranceLevel,
      };
    } catch (err) {
      console.error("Erro ao listar fatores MFA:", err);
      return {
        hasActiveMfa: false,
        factors: [],
        assuranceLevel: 'aal1',
      };
    }
  },

  /**
   * Inicia o cadastro de um novo aplicativo autenticador TOTP (Google Authenticator, Authy, etc)
   */
  async enrollTotp(friendlyName = 'CoupleRH Authenticator'): Promise<TotpEnrollmentData> {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName,
    });

    if (error) throw error;
    if (!data || !data.totp) throw new Error("Falha ao gerar credencial TOTP.");

    return {
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    };
  },

  /**
   * Desafia e valida o código de 6 dígitos gerado pelo aplicativo autenticador para ativar o MFA
   */
  async verifyTotpCode(factorId: string, code: string): Promise<void> {
    const cleanCode = code.replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleanCode)) {
      throw new Error("O código de autenticação deve conter exatamente 6 dígitos numéricos.");
    }

    // 1. Criar o desafio
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });
    if (challengeError) throw challengeError;

    // 2. Verificar o desafio com o código informado
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code: cleanCode,
    });

    if (verifyError) throw verifyError;
  },

  /**
   * Remove e desvincula um fator MFA registrado
   */
  async unenrollTotp(factorId: string): Promise<void> {
    const { error } = await supabase.auth.mfa.unenroll({
      factorId,
    });

    if (error) throw error;
  },

  /**
   * Encerra a sessão atual do usuário
   */
  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }
};
