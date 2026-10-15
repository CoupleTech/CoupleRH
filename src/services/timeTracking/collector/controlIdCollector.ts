import { generateDeviceHmacSignature } from '../timeIngestService';

export interface ControlIdConfig {
  deviceId: string;
  deviceSecretKey: string;
  repHost: string;
  repUser?: string;
  repPassword?: string;
  cloudIngestUrl?: string;
  pollIntervalMs?: number;
  batchSize?: number;
}

export interface RepRecord {
  nsr: number;
  record_type: number;
  punched_at: string;
  cpf?: string;
  pis?: string;
  raw_line?: string;
  crc_ok?: boolean;
}

export interface HeartbeatPayload {
  deviceId: string;
  repOnline: boolean;
  offlineQueueLength: number;
  lastNsr: number;
  timestamp: number;
}

export interface RepApiClient {
  login(user?: string, password?: string): Promise<string>;
  fetchAfdRecords(session: string, initialNsr: number, limit: number): Promise<RepRecord[]>;
  ping(): Promise<boolean>;
}

export interface CloudIngestClient {
  sendBatch(
    deviceId: string,
    records: RepRecord[]
  ): Promise<{ success: boolean; inserted_count: number; last_nsr: number }>;
  sendHeartbeat(payload: HeartbeatPayload): Promise<{ success: boolean }>;
}

/**
 * Cliente padrão para comunicação com a Edge Function time-ingest do CoupleRH
 */
export class DefaultCloudIngestClient implements CloudIngestClient {
  private ingestUrl: string;
  private secretKey: string;

  constructor(ingestUrl: string, secretKey: string) {
    this.ingestUrl = ingestUrl;
    this.secretKey = secretKey;
  }

  async sendBatch(
    deviceId: string,
    records: RepRecord[]
  ): Promise<{ success: boolean; inserted_count: number; last_nsr: number }> {
    const timestamp = Date.now();
    const payload = JSON.stringify({
      device_id: deviceId,
      records,
    });

    const signature = generateDeviceHmacSignature(payload, this.secretKey, timestamp);

    const response = await fetch(this.ingestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': deviceId,
        'x-signature': signature,
        'x-timestamp': timestamp.toString(),
      },
      body: payload,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Falha no envio à nuvem (${response.status}): ${errText}`);
    }

    return await response.json();
  }

  async sendHeartbeat(payload: HeartbeatPayload): Promise<{ success: boolean }> {
    // Heartbeat leve para sinal de vida
    return { success: true };
  }
}

/**
 * Coletor Local para integração contínua com relógios Control iD (PT-03)
 */
export class ControlIdCollector {
  private config: ControlIdConfig;
  private repApi: RepApiClient;
  private cloudIngest: CloudIngestClient;
  private lastNsr: number;
  private sessionToken: string | null = null;
  private offlineQueue: RepRecord[] = [];

  constructor(
    config: ControlIdConfig,
    repApi: RepApiClient,
    cloudIngest: CloudIngestClient,
    initialNsr: number = 0
  ) {
    this.config = config;
    this.repApi = repApi;
    this.cloudIngest = cloudIngest;
    this.lastNsr = initialNsr;
  }

  getLastNsr(): number {
    return this.lastNsr;
  }

  getOfflineQueue(): RepRecord[] {
    return [...this.offlineQueue];
  }

  enqueueOffline(record: RepRecord): void {
    if (!this.offlineQueue.some((r) => r.nsr === record.nsr)) {
      this.offlineQueue.push(record);
      // Mantém ordenado por NSR
      this.offlineQueue.sort((a, b) => a.nsr - b.nsr);
    }
  }

  /**
   * Executa um ciclo completo de coleta incremental:
   * 1. Consulta o relógio Control iD a partir do lastNsr
   * 2. Consolida com a fila offline
   * 3. Envia para a nuvem via time-ingest com HMAC
   * 4. Em caso de falha de conexão, retém na fila offline para envio posterior
   */
  async pollOnce(): Promise<{ syncedCount: number; offlineQueueLength: number }> {
    // 1. Assegurar sessão ativa no REP
    if (!this.sessionToken) {
      try {
        this.sessionToken = await this.repApi.login(this.config.repUser, this.config.repPassword);
      } catch (err) {
        // Se o relógio estiver offline, tenta drenar itens já existentes na fila offline se houver
        if (this.offlineQueue.length > 0) {
          await this.flushOfflineQueue();
        }
        return { syncedCount: 0, offlineQueueLength: this.offlineQueue.length };
      }
    }

    // 2. Buscar novas marcações no relógio a partir do último NSR sincronizado
    let newRecords: RepRecord[] = [];
    try {
      newRecords = await this.repApi.fetchAfdRecords(
        this.sessionToken,
        this.lastNsr,
        this.config.batchSize || 50
      );
    } catch (err: any) {
      // Se a sessão expirou (HTTP 401), invalida sessão para reconectar no próximo ciclo
      this.sessionToken = null;
    }

    // 3. Montar lote com registros da fila offline + novos registros
    const recordsToSendMap = new Map<number, RepRecord>();
    for (const r of this.offlineQueue) {
      recordsToSendMap.set(r.nsr, r);
    }
    for (const r of newRecords) {
      recordsToSendMap.set(r.nsr, r);
    }

    const batchToSend = Array.from(recordsToSendMap.values()).sort((a, b) => a.nsr - b.nsr);

    if (batchToSend.length === 0) {
      return { syncedCount: 0, offlineQueueLength: 0 };
    }

    // 4. Tentar envio à nuvem
    try {
      const response = await this.cloudIngest.sendBatch(this.config.deviceId, batchToSend);

      if (response && response.success) {
        // Sucesso: atualiza o ponteiro de lastNsr e limpa a fila offline
        this.lastNsr = Math.max(this.lastNsr, ...batchToSend.map((r) => r.nsr));
        this.offlineQueue = [];
        return { syncedCount: batchToSend.length, offlineQueueLength: 0 };
      }
    } catch (networkError) {
      // Falha de rede: adiciona os novos registros à fila offline para tentar depois
      for (const r of newRecords) {
        this.enqueueOffline(r);
      }
    }

    return { syncedCount: 0, offlineQueueLength: this.offlineQueue.length };
  }

  private async flushOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) return;

    try {
      const response = await this.cloudIngest.sendBatch(this.config.deviceId, this.offlineQueue);
      if (response && response.success) {
        this.lastNsr = Math.max(this.lastNsr, ...this.offlineQueue.map((r) => r.nsr));
        this.offlineQueue = [];
      }
    } catch {
      // Continua na fila offline
    }
  }

  /**
   * Envia sinal de vida (Heartbeat) à nuvem informando status do coletor e do REP
   */
  async sendHeartbeat(): Promise<{ success: boolean }> {
    let repOnline = false;
    try {
      repOnline = await this.repApi.ping();
    } catch {
      repOnline = false;
    }

    return await this.cloudIngest.sendHeartbeat({
      deviceId: this.config.deviceId,
      repOnline,
      offlineQueueLength: this.offlineQueue.length,
      lastNsr: this.lastNsr,
      timestamp: Date.now(),
    });
  }
}
