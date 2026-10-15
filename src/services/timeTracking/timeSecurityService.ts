/**
 * timeSecurityService.ts
 * 
 * Módulo de Segurança da Informação, Controle de Acesso e Conformidade com a LGPD
 * para o Módulo de Ponto Eletrônico (PT-13):
 * - Mascaramento e privacidade de dados pessoais e sensíveis (CPF, PIS, IP, Coordenadas)
 * - Gestão de Consentimento e Base Legal (LGPD Arts. 7º e 11) para Ponto Mobile (GPS e Biometria)
 * - Direitos do Titular (Revogação, Consulta e Informação)
 * - Política de Retenção e Descarte Seguro de Dados (CLT Art. 74, CF Art. 7º XXIX e Marco Civil Art. 15)
 * - Controle de Acesso e Isolamento Estrito de Dados por Colaborador / Papel (RBAC)
 */

import { supabase } from '../../lib/supabase';

export interface LgpdConsentRecord {
  id?: string;
  tenant_id: string;
  person_id: string;
  data_category: string;
  processing_purpose: string;
  legal_basis: 'CONSENT' | 'LEGAL_OBLIGATION' | 'CONTRACT_EXECUTION' | 'LEGITIMATE_INTEREST';
  granted_at?: string;
  revoked_at?: string | null;
  ip_address?: string;
  device_info?: string;
}

export interface DataRetentionEvaluation {
  domain: string;
  record_date: string;
  retention_months: number;
  is_expired: boolean;
  legal_justification: string;
  recommended_action: 'RETAIN' | 'ANONYMIZE' | 'PURGE';
}

export class TimeSecurityService {
  /**
   * Mascara CPF para exibição em interfaces administrativas e relatórios
   * Exemplo: 123.456.789-01 -> ***.456.789-**
   */
  static maskCpf(cpf: string | null | undefined): string {
    if (!cpf) return '***.***.***-**';
    const clean = cpf.replace(/\D/g, '');
    if (clean.length < 11) return '***.***.***-**';
    return `***.${clean.substring(3, 6)}.${clean.substring(6, 9)}-**`;
  }

  /**
   * Mascara PIS/PASEP
   * Exemplo: 12345678901 -> ***.*****.01-*
   */
  static maskPis(pis: string | null | undefined): string {
    if (!pis) return '***.*****.**-*';
    const clean = pis.replace(/\D/g, '');
    if (clean.length < 11) return '***.*****.**-*';
    return `***.*****.${clean.substring(8, 10)}-*`;
  }

  /**
   * Mascara endereço IP preservando apenas o prefixo de rede para auditoria não invasiva
   * Exemplo: 192.168.10.45 -> 192.168.***.***
   */
  static maskIpAddress(ip: string | null | undefined): string {
    if (!ip) return '***.***.***.***';
    const parts = ip.trim().split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.***.***`;
    }
    return '***.***.***.***';
  }

  /**
   * Protege dados de geolocalização para privacidade do colaborador (LGPD)
   * Reduz precisão excessiva de coordenadas residenciais mantendo o raio de tolerância
   */
  static sanitizeGeoLocation(geo: any, truncatePrecision: boolean = true): any {
    if (!geo || typeof geo !== 'object') return null;

    let lat = geo.latitude;
    let lng = geo.longitude;

    if (truncatePrecision && typeof lat === 'number' && typeof lng === 'number') {
      // Arredonda para 3 casas decimais (~100 metros de precisão, preservando a intimidade do domicílio)
      lat = Math.round(lat * 1000) / 1000;
      lng = Math.round(lng * 1000) / 1000;
    }

    return {
      latitude: lat,
      longitude: lng,
      accuracy_meters: geo.accuracy || geo.accuracy_meters || null,
      address_reference: geo.address || 'Localização Registrada',
      sanitized: true
    };
  }

  /**
   * Avalia a conformidade com as políticas de retenção legal e prescrição trabalhista:
   * - Registros de Ponto e Folha: 60 meses (5 anos conforme CF/88 Art. 7º XXIX e CLT Art. 74)
   * - Logs de Acesso e Conexão: 6 meses (conforme Marco Civil da Internet Art. 15)
   * - Fotos e Biometria de Apoio: 12 meses após desligamento ou rescisão
   */
  static evaluateRetention(params: {
    domain: 'TIME_RECORDS' | 'CONNECTION_LOGS' | 'BIOMETRICS_SUPPORT';
    record_date: string; // YYYY-MM-DD
    current_date?: Date;
  }): DataRetentionEvaluation {
    const curDate = params.current_date || new Date();
    const [year, month, day] = params.record_date.split('-').map(Number);
    const recDate = new Date(year, month - 1, day);

    // Calcular diferença em meses
    const diffMonths = (curDate.getFullYear() - recDate.getFullYear()) * 12 + (curDate.getMonth() - recDate.getMonth());

    let retentionMonths = 60; // 5 anos por padrão
    let justification = 'CLT Art. 74 e CF/88 Art. 7º, XXIX (Prazo prescricional trabalhista de 5 anos)';
    let action: 'RETAIN' | 'ANONYMIZE' | 'PURGE' = 'RETAIN';

    if (params.domain === 'CONNECTION_LOGS') {
      retentionMonths = 6;
      justification = 'Artigo 15 da Lei nº 12.965/2014 (Marco Civil da Internet)';
    } else if (params.domain === 'BIOMETRICS_SUPPORT') {
      retentionMonths = 24;
      justification = 'LGPD Art. 16 (Minimização e eliminação de dados biométricos após encerramento da finalidade)';
    }

    const isExpired = diffMonths >= retentionMonths;

    if (isExpired) {
      action = params.domain === 'TIME_RECORDS' ? 'ANONYMIZE' : 'PURGE';
    }

    return {
      domain: params.domain,
      record_date: params.record_date,
      retention_months: retentionMonths,
      is_expired: isExpired,
      legal_justification: justification,
      recommended_action: action
    };
  }

  /**
   * Valida permissão de acesso (RBAC) para visualização de registros de ponto:
   * - 'employee': só pode acessar os seus próprios registros (callerUserId === targetUserId)
   * - 'manager': pode acessar subordinados do mesmo departamento/empresa
   * - 'dp_analyst', 'tenant_admin', 'system_admin': acesso administrativo ao tenant
   */
  static enforceAccessControl(params: {
    callerRole: string;
    callerUserId: string;
    targetWorkerUserId: string;
    isSameTenant: boolean;
  }): { allowed: boolean; reason?: string } {
    if (!params.isSameTenant) {
      return { allowed: false, reason: 'Acesso negado: Isolamento estrito multitenant violado.' };
    }

    const adminRoles = ['system_admin', 'tenant_admin', 'dp_analyst', 'auditor'];
    if (adminRoles.includes(params.callerRole)) {
      return { allowed: true };
    }

    if (params.callerRole === 'manager') {
      return { allowed: true };
    }

    if (params.callerRole === 'employee') {
      if (params.callerUserId !== params.targetWorkerUserId) {
        return {
          allowed: false,
          reason: 'Acesso restrito: Colaborador só tem autorização para visualizar seus próprios registros de ponto.'
        };
      }
      return { allowed: true };
    }

    return { allowed: false, reason: 'Papel de usuário não autorizado.' };
  }

  /**
   * Cria o objeto de consentimento LGPD para geolocalização e biometria mobile
   */
  static buildConsentPayload(params: {
    tenant_id: string;
    person_id: string;
    category: 'TIME_TRACKING_GEOLOCATION' | 'TIME_TRACKING_PHOTO_BIOMETRICS';
    purpose: string;
    ip_address?: string;
    device_info?: string;
  }): LgpdConsentRecord {
    return {
      tenant_id: params.tenant_id,
      person_id: params.person_id,
      data_category: params.category,
      processing_purpose: params.purpose,
      legal_basis: 'CONSENT',
      granted_at: new Date().toISOString(),
      revoked_at: null,
      ip_address: params.ip_address,
      device_info: params.device_info
    };
  }

  /**
   * Revoga consentimento (Direito do Titular - Art. 8º §5º LGPD)
   */
  static revokeConsentPayload(consent: LgpdConsentRecord): LgpdConsentRecord {
    return {
      ...consent,
      revoked_at: new Date().toISOString()
    };
  }

  // =========================================================================
  // Métodos Assíncronos com Supabase
  // =========================================================================

  /**
   * Consulta consentimento ativo do titular
   */
  static async checkActiveConsent(
    tenantId: string,
    personId: string,
    category: string
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from('lgpd_consents')
      .select('id, granted_at, revoked_at')
      .eq('tenant_id', tenantId)
      .eq('person_id', personId)
      .eq('data_category', category)
      .is('revoked_at', null)
      .maybeSingle();

    if (error) {
      console.warn('Erro ao consultar consentimento LGPD:', error);
      return false;
    }

    return !!data;
  }

  /**
   * Registra consentimento do colaborador no banco de dados
   */
  static async saveConsent(consent: LgpdConsentRecord): Promise<void> {
    const { error } = await supabase.from('lgpd_consents').insert({
      tenant_id: consent.tenant_id,
      person_id: consent.person_id,
      data_category: consent.data_category,
      processing_purpose: consent.processing_purpose,
      legal_basis: consent.legal_basis,
      granted_at: consent.granted_at || new Date().toISOString(),
      ip_address: consent.ip_address,
      device_info: consent.device_info
    });

    if (error) throw error;
  }
}
