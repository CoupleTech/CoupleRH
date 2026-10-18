import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  CertificateService, 
  type CertificateUploadPayload 
} from '../../services/settings/certificateService';
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

describe('CONF-05: CertificateService (Certificados Digitais eSocial A1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validPayload: CertificateUploadPayload = {
    filename: 'certificado_empresa.pfx',
    subject_name: 'EMPRESA EXEMPLO LTDA:12345678000195',
    cnpj: '12.345.678/0001-95',
    issuer: 'AC SERASA RFB v5',
    serial_number: 'ICP-BR-7A3B9C1D',
    valid_from: '2026-01-01T00:00:00Z',
    valid_to: '2027-01-01T23:59:59Z',
    environment: 'producao',
    password: 'senha_segura_123'
  };

  describe('1. Validações de Domínio e Padrão ICP-Brasil (validatePayload)', () => {
    it('deve aceitar payload válido com extensão .pfx', () => {
      const res = CertificateService.validatePayload(validPayload);
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it('deve aceitar payload com extensão .p12', () => {
      const res = CertificateService.validatePayload({
        ...validPayload,
        filename: 'certificado.p12'
      });
      expect(res.valid).toBe(true);
    });

    it('deve rejeitar arquivos com extensões inválidas (não PKCS#12)', () => {
      const res = CertificateService.validatePayload({
        ...validPayload,
        filename: 'certificado.crt'
      });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('extensão .pfx ou .p12');
    });

    it('deve rejeitar titular/razão social em branco', () => {
      const res = CertificateService.validatePayload({
        ...validPayload,
        subject_name: ''
      });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Razão Social / Titular');
    });

    it('deve rejeitar CNPJ com quantidade incorreta de dígitos', () => {
      const resCurto = CertificateService.validatePayload({
        ...validPayload,
        cnpj: '12345678'
      });
      expect(resCurto.valid).toBe(false);
      expect(resCurto.error).toContain('CNPJ do certificado inválido');
    });

    it('deve rejeitar autoridade certificadora ou número de série em branco', () => {
      const resIssuer = CertificateService.validatePayload({
        ...validPayload,
        issuer: ' '
      });
      expect(resIssuer.valid).toBe(false);
      expect(resIssuer.error).toContain('Autoridade Certificadora');

      const resSerial = CertificateService.validatePayload({
        ...validPayload,
        serial_number: ''
      });
      expect(resSerial.valid).toBe(false);
      expect(resSerial.error).toContain('Número de série');
    });

    it('deve rejeitar data de expiração anterior ou igual à data de emissão', () => {
      const resInvertido = CertificateService.validatePayload({
        ...validPayload,
        valid_from: '2026-10-01T00:00:00Z',
        valid_to: '2026-05-01T00:00:00Z'
      });
      expect(resInvertido.valid).toBe(false);
      expect(resInvertido.error).toContain('posterior à data de emissão');
    });

    it('deve rejeitar ambiente inválido', () => {
      const resAmb = CertificateService.validatePayload({
        ...validPayload,
        environment: 'homologacao_invalida' as any
      });
      expect(resAmb.valid).toBe(false);
      expect(resAmb.error).toContain('Ambiente do eSocial inválido');
    });
  });

  describe('2. Utilitários e Diagnóstico de Vigência (computeStatus e formatCNPJ)', () => {
    it('deve formatar CNPJ de 14 dígitos corretamente', () => {
      expect(CertificateService.formatCNPJ('12345678000195')).toBe('12.345.678/0001-95');
    });

    it('deve diagnosticar status VALID quando faltarem mais de 30 dias', () => {
      const futureDate = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000).toISOString();
      const status = CertificateService.computeStatus(futureDate);
      expect(status.status).toBe('VALID');
      expect(status.daysRemaining).toBeGreaterThan(30);
    });

    it('deve diagnosticar status EXPIRING_SOON quando faltarem 30 dias ou menos', () => {
      const soonDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
      const status = CertificateService.computeStatus(soonDate);
      expect(status.status).toBe('EXPIRING_SOON');
      expect(status.daysRemaining).toBeLessThanOrEqual(30);
      expect(status.daysRemaining).toBeGreaterThanOrEqual(0);
    });

    it('deve diagnosticar status EXPIRED quando a data de validade estiver no passado', () => {
      const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const status = CertificateService.computeStatus(pastDate);
      expect(status.status).toBe('EXPIRED');
      expect(status.daysRemaining).toBeLessThan(0);
    });
  });

  describe('3. Consulta e Gestão de Certificado Ativo (getActiveCertificate)', () => {
    it('deve consultar RPC get_tenant_active_certificate e retornar dados consolidados', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: {
          id: 'cert-123',
          tenant_id: 'ten-456',
          company_id: 'comp-789',
          filename: 'certificado.pfx',
          subject_name: 'EMPRESA EXEMPLO LTDA:12345678000195',
          cnpj: '12345678000195',
          issuer: 'AC SERASA RFB v5',
          serial_number: 'SER-999',
          valid_from: '2026-01-01T00:00:00Z',
          valid_to: '2027-01-01T23:59:59Z',
          environment: 'producao',
          is_active: true,
          days_remaining: 260,
          status: 'VALID',
          created_at: '2026-01-01T10:00:00Z'
        },
        error: null
      } as any);

      const cert = await CertificateService.getActiveCertificate('producao');
      expect(cert).not.toBeNull();
      expect(cert?.cnpj).toBe('12345678000195');
      expect(cert?.status).toBe('VALID');
      expect(supabase.rpc).toHaveBeenCalledWith('get_tenant_active_certificate', {
        p_environment: 'producao'
      });
    });

    it('deve retornar null quando a RPC indicar ausência de certificado ativo', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: null
      } as any);

      vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
        data: { user: null },
        error: null
      } as any);

      const cert = await CertificateService.getActiveCertificate('producao');
      expect(cert).toBeNull();
    });
  });

  describe('4. Instalação e Revogação Segura (saveCertificate e revokeCertificate)', () => {
    it('deve salvar certificado via RPC save_tenant_certificate', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: {
          success: true,
          id: 'new-cert-id',
          subject_name: validPayload.subject_name
        },
        error: null
      } as any);

      const res = await CertificateService.saveCertificate(validPayload);
      expect(res.success).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('save_tenant_certificate', expect.objectContaining({
        p_filename: 'certificado_empresa.pfx',
        p_subject_name: validPayload.subject_name,
        p_environment: 'producao'
      }));
    });

    it('deve revogar certificado ativo via RPC revoke_tenant_certificate', async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: { success: true },
        error: null
      } as any);

      const res = await CertificateService.revokeCertificate('cert-123', 'Substituído');
      expect(res.success).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('revoke_tenant_certificate', {
        p_certificate_id: 'cert-123',
        p_reason: 'Substituído'
      });
    });
  });
});
