import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimeBankAgreementService } from '../../services/documents/timeBankAgreementService';
import { DocumentGeneratorService } from '../../services/documents/documentGeneratorService';

describe('TB-04.2: Emissão e Envio do Termo de Acordo Individual de Banco de Horas (CLT Art. 59 § 5º)', () => {
  const mockTenantId = 'tenant-test-123';
  const mockCompanyId = 'company-test-456';
  const mockWorkerId = 'worker-test-789';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Deve calcular automaticamente vigência de 6 meses conforme estipulado pelo Art. 59 § 5º da CLT', () => {
    const validFrom = '2026-10-15';
    const computedValidity = TimeBankAgreementService.calculateDefaultValidity(validFrom);

    expect(computedValidity.validFrom).toBe('2026-10-15');
    // 6 meses a partir de outubro = abril do ano seguinte
    expect(computedValidity.validTo).toBe('2027-04-15');
    expect(computedValidity.durationMonths).toBe(6);
  });

  it('2. Deve gerar o documento em PDF com Hash H1 e código de verificação público formatado', async () => {
    const snapshot = {
      agreementId: 'agr-uuid-1234',
      company: {
        corporateName: 'EMPRESA TECNOLOGIA LTDA',
        cnpj: '12.345.678/0001-90',
        address: 'São Paulo/SP'
      },
      worker: {
        id: mockWorkerId,
        fullName: 'Carlos Eduardo Ferreira',
        cpf: '123.456.789-00',
        positionTitle: 'Desenvolvedor Pleno'
      },
      validFrom: '2026-10-15',
      validTo: '2027-04-15',
      agreementDate: '15/10/2026',
      termsVersion: '1.0'
    };

    const docResult = await DocumentGeneratorService.generateTimeBankAgreementPdf(snapshot);

    expect(docResult.pdfBytes).toBeInstanceOf(Uint8Array);
    expect(docResult.pdfBytes.length).toBeGreaterThan(500);
    expect(docResult.hashH1).toMatch(/^[a-f0-9]{64}$/i);
    expect(docResult.verificationCode).toMatch(/^CRH-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(docResult.metadata.docType).toBe('TIME_BANK_AGREEMENT');
  });

  it('3. Deve montar o payload estrito de auditoria para persistência em employee_documents', () => {
    const snapshot = {
      agreementId: 'agr-test-999',
      company: {
        corporateName: 'EMPRESA RH S/A',
        cnpj: '98.765.432/0001-10',
        address: 'Curitiba/PR'
      },
      worker: {
        id: mockWorkerId,
        fullName: 'Mariana Souza',
        cpf: '321.654.987-11',
        positionTitle: 'Analista Financeiro'
      },
      validFrom: '2026-10-15',
      validTo: '2027-04-15',
      agreementDate: '15/10/2026',
      termsVersion: '1.0'
    };

    const payload = TimeBankAgreementService.buildDocumentPayload({
      tenantId: mockTenantId,
      companyId: mockCompanyId,
      workerId: mockWorkerId,
      snapshot,
      fileUrl: 'https://storage.supabase.com/agreements/agr-test-999.pdf',
      hashH1: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      verificationCode: 'CRH-AGRE-2026'
    });

    expect(payload.tenant_id).toBe(mockTenantId);
    expect(payload.company_id).toBe(mockCompanyId);
    expect(payload.worker_id).toBe(mockWorkerId);
    expect(payload.doc_type).toBe('TIME_BANK_AGREEMENT');
    expect(payload.document_type).toBe('TIME_BANK_AGREEMENT');
    expect(payload.status).toBe('PENDING');
    expect(payload.signature_level).toBe('ADVANCED');
    expect(payload.requires_employee_signature).toBe(true);
    expect(payload.requires_otp).toBe(true);
    expect(payload.verification_code).toBe('CRH-AGRE-2026');
    expect(payload.source_ref).toBe('time_bank_agreement:agr-test-999');
    expect(payload.metadata.validFrom).toBe('2026-10-15');
    expect(payload.metadata.validTo).toBe('2027-04-15');
  });

  it('4. Deve formatar a mensagem personalizada de convocação para assinatura via WhatsApp / Celular', () => {
    const msg = TimeBankAgreementService.buildWhatsAppNotificationMessage({
      workerName: 'Mariana Souza',
      companyName: 'EMPRESA RH S/A',
      verificationCode: 'CRH-AGRE-2026',
      portalUrl: 'https://app.couplerh.com.br/portal/login',
      validTo: '15/04/2027'
    });

    expect(msg).toContain('Mariana Souza');
    expect(msg).toContain('EMPRESA RH S/A');
    expect(msg).toContain('Acordo Individual de Banco de Horas');
    expect(msg).toContain('CRH-AGRE-2026');
    expect(msg).toContain('15/04/2027');
    expect(msg).toContain('https://app.couplerh.com.br/portal/login');
  });

  it('5. Deve validar adequação à CLT rejeitando vigência individual superior a 6 meses sem convenção coletiva', () => {
    // Acordo individual com mais de 6 meses
    const validation = TimeBankAgreementService.validateAgreementPeriod({
      validFrom: '2026-01-01',
      validTo: '2027-01-01', // 12 meses
      policyType: 'INDIVIDUAL_AGREEMENT'
    });

    expect(validation.isValid).toBe(false);
    expect(validation.error).toContain('6 meses');

    // Acordo coletivo (CCT) de até 12 meses deve ser aceito
    const validationCct = TimeBankAgreementService.validateAgreementPeriod({
      validFrom: '2026-01-01',
      validTo: '2027-01-01', // 12 meses
      policyType: 'COLLECTIVE_AGREEMENT'
    });

    expect(validationCct.isValid).toBe(true);
  });
});
