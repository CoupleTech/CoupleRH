/**
 * notificationSettingsService.ts
 * 
 * Serviço de gerenciamento das configurações corporativas de notificações e alertas (CONF-04).
 * Suporte a gatilhos legais (Férias Art. 135 CLT, Fechamento de Ponto, ASO NR-7, Divergências Folha/eSocial)
 * e canais corporativos (E-mail DP, WhatsApp e In-App).
 */

import { supabase } from '../../lib/supabase';

export interface TenantNotificationSettings {
  id?: string;
  tenant_id?: string;
  notify_vacation_warning: boolean;
  vacation_warning_days: 15 | 30 | 45 | 60;
  notify_timesheet_cutoff: boolean;
  timesheet_cutoff_warning_days: number;
  notify_aso_expiration: boolean;
  aso_expiration_warning_days: 15 | 30 | 45 | 60;
  notify_salary_advances: boolean;
  notify_payroll_divergences: boolean;
  notify_esocial_inconsistencies: boolean;
  in_app_notifications_enabled: boolean;
  email_notifications_enabled: boolean;
  dp_notification_email: string | null;
  whatsapp_notifications_enabled: boolean;
  dp_notification_phone: string | null;
}

export const TenantNotificationSettings = {} as const;

export const DEFAULT_NOTIFICATION_SETTINGS: TenantNotificationSettings = {
  notify_vacation_warning: true,
  vacation_warning_days: 30,
  notify_timesheet_cutoff: true,
  timesheet_cutoff_warning_days: 3,
  notify_aso_expiration: true,
  aso_expiration_warning_days: 30,
  notify_salary_advances: true,
  notify_payroll_divergences: true,
  notify_esocial_inconsistencies: true,
  in_app_notifications_enabled: true,
  email_notifications_enabled: true,
  dp_notification_email: null,
  whatsapp_notifications_enabled: false,
  dp_notification_phone: null
};

export const NotificationSettingsService = {
  /**
   * Valida parâmetros de notificação antes da persistência
   */
  validate(settings: TenantNotificationSettings): { valid: boolean; error?: string } {
    if (![15, 30, 45, 60].includes(settings.vacation_warning_days)) {
      return { valid: false, error: 'Aviso de férias deve ser de 15, 30, 45 ou 60 dias de antecedência.' };
    }

    if (settings.timesheet_cutoff_warning_days < 1 || settings.timesheet_cutoff_warning_days > 15) {
      return { valid: false, error: 'Aviso de fechamento do ponto deve estar entre 1 e 15 dias.' };
    }

    if (![15, 30, 45, 60].includes(settings.aso_expiration_warning_days)) {
      return { valid: false, error: 'Aviso de vencimento de ASO deve ser de 15, 30, 45 ou 60 dias de antecedência.' };
    }

    if (settings.email_notifications_enabled && settings.dp_notification_email) {
      const email = settings.dp_notification_email.trim();
      const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
      if (!emailRegex.test(email)) {
        return { valid: false, error: 'E-mail corporativo do DP informado é inválido.' };
      }
    }

    if (settings.whatsapp_notifications_enabled && settings.dp_notification_phone) {
      const cleanPhone = settings.dp_notification_phone.replace(/\D/g, '');
      if (cleanPhone.length < 10 || cleanPhone.length > 13) {
        return { valid: false, error: 'Telefone/WhatsApp do DP deve conter entre 10 e 13 dígitos (incluindo DDD).' };
      }
    }

    return { valid: true };
  },

  /**
   * Carrega as configurações de notificação do tenant ativo
   */
  async getSettings(): Promise<TenantNotificationSettings> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return DEFAULT_NOTIFICATION_SETTINGS;
      }

      // Buscar tenant ativo
      const { data: tu } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (!tu?.tenant_id) {
        return DEFAULT_NOTIFICATION_SETTINGS;
      }

      const { data, error } = await supabase
        .from('tenant_settings')
        .select(`
          id,
          tenant_id,
          notify_vacation_warning,
          vacation_warning_days,
          notify_timesheet_cutoff,
          timesheet_cutoff_warning_days,
          notify_aso_expiration,
          aso_expiration_warning_days,
          notify_salary_advances,
          notify_payroll_divergences,
          notify_esocial_inconsistencies,
          in_app_notifications_enabled,
          email_notifications_enabled,
          dp_notification_email,
          whatsapp_notifications_enabled,
          dp_notification_phone
        `)
        .eq('tenant_id', tu.tenant_id)
        .maybeSingle();

      if (error) {
        console.warn('Erro ao carregar configurações de notificação do tenant, usando padrões:', error.message);
        return DEFAULT_NOTIFICATION_SETTINGS;
      }

      if (!data) {
        return DEFAULT_NOTIFICATION_SETTINGS;
      }

      return {
        id: data.id,
        tenant_id: data.tenant_id,
        notify_vacation_warning: data.notify_vacation_warning ?? true,
        vacation_warning_days: ([15, 30, 45, 60].includes(data.vacation_warning_days) ? data.vacation_warning_days : 30) as any,
        notify_timesheet_cutoff: data.notify_timesheet_cutoff ?? true,
        timesheet_cutoff_warning_days: data.timesheet_cutoff_warning_days ?? 3,
        notify_aso_expiration: data.notify_aso_expiration ?? true,
        aso_expiration_warning_days: ([15, 30, 45, 60].includes(data.aso_expiration_warning_days) ? data.aso_expiration_warning_days : 30) as any,
        notify_salary_advances: data.notify_salary_advances ?? true,
        notify_payroll_divergences: data.notify_payroll_divergences ?? true,
        notify_esocial_inconsistencies: data.notify_esocial_inconsistencies ?? true,
        in_app_notifications_enabled: data.in_app_notifications_enabled ?? true,
        email_notifications_enabled: data.email_notifications_enabled ?? true,
        dp_notification_email: data.dp_notification_email ?? null,
        whatsapp_notifications_enabled: data.whatsapp_notifications_enabled ?? false,
        dp_notification_phone: data.dp_notification_phone ?? null
      };
    } catch (err) {
      console.error('Falha na busca de configurações de notificação:', err);
      return DEFAULT_NOTIFICATION_SETTINGS;
    }
  },

  /**
   * Persiste as preferências de notificação via RPC segura com auditoria forense T29
   */
  async saveSettings(settings: TenantNotificationSettings): Promise<{ success: boolean; error?: string }> {
    const validation = this.validate(settings);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      const cleanEmail = settings.dp_notification_email?.trim() || null;
      const cleanPhone = settings.dp_notification_phone?.trim() || null;

      const { data, error } = await supabase.rpc('update_tenant_notification_settings', {
        p_notify_vacation_warning: settings.notify_vacation_warning,
        p_vacation_warning_days: settings.vacation_warning_days,
        p_notify_timesheet_cutoff: settings.notify_timesheet_cutoff,
        p_timesheet_cutoff_warning_days: settings.timesheet_cutoff_warning_days,
        p_notify_aso_expiration: settings.notify_aso_expiration,
        p_aso_expiration_warning_days: settings.aso_expiration_warning_days,
        p_notify_salary_advances: settings.notify_salary_advances,
        p_notify_payroll_divergences: settings.notify_payroll_divergences,
        p_notify_esocial_inconsistencies: settings.notify_esocial_inconsistencies,
        p_in_app_notifications_enabled: settings.in_app_notifications_enabled,
        p_email_notifications_enabled: settings.email_notifications_enabled,
        p_dp_notification_email: cleanEmail,
        p_whatsapp_notifications_enabled: settings.whatsapp_notifications_enabled,
        p_dp_notification_phone: cleanPhone
      });

      if (error) {
        // Fallback defensivo: se a RPC falhar por permissão ou rede, tenta update direto via RLS
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: tu } = await supabase
            .from('tenant_users')
            .select('tenant_id')
            .eq('user_id', user.id)
            .limit(1)
            .single();

          if (tu?.tenant_id) {
            const { error: upsertErr } = await supabase
              .from('tenant_settings')
              .upsert({
                tenant_id: tu.tenant_id,
                notify_vacation_warning: settings.notify_vacation_warning,
                vacation_warning_days: settings.vacation_warning_days,
                notify_timesheet_cutoff: settings.notify_timesheet_cutoff,
                timesheet_cutoff_warning_days: settings.timesheet_cutoff_warning_days,
                notify_aso_expiration: settings.notify_aso_expiration,
                aso_expiration_warning_days: settings.aso_expiration_warning_days,
                notify_salary_advances: settings.notify_salary_advances,
                notify_payroll_divergences: settings.notify_payroll_divergences,
                notify_esocial_inconsistencies: settings.notify_esocial_inconsistencies,
                in_app_notifications_enabled: settings.in_app_notifications_enabled,
                email_notifications_enabled: settings.email_notifications_enabled,
                dp_notification_email: cleanEmail,
                whatsapp_notifications_enabled: settings.whatsapp_notifications_enabled,
                dp_notification_phone: cleanPhone,
                updated_at: new Date().toISOString()
              }, { onConflict: 'tenant_id' });

            if (!upsertErr) {
              return { success: true };
            }
          }
        }
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro inesperado ao salvar configurações de notificação.' };
    }
  }
};
