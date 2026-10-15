/**
 * documentOtpService.ts
 * 
 * Serviço de Geração e Validação de Códigos OTP (One-Time Password) de 6 dígitos
 * Utilizado para reforçar a autenticidade e não repúdio antes da assinatura eletrônica
 * 
 * Tarefa: AS-06 (Fase P6)
 */

import { computeCanonicalHash } from './documentSignatureModel';

export interface GeneratedOtp {
  code: string;       // Enviado ao usuário (e-mail/portal/WhatsApp)
  otpHash: string;    // Armazenado no estado/banco para conferência segura
  expiresAt: string;  // Data ISO de expiração (10 minutos)
}

export interface OtpVerificationResult {
  success: boolean;
  error?: string;
  remainingAttempts?: number;
}

export class DocumentOtpService {
  public static readonly OTP_VALIDITY_MINUTES = 10;
  public static readonly MAX_ATTEMPTS = 3;

  /**
   * Gera um código numérico seguro de 6 dígitos com expiração de 10 minutos
   */
  public static async generateOtp(documentId: string, workerSecret: string): Promise<GeneratedOtp> {
    // 6 dígitos numéricos aleatórios
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    const code = String(100000 + (array[0] % 900000));

    const expiresAtDate = new Date(Date.now() + this.OTP_VALIDITY_MINUTES * 60 * 1000);
    const expiresAt = expiresAtDate.toISOString();

    // Hash seguro do código concatenado com o documento e salt
    const rawToHash = `${code}:${documentId}:${workerSecret}:${expiresAt}`;
    const otpHash = await computeCanonicalHash(rawToHash);

    return {
      code,
      otpHash,
      expiresAt
    };
  }

  /**
   * Valida o código digitado contra o hash esperado e verifica prazos e limites de tentativas
   */
  public static async verifyOtp(
    inputCode: string,
    documentId: string,
    workerSecret: string,
    expectedHash: string,
    expiresAtIso: string,
    currentAttempts: number
  ): Promise<OtpVerificationResult> {
    const now = new Date();
    const expiry = new Date(expiresAtIso);

    // 1. Verificação de expiração
    if (now > expiry) {
      return {
        success: false,
        error: 'O código de autenticação expirou. Solicite um novo código para assinar.'
      };
    }

    // 2. Verificação de limite de tentativas
    if (currentAttempts >= this.MAX_ATTEMPTS) {
      return {
        success: false,
        error: 'Limite máximo de tentativas incorretas excedido. Gere um novo código por segurança.',
        remainingAttempts: 0
      };
    }

    // 3. Normalização e validação de formato
    const cleanCode = inputCode ? inputCode.trim().replace(/\D/g, '') : '';
    if (cleanCode.length !== 6) {
      const remaining = this.MAX_ATTEMPTS - (currentAttempts + 1);
      return {
        success: false,
        error: `O código deve conter exatamente 6 dígitos numéricos. Restam ${Math.max(0, remaining)} tentativa(s).`,
        remainingAttempts: Math.max(0, remaining)
      };
    }

    // 4. Verificação de hash
    const rawToHash = `${cleanCode}:${documentId}:${workerSecret}:${expiresAtIso}`;
    const computedHash = await computeCanonicalHash(rawToHash);

    if (computedHash.toLowerCase() !== expectedHash.toLowerCase()) {
      const remaining = this.MAX_ATTEMPTS - (currentAttempts + 1);
      return {
        success: false,
        error: `Código de autenticação incorreto. Restam ${Math.max(0, remaining)} tentativa(s).`,
        remainingAttempts: Math.max(0, remaining)
      };
    }

    return {
      success: true,
      remainingAttempts: this.MAX_ATTEMPTS - currentAttempts
    };
  }
}
