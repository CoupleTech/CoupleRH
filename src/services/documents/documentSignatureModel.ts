/**
 * documentSignatureModel.ts
 * 
 * Modelo de Domínio e Utilitários para Assinatura Digital de Documentos Trabalhistas
 * CoupleRH - Conformidade com MP 2.200-2/2001, Lei 14.063/2020 e Portaria MTP 671/2021
 * 
 * Tarefa: AS-01 (Fase P6)
 */

export type DocumentType =
  | 'PAYSLIP'
  | 'VACATION_RECEIPT'
  | 'VACATION_NOTICE'
  | 'TIMESHEET'
  | 'TIME_BANK_AGREEMENT'
  | 'TRCT'
  | 'POLICY'
  | 'CONTRACT'
  | 'OTHER';

export type SignatureLevel =
  | 'SIMPLE'     // Identificação básica por login no portal
  | 'ADVANCED'   // Rubrica em tela + Evidências (IP, UA, OTP) + Hash H1/H2 (Lei 14.063/2020 Art. 4º II)
  | 'QUALIFIED'; // Certificado ICP-Brasil padrão PAdES / A1 (Lei 14.063/2020 Art. 4º III)

export type DocumentSignatureStatus =
  | 'DRAFT'
  | 'PENDING_SIGNATURE'
  | 'PARTIALLY_SIGNED'
  | 'SIGNED'
  | 'CONTESTED'
  | 'REFUSED'
  | 'CANCELED'
  | 'EXPIRED';

export type SignatureDecision =
  | 'SIGNED'
  | 'CONTESTED'
  | 'REFUSED';

export type SignatureAuthMethod =
  | 'SESSION'
  | 'SESSION_OTP'
  | 'SESSION_PIN'
  | 'CERTIFICATE_ICP'
  | 'GOV_BR';

export type DocumentEventType =
  | 'CREATED'
  | 'NOTIFIED_EMAIL'
  | 'NOTIFIED_WHATSAPP'
  | 'NOTIFIED_PORTAL'
  | 'VIEWED'
  | 'OTP_REQUESTED'
  | 'OTP_VERIFIED'
  | 'SIGNED'
  | 'CONTESTED'
  | 'REFUSED'
  | 'DOWNLOADED'
  | 'VERIFIED_PUBLIC';

export interface SignatureStrokePoint {
  x: number;
  y: number;
  time: number;
}

export interface GeolocationData {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  timestamp: string;
}

export interface ManifestMetadata {
  signerName: string;
  maskedCpf: string;
  workerRole?: string;
  companyName: string;
  companyCnpj: string;
  ipAddress: string;
  userAgent: string;
  signedAtIso: string;
  authMethod: SignatureAuthMethod;
  hashH1Original: string;
  hashH2Signed: string;
  verificationCode: string;
  verificationUrl: string;
  geoSummary?: string;
}

export interface EmployeeDocumentRecord {
  id: string;
  tenantId: string;
  workerId: string;
  documentTemplateId?: string | null;
  title: string;
  docType: DocumentType;
  sourceRef?: string | null;
  hashOriginal?: string | null; // H1 (PDF original do servidor)
  hashSigned?: string | null;   // H2 (PDF estampado com manifesto)
  fileUrl?: string | null;
  signedFileUrl?: string | null;
  status: DocumentSignatureStatus;
  signatureLevel: SignatureLevel;
  requiresEmployeeSignature: boolean;
  requiresEmployerSignature: boolean;
  requiresOtp: boolean;
  verificationCode: string;
  dueAt?: string | null;
  version: number;
  viewedAt?: string | null;
  signedAt?: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface SignatureLogRecord {
  id: string;
  tenantId: string;
  employeeDocumentId: string;
  signerUserId: string;
  signerRole: 'EMPLOYEE' | 'EMPLOYER' | 'WITNESS';
  ipAddress: string;
  userAgent: string;
  signatureTimestamp: string;
  documentHashAtSigning: string; // Hash H1 no momento da assinatura
  authMethod: SignatureAuthMethod;
  geo?: GeolocationData | null;
  signaturePngUrl?: string | null;
  signatureStrokes?: SignatureStrokePoint[][] | null;
  decision: SignatureDecision;
  reason?: string | null;
  manifestMetadata?: ManifestMetadata | null;
  certificateInfo?: Record<string, any> | null;
}

export interface DocumentEventRecord {
  id: string;
  tenantId: string;
  documentId: string;
  event: DocumentEventType;
  at: string;
  ip?: string | null;
  userAgent?: string | null;
  actorUserId?: string | null;
  meta?: Record<string, any>;
}

/**
 * Gera um código de verificação público formatado (ex: CRH-7F89-A2B4)
 */
export function generateVerificationCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Base32 sem caracteres ambíguos (0, O, 1, I)
  let part1 = '';
  let part2 = '';
  
  for (let i = 0; i < 4; i++) {
    const randIndex1 = Math.floor(Math.random() * chars.length);
    const randIndex2 = Math.floor(Math.random() * chars.length);
    part1 += chars[randIndex1];
    part2 += chars[randIndex2];
  }
  
  return `CRH-${part1}-${part2}`;
}

/**
 * Valida o formato de um código de verificação
 */
export function validateVerificationCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  const regex = /^CRH-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/i;
  return regex.test(code.trim().toUpperCase());
}

/**
 * Mascara o CPF para exibição segura e em conformidade com a LGPD no manifesto público
 * Formato: ***.123.456-**
 */
export function maskCpfForManifest(cpf: string): string {
  if (!cpf) return '***.***.***-**';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) {
    return '***.***.***-**';
  }
  return `***.${clean.substring(3, 6)}.${clean.substring(6, 9)}-**`;
}

/**
 * Formata um código de verificação normalizando maiúsculas e hífens
 */
export function formatVerificationCode(raw: string): string {
  if (!raw) return '';
  const clean = raw.toUpperCase().replace(/[^23456789ABCDEFGHJKLMNPQRSTUVWXYZ]/g, '');
  if (clean.startsWith('CRH')) {
    const rest = clean.substring(3);
    const p1 = rest.substring(0, 4);
    const p2 = rest.substring(4, 8);
    return `CRH${p1 ? '-' + p1 : ''}${p2 ? '-' + p2 : ''}`;
  }
  const p1 = clean.substring(0, 4);
  const p2 = clean.substring(4, 8);
  return `CRH-${p1}${p2 ? '-' + p2 : ''}`;
}

/**
 * Calcula o hash SHA-256 canônico em hexadecimal (64 caracteres)
 */
export async function computeCanonicalHash(data: Uint8Array | ArrayBuffer | string): Promise<string> {
  let buffer: Uint8Array;
  if (typeof data === 'string') {
    buffer = new TextEncoder().encode(data);
  } else if (data instanceof Uint8Array) {
    buffer = data;
  } else {
    buffer = new Uint8Array(data);
  }

  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', buffer as any);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  throw new Error('Ambiente de criptografia SHA-256 indisponível');
}
