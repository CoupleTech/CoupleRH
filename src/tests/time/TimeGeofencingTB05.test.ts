import { describe, it, expect } from 'vitest';
import {
  calculateHaversineDistanceMeters,
  validateGeofence,
  type WorkplaceGeofenceConfig
} from '../../services/timeTracking/timeTrackingGeoService';

describe('TB-05: Geolocalização e Geofencing no Ponto Digital Mobile', () => {
  // Coordenadas de referência: Sede da Empresa (Ex: Av. Paulista, 1000, São Paulo)
  const companyHQ: WorkplaceGeofenceConfig = {
    name: 'Sede Paulista',
    latitude: -23.565700,
    longitude: -46.651500,
    radius_meters: 50,
    enforce_geofence: true
  };

  describe('1. Cálculo de Distância Geodésica (Fórmula de Haversine)', () => {
    it('deve retornar 0 metros para as mesmas coordenadas', () => {
      const dist = calculateHaversineDistanceMeters(
        companyHQ.latitude!,
        companyHQ.longitude!,
        companyHQ.latitude!,
        companyHQ.longitude!
      );
      expect(dist).toBe(0);
    });

    it('deve calcular com precisão métrica a distância entre pontos próximos', () => {
      // Ponto a cerca de ~20 metros de distância
      const userLat = -23.565850;
      const userLon = -46.651500;
      const dist = calculateHaversineDistanceMeters(
        companyHQ.latitude!,
        companyHQ.longitude!,
        userLat,
        userLon
      );
      expect(dist).toBeGreaterThan(15);
      expect(dist).toBeLessThan(25);
    });

    it('deve calcular distância maior corretamente (ex: ~1.5km)', () => {
      // Ponto na Consolação (~1.5 km de distância)
      const dist = calculateHaversineDistanceMeters(-23.5535, -46.6588, -23.5657, -46.6515);
      expect(dist).toBeGreaterThan(1400);
      expect(dist).toBeLessThan(1600);
    });
  });

  describe('2. Validação de Cerca Eletrônica (Geofence)', () => {
    it('deve AUTORIZAR marcação quando o colaborador estiver DENTRO do raio de tolerância (ex: 8m dentro de 50m)', () => {
      // ~8 metros de distância
      const userLat = -23.565760;
      const userLon = -46.651500;

      const result = validateGeofence({
        userLat,
        userLon,
        workplace: companyHQ,
        isTelework: false
      });

      expect(result.isAllowed).toBe(true);
      expect(result.status).toBe('INSIDE');
      expect(result.distanceMeters).toBeLessThanOrEqual(companyHQ.radius_meters);
      expect(result.message).toContain('autorizada');
    });

    it('deve BLOQUEAR marcação presencial quando o colaborador estiver FORA do raio configurado (ex: 85m com limite de 50m)', () => {
      // ~85 metros de distância
      const userLat = -23.566450;
      const userLon = -46.651500;

      const result = validateGeofence({
        userLat,
        userLon,
        workplace: companyHQ,
        isTelework: false
      });

      expect(result.isAllowed).toBe(false);
      expect(result.status).toBe('OUTSIDE');
      expect(result.distanceMeters).toBeGreaterThan(companyHQ.radius_meters);
      expect(result.message).toContain('Fora do perímetro autorizado');
      expect(result.message).toContain('Bloqueado');
    });

    it('deve AUTORIZAR marcação de colaborador em TELETRABALHO / Home Office mesmo fora do local físico', () => {
      // Colaborador a 50 km da sede da empresa
      const userLat = -23.100000;
      const userLon = -46.900000;

      const result = validateGeofence({
        userLat,
        userLon,
        workplace: companyHQ,
        isTelework: true
      });

      expect(result.isAllowed).toBe(true);
      expect(result.status).toBe('TELEWORK');
      expect(result.message).toContain('Teletrabalho');
    });

    it('deve AUTORIZAR marcação quando enforce_geofence for FALSO (apenas auditoria)', () => {
      const auditWorkplace: WorkplaceGeofenceConfig = {
        ...companyHQ,
        enforce_geofence: false
      };

      // Fora do raio
      const userLat = -23.567000;
      const userLon = -46.651500;

      const result = validateGeofence({
        userLat,
        userLon,
        workplace: auditWorkplace,
        isTelework: false
      });

      expect(result.isAllowed).toBe(true);
      expect(result.status).toBe('AUDIT_ONLY');
      expect(result.message).toContain('informativo');
    });

    it('deve BLOQUEAR quando o GPS não for capturado e enforce_geofence for obrigatório', () => {
      const result = validateGeofence({
        userLat: null,
        userLon: null,
        workplace: companyHQ,
        isTelework: false
      });

      expect(result.isAllowed).toBe(false);
      expect(result.status).toBe('NO_GPS');
      expect(result.message).toContain('GPS');
    });
  });
});
