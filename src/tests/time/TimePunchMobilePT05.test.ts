import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  calculateHaversineDistance,
  validateGeofence,
  validateRecentPunchDebounce,
  generatePunchReceipt,
  processMobilePunch,
  type MobilePunchInput,
  type MobilePunchContext,
} from '../../services/timeTracking/timePunchService';

describe('PT-05: Ponto pelo Celular (REP-P / Portaria MTP 671/2021)', () => {
  // Coordenadas de teste:
  // Sede da Empresa: Av. Paulista, 1000, SP (-23.5645, -46.6525)
  const officeCoords = { latitude: -23.5645, longitude: -46.6525 };
  // Ponto próximo (a ~50 metros): Av. Paulista, 1030 (-23.5642, -46.6521)
  const nearbyCoords = { latitude: -23.5642, longitude: -46.6521 };
  // Ponto distante (a ~15 km): Parque do Ibirapuera / Santo Amaro (-23.6500, -46.7000)
  const farCoords = { latitude: -23.6500, longitude: -46.7000 };

  describe('1. Cálculo de Distância Geodésica e Geofence', () => {
    it('deve calcular distância geodésica (Haversine) com precisão', () => {
      const distance = calculateHaversineDistance(
        officeCoords.latitude,
        officeCoords.longitude,
        nearbyCoords.latitude,
        nearbyCoords.longitude
      );
      // Deve estar entre 40 e 60 metros
      expect(distance).toBeGreaterThan(30);
      expect(distance).toBeLessThan(80);
    });

    it('deve aprovar marcação dentro do raio do local de trabalho', () => {
      const workplace = {
        name: 'Sede Paulista',
        latitude: officeCoords.latitude,
        longitude: officeCoords.longitude,
        radius_meters: 100,
        enforce_geofence: true,
      };

      const result = validateGeofence(workplace, nearbyCoords, false);
      expect(result.allowed).toBe(true);
      expect(result.distance_meters).toBeLessThanOrEqual(100);
    });

    it('deve rejeitar marcação fora do raio permitido quando o geofence for obrigatório', () => {
      const workplace = {
        name: 'Sede Paulista',
        latitude: officeCoords.latitude,
        longitude: officeCoords.longitude,
        radius_meters: 100,
        enforce_geofence: true,
      };

      const result = validateGeofence(workplace, farCoords, false);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Fora do perímetro permitido de marcação de ponto');
    });

    it('deve permitir marcação em qualquer local quando o contrato for Teletrabalho / Externo', () => {
      const workplace = {
        name: 'Sede Paulista',
        latitude: officeCoords.latitude,
        longitude: officeCoords.longitude,
        radius_meters: 100,
        enforce_geofence: true,
      };

      const result = validateGeofence(workplace, farCoords, true); // isTelework = true
      expect(result.allowed).toBe(true);
      expect(result.is_telework).toBe(true);
    });
  });

  describe('2. Anti-duplicação (Debounce de batidas repetidas)', () => {
    it('deve rejeitar batida repetida realizada em menos de 60 segundos após a anterior', () => {
      const now = new Date('2026-10-14T08:00:30-03:00').getTime();
      const lastPunch = new Date('2026-10-14T08:00:00-03:00').getTime(); // 30 segundos atrás

      const result = validateRecentPunchDebounce(lastPunch, now, 60);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Marcação repetida recente');
    });

    it('deve permitir batida após decorrido o intervalo mínimo configurado', () => {
      const now = new Date('2026-10-14T08:02:00-03:00').getTime();
      const lastPunch = new Date('2026-10-14T08:00:00-03:00').getTime(); // 2 minutos atrás (> 60s)

      const result = validateRecentPunchDebounce(lastPunch, now, 60);
      expect(result.allowed).toBe(true);
    });
  });

  describe('3. Comprovante de Registro de Ponto do Trabalhador (Portaria 671)', () => {
    it('deve gerar comprovante com hash SHA-256, dados completos e payload de QR Code', () => {
      const receipt = generatePunchReceipt({
        nsr: 1050,
        punchedAt: '2026-10-14T08:00:00-03:00',
        companyName: 'CoupleRH Tecnologia Ltda',
        companyCnpj: '12.345.678/0001-95',
        workerName: 'Carlos Silva',
        workerCpf: '123.456.789-01',
      });

      expect(receipt.receipt_code).toMatch(/^[a-f0-9]{64}$/);
      expect(receipt.qr_code_payload).toContain('https://couplerh.com.br/verificar-ponto');
      expect(receipt.qr_code_payload).toContain('1050');
      expect(receipt.qr_code_payload).toContain('12345678000195');
      expect(receipt.qr_code_payload).toContain(receipt.receipt_code);
    });
  });

  describe('4. Processamento Completo da Batida Móvel', () => {
    const mockContext: MobilePunchContext = {
      tenant_id: 'tenant-123',
      company: {
        id: 'comp-1',
        name: 'Empresa Teste',
        cnpj: '12345678000195',
      },
      worker: {
        id: 'worker-1',
        name: 'Maria Oliveira',
        cpf: '98765432100',
      },
      contract: {
        id: 'contract-1',
        is_telework: false,
        workplace: {
          id: 'wp-1',
          name: 'Escritório Central',
          latitude: officeCoords.latitude,
          longitude: officeCoords.longitude,
          radius_meters: 100,
          enforce_geofence: true,
        },
      },
      serverTime: '2026-10-14T08:00:00-03:00',
      nextNsr: 2001,
      lastPunchTimestamp: undefined,
    };

    it('deve processar batida com sucesso, carimbando hora no servidor e gerando NSR sequencial', async () => {
      const input: MobilePunchInput = {
        contract_id: 'contract-1',
        geo: {
          latitude: nearbyCoords.latitude,
          longitude: nearbyCoords.longitude,
          accuracy: 10,
        },
        device_fingerprint: 'pwa-chrome-android-fingerprint-xyz',
        ip: '189.10.20.30',
      };

      const result = await processMobilePunch(input, mockContext);

      expect(result.success).toBe(true);
      expect(result.record).toBeDefined();
      expect(result.record?.nsr).toBe(2001);
      expect(result.record?.source).toBe('MOBILE');
      // A hora deve ser exatamente a do servidor (carimbo confiável)
      expect(result.record?.punched_at).toBe('2026-10-14T08:00:00-03:00');
      expect(result.receipt).toBeDefined();
      expect(result.receipt?.receipt_code).toBeDefined();
    });
  });

  describe('5. Validação da Migration 00078_time_punch_geofence_pt05.sql', () => {
    it('o script de migration deve existir e conter campos de geofence, teletrabalho e sequence', () => {
      const migrationPath = path.resolve(
        process.cwd(),
        'supabase/migrations/00078_time_punch_geofence_pt05.sql'
      );
      expect(fs.existsSync(migrationPath)).toBe(true);

      const sqlContent = fs.readFileSync(migrationPath, 'utf-8');
      expect(sqlContent).toContain('ALTER TABLE public.workplaces');
      expect(sqlContent).toContain('latitude');
      expect(sqlContent).toContain('longitude');
      expect(sqlContent).toContain('radius_meters');
      expect(sqlContent).toContain('enforce_geofence');
      expect(sqlContent).toContain('is_telework');
      expect(sqlContent).toContain('register_mobile_punch');
    });
  });
});
