/**
 * Secret Rotation & Infrastructure Governance Service - CoupleRH
 * Governança de Credenciais, Rotação de Segredos Criptográficos e Parâmetros de Continuidade de Negócios (PITR)
 * em conformidade com o §9 do Documento de Melhorias de Produção.
 */

import { supabase } from '../../lib/supabase';

export interface DeviceApiKeyRotationResult {
  deviceId: string;
  newPlainKey: string;
  newKeyHash: string;
  revocationLog: {
    previous_hash: string;
    rotated_at: string;
    reason: string;
  };
}

export interface SecretPolicy {
  secretName: string;
  maxAgeDays: number;
  allowedLocations: string[];
  recommendation: string;
}

export interface DisasterRecoveryParameters {
  rpoMinutes: number;         // Recovery Point Objective (tempo máximo tolerável de perda de dados)
  rtoMinutes: number;         // Recovery Time Objective (tempo máximo tolerável para restauração total)
  backupType: string;         // 'CONTINUOUS_WAL_PITR' | 'DAILY_SNAPSHOT'
  retentionDays: number;      // Período de retenção de snapshots e WAL
  automatedFailover: boolean;
  drillFrequencyDays: number; // Frequência recomendada de simulação de restauração
}

export class SecretRotationService {
  /**
   * Gera uma API Key segura de 256 bits (64 caracteres hexadecimais) via CSPRNG
   */
  static async generateSecureApiKey(): Promise<{ plainKey: string; keyHash: string }> {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const plainKey = Array.from(randomBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const keyHash = await this.hashApiKey(plainKey);
    return { plainKey, keyHash };
  }

  /**
   * Calcula o hash SHA-256 de uma chave para persistência segura no banco
   */
  static async hashApiKey(plainKey: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(plainKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Verifica se uma chave em texto claro corresponde ao hash SHA-256 armazenado
   */
  static async verifyApiKey(plainKey: string, storedHash: string): Promise<boolean> {
    const computedHash = await this.hashApiKey(plainKey);
    return computedHash === storedHash;
  }

  /**
   * Rotaciona as credenciais de um dispositivo coletor REP (Control iD ou Ponto Mobile)
   */
  static async rotateDeviceCredentials(params: {
    deviceId: string;
    tenantId: string;
    currentHash: string;
    rotationReason?: string;
  }): Promise<DeviceApiKeyRotationResult> {
    const { plainKey, keyHash } = await this.generateSecureApiKey();

    const revocationLog = {
      previous_hash: params.currentHash,
      rotated_at: new Date().toISOString(),
      reason: params.rotationReason || 'Rotação periódica de credenciais de equipamento',
    };

    return {
      deviceId: params.deviceId,
      newPlainKey: plainKey,
      newKeyHash: keyHash,
      revocationLog,
    };
  }

  /**
   * Executa a rotação de chave de dispositivo diretamente no banco Supabase
   */
  static async executeDeviceApiKeyRotationInDb(deviceId: string, reason?: string) {
    // 1. Busca dispositivo atual
    const { data: device, error: fetchErr } = await supabase
      .from('time_devices')
      .select('id, tenant_id, api_key_hash')
      .eq('id', deviceId)
      .single();

    if (fetchErr || !device) {
      throw new Error('Dispositivo não encontrado: ' + (fetchErr?.message || 'ID inválido'));
    }

    // 2. Gera novo par de chaves
    const rotation = await this.rotateDeviceCredentials({
      deviceId: device.id,
      tenantId: device.tenant_id,
      currentHash: device.api_key_hash || 'SEM_HASH_ANTERIOR',
      rotationReason: reason,
    });

    // 3. Atualiza no banco
    const { error: updateErr } = await supabase
      .from('time_devices')
      .update({
        api_key_hash: rotation.newKeyHash,
        last_sync_at: new Date().toISOString(),
      })
      .eq('id', deviceId);

    if (updateErr) {
      throw new Error('Erro ao atualizar chave do dispositivo no banco: ' + updateErr.message);
    }

    return {
      success: true,
      deviceId,
      newPlainKey: rotation.newPlainKey,
      notice: 'ATENÇÃO: A nova API Key é exibida apenas uma vez. Atualize a configuração do coletor local imediatamente.',
    };
  }

  /**
   * Retorna a política oficial de rotação por tipo de segredo corporativo
   */
  static getSecretPolicy(secretName: 'JWT_SECRET' | 'SUPABASE_SERVICE_ROLE_KEY' | 'SUPABASE_ANON_KEY' | 'DB_PASSWORD'): SecretPolicy {
    switch (secretName) {
      case 'JWT_SECRET':
        return {
          secretName,
          maxAgeDays: 90,
          allowedLocations: ['backend_auth_provider'],
          recommendation: 'Rotacionar a cada 90 dias ou imediatamente após suspeita de comprometimento de credenciais.',
        };
      case 'SUPABASE_SERVICE_ROLE_KEY':
        return {
          secretName,
          maxAgeDays: 180,
          allowedLocations: ['edge_functions', 'ci_cd_deployment_secrets'],
          recommendation: 'Segredo de máximo privilégio. Proibido em bundles de frontend. Rotacionar a cada 180 dias.',
        };
      case 'DB_PASSWORD':
        return {
          secretName,
          maxAgeDays: 90,
          allowedLocations: ['connection_pooler', 'encrypted_vault'],
          recommendation: 'Rotacionar senha do pooler/PostgreSQL a cada 90 dias com zero downtime via credencial secundária.',
        };
      case 'SUPABASE_ANON_KEY':
      default:
        return {
          secretName: 'SUPABASE_ANON_KEY',
          maxAgeDays: 365,
          allowedLocations: ['frontend', 'mobile_pwa'],
          recommendation: 'Chave pública com proteção garantida pelas políticas RLS (Row Level Security) do PostgreSQL.',
        };
    }
  }

  /**
   * Retorna as métricas e parâmetros oficiais do Plano de Recuperação de Desastres (PITR)
   */
  static getDisasterRecoveryParameters(): DisasterRecoveryParameters {
    return {
      rpoMinutes: 5,                  // Ponto de recuperação: no máximo 5 minutos de perda de dados
      rtoMinutes: 60,                 // Tempo de restauração: sistema restabelecido em até 1 hora
      backupType: 'CONTINUOUS_WAL_PITR', // Write-Ahead Logging Contínuo (Point-In-Time Recovery)
      retentionDays: 7,               // Janela contínua de 7 a 30 dias para restauração a qualquer segundo
      automatedFailover: true,
      drillFrequencyDays: 90,         // Simulação periódica trimestral de restauração (Restore Drill)
    };
  }
}
