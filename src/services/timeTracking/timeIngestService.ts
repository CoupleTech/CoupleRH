import * as crypto from 'crypto';
import type { TimeDevice, TimePunchRecord } from './timeTrackingModel';
import type { AfdImportWorker } from './afdImportService';

export interface TimeIngestRecordInput {
  nsr: number;
  record_type?: number; // padrão 3
  punched_at: string; // ISO 8601 com fuso
  cpf?: string;
  pis?: string;
  raw_line?: string;
  crc_ok?: boolean;
}

export interface TimeIngestBatch {
  device_id: string;
  records: TimeIngestRecordInput[];
}

export interface TimeIngestContext {
  tenant_id: string;
  company_id?: string;
  device: TimeDevice;
  workers?: AfdImportWorker[];
  existingPunches?: Set<string>; // formato "device_id:nsr"
}

export interface TimeIngestResult {
  success: boolean;
  device_id: string;
  batch_size: number;
  inserted_count: number;
  duplicate_count: number;
  rejected_count: number;
  last_nsr: number;
  recordsToInsert: TimePunchRecord[];
  warnings: string[];
  error?: string;
}

/**
 * Remove qualquer caractere não numérico
 */
function cleanDigits(value?: string): string {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

/**
 * Gera assinatura HMAC-SHA256 a partir de um payload e timestamp
 */
export function generateDeviceHmacSignature(
  payload: string,
  secretKey: string,
  timestamp: number | string
): string {
  const message = `${timestamp}:${payload}`;
  return crypto.createHmac('sha256', secretKey).update(message, 'utf8').digest('hex');
}

/**
 * Valida a assinatura HMAC-SHA256 e protege contra replay attacks
 */
export function verifyDeviceHmacSignature(
  payload: string,
  signature: string,
  secretKey: string,
  timestamp: number | string,
  currentTimestamp: number = Date.now(),
  toleranceMs: number = 10 * 60 * 1000 // 10 minutos
): { valid: boolean; reason?: string } {
  const tsNum = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
  if (isNaN(tsNum)) {
    return { valid: false, reason: 'Timestamp inválido' };
  }

  // Prevenção contra replay attack
  const timeDifference = Math.abs(currentTimestamp - tsNum);
  if (timeDifference > toleranceMs) {
    return {
      valid: false,
      reason: `Timestamp fora da janela de tolerância permitida (${Math.round(toleranceMs / 60000)} minutos)`,
    };
  }

  const expectedSignature = generateDeviceHmacSignature(payload, secretKey, tsNum);

  // Comparação segura contra timing attacks
  const sigBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (sigBuffer.length !== expectedBuffer.length) {
    return { valid: false, reason: 'Assinatura HMAC inválida' };
  }

  const matches = crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  if (!matches) {
    return { valid: false, reason: 'Assinatura HMAC inválida' };
  }

  return { valid: true };
}

/**
 * Processa a ingestão de um lote de batidas de ponto
 */
export async function processTimeIngestBatch(
  batch: TimeIngestBatch,
  context: TimeIngestContext
): Promise<TimeIngestResult> {
  const warnings: string[] = [];
  const recordsToInsert: TimePunchRecord[] = [];

  // 1. Validação de dispositivo
  if (batch.device_id !== context.device.id) {
    return {
      success: false,
      device_id: batch.device_id,
      batch_size: batch.records?.length || 0,
      inserted_count: 0,
      duplicate_count: 0,
      rejected_count: 0,
      last_nsr: context.device.last_nsr || 0,
      recordsToInsert: [],
      warnings: [],
      error: `Divergência no identificador do dispositivo: payload tem "${batch.device_id}", mas o contexto é "${context.device.id}".`,
    };
  }

  if (context.device.status !== 'ACTIVE') {
    return {
      success: false,
      device_id: batch.device_id,
      batch_size: batch.records?.length || 0,
      inserted_count: 0,
      duplicate_count: 0,
      rejected_count: 0,
      last_nsr: context.device.last_nsr || 0,
      recordsToInsert: [],
      warnings: [],
      error: `Dispositivo não está ativo para ingestão. Status atual: ${context.device.status}.`,
    };
  }

  // 2. Mapeamento de trabalhadores
  const workerByCpf = new Map<string, AfdImportWorker>();
  const workerByPis = new Map<string, AfdImportWorker>();

  if (context.workers) {
    for (const w of context.workers) {
      const c = cleanDigits(w.cpf);
      if (c) workerByCpf.set(c, w);

      const p = cleanDigits(w.pis);
      if (p) workerByPis.set(p, w);
    }
  }

  let duplicateCount = 0;
  let maxNsr = context.device.last_nsr || 0;

  // 3. Processar registros do lote
  for (const item of batch.records) {
    const punchKey = `${context.device.id}:${item.nsr}`;

    // Idempotência: ignora batidas já gravadas no banco
    if (context.existingPunches && context.existingPunches.has(punchKey)) {
      duplicateCount++;
      if (item.nsr > maxNsr) {
        maxNsr = item.nsr;
      }
      continue;
    }

    const cleanCpf = cleanDigits(item.cpf);
    const cleanPis = cleanDigits(item.pis);
    let matchedWorker: AfdImportWorker | undefined;

    if (cleanPis && workerByPis.has(cleanPis)) {
      matchedWorker = workerByPis.get(cleanPis);
    } else if (cleanCpf && workerByCpf.has(cleanCpf)) {
      matchedWorker = workerByCpf.get(cleanCpf);
    }

    if (!matchedWorker && (cleanCpf || cleanPis)) {
      warnings.push(
        `NSR ${item.nsr}: Colaborador não localizado para documento informado (CPF: ${cleanCpf || 'n/a'}, PIS: ${cleanPis || 'n/a'}). Registro mantido na trilha para conciliação.`
      );
    }

    const punchRecord: TimePunchRecord = {
      tenant_id: context.tenant_id,
      company_id: context.company_id,
      device_id: context.device.id,
      nsr: item.nsr,
      record_type: item.record_type || 3,
      punched_at: item.punched_at,
      cpf: matchedWorker?.cpf || (cleanCpf.length === 11 ? cleanCpf : undefined),
      pis: matchedWorker?.pis || (cleanPis ? cleanPis : undefined),
      worker_id: matchedWorker?.id,
      contract_id: matchedWorker?.active_contract_id,
      source: 'REP',
      raw_line: item.raw_line,
      crc_ok: item.crc_ok ?? true,
    };

    recordsToInsert.push(punchRecord);

    if (item.nsr > maxNsr) {
      maxNsr = item.nsr;
    }
  }

  return {
    success: true,
    device_id: context.device.id,
    batch_size: batch.records.length,
    inserted_count: recordsToInsert.length,
    duplicate_count: duplicateCount,
    rejected_count: 0,
    last_nsr: maxNsr,
    recordsToInsert,
    warnings,
  };
}
