import * as crypto from 'crypto';
import type { TimePunchRecord } from './timeTrackingModel';

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface WorkplaceGeofence {
  id?: string;
  name: string;
  latitude?: number;
  longitude?: number;
  radius_meters?: number;
  enforce_geofence?: boolean;
}

export interface PunchReceiptData {
  nsr: number;
  punchedAt: string; // ISO
  companyName: string;
  companyCnpj: string;
  workerName: string;
  workerCpf: string;
}

export interface PunchReceipt {
  receipt_code: string; // SHA-256
  qr_code_payload: string;
  issued_at: string;
  data: PunchReceiptData;
}

export interface MobilePunchInput {
  contract_id: string;
  geo?: GeoCoordinates;
  device_fingerprint?: string;
  ip?: string;
  selfie_url?: string;
  has_selfie_consent?: boolean;
}

export interface MobilePunchContext {
  tenant_id: string;
  company: {
    id: string;
    name: string;
    cnpj: string;
  };
  worker: {
    id: string;
    name: string;
    cpf: string;
    pis?: string;
  };
  contract: {
    id: string;
    is_telework?: boolean;
    workplace?: WorkplaceGeofence;
  };
  serverTime: string; // ISO carimbada no servidor
  nextNsr: number;
  lastPunchTimestamp?: number;
}

export interface MobilePunchResult {
  success: boolean;
  record?: TimePunchRecord;
  receipt?: PunchReceipt;
  distance_meters?: number;
  error?: string;
}

function cleanDigits(val?: string): string {
  if (!val) return '';
  return val.replace(/\D/g, '');
}

/**
 * Calcula a distância geodésica entre dois pontos na Terra em metros (fórmula de Haversine)
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Raio médio da Terra em metros
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Valida o perímetro do local de trabalho (Geofence)
 */
export function validateGeofence(
  workplace: WorkplaceGeofence | undefined,
  userCoords: GeoCoordinates | undefined,
  isTelework: boolean = false
): { allowed: boolean; distance_meters?: number; is_telework?: boolean; reason?: string } {
  // Se o colaborador estiver em regime de teletrabalho / externo, geofence não é bloqueante
  if (isTelework) {
    return { allowed: true, is_telework: true };
  }

  // Se o workplace não tiver coordenadas ou geofence desativado
  if (!workplace || !workplace.enforce_geofence || workplace.latitude === undefined || workplace.longitude === undefined) {
    return { allowed: true };
  }

  if (!userCoords || userCoords.latitude === undefined || userCoords.longitude === undefined) {
    return {
      allowed: false,
      reason: 'Geolocalização é obrigatória para este local de trabalho mas não foi capturada pelo dispositivo.',
    };
  }

  const radius = workplace.radius_meters ?? 200;
  const distance = calculateHaversineDistance(
    workplace.latitude,
    workplace.longitude,
    userCoords.latitude,
    userCoords.longitude
  );

  if (distance > radius) {
    return {
      allowed: false,
      distance_meters: distance,
      reason: `Fora do perímetro permitido de marcação de ponto. Distância: ${distance}m (raio máximo: ${radius}m) em relação a "${workplace.name}".`,
    };
  }

  return { allowed: true, distance_meters: distance };
}

/**
 * Valida se houve marcação repetida em curto intervalo (Debounce / anti-duplicação)
 */
export function validateRecentPunchDebounce(
  lastPunchTimestamp: number | undefined,
  currentTimestamp: number,
  minIntervalSeconds: number = 60
): { allowed: boolean; reason?: string } {
  if (!lastPunchTimestamp) {
    return { allowed: true };
  }

  const elapsedSeconds = (currentTimestamp - lastPunchTimestamp) / 1000;
  if (elapsedSeconds < minIntervalSeconds) {
    return {
      allowed: false,
      reason: `Marcação repetida recente: aguarde ${Math.ceil(minIntervalSeconds - elapsedSeconds)} segundos antes de bater o ponto novamente.`,
    };
  }

  return { allowed: true };
}

/**
 * Gera o Comprovante de Registro de Ponto do Trabalhador (Portaria MTP 671/2021)
 */
export function generatePunchReceipt(data: PunchReceiptData): PunchReceipt {
  const cleanCnpj = cleanDigits(data.companyCnpj);
  const cleanCpf = cleanDigits(data.workerCpf);

  // String base com dados canônicos da marcação
  const rawReceipt = `${data.nsr}|${data.punchedAt}|${cleanCnpj}|${cleanCpf}`;
  const receiptCode = crypto.createHash('sha256').update(rawReceipt, 'utf8').digest('hex');

  const verificationUrl = `https://couplerh.com.br/verificar-ponto?nsr=${data.nsr}&cnpj=${cleanCnpj}&h=${receiptCode.substring(0, 16)}`;
  const qrCodePayload = `${verificationUrl}&cpf=${cleanCpf}&hash=${receiptCode}`;

  return {
    receipt_code: receiptCode,
    qr_code_payload: qrCodePayload,
    issued_at: data.punchedAt,
    data,
  };
}

/**
 * Processamento completo de marcação de ponto via celular / PWA (REP-P)
 */
export async function processMobilePunch(
  input: MobilePunchInput,
  context: MobilePunchContext
): Promise<MobilePunchResult> {
  const serverTimeMs = new Date(context.serverTime).getTime();

  // 1. Debounce contra marcações duplas acidentais
  const debounce = validateRecentPunchDebounce(context.lastPunchTimestamp, serverTimeMs, 60);
  if (!debounce.allowed) {
    return { success: false, error: debounce.reason };
  }

  // 2. Validação de Geofence
  const geofence = validateGeofence(
    context.contract.workplace,
    input.geo,
    context.contract.is_telework ?? false
  );
  if (!geofence.allowed) {
    return { success: false, error: geofence.reason, distance_meters: geofence.distance_meters };
  }

  // 3. Geração do Comprovante de Registro de Ponto
  const receipt = generatePunchReceipt({
    nsr: context.nextNsr,
    punchedAt: context.serverTime,
    companyName: context.company.name,
    companyCnpj: context.company.cnpj,
    workerName: context.worker.name,
    workerCpf: context.worker.cpf,
  });

  // 4. Montagem da batida imutável
  const record: TimePunchRecord = {
    tenant_id: context.tenant_id,
    company_id: context.company.id,
    nsr: context.nextNsr,
    record_type: 3,
    punched_at: context.serverTime, // Hora confiável do servidor
    cpf: cleanDigits(context.worker.cpf),
    pis: cleanDigits(context.worker.pis) || undefined,
    worker_id: context.worker.id,
    contract_id: context.contract.id,
    source: 'MOBILE',
    geo: input.geo ? {
      latitude: input.geo.latitude,
      longitude: input.geo.longitude,
      accuracy: input.geo.accuracy,
    } : undefined,
    ip: input.ip,
    device_fingerprint: input.device_fingerprint,
    receipt_code: receipt.receipt_code,
    crc_ok: true,
  };

  return {
    success: true,
    record,
    receipt,
    distance_meters: geofence.distance_meters,
  };
}
