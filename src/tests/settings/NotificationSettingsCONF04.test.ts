import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  NotificationSettingsService, 
  DEFAULT_NOTIFICATION_SETTINGS, 
  type TenantNotificationSettings 
} from '../../services/settings/notificationSettingsService';
import { supabase } from '../../lib/supabase';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn()
    },
    from: vi.fn(),
    rpc: vi.fn()
  }
}));

describe('CONF-04: NotificationSettingsService (Notificações e Alertas Corporativos)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Validações de Domínio e Prazos CLT / SST (validate)', () => {
    it('deve aceitar parâmetros de notificação válidos com os padrões', () => {
      const res = NotificationSettingsService.validate(DEFAULT_NOTIFICATION_SETTINGS);
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('deve aceitar configurações completas com e-mail corporativo e WhatsApp válidos', () => {
      const settings: TenantNotificationSettings = {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        vacation_warning_days: 45,
        timesheet_cutoff_warning_days: 5,
        aso_expiration_warning_days: 60,
        email_notifications_enabled: true,
        dp_notification_email: 'dp.folha@empresa.com.br',
        whatsapp_notifications_enabled: true,
        dp_notification_phone: '11987654321'
      };

      const res = NotificationSettingsService.validate(settings);
      expect(res.valid).toBe(true);
    });

    it('deve rejeitar dias de aviso de férias inválidos (fora de 15, 30, 45, 60)', () => {
      const settings: TenantNotificationSettings = {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        vacation_warning_days: 20 as any
      };

      const res = NotificationSettingsService.validate(settings);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('15, 30, 45 ou 60 dias');
    });

    it('deve rejeitar antecedência de corte de ponto menor que 1 ou maior que 15', () => {
      const resMin = NotificationSettingsService.validate({
        ...DEFAULT_NOTIFICATION_SETTINGS,
        timesheet_cutoff_warning_days: 0
      });
      expect(resMin.valid).toBe(false);
      expect(resMin.error).toContain('entre 1 e 15 dias');

      const resMax = NotificationSettingsService.validate({
        ...DEFAULT_NOTIFICATION_SETTINGS,
        timesheet_cutoff_warning_days: 16
      });
      expect(resMax.valid).toBe(false);
      expect(resMax.error).toContain('entre 1 e 15 dias');
    });

    it('deve rejeitar antecedência de vencimento de ASO inválida', () => {
      const settings: TenantNotificationSettings = {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        aso_expiration_warning_days: 10 as any
      };

      const res = NotificationSettingsService.validate(settings);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Aviso de vencimento de ASO deve ser de 15, 30, 45 ou 60 dias');
    });

    it('deve rejeitar e-mail corporativo inválido quando informado', () => {
      const settings: TenantNotificationSettings = {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        email_notifications_enabled: true,
        dp_notification_email: 'email-invalido-sem-arroba'
      };

      const res = NotificationSettingsService.validate(settings);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('E-mail corporativo do DP informado é inválido');
    });

    it('deve rejeitar telefone corporativo com menos de 10 ou mais de 13 dígitos numéricos', () => {
      const settingsCurto: TenantNotificationSettings = {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        whatsapp_notifications_enabled: true,
        dp_notification_phone: '12345678' // 8 dígitos
      };

      const resCurto = NotificationSettingsService.validate(settingsCurto);
      expect(resCurto.valid).toBe(false);
      expect(resCurto.error).toContain('entre 10 e 13 dígitos');

      const settingsLongo: TenantNotificationSettings = {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        whatsapp_notifications_enabled: true,
        dp_notification_phone: '55119999988887777' // 17 dígitos
      };

      const resLongo = NotificationSettingsService.validate(settingsLongo);
      expect(resLongo.valid).toBe(false);
    });
  });

  describe('Carregamento de Preferências (getSettings)', () => {
    it('deve retornar configurações padrão quando o usuário não estiver autenticado', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
        data: { user: null },
        error: null
      } as any);

      const settings = await NotificationSettingsService.getSettings();
      expect(settings).toEqual(DEFAULT_NOTIFICATION_SETTINGS);
    });

    it('deve retornar as preferências salvas no banco para o tenant ativo', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
        data: { user: { id: 'usr-123' } },
        error: null
      } as any);

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'tenant_users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { tenant_id: 'tenant-abc' },
              error: null
            })
          };
        }

        if (table === 'tenant_settings') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: 'set-001',
                tenant_id: 'tenant-abc',
                notify_vacation_warning: true,
                vacation_warning_days: 45,
                notify_timesheet_cutoff: true,
                timesheet_cutoff_warning_days: 5,
                notify_aso_expiration: true,
                aso_expiration_warning_days: 60,
                notify_salary_advances: true,
                notify_payroll_divergences: true,
                notify_esocial_inconsistencies: true,
                in_app_notifications_enabled: true,
                email_notifications_enabled: true,
                dp_notification_email: 'dp@empresa.com.br',
                whatsapp_notifications_enabled: true,
                dp_notification_phone: '11999998888'
              },
              error: null
            })
          };
        }

        return {};
      });

      vi.mocked(supabase.from).mockImplementation(mockFrom as any);

      const settings = await NotificationSettingsService.getSettings();
      expect(settings.vacation_warning_days).toBe(45);
      expect(settings.timesheet_cutoff_warning_days).toBe(5);
      expect(settings.aso_expiration_warning_days).toBe(60);
      expect(settings.dp_notification_email).toBe('dp@empresa.com.br');
      expect(settings.whatsapp_notifications_enabled).toBe(true);
    });
  });

  describe('Salvamento e Persistência Segura (saveSettings)', () => {
    it('deve abortar e retornar erro se o payload for inválido antes de chamar RPC', async () => {
      const rpcSpy = vi.mocked(supabase.rpc);

      const invalidSettings: TenantNotificationSettings = {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        timesheet_cutoff_warning_days: 99
      };

      const result = await NotificationSettingsService.saveSettings(invalidSettings);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(rpcSpy).not.toHaveBeenCalled();
    });

    it('deve chamar a RPC update_tenant_notification_settings com sucesso', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: { success: true },
        error: null
      } as any);

      const settings: TenantNotificationSettings = {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        vacation_warning_days: 30,
        timesheet_cutoff_warning_days: 3,
        dp_notification_email: 'rh@empresa.com'
      };

      const result = await NotificationSettingsService.saveSettings(settings);
      expect(result.success).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('update_tenant_notification_settings', expect.objectContaining({
        p_vacation_warning_days: 30,
        p_timesheet_cutoff_warning_days: 3,
        p_dp_notification_email: 'rh@empresa.com'
      }));
    });

    it('deve tratar falha na RPC e retornar mensagem de erro amigável', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: { message: 'Acesso negado: apenas administradores.' }
      } as any);

      vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
        data: { user: null },
        error: null
      } as any);

      const result = await NotificationSettingsService.saveSettings(DEFAULT_NOTIFICATION_SETTINGS);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Acesso negado');
    });
  });
});
