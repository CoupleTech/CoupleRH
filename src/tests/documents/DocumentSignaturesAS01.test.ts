import { describe, it, expect } from 'vitest';
import {
  generateVerificationCode,
  validateVerificationCode,
  formatVerificationCode,
  maskCpfForManifest,
  computeCanonicalHash,
  type EmployeeDocumentRecord,
  type SignatureLogRecord,
  type DocumentEventRecord
} from '../../services/documents/documentSignatureModel';

describe('AS-01: Modelo de Assinatura Digital e Integridade', () => {
  it('deve gerar códigos de verificação no formato CRH-XXXX-XXXX válidos', () => {
    const code = generateVerificationCode();
    expect(code).toMatch(/^CRH-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
    expect(validateVerificationCode(code)).toBe(true);
  });

  it('deve rejeitar códigos de verificação inválidos ou corrompidos', () => {
    expect(validateVerificationCode('')).toBe(false);
    expect(validateVerificationCode('INVALID-CODE')).toBe(false);
    expect(validateVerificationCode('CRH-123-456')).toBe(false);
    expect(validateVerificationCode('CRH-0000-0000')).toBe(false); // 0 não faz parte do alfabeto Crockford/Base32 usado
  });

  it('deve normalizar e formatar códigos parciais ou desformatados', () => {
    expect(formatVerificationCode('crha2b4c5d6')).toBe('CRH-A2B4-C5D6');
    expect(formatVerificationCode('CRH-A2B4-C5D6')).toBe('CRH-A2B4-C5D6');
  });

  it('deve mascarar CPF em conformidade estrita com a LGPD para a folha de manifesto', () => {
    expect(maskCpfForManifest('12345678901')).toBe('***.456.789-**');
    expect(maskCpfForManifest('123.456.789-01')).toBe('***.456.789-**');
    expect(maskCpfForManifest('invalido')).toBe('***.***.***-**');
    expect(maskCpfForManifest('')).toBe('***.***.***-**');
  });

  it('deve calcular hash SHA-256 canônico de 64 caracteres hexadecimais', async () => {
    const content = 'CONTRATO_DE_TRABALHO_COUPLERH_V1';
    const hash1 = await computeCanonicalHash(content);
    const hash2 = await computeCanonicalHash(content);

    expect(hash1).toHaveLength(64);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    expect(hash1).toBe(hash2);

    const modified = await computeCanonicalHash('CONTRATO_DE_TRABALHO_COUPLERH_V2');
    expect(modified).not.toBe(hash1);
  });

  it('deve permitir estruturar registros completos de EmployeeDocumentRecord, SignatureLog e DocumentEvent', () => {
    const doc: EmployeeDocumentRecord = {
      id: 'doc-uuid-1',
      tenantId: 'tenant-uuid-1',
      workerId: 'worker-uuid-1',
      title: 'Holerite Competência 10/2026',
      docType: 'PAYSLIP',
      sourceRef: 'payslip-uuid-1',
      hashOriginal: 'a'.repeat(64),
      hashSigned: 'b'.repeat(64),
      status: 'PENDING_SIGNATURE',
      signatureLevel: 'ADVANCED',
      requiresEmployeeSignature: true,
      requiresEmployerSignature: false,
      requiresOtp: true,
      verificationCode: 'CRH-A2B4-C5D6',
      dueAt: '2026-10-20T23:59:59Z',
      version: 1,
      createdAt: '2026-10-14T10:00:00Z',
      updatedAt: '2026-10-14T10:00:00Z'
    };

    const signature: SignatureLogRecord = {
      id: 'sig-uuid-1',
      tenantId: 'tenant-uuid-1',
      employeeDocumentId: doc.id,
      signerUserId: 'user-uuid-1',
      signerRole: 'EMPLOYEE',
      ipAddress: '189.12.34.56',
      userAgent: 'Mozilla/5.0 CoupleRH PWA',
      signatureTimestamp: '2026-10-14T10:05:00Z',
      documentHashAtSigning: doc.hashOriginal!,
      authMethod: 'SESSION_OTP',
      geo: {
        latitude: -23.55052,
        longitude: -46.633308,
        accuracyMeters: 15,
        timestamp: '2026-10-14T10:05:00Z'
      },
      decision: 'SIGNED',
      signatureStrokes: [
        [{ x: 10, y: 15, time: 100 }, { x: 20, y: 25, time: 200 }]
      ]
    };

    const event: DocumentEventRecord = {
      id: 'evt-uuid-1',
      tenantId: 'tenant-uuid-1',
      documentId: doc.id,
      event: 'CREATED',
      at: '2026-10-14T10:00:00Z',
      actorUserId: 'admin-uuid-1',
      meta: { source: 'payroll_closure' }
    };

    expect(doc.docType).toBe('PAYSLIP');
    expect(signature.decision).toBe('SIGNED');
    expect(event.event).toBe('CREATED');
  });
});
