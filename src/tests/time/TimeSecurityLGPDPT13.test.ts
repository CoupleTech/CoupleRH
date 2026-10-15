import { describe, it, expect } from 'vitest';
import {
  TimeSecurityService,
  LgpdConsentRecord
} from '../../services/timeTracking/timeSecurityService';

describe('FASE P5: PT-13 — Segurança da Informação e LGPD do Ponto Eletrônico (Portaria MTP 671 e Lei 13.709/2018)', () => {
  const mockTenantId = 'tenant-sec-111';
  const mockPersonId = 'person-sec-222';

  describe('1. Mascaramento e Privacidade de Dados Sensíveis e Pessoais', () => {
    it('deve mascarar CPF ocultando os dígitos extremos para privacidade', () => {
      const masked = TimeSecurityService.maskCpf('12345678901');
      expect(masked).toBe('***.456.789-**');

      const maskedFormatted = TimeSecurityService.maskCpf('123.456.789-01');
      expect(maskedFormatted).toBe('***.456.789-**');
    });

    it('deve mascarar PIS/PASEP preservando apenas parte intermediária', () => {
      const masked = TimeSecurityService.maskPis('12345678901');
      expect(masked).toBe('***.*****.90-*');
    });

    it('deve mascarar endereço IP preservando a sub-rede para auditoria sem invasão de privacidade', () => {
      const masked = TimeSecurityService.maskIpAddress('192.168.1.50');
      expect(masked).toBe('192.168.***.***');
    });

    it('deve truncar coordenadas de GPS residenciais para proteger a intimidade do domicílio', () => {
      const rawGeo = {
        latitude: -23.550520,
        longitude: -46.633308,
        accuracy: 10,
        address: 'Rua de Teste, 100'
      };

      const sanitized = TimeSecurityService.sanitizeGeoLocation(rawGeo, true);
      expect(sanitized.latitude).toBe(-23.551);
      expect(sanitized.longitude).toBe(-46.633);
      expect(sanitized.sanitized).toBe(true);
    });
  });

  describe('2. Gestão de Consentimento e Base Legal (LGPD Arts. 7º e 11)', () => {
    it('deve estruturar payload de consentimento para geolocalização mobile com data e finalidade', () => {
      const consent = TimeSecurityService.buildConsentPayload({
        tenant_id: mockTenantId,
        person_id: mockPersonId,
        category: 'TIME_TRACKING_GEOLOCATION',
        purpose: 'Comprovação de presença no local de trabalho para registro de ponto por exceção',
        ip_address: '189.40.100.2',
        device_info: 'Chrome Mobile / Android 14'
      });

      expect(consent.legal_basis).toBe('CONSENT');
      expect(consent.data_category).toBe('TIME_TRACKING_GEOLOCATION');
      expect(consent.granted_at).toBeDefined();
      expect(consent.revoked_at).toBeNull();
    });

    it('deve permitir a revogação de consentimento pelo titular (Direito LGPD Art. 8º §5º)', () => {
      const activeConsent: LgpdConsentRecord = {
        tenant_id: mockTenantId,
        person_id: mockPersonId,
        data_category: 'TIME_TRACKING_PHOTO_BIOMETRICS',
        processing_purpose: 'Reconhecimento facial para validação de identidade na batida de ponto',
        legal_basis: 'CONSENT',
        granted_at: '2026-01-10T08:00:00Z',
        revoked_at: null
      };

      const revoked = TimeSecurityService.revokeConsentPayload(activeConsent);
      expect(revoked.revoked_at).toBeDefined();
      expect(typeof revoked.revoked_at).toBe('string');
    });
  });

  describe('3. Ciclo de Vida e Políticas de Retenção de Dados (Data Lifecycle)', () => {
    it('deve exigir retenção de registros de ponto por no mínimo 60 meses (5 anos CLT/CF)', () => {
      // Registro com 2 anos de idade (24 meses) -> Deve ser retido
      const evaluationRecent = TimeSecurityService.evaluateRetention({
        domain: 'TIME_RECORDS',
        record_date: '2024-03-01',
        current_date: new Date('2026-03-01')
      });
      expect(evaluationRecent.is_expired).toBe(false);
      expect(evaluationRecent.recommended_action).toBe('RETAIN');
      expect(evaluationRecent.retention_months).toBe(60);

      // Registro com 6 anos de idade (72 meses) -> Expirou o prazo legal trabalhista
      const evaluationOld = TimeSecurityService.evaluateRetention({
        domain: 'TIME_RECORDS',
        record_date: '2020-01-01',
        current_date: new Date('2026-03-01')
      });
      expect(evaluationOld.is_expired).toBe(true);
      expect(evaluationOld.recommended_action).toBe('ANONYMIZE');
    });

    it('deve expirar logs de conexão após 6 meses conforme o Marco Civil da Internet', () => {
      const logRecent = TimeSecurityService.evaluateRetention({
        domain: 'CONNECTION_LOGS',
        record_date: '2026-01-01',
        current_date: new Date('2026-03-01')
      });
      expect(logRecent.is_expired).toBe(false);
      expect(logRecent.retention_months).toBe(6);

      const logExpired = TimeSecurityService.evaluateRetention({
        domain: 'CONNECTION_LOGS',
        record_date: '2025-06-01',
        current_date: new Date('2026-03-01')
      });
      expect(logExpired.is_expired).toBe(true);
      expect(logExpired.recommended_action).toBe('PURGE');
    });
  });

  describe('4. Controle de Acesso Baseado em Papéis (RBAC) e Isolamento Multitenant', () => {
    it('deve bloquear acesso imediatamente se pertencer a outro tenant', () => {
      const result = TimeSecurityService.enforceAccessControl({
        callerRole: 'tenant_admin',
        callerUserId: 'user-a',
        targetWorkerUserId: 'worker-b',
        isSameTenant: false // Cross-tenant violation
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Isolamento estrito multitenant');
    });

    it('colaborador comum só pode visualizar seus próprios registros de ponto', () => {
      // Tentativa de ver o próprio ponto: permitido
      const selfAccess = TimeSecurityService.enforceAccessControl({
        callerRole: 'employee',
        callerUserId: 'worker-100',
        targetWorkerUserId: 'worker-100',
        isSameTenant: true
      });
      expect(selfAccess.allowed).toBe(true);

      // Tentativa de ver o ponto de outro colaborador: bloqueado
      const otherAccess = TimeSecurityService.enforceAccessControl({
        callerRole: 'employee',
        callerUserId: 'worker-100',
        targetWorkerUserId: 'worker-200',
        isSameTenant: true
      });
      expect(otherAccess.allowed).toBe(false);
      expect(otherAccess.reason).toContain('só tem autorização para visualizar seus próprios registros');
    });

    it('gestor e analista de DP podem visualizar registros de colaboradores do tenant', () => {
      const dpAccess = TimeSecurityService.enforceAccessControl({
        callerRole: 'dp_analyst',
        callerUserId: 'dp-user',
        targetWorkerUserId: 'worker-any',
        isSameTenant: true
      });
      expect(dpAccess.allowed).toBe(true);

      const managerAccess = TimeSecurityService.enforceAccessControl({
        callerRole: 'manager',
        callerUserId: 'mgr-user',
        targetWorkerUserId: 'worker-any',
        isSameTenant: true
      });
      expect(managerAccess.allowed).toBe(true);
    });
  });
});
