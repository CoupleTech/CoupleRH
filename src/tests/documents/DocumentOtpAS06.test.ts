import { describe, it, expect } from 'vitest';
import { DocumentOtpService } from '../../services/documents/documentOtpService';

describe('AS-06: Autenticação com Código OTP de 6 dígitos', () => {
  const documentId = 'doc-123-uuid';
  const workerSecret = 'worker-cpf-salt-secret';

  it('deve gerar código OTP de 6 dígitos com expiração de 10 minutos', async () => {
    const otp = await DocumentOtpService.generateOtp(documentId, workerSecret);
    expect(otp.code).toMatch(/^\d{6}$/);
    expect(otp.otpHash).toHaveLength(64);
    
    const expiry = new Date(otp.expiresAt).getTime();
    const diffMinutes = (expiry - Date.now()) / (60 * 1000);
    expect(diffMinutes).toBeGreaterThan(9);
    expect(diffMinutes).toBeLessThanOrEqual(10);
  });

  it('deve validar com sucesso o código correto dentro do prazo', async () => {
    const otp = await DocumentOtpService.generateOtp(documentId, workerSecret);
    const result = await DocumentOtpService.verifyOtp(
      otp.code,
      documentId,
      workerSecret,
      otp.otpHash,
      otp.expiresAt,
      0
    );

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('deve rejeitar código incorreto e decrementar tentativas restantes', async () => {
    const otp = await DocumentOtpService.generateOtp(documentId, workerSecret);
    const result = await DocumentOtpService.verifyOtp(
      '000000',
      documentId,
      workerSecret,
      otp.otpHash,
      otp.expiresAt,
      0
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Código de autenticação incorreto');
    expect(result.remainingAttempts).toBe(2);
  });

  it('deve bloquear após 3 tentativas inválidas consecutivas', async () => {
    const otp = await DocumentOtpService.generateOtp(documentId, workerSecret);
    const result = await DocumentOtpService.verifyOtp(
      otp.code, // mesmo que o código esteja certo, 3 tentativas já foram feitas
      documentId,
      workerSecret,
      otp.otpHash,
      otp.expiresAt,
      3
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Limite máximo de tentativas');
  });

  it('deve rejeitar código após o prazo de expiração de 10 minutos', async () => {
    const otp = await DocumentOtpService.generateOtp(documentId, workerSecret);
    const expiredDate = new Date(Date.now() - 1000).toISOString();

    const result = await DocumentOtpService.verifyOtp(
      otp.code,
      documentId,
      workerSecret,
      otp.otpHash,
      expiredDate,
      0
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('expirou');
  });
});
