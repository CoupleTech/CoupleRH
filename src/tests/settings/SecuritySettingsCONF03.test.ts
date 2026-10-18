import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  SecuritySettingsService, 
  isMfaRequiredForRole, 
  getTimeoutLabel,
  DEFAULT_SECURITY_SETTINGS,
  type TenantSecuritySettings
} from '../../services/settings/securitySettingsService';
import { supabase } from '../../lib/supabase';

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
    auth: {
      mfa: {
        listFactors: vi.fn(),
        getAuthenticatorAssuranceLevel: vi.fn(),
        enroll: vi.fn(),
        challenge: vi.fn(),
        verify: vi.fn(),
        unenroll: vi.fn(),
      },
      signOut: vi.fn(),
    }
  }
}));

describe('CONF-03: Governança de Segurança Corporativa, MFA (TOTP) e Timeout de Sessão', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Regras de Exigência de MFA e Rótulos (Helpers)', () => {
    it('deve identificar corretamente papéis que exigem MFA obrigatório', () => {
      expect(isMfaRequiredForRole('system_admin')).toBe(true);
      expect(isMfaRequiredForRole('tenant_admin')).toBe(true);
      expect(isMfaRequiredForRole('dp_analyst')).toBe(true);
      expect(isMfaRequiredForRole('employee')).toBe(false);
      expect(isMfaRequiredForRole(null)).toBe(false);
      expect(isMfaRequiredForRole(undefined)).toBe(false);
    });

    it('deve respeitar lista personalizada de papéis obrigatórios', () => {
      const customRequired = ['manager', 'accountant'];
      expect(isMfaRequiredForRole('manager', customRequired)).toBe(true);
      expect(isMfaRequiredForRole('dp_analyst', customRequired)).toBe(false);
    });

    it('deve formatar rótulos amigáveis de timeout de sessão', () => {
      expect(getTimeoutLabel(15)).toContain('15 minutos');
      expect(getTimeoutLabel(60)).toContain('1 hora');
      expect(getTimeoutLabel(480)).toContain('8 horas');
      expect(getTimeoutLabel(90)).toBe('90 minutos');
    });
  });

  describe('2. Leitura e Persistência de Parâmetros de Segurança', () => {
    it('deve carregar parâmetros do tenant_settings quando disponíveis', async () => {
      const mockSettings = {
        session_timeout_minutes: 30,
        require_mfa_roles: ['system_admin', 'manager'],
        max_login_attempts: 3,
      };

      (supabase.from as any).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: mockSettings, error: null }),
          }),
        }),
      });

      const result = await SecuritySettingsService.fetchSecuritySettings();

      expect(result).toEqual({
        session_timeout_minutes: 30,
        require_mfa_roles: ['system_admin', 'manager'],
        max_login_attempts: 3,
      });
    });

    it('deve adotar padrões seguros em caso de falha ou ausência de registro', async () => {
      (supabase.from as any).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'Erro conexão' } }),
          }),
        }),
      });

      const result = await SecuritySettingsService.fetchSecuritySettings();

      expect(result).toEqual(DEFAULT_SECURITY_SETTINGS);
    });

    it('deve atualizar políticas de segurança via RPC update_tenant_security_settings', async () => {
      (supabase.rpc as any).mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      const newSettings: TenantSecuritySettings = {
        session_timeout_minutes: 120,
        require_mfa_roles: ['system_admin', 'dp_analyst', 'accountant'],
        max_login_attempts: 4,
      };

      await SecuritySettingsService.updateSecuritySettings(newSettings);

      expect(supabase.rpc).toHaveBeenCalledWith('update_tenant_security_settings', {
        p_session_timeout: 120,
        p_require_mfa_roles: ['system_admin', 'dp_analyst', 'accountant'],
        p_max_login_attempts: 4,
      });
    });
  });

  describe('3. Ciclo de Vida de Autenticação Multifator (MFA TOTP)', () => {
    it('deve listar fatores MFA e identificar status ativo (AAL2)', async () => {
      (supabase.auth.mfa.listFactors as any).mockResolvedValueOnce({
        data: {
          totp: [
            {
              id: 'factor-101',
              status: 'verified',
              friendly_name: 'Meu Celular',
              factor_type: 'totp',
              created_at: '2026-10-17T12:00:00Z',
            }
          ]
        },
        error: null,
      });

      (supabase.auth.mfa.getAuthenticatorAssuranceLevel as any).mockResolvedValueOnce({
        data: {
          currentLevel: 'aal2',
          nextLevel: 'aal2',
        },
        error: null,
      });

      const result = await SecuritySettingsService.listUserMfaFactors();

      expect(result.hasActiveMfa).toBe(true);
      expect(result.assuranceLevel).toBe('aal2');
      expect(result.factors).toHaveLength(1);
      expect(result.factors[0].status).toBe('verified');
    });

    it('deve iniciar enrollment de TOTP gerando QR code e segredo', async () => {
      (supabase.auth.mfa.enroll as any).mockResolvedValueOnce({
        data: {
          id: 'factor-new-1',
          totp: {
            qr_code: '<svg>qr</svg>',
            secret: 'JBSWY3DPEHPK3PXP',
            uri: 'otpauth://totp/CoupleRH?secret=JBSWY3DPEHPK3PXP',
          }
        },
        error: null,
      });

      const result = await SecuritySettingsService.enrollTotp('Autenticador Teste');

      expect(supabase.auth.mfa.enroll).toHaveBeenCalledWith({
        factorType: 'totp',
        friendlyName: 'Autenticador Teste',
      });
      expect(result.factorId).toBe('factor-new-1');
      expect(result.secret).toBe('JBSWY3DPEHPK3PXP');
      expect(result.qrCode).toBe('<svg>qr</svg>');
    });

    it('deve rejeitar código de validação que não contenha exatamente 6 dígitos', async () => {
      await expect(
        SecuritySettingsService.verifyTotpCode('factor-1', '123')
      ).rejects.toThrow('O código de autenticação deve conter exatamente 6 dígitos');

      await expect(
        SecuritySettingsService.verifyTotpCode('factor-1', 'abc123')
      ).rejects.toThrow('O código de autenticação deve conter exatamente 6 dígitos');
    });

    it('deve validar desafio TOTP com código de 6 dígitos formatado', async () => {
      (supabase.auth.mfa.challenge as any).mockResolvedValueOnce({
        data: { id: 'challenge-99' },
        error: null,
      });

      (supabase.auth.mfa.verify as any).mockResolvedValueOnce({
        data: { access_token: 'valid_jwt' },
        error: null,
      });

      await SecuritySettingsService.verifyTotpCode('factor-1', '123 456');

      expect(supabase.auth.mfa.challenge).toHaveBeenCalledWith({ factorId: 'factor-1' });
      expect(supabase.auth.mfa.verify).toHaveBeenCalledWith({
        factorId: 'factor-1',
        challengeId: 'challenge-99',
        code: '123456',
      });
    });

    it('deve desvincular fator MFA (unenroll)', async () => {
      (supabase.auth.mfa.unenroll as any).mockResolvedValueOnce({
        data: { id: 'factor-1' },
        error: null,
      });

      await SecuritySettingsService.unenrollTotp('factor-1');

      expect(supabase.auth.mfa.unenroll).toHaveBeenCalledWith({ factorId: 'factor-1' });
    });
  });
});
