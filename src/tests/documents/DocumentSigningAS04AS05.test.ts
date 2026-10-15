import { describe, it, expect } from 'vitest';
import { DocumentGeneratorService, type PayslipSnapshot } from '../../services/documents/documentGeneratorService';
import { DocumentSigningService } from '../../services/documents/documentSigningService';

describe('AS-04 e AS-05: Assinatura Eletrônica, Estampagem de Rubrica, Manifesto e Hash H2', () => {
  // PNG 1x1 válido para simular rubrica em ambiente de teste
  const mockSignaturePng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const mockPayslip: PayslipSnapshot = {
    payslipId: 'payslip-test-1',
    company: {
      id: 'comp-1',
      corporateName: 'Tech Enterprise Brasil Ltda',
      cnpj: '11.222.333/0001-44'
    },
    worker: {
      id: 'work-1',
      fullName: 'Carlos Eduardo Santos',
      cpf: '333.444.555-66',
      admissionDate: '10/01/2024',
      positionTitle: 'Analista de Infraestrutura',
      baseSalary: 8500.00
    },
    periodMonth: 10,
    periodYear: 2026,
    periodType: 'MONTHLY',
    calculationDate: '2026-10-14',
    items: [
      { code: '101', name: 'Salário Base', type: 'EARNING', amount: 8500.00 },
      { code: '901', name: 'INSS Folha', type: 'DEDUCTION', amount: 951.62 }
    ],
    totalEarnings: 8500.00,
    totalDeductions: 951.62,
    netSalary: 7548.38,
    baseInss: 8475.55,
    baseFgts: 8500.00,
    fgtsMonth: 680.00,
    baseIrrf: 7548.38
  };

  it('deve estampar rubrica, anexar página de manifesto e gerar H2 consistente', async () => {
    // 1. Gera o documento original com H1
    const original = await DocumentGeneratorService.generatePayslipPdf(mockPayslip);
    expect(original.hashH1).toHaveLength(64);

    // 2. Estampa assinatura e gera manifesto
    const signed = await DocumentSigningService.stampSignatureAndManifest({
      originalPdfBytes: original.pdfBytes,
      expectedHashH1: original.hashH1,
      signaturePngBase64: mockSignaturePng,
      signer: {
        name: mockPayslip.worker.fullName,
        cpf: mockPayslip.worker.cpf,
        role: mockPayslip.worker.positionTitle,
        companyName: mockPayslip.company.corporateName,
        companyCnpj: mockPayslip.company.cnpj
      },
      audit: {
        ip: '201.55.100.80',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        signedAt: new Date('2026-10-14T14:30:00Z'),
        authMethod: 'SESSION_OTP',
        geo: {
          latitude: -23.5505,
          longitude: -46.6333,
          accuracyMeters: 20,
          timestamp: '2026-10-14T14:30:00Z'
        }
      },
      verificationCode: original.verificationCode,
      documentTitle: 'Holerite 10/2026'
    });

    // 3. Validações
    expect(signed.signedPdfBytes.length).toBeGreaterThan(original.pdfBytes.length);
    expect(signed.hashH1).toBe(original.hashH1);
    expect(signed.hashH2).toHaveLength(64);
    expect(signed.hashH2).not.toBe(original.hashH1);
    expect(signed.manifestData.signerName).toBe('Carlos Eduardo Santos');
    expect(signed.manifestData.maskedCpf).toBe('***.444.555-**');
    expect(signed.manifestData.authMethod).toBe('SESSION_OTP');
    expect(signed.manifestData.verificationUrl).toContain(original.verificationCode);

    // 4. Teste de Integridade H2 (válido)
    const isValid = await DocumentSigningService.verifySignedDocumentIntegrity(signed.signedPdfBytes, signed.hashH2);
    expect(isValid).toBe(true);

    // 5. Teste de Detecção de Adulteração (corrompe 1 byte)
    const tamperedBytes = new Uint8Array(signed.signedPdfBytes);
    tamperedBytes[tamperedBytes.length - 50] ^= 0xFF; // inverte bits de um byte
    const isTamperedValid = await DocumentSigningService.verifySignedDocumentIntegrity(tamperedBytes, signed.hashH2);
    expect(isTamperedValid).toBe(false);
  });

  it('deve rejeitar assinatura se o hash H1 fornecido não coincidir com os bytes do PDF', async () => {
    const original = await DocumentGeneratorService.generatePayslipPdf(mockPayslip);
    const fakeH1 = 'f'.repeat(64);

    await expect(
      DocumentSigningService.stampSignatureAndManifest({
        originalPdfBytes: original.pdfBytes,
        expectedHashH1: fakeH1,
        signaturePngBase64: mockSignaturePng,
        signer: {
          name: 'Nome',
          cpf: '12345678900',
          companyName: 'Empresa',
          companyCnpj: '00000000000100'
        },
        audit: {
          ip: '127.0.0.1',
          userAgent: 'Test Agent',
          signedAt: new Date(),
          authMethod: 'SESSION'
        },
        verificationCode: original.verificationCode
      })
    ).rejects.toThrow(/VIOLAÇÃO DE INTEGRIDADE/);
  });
});
