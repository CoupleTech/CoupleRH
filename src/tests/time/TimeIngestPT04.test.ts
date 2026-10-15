import { describe, it, expect } from 'vitest';
import {
  generateDeviceHmacSignature,
  verifyDeviceHmacSignature,
  processTimeIngestBatch,
  type TimeIngestBatch,
  type TimeIngestContext,
} from '../../services/timeTracking/timeIngestService';

describe('PT-04: Edge Function time-ingest (HMAC, lote e idempotência)', () => {
  const secretKey = 'device-secret-super-key-2026';
  const deviceId = 'device-rep-001';

  describe('1. Autenticação por HMAC-SHA256 e Proteção contra Replay Attack', () => {
    it('deve gerar e validar com sucesso uma assinatura HMAC válida no timestamp atual', () => {
      const now = Date.now();
      const payload = JSON.stringify({
        device_id: deviceId,
        records: [{ nsr: 101, punched_at: '2026-10-14T08:00:00-03:00' }],
      });

      const signature = generateDeviceHmacSignature(payload, secretKey, now);
      const isValid = verifyDeviceHmacSignature(payload, signature, secretKey, now);

      expect(isValid.valid).toBe(true);
      expect(isValid.reason).toBeUndefined();
    });

    it('deve rejeitar requisição com assinatura HMAC adulterada', () => {
      const now = Date.now();
      const payload = JSON.stringify({ device_id: deviceId, records: [] });
      const tamperedSignature = 'a'.repeat(64);

      const result = verifyDeviceHmacSignature(payload, tamperedSignature, secretKey, now);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Assinatura HMAC inválida');
    });

    it('deve rejeitar requisição com payload alterado após a assinatura', () => {
      const now = Date.now();
      const originalPayload = JSON.stringify({ device_id: deviceId, count: 1 });
      const signature = generateDeviceHmacSignature(originalPayload, secretKey, now);

      const modifiedPayload = JSON.stringify({ device_id: deviceId, count: 2 });
      const result = verifyDeviceHmacSignature(modifiedPayload, signature, secretKey, now);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Assinatura HMAC inválida');
    });

    it('deve rejeitar requisição expirada fora da janela de tolerância (replay attack > 10 min)', () => {
      const oldTimestamp = Date.now() - 15 * 60 * 1000; // 15 minutos atrás
      const payload = JSON.stringify({ device_id: deviceId, records: [] });
      const signature = generateDeviceHmacSignature(payload, secretKey, oldTimestamp);

      const result = verifyDeviceHmacSignature(
        payload,
        signature,
        secretKey,
        oldTimestamp,
        Date.now(),
        10 * 60 * 1000 // tolerância de 10 min
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Timestamp fora da janela de tolerância');
    });
  });

  describe('2. Ingestão em Lote e Idempotência', () => {
    const mockContext: TimeIngestContext = {
      tenant_id: 'tenant-123',
      company_id: 'company-456',
      device: {
        id: deviceId,
        tenant_id: 'tenant-123',
        company_id: 'company-456',
        name: 'Relógio Produção',
        kind: 'REP_C',
        status: 'ACTIVE',
        last_nsr: 100,
        api_key_hash: 'hash-secret',
      },
      workers: [
        {
          id: 'worker-10',
          person_id: 'person-10',
          cpf: '12345678901',
          pis: '123456789010',
          active_contract_id: 'contract-10',
        },
      ],
      existingPunches: new Set<string>(['device-rep-001:101', 'device-rep-001:102']),
    };

    it('deve processar lote de batidas, associar trabalhador e atualizar last_nsr', async () => {
      const batch: TimeIngestBatch = {
        device_id: deviceId,
        records: [
          {
            nsr: 103,
            record_type: 3,
            punched_at: '2026-10-14T08:00:00-03:00',
            cpf: '123.456.789-01',
            raw_line: '0000001033141020260800123456789010',
            crc_ok: true,
          },
          {
            nsr: 104,
            record_type: 3,
            punched_at: '2026-10-14T12:00:00-03:00',
            pis: '123456789010',
            raw_line: '0000001043141020261200123456789010',
            crc_ok: true,
          },
        ],
      };

      const result = await processTimeIngestBatch(batch, mockContext);

      expect(result.success).toBe(true);
      expect(result.batch_size).toBe(2);
      expect(result.inserted_count).toBe(2);
      expect(result.duplicate_count).toBe(0);
      expect(result.rejected_count).toBe(0);
      expect(result.last_nsr).toBe(104);

      expect(result.recordsToInsert).toHaveLength(2);
      expect(result.recordsToInsert[0].worker_id).toBe('worker-10');
      expect(result.recordsToInsert[0].contract_id).toBe('contract-10');
      expect(result.recordsToInsert[0].source).toBe('REP');
    });

    it('deve garantir idempotência: ignorar batidas já existentes no banco sem erro fatal', async () => {
      const batchWithDuplicates: TimeIngestBatch = {
        device_id: deviceId,
        records: [
          {
            nsr: 101, // Já existente no mockContext.existingPunches
            record_type: 3,
            punched_at: '2026-10-14T07:55:00-03:00',
            cpf: '12345678901',
          },
          {
            nsr: 102, // Já existente no mockContext.existingPunches
            record_type: 3,
            punched_at: '2026-10-14T08:00:00-03:00',
            cpf: '12345678901',
          },
          {
            nsr: 105, // Novo registro
            record_type: 3,
            punched_at: '2026-10-14T18:00:00-03:00',
            cpf: '12345678901',
          },
        ],
      };

      const result = await processTimeIngestBatch(batchWithDuplicates, mockContext);

      expect(result.success).toBe(true);
      expect(result.batch_size).toBe(3);
      expect(result.inserted_count).toBe(1); // Apenas o 105 novo
      expect(result.duplicate_count).toBe(2); // 101 e 102 duplicados
      expect(result.recordsToInsert).toHaveLength(1);
      expect(result.recordsToInsert[0].nsr).toBe(105);
      expect(result.last_nsr).toBe(105);
    });

    it('deve rejeitar ingestão se o dispositivo estiver inativo ou em manutenção', async () => {
      const inactiveContext: TimeIngestContext = {
        ...mockContext,
        device: {
          ...mockContext.device,
          status: 'MAINTENANCE',
        },
      };

      const batch: TimeIngestBatch = {
        device_id: deviceId,
        records: [{ nsr: 200, punched_at: '2026-10-14T08:00:00-03:00' }],
      };

      const result = await processTimeIngestBatch(batch, inactiveContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Dispositivo não está ativo para ingestão');
      expect(result.recordsToInsert).toHaveLength(0);
    });

    it('deve rejeitar requisição com divergência de device_id entre payload e contexto', async () => {
      const batchWithMismatchedDevice: TimeIngestBatch = {
        device_id: 'wrong-device-id',
        records: [{ nsr: 200, punched_at: '2026-10-14T08:00:00-03:00' }],
      };

      const result = await processTimeIngestBatch(batchWithMismatchedDevice, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Divergência no identificador do dispositivo');
    });
  });
});
