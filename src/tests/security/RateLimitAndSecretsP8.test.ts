import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  RateLimiter,
  RateLimitConfig,
  RateLimitPolicy,
} from '../../services/security/rateLimiter';
import { SecretRotationService } from '../../services/security/secretRotationService';

describe('FASE P8: Rate Limiting, Rotação de Segredos e Governança de Infraestrutura', () => {
  describe('1. Rate Limiting com Sliding Window (Prevenção contra Abuso e DoS)', () => {
    let limiter: RateLimiter;

    beforeEach(() => {
      limiter = new RateLimiter();
    });

    it('deve permitir requisições enquanto o limite não for excedido', () => {
      const config: RateLimitConfig = {
        limit: 3,
        windowSeconds: 60,
      };

      // 1ª chamada
      const res1 = limiter.consume('client-ip-123', config);
      expect(res1.allowed).toBe(true);
      expect(res1.remaining).toBe(2);
      expect(res1.limit).toBe(3);

      // 2ª chamada
      const res2 = limiter.consume('client-ip-123', config);
      expect(res2.allowed).toBe(true);
      expect(res2.remaining).toBe(1);

      // 3ª chamada
      const res3 = limiter.consume('client-ip-123', config);
      expect(res3.allowed).toBe(true);
      expect(res3.remaining).toBe(0);
    });

    it('deve bloquear a 4ª requisição com 429 Too Many Requests quando limite = 3', () => {
      const config: RateLimitConfig = {
        limit: 3,
        windowSeconds: 60,
      };

      limiter.consume('user-456', config);
      limiter.consume('user-456', config);
      limiter.consume('user-456', config);

      // 4ª chamada: deve ser bloqueada
      const blocked = limiter.consume('user-456', config);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
      expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
    });

    it('deve manter o isolamento estrito entre diferentes identificadores (IPs/Users)', () => {
      const config: RateLimitConfig = { limit: 2, windowSeconds: 60 };

      // Esgota a cota do Usuário A
      limiter.consume('user-A', config);
      limiter.consume('user-A', config);
      const blockedA = limiter.consume('user-A', config);
      expect(blockedA.allowed).toBe(false);

      // Usuário B ainda deve ter cota cheia
      const userB = limiter.consume('user-B', config);
      expect(userB.allowed).toBe(true);
      expect(userB.remaining).toBe(1);
    });

    it('deve aplicar políticas predefinidas por endpoint crítico (Cálculo de Folha, Ponto Mobile e Ingestão)', () => {
      const policyFolha = RateLimiter.getPolicy(RateLimitPolicy.PAYROLL_ENGINE);
      expect(policyFolha.limit).toBe(10); // Máx 10 cálculos por minuto por tenant
      expect(policyFolha.windowSeconds).toBe(60);

      const policyPunch = RateLimiter.getPolicy(RateLimitPolicy.TIME_PUNCH);
      expect(policyPunch.limit).toBe(6); // Máx 6 batidas por minuto por trabalhador (anti-duplicação)

      const policyPublic = RateLimiter.getPolicy(RateLimitPolicy.PUBLIC_VERIFICATION);
      expect(policyPublic.limit).toBe(30); // Máx 30 consultas públicas por minuto por IP
    });

    it('deve resetar o contador e liberar novas requisições após a expiração da janela', () => {
      vi.useFakeTimers();
      const config: RateLimitConfig = { limit: 1, windowSeconds: 10 };

      // 1ª chamada: OK
      expect(limiter.consume('client-timer', config).allowed).toBe(true);
      // 2ª chamada imediata: Bloqueado
      expect(limiter.consume('client-timer', config).allowed).toBe(false);

      // Avança o tempo em 11 segundos
      vi.advanceTimersByTime(11000);

      // Nova chamada: Deve ser permitida novamente
      const afterExpiry = limiter.consume('client-timer', config);
      expect(afterExpiry.allowed).toBe(true);
      expect(afterExpiry.remaining).toBe(0);

      vi.useRealTimers();
    });
  });

  describe('2. Rotação de Segredos e Gestão de Chaves Criptográficas', () => {
    it('deve gerar nova API Key criptográfica de alta entropia para coletores de ponto REP', async () => {
      const key1 = await SecretRotationService.generateSecureApiKey();
      const key2 = await SecretRotationService.generateSecureApiKey();

      expect(key1.plainKey).toHaveLength(64); // Chave hexadecimal de 256 bits
      expect(key2.plainKey).toHaveLength(64);
      expect(key1.plainKey).not.toBe(key2.plainKey);
      expect(key1.keyHash).toHaveLength(64); // SHA-256 hash
    });

    it('deve validar correspondência correta entre a plain key e o hash armazenado', async () => {
      const { plainKey, keyHash } = await SecretRotationService.generateSecureApiKey();

      const isValid = await SecretRotationService.verifyApiKey(plainKey, keyHash);
      expect(isValid).toBe(true);

      const isInvalid = await SecretRotationService.verifyApiKey('chave-adulterada-123', keyHash);
      expect(isInvalid).toBe(false);
    });

    it('deve rotacionar chave de dispositivo gerando payload de auditoria', async () => {
      const currentHash = 'hash-antigo-1234567890';
      const rotation = await SecretRotationService.rotateDeviceCredentials({
        deviceId: 'device-rep-01',
        tenantId: 'tenant-001',
        currentHash,
        rotationReason: 'Rotação periódica trimestral de segurança',
      });

      expect(rotation.newPlainKey).toBeDefined();
      expect(rotation.newKeyHash).toBeDefined();
      expect(rotation.newKeyHash).not.toBe(currentHash);
      expect(rotation.revocationLog.previous_hash).toBe(currentHash);
      expect(rotation.revocationLog.reason).toBe('Rotação periódica trimestral de segurança');
      expect(rotation.revocationLog.rotated_at).toBeDefined();
    });

    it('deve auditar e validar política de rotação de segredos (JWT e Service Role)', () => {
      const policy = SecretRotationService.getSecretPolicy('JWT_SECRET');
      expect(policy.maxAgeDays).toBe(90);
      expect(policy.recommendation).toContain('90 dias');

      const serviceRolePolicy = SecretRotationService.getSecretPolicy('SUPABASE_SERVICE_ROLE_KEY');
      expect(serviceRolePolicy.maxAgeDays).toBe(180);
      expect(serviceRolePolicy.allowedLocations).not.toContain('frontend');
      expect(serviceRolePolicy.allowedLocations).toContain('edge_functions');
    });
  });

  describe('3. Governança de Infraestrutura e Recuperação de Desastres (PITR)', () => {
    it('deve validar métricas de RPO (< 5 min) e RTO (< 60 min) do plano de continuidade', () => {
      const drMetrics = SecretRotationService.getDisasterRecoveryParameters();
      expect(drMetrics.rpoMinutes).toBeLessThanOrEqual(5); // Recovery Point Objective
      expect(drMetrics.rtoMinutes).toBeLessThanOrEqual(60); // Recovery Time Objective
      expect(drMetrics.backupType).toBe('CONTINUOUS_WAL_PITR');
      expect(drMetrics.retentionDays).toBeGreaterThanOrEqual(7);
    });
  });
});
