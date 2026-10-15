import { describe, it, expect } from 'vitest';
import { DocumentGeneratorService, type PayslipSnapshot } from '../../services/documents/documentGeneratorService';
import { DocumentSigningService } from '../../services/documents/documentSigningService';
import { SignatureCanvasCore } from '../../services/documents/signatureCanvasCore';
import { DocumentOtpService } from '../../services/documents/documentOtpService';
import { DocumentComplianceService } from '../../services/documents/documentComplianceService';
import { validateVerificationCode } from '../../services/documents/documentSignatureModel';

describe('GATE P6: Bateria Completa de Homologação da Assinatura Digital de Documentos', () => {
  const mockCompany = {
    id: 'emp-101',
    corporateName: 'Alpha Tech Participações S.A.',
    cnpj: '01.234.567/0001-89'
  };

  const mockWorker = {
    id: 'work-202',
    fullName: 'Lucas Ferreira Mendes',
    cpf: '456.789.012-34',
    admissionDate: '15/03/2022',
    positionTitle: 'Tech Lead',
    baseSalary: 16000.00
  };

  const mockSignaturePng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  it('Critério 1: Documento gerado a partir de snapshot imutável com Hash H1 SHA-256 canônico', async () => {
    const snapshot: PayslipSnapshot = {
      payslipId: 'ps-oct-2026',
      company: mockCompany,
      worker: mockWorker,
      periodMonth: 10,
      periodYear: 2026,
      periodType: 'MONTHLY',
      calculationDate: '2026-10-14',
      items: [
        { code: '101', name: 'Salário Base', type: 'EARNING', amount: 16000.00 },
        { code: '901', name: 'INSS Folha', type: 'DEDUCTION', amount: 951.62 },
        { code: '902', name: 'IRRF Folha', type: 'DEDUCTION', amount: 3385.10 }
      ],
      totalEarnings: 16000.00,
      totalDeductions: 4336.72,
      netSalary: 11663.28,
      baseInss: 8475.55,
      baseFgts: 16000.00,
      fgtsMonth: 1280.00,
      baseIrrf: 15048.38
    };

    const generated = await DocumentGeneratorService.generatePayslipPdf(snapshot);

    expect(generated.pdfBytes).toBeDefined();
    expect(generated.hashH1).toHaveLength(64);
    expect(generated.hashH1).toMatch(/^[a-f0-9]{64}$/);
    expect(validateVerificationCode(generated.verificationCode)).toBe(true);
  });

  it('Critério 2: Rubrica em tela validada com traços vetoriais autênticos (AS-03)', () => {
    // Rejeita clique acidental
    const click = [[{ x: 10, y: 10, time: 100 }]];
    expect(SignatureCanvasCore.validateStrokes(click).valid).toBe(false);

    // Aceita traçado contínuo
    const authenticStrokes = [
      Array.from({ length: 18 }, (_, i) => ({ x: 20 + i * 8, y: 50 + (i % 3) * 5, time: 1000 + i * 30 }))
    ];
    const validation = SignatureCanvasCore.validateStrokes(authenticStrokes);
    expect(validation.valid).toBe(true);
    expect(validation.pointCount).toBe(18);
  });

  it('Critério 3: Autenticação com OTP de 6 dígitos antes de assinar (AS-06)', async () => {
    const docId = 'doc-test-p6';
    const secret = 'cpf-salt-secret';
    const otp = await DocumentOtpService.generateOtp(docId, secret);

    expect(otp.code).toMatch(/^\d{6}$/);

    // Validação positiva
    const valid = await DocumentOtpService.verifyOtp(otp.code, docId, secret, otp.otpHash, otp.expiresAt, 0);
    expect(valid.success).toBe(true);

    // Tentativa inválida
    const invalid = await DocumentOtpService.verifyOtp('999999', docId, secret, otp.otpHash, otp.expiresAt, 0);
    expect(invalid.success).toBe(false);
    expect(invalid.remainingAttempts).toBe(2);
  });

  it('Critério 4: Estampagem da rubrica no PDF, anexo de página de manifesto e cálculo de Hash H2 (AS-04/AS-05)', async () => {
    const snapshot: PayslipSnapshot = {
      payslipId: 'ps-homolog',
      company: mockCompany,
      worker: mockWorker,
      periodMonth: 10,
      periodYear: 2026,
      periodType: 'MONTHLY',
      calculationDate: '2026-10-14',
      items: [{ code: '101', name: 'Salário Base', type: 'EARNING', amount: 16000.00 }],
      totalEarnings: 16000.00,
      totalDeductions: 0,
      netSalary: 16000.00,
      baseInss: 8475.55,
      baseFgts: 16000.00,
      fgtsMonth: 1280.00,
      baseIrrf: 16000.00
    };

    const original = await DocumentGeneratorService.generatePayslipPdf(snapshot);

    const signed = await DocumentSigningService.stampSignatureAndManifest({
      originalPdfBytes: original.pdfBytes,
      expectedHashH1: original.hashH1,
      signaturePngBase64: mockSignaturePng,
      signer: {
        name: mockWorker.fullName,
        cpf: mockWorker.cpf,
        role: mockWorker.positionTitle,
        companyName: mockCompany.corporateName,
        companyCnpj: mockCompany.cnpj
      },
      audit: {
        ip: '177.18.99.10',
        userAgent: 'CoupleRH Desktop Client v2.0',
        signedAt: new Date(),
        authMethod: 'SESSION_OTP'
      },
      verificationCode: original.verificationCode,
      documentTitle: 'Holerite de Homologação'
    });

    expect(signed.signedPdfBytes.length).toBeGreaterThan(original.pdfBytes.length);
    expect(signed.hashH2).toHaveLength(64);
    expect(signed.hashH2).not.toBe(original.hashH1);
    expect(signed.manifestData.signerName).toBe(mockWorker.fullName);
    expect(signed.manifestData.maskedCpf).toBe('***.789.012-**');

    // Validação de Integridade do PDF assinado
    const isIntegrityOk = await DocumentSigningService.verifySignedDocumentIntegrity(
      signed.signedPdfBytes,
      signed.hashH2
    );
    expect(isIntegrityOk).toBe(true);
  });

  it('Critério 5: Adulteração de 1 byte no PDF assinado é detectada imediatamente na verificação pública (Gate P6)', async () => {
    const snapshot: PayslipSnapshot = {
      payslipId: 'ps-tamper-check',
      company: mockCompany,
      worker: mockWorker,
      periodMonth: 10,
      periodYear: 2026,
      periodType: 'MONTHLY',
      calculationDate: '2026-10-14',
      items: [{ code: '101', name: 'Salário Base', type: 'EARNING', amount: 16000.00 }],
      totalEarnings: 16000.00,
      totalDeductions: 0,
      netSalary: 16000.00,
      baseInss: 8475.55,
      baseFgts: 16000.00,
      fgtsMonth: 1280.00,
      baseIrrf: 16000.00
    };

    const original = await DocumentGeneratorService.generatePayslipPdf(snapshot);
    const signed = await DocumentSigningService.stampSignatureAndManifest({
      originalPdfBytes: original.pdfBytes,
      expectedHashH1: original.hashH1,
      signaturePngBase64: mockSignaturePng,
      signer: {
        name: mockWorker.fullName,
        cpf: mockWorker.cpf,
        companyName: mockCompany.corporateName,
        companyCnpj: mockCompany.cnpj
      },
      audit: {
        ip: '127.0.0.1',
        userAgent: 'Test Agent',
        signedAt: new Date(),
        authMethod: 'SESSION'
      },
      verificationCode: original.verificationCode
    });

    // Inverte um byte aleatório no corpo do PDF para simular alteração de valor ou fraude
    const corrupted = new Uint8Array(signed.signedPdfBytes);
    corrupted[Math.floor(corrupted.length / 2)] ^= 0xAA;

    const check = await DocumentSigningService.verifySignedDocumentIntegrity(corrupted, signed.hashH2);
    expect(check).toBe(false);
  });

  it('Critério 6: Contestação e recusa com justificativa formal registrada na trilha (AS-11)', () => {
    const payload = DocumentComplianceService.buildContestPayload(
      'doc-contest-1',
      mockWorker.id,
      'Solicito revisão do adicional noturno que não foi creditado integralmente nesta competência.',
      'CONTESTED'
    );

    expect(payload.decision).toBe('CONTESTED');
    expect(payload.reason).toContain('revisão do adicional noturno');
    expect(payload.contestedAt).toBeDefined();
  });
});
