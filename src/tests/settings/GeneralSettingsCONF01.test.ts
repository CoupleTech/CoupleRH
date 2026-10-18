import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenantSettingsService, SUPPORTED_TIMEZONES } from '../../services/settings/tenantSettingsService';
import { supabase } from '../../lib/supabase';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn()
  }
}));

describe('CONF-01: TenantSettingsService (Configurações Gerais do Tenant)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Validações de Domínio (validateSettings)', () => {
    it('deve aceitar parâmetros válidos', () => {
      const res = TenantSettingsService.validateSettings({
        timezone: 'America/Sao_Paulo',
        timesheet_cutoff_day: 25,
        esocial_environment: 'producao'
      });
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('deve rejeitar fuso horário vazio ou nulo', () => {
      const res1 = TenantSettingsService.validateSettings({
        timezone: '',
        timesheet_cutoff_day: 25,
        esocial_environment: 'producao'
      });
      expect(res1.valid).toBe(false);
      expect(res1.error).toContain('fuso horário padrão é obrigatório');

      const res2 = TenantSettingsService.validateSettings({
        timezone: undefined,
        timesheet_cutoff_day: 25,
        esocial_environment: 'producao'
      });
      expect(res2.valid).toBe(false);
    });

    it('deve validar limites do dia de corte do ponto (1 a 31)', () => {
      // Menor que 1
      const resZero = TenantSettingsService.validateSettings({
        timezone: 'America/Sao_Paulo',
        timesheet_cutoff_day: 0,
        esocial_environment: 'producao'
      });
      expect(resZero.valid).toBe(false);
      expect(resZero.error).toContain('número inteiro entre 1 e 31');

      // Maior que 31
      const res32 = TenantSettingsService.validateSettings({
        timezone: 'America/Sao_Paulo',
        timesheet_cutoff_day: 32,
        esocial_environment: 'producao'
      });
      expect(res32.valid).toBe(false);
      expect(res32.error).toContain('número inteiro entre 1 e 31');

      // Valor não inteiro
      const resFloat = TenantSettingsService.validateSettings({
        timezone: 'America/Sao_Paulo',
        timesheet_cutoff_day: 25.5,
        esocial_environment: 'producao'
      });
      expect(resFloat.valid).toBe(false);

      // Limites válidos
      expect(TenantSettingsService.validateSettings({
        timezone: 'America/Sao_Paulo',
        timesheet_cutoff_day: 1,
        esocial_environment: 'producao'
      }).valid).toBe(true);

      expect(TenantSettingsService.validateSettings({
        timezone: 'America/Sao_Paulo',
        timesheet_cutoff_day: 31,
        esocial_environment: 'producao'
      }).valid).toBe(true);
    });

    it('deve rejeitar ambientes inválidos do eSocial', () => {
      const res = TenantSettingsService.validateSettings({
        timezone: 'America/Sao_Paulo',
        timesheet_cutoff_day: 25,
        esocial_environment: 'homologacao' as any
      });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('producao');
    });

    it('deve conter catálogo de fusos horários brasileiros suportados', () => {
      expect(SUPPORTED_TIMEZONES.length).toBeGreaterThanOrEqual(5);
      const values = SUPPORTED_TIMEZONES.map(t => t.value);
      expect(values).toContain('America/Sao_Paulo');
      expect(values).toContain('America/Manaus');
      expect(values).toContain('America/Cuiaba');
    });
  });

  describe('Integração com Supabase (fetchSettings e saveSettings)', () => {
    it('deve retornar configurações default se não houver registro no banco', async () => {
      const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null });
      const eqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      vi.mocked(supabase.from).mockReturnValue({ select: selectMock } as any);

      const settings = await TenantSettingsService.fetchSettings('tenant-123');
      expect(settings.timezone).toBe('America/Sao_Paulo');
      expect(settings.timesheet_cutoff_day).toBe(25);
      expect(settings.esocial_environment).toBe('producao');
    });

    it('deve retornar dados existentes do banco', async () => {
      const mockRecord = {
        id: 'cfg-1',
        tenant_id: 'tenant-123',
        timezone: 'America/Manaus',
        timesheet_cutoff_day: 20,
        esocial_environment: 'restrita',
        created_at: '2026-10-16T10:00:00Z',
        updated_at: '2026-10-16T10:00:00Z'
      };

      const maybeSingleMock = vi.fn().mockResolvedValue({ data: mockRecord, error: null });
      const eqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
      const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
      vi.mocked(supabase.from).mockReturnValue({ select: selectMock } as any);

      const settings = await TenantSettingsService.fetchSettings('tenant-123');
      expect(settings.timezone).toBe('America/Manaus');
      expect(settings.timesheet_cutoff_day).toBe(20);
      expect(settings.esocial_environment).toBe('restrita');
    });

    it('deve salvar configurações com sucesso via upsert', async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: {
          id: 'cfg-1',
          tenant_id: 'tenant-123',
          timezone: 'America/Sao_Paulo',
          timesheet_cutoff_day: 26,
          esocial_environment: 'producao'
        },
        error: null
      });
      const selectMock = vi.fn().mockReturnValue({ single: singleMock });
      const upsertMock = vi.fn().mockReturnValue({ select: selectMock });
      vi.mocked(supabase.from).mockReturnValue({ upsert: upsertMock } as any);

      const saved = await TenantSettingsService.saveSettings('tenant-123', {
        timezone: 'America/Sao_Paulo',
        timesheet_cutoff_day: 26,
        esocial_environment: 'producao'
      });

      expect(upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 'tenant-123',
          timesheet_cutoff_day: 26,
          esocial_environment: 'producao'
        }),
        { onConflict: 'tenant_id' }
      );
      expect(saved.timesheet_cutoff_day).toBe(26);
    });

    it('deve lançar erro se o salvamento for rejeitado pelo banco', async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Violação de RLS' }
      });
      const selectMock = vi.fn().mockReturnValue({ single: singleMock });
      const upsertMock = vi.fn().mockReturnValue({ select: selectMock });
      vi.mocked(supabase.from).mockReturnValue({ upsert: upsertMock } as any);

      await expect(
        TenantSettingsService.saveSettings('tenant-123', {
          timezone: 'America/Sao_Paulo',
          timesheet_cutoff_day: 26,
          esocial_environment: 'producao'
        })
      ).rejects.toThrow('Falha ao persistir configurações do tenant: Violação de RLS');
    });
  });
});
