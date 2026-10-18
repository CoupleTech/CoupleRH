import { supabase } from "../../lib/supabase";

export interface TenantGeneralSettings {
  id?: string;
  tenant_id: string;
  timezone: string;
  timesheet_cutoff_day: number;
  esocial_environment: 'producao' | 'restrita';
  created_at?: string;
  updated_at?: string;
}

export const SUPPORTED_TIMEZONES = [
  { value: 'America/Sao_Paulo', label: 'Horário de Brasília (America/Sao_Paulo)' },
  { value: 'America/Manaus', label: 'Amazonas (America/Manaus)' },
  { value: 'America/Cuiaba', label: 'Mato Grosso / Cuiabá (America/Cuiaba)' },
  { value: 'America/Belem', label: 'Pará / Belém (America/Belem)' },
  { value: 'America/Fortaleza', label: 'Nordeste / Fortaleza (America/Fortaleza)' },
  { value: 'America/Recife', label: 'Pernambuco / Recife (America/Recife)' },
  { value: 'America/Boa_Vista', label: 'Roraima / Boa Vista (America/Boa_Vista)' },
  { value: 'America/Porto_Velho', label: 'Rondônia / Porto Velho (America/Porto_Velho)' },
  { value: 'America/Rio_Branco', label: 'Acre / Rio Branco (America/Rio_Branco)' }
];

export class TenantSettingsService {
  /**
   * Valida as configurações gerais do tenant antes de enviar ao banco de dados.
   */
  static validateSettings(settings: Partial<TenantGeneralSettings>): { valid: boolean; error?: string } {
    if (!settings.timezone || typeof settings.timezone !== 'string' || settings.timezone.trim() === '') {
      return { valid: false, error: 'O fuso horário padrão é obrigatório.' };
    }

    if (
      settings.timesheet_cutoff_day === undefined ||
      settings.timesheet_cutoff_day === null ||
      !Number.isInteger(Number(settings.timesheet_cutoff_day)) ||
      Number(settings.timesheet_cutoff_day) < 1 ||
      Number(settings.timesheet_cutoff_day) > 31
    ) {
      return { valid: false, error: 'O dia de fechamento do ponto deve ser um número inteiro entre 1 e 31.' };
    }

    if (settings.esocial_environment !== 'producao' && settings.esocial_environment !== 'restrita') {
      return { valid: false, error: 'O ambiente do eSocial deve ser "producao" ou "restrita".' };
    }

    return { valid: true };
  }

  /**
   * Obtém as configurações gerais do tenant atual. Se não existir, retorna os padrões de fábrica.
   */
  static async fetchSettings(tenantId: string): Promise<TenantGeneralSettings> {
    if (!tenantId) {
      throw new Error('Tenant ID é obrigatório para consultar as configurações.');
    }

    const { data, error } = await supabase
      .from('tenant_settings')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      throw new Error(`Erro ao buscar configurações do tenant: ${error.message}`);
    }

    if (data) {
      return {
        id: data.id,
        tenant_id: data.tenant_id,
        timezone: data.timezone || 'America/Sao_Paulo',
        timesheet_cutoff_day: data.timesheet_cutoff_day ?? 25,
        esocial_environment: data.esocial_environment || 'producao',
        created_at: data.created_at,
        updated_at: data.updated_at
      };
    }

    // Default fallback
    return {
      tenant_id: tenantId,
      timezone: 'America/Sao_Paulo',
      timesheet_cutoff_day: 25,
      esocial_environment: 'producao'
    };
  }

  /**
   * Salva ou atualiza as configurações gerais do tenant no Supabase (upsert com auditoria).
   */
  static async saveSettings(
    tenantId: string,
    params: {
      timezone: string;
      timesheet_cutoff_day: number;
      esocial_environment: 'producao' | 'restrita';
    }
  ): Promise<TenantGeneralSettings> {
    if (!tenantId) {
      throw new Error('Tenant ID é obrigatório para salvar as configurações.');
    }

    const validation = this.validateSettings(params);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const payload = {
      tenant_id: tenantId,
      timezone: params.timezone,
      timesheet_cutoff_day: Number(params.timesheet_cutoff_day),
      esocial_environment: params.esocial_environment,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('tenant_settings')
      .upsert(payload, { onConflict: 'tenant_id' })
      .select()
      .single();

    if (error) {
      throw new Error(`Falha ao persistir configurações do tenant: ${error.message}`);
    }

    return data;
  }
}
