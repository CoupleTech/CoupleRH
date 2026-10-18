/**
 * Rate Limiter - CoupleRH
 * Algoritmo Sliding Window Counter para controle de fluxo, prevenção contra ataques DoS/brute force
 * e proteção de endpoints críticos de Folha, Ponto e Assinaturas (Conforme §9 do Documento de Melhorias).
 */

export enum RateLimitPolicy {
  PAYROLL_ENGINE = 'PAYROLL_ENGINE',       // Cálculo do Motor de Folha: máx 10 recálculos/min por tenant
  TIME_PUNCH = 'TIME_PUNCH',               // Marcação de Ponto Mobile REP-P: máx 6 batidas/min por trabalhador (anti-flood/duplicidade)
  TIME_INGEST = 'TIME_INGEST',             // Ingestão de AFD/Relógio REP: máx 60 lotes/min por equipamento
  SIGN_DOCUMENT = 'SIGN_DOCUMENT',         // Assinatura Digital de Documentos: máx 10 assinaturas/min por usuário
  PUBLIC_VERIFICATION = 'PUBLIC_VERIFICATION' // Verificador Público de Hash/Doc: máx 30 consultas/min por IP
}

export interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  retryAfterSeconds: number;
}

interface WindowBucket {
  timestamps: number[];
}

export class RateLimiter {
  private buckets: Map<string, WindowBucket> = new Map();
  private lastCleanup: number = Date.now();

  /**
   * Consome 1 token na janela deslizante (Sliding Window) para a chave identificadora informada
   */
  consume(key: string, config: RateLimitConfig): RateLimitResult {
    this.maybeCleanup();

    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;
    const windowStart = now - windowMs;

    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { timestamps: [] };
      this.buckets.set(key, bucket);
    }

    // Filtra apenas timestamps dentro da janela atual
    bucket.timestamps = bucket.timestamps.filter((ts) => ts > windowStart);

    if (bucket.timestamps.length >= config.limit) {
      // Limite atingido: calcula quando a requisição mais antiga da janela irá expirar
      const oldestTs = bucket.timestamps[0];
      const expiryTime = oldestTs + windowMs;
      const retryAfterMs = Math.max(0, expiryTime - now);
      const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

      return {
        allowed: false,
        limit: config.limit,
        remaining: 0,
        resetSeconds: retryAfterSeconds,
        retryAfterSeconds: Math.max(1, retryAfterSeconds),
      };
    }

    // Permite a requisição e adiciona o timestamp atual
    bucket.timestamps.push(now);
    const remaining = config.limit - bucket.timestamps.length;
    const oldestTs = bucket.timestamps[0];
    const resetSeconds = Math.max(1, Math.ceil((oldestTs + windowMs - now) / 1000));

    return {
      allowed: true,
      limit: config.limit,
      remaining,
      resetSeconds,
      retryAfterSeconds: 0,
    };
  }

  /**
   * Retorna a política predefinida por endpoint crítico
   */
  static getPolicy(policy: RateLimitPolicy): RateLimitConfig {
    switch (policy) {
      case RateLimitPolicy.PAYROLL_ENGINE:
        return { limit: 10, windowSeconds: 60 };
      case RateLimitPolicy.TIME_PUNCH:
        return { limit: 6, windowSeconds: 60 };
      case RateLimitPolicy.TIME_INGEST:
        return { limit: 60, windowSeconds: 60 };
      case RateLimitPolicy.SIGN_DOCUMENT:
        return { limit: 10, windowSeconds: 60 };
      case RateLimitPolicy.PUBLIC_VERIFICATION:
      default:
        return { limit: 30, windowSeconds: 60 };
    }
  }

  /**
   * Gera os headers HTTP padronizados de Rate Limiting (RFC 6585)
   */
  static formatHeaders(result: RateLimitResult): Record<string, string> {
    const headers: Record<string, string> = {
      'X-RateLimit-Limit': String(result.limit),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(result.resetSeconds),
    };

    if (!result.allowed) {
      headers['Retry-After'] = String(result.retryAfterSeconds);
    }

    return headers;
  }

  /**
   * Limpeza periódica em memória de buckets ociosos para evitar vazamento de memória (Memory Leak)
   */
  private maybeCleanup() {
    const now = Date.now();
    // Executa limpeza no máximo a cada 5 minutos
    if (now - this.lastCleanup < 300000) return;

    this.lastCleanup = now;
    const maxWindow = 3600000; // 1 hora
    const cutoff = now - maxWindow;

    for (const [key, bucket] of this.buckets.entries()) {
      bucket.timestamps = bucket.timestamps.filter((ts) => ts > cutoff);
      if (bucket.timestamps.length === 0) {
        this.buckets.delete(key);
      }
    }
  }
}

// Instância singleton padrão para o frontend/serviços
export const globalRateLimiter = new RateLimiter();
