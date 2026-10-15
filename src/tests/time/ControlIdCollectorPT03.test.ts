import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ControlIdCollector,
  type ControlIdConfig,
  type RepApiClient,
  type CloudIngestClient,
} from '../../services/timeTracking/collector/controlIdCollector';

describe('PT-03: Coletor Local Control iD (Pull incremental, fila offline, HMAC e heartbeat)', () => {
  const config: ControlIdConfig = {
    deviceId: 'device-rep-001',
    deviceSecretKey: 'rep-secret-key-123',
    repHost: 'http://192.168.1.200',
    repUser: 'admin',
    repPassword: 'adminpassword',
    pollIntervalMs: 5000,
    batchSize: 50,
  };

  let mockRepApi: RepApiClient;
  let mockCloudIngest: CloudIngestClient;

  beforeEach(() => {
    mockRepApi = {
      login: vi.fn().mockResolvedValue('session-token-abc'),
      fetchAfdRecords: vi.fn(),
      ping: vi.fn().mockResolvedValue(true),
    };

    mockCloudIngest = {
      sendBatch: vi.fn().mockResolvedValue({ success: true, inserted_count: 2, last_nsr: 102 }),
      sendHeartbeat: vi.fn().mockResolvedValue({ success: true }),
    };
  });

  describe('1. Pull Incremental por NSR e Autenticação no Relógio', () => {
    it('deve autenticar no relógio Control iD e buscar apenas registros a partir do lastNsr', async () => {
      // Simula o relógio retornando duas novas marcações a partir do NSR 101
      mockRepApi.fetchAfdRecords = vi.fn().mockResolvedValue([
        {
          nsr: 101,
          record_type: 3,
          punched_at: '2026-10-14T08:00:00-03:00',
          cpf: '12345678901',
          raw_line: '0000001013141020260800123456789010',
        },
        {
          nsr: 102,
          record_type: 3,
          punched_at: '2026-10-14T12:00:00-03:00',
          cpf: '12345678901',
          raw_line: '0000001023141020261200123456789010',
        },
      ]);

      const collector = new ControlIdCollector(config, mockRepApi, mockCloudIngest, 100);

      const cycleResult = await collector.pollOnce();

      expect(mockRepApi.login).toHaveBeenCalledWith('admin', 'adminpassword');
      expect(mockRepApi.fetchAfdRecords).toHaveBeenCalledWith('session-token-abc', 100, 50);
      expect(mockCloudIngest.sendBatch).toHaveBeenCalledTimes(1);
      expect(cycleResult.syncedCount).toBe(2);
      expect(collector.getLastNsr()).toBe(102);
    });

    it('não deve enviar requisições à nuvem se não houver novos registros no REP', async () => {
      mockRepApi.fetchAfdRecords = vi.fn().mockResolvedValue([]);

      const collector = new ControlIdCollector(config, mockRepApi, mockCloudIngest, 102);
      const cycleResult = await collector.pollOnce();

      expect(cycleResult.syncedCount).toBe(0);
      expect(mockCloudIngest.sendBatch).not.toHaveBeenCalled();
      expect(collector.getLastNsr()).toBe(102);
    });
  });

  describe('2. Fila Offline e Resiliência a Falhas de Conexão', () => {
    it('deve armazenar registros na fila offline se o envio para a nuvem falhar', async () => {
      mockRepApi.fetchAfdRecords = vi.fn().mockResolvedValue([
        {
          nsr: 103,
          record_type: 3,
          punched_at: '2026-10-14T13:00:00-03:00',
          cpf: '12345678901',
        },
      ]);

      // Falha de rede ao conectar com a nuvem
      mockCloudIngest.sendBatch = vi.fn().mockRejectedValue(new Error('Network error: Cloud offline'));

      const collector = new ControlIdCollector(config, mockRepApi, mockCloudIngest, 102);

      const cycleResult = await collector.pollOnce();

      expect(cycleResult.offlineQueueLength).toBe(1);
      expect(collector.getOfflineQueue()).toHaveLength(1);
      expect(collector.getOfflineQueue()[0].nsr).toBe(103);
      // Não atualiza lastNsr confirmado na nuvem enquanto estiver na fila offline
      expect(collector.getLastNsr()).toBe(102);
    });

    it('deve descarregar a fila offline em ordem assim que a conexão com a nuvem for restabelecida', async () => {
      const collector = new ControlIdCollector(config, mockRepApi, mockCloudIngest, 102);

      // 1. Simula falha e batida enfileirada na fila offline
      collector.enqueueOffline({
        nsr: 103,
        record_type: 3,
        punched_at: '2026-10-14T13:00:00-03:00',
        cpf: '12345678901',
      });
      expect(collector.getOfflineQueue()).toHaveLength(1);

      // 2. Agora o relógio tem mais uma batida (104) e a nuvem volta a responder
      mockRepApi.fetchAfdRecords = vi.fn().mockResolvedValue([
        {
          nsr: 104,
          record_type: 3,
          punched_at: '2026-10-14T18:00:00-03:00',
          cpf: '12345678901',
        },
      ]);

      mockCloudIngest.sendBatch = vi.fn().mockResolvedValue({
        success: true,
        inserted_count: 2,
        last_nsr: 104,
      });

      const cycleResult = await collector.pollOnce();

      expect(cycleResult.offlineQueueLength).toBe(0);
      expect(collector.getOfflineQueue()).toHaveLength(0);
      expect(collector.getLastNsr()).toBe(104);

      // O lote enviado para a nuvem deve conter tanto o item da fila offline (103) quanto o novo (104)
      const sentRecords = (mockCloudIngest.sendBatch as any).mock.calls[0][1];
      expect(sentRecords.map((r: any) => r.nsr)).toEqual([103, 104]);
    });
  });

  describe('3. Heartbeat e Monitoramento de Conectividade', () => {
    it('deve enviar heartbeat reportando status do coletor, status do relógio e tamanho da fila offline', async () => {
      const collector = new ControlIdCollector(config, mockRepApi, mockCloudIngest, 100);

      const heartbeatResult = await collector.sendHeartbeat();

      expect(heartbeatResult.success).toBe(true);
      expect(mockCloudIngest.sendHeartbeat).toHaveBeenCalledWith({
        deviceId: 'device-rep-001',
        repOnline: true,
        offlineQueueLength: 0,
        lastNsr: 100,
        timestamp: expect.any(Number),
      });
    });

    it('deve reportar no heartbeat quando o relógio estiver inacessível na rede local', async () => {
      mockRepApi.ping = vi.fn().mockResolvedValue(false);

      const collector = new ControlIdCollector(config, mockRepApi, mockCloudIngest, 100);
      await collector.sendHeartbeat();

      expect(mockCloudIngest.sendHeartbeat).toHaveBeenCalledWith(
        expect.objectContaining({
          repOnline: false,
        })
      );
    });
  });
});
