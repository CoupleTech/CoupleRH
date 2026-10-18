/**
 * LGPD Service - CoupleRH
 * Módulo de Governança de Dados, Direitos do Titular e Conformidade com a LGPD (Lei nº 13.709/2018)
 * e Legislação Trabalhista Brasileira (CLT, CF Art. 7º XXIX, Portaria MTP 671/2021 e Normas Regulamentadoras)
 */

import { supabase } from '../../lib/supabase';

export enum LgpdLegalBasis {
  CONSENT = 'CONSENT',                               // Art. 7º, I (Consentimento do titular)
  LEGAL_OBLIGATION = 'LEGAL_OBLIGATION',             // Art. 7º, II (Cumprimento de obrigação legal ou regulatória - ex: CLT, eSocial)
  CONTRACT_EXECUTION = 'CONTRACT_EXECUTION',         // Art. 7º, V (Execução de contrato de trabalho ou procedimentos preliminares)
  LEGITIMATE_INTEREST = 'LEGITIMATE_INTEREST',       // Art. 7º, IX (Interesse legítimo do controlador)
  REGULAR_EXERCISE_RIGHTS = 'REGULAR_EXERCISE_RIGHTS'// Art. 7º, VI (Exercício regular de direitos em processo judicial ou administrativo)
}

export enum LgpdRequestType {
  ACCESS_DATA = 'ACCESS_DATA',               // Art. 18, II (Acesso aos dados)
  CONFIRMATION = 'CONFIRMATION',             // Art. 18, I (Confirmação da existência de tratamento)
  CORRECTION = 'CORRECTION',                 // Art. 18, III (Correção de dados incompletos, inexatos ou desatualizados)
  ANONYMIZATION = 'ANONYMIZATION',           // Art. 18, IV (Anonimização, bloqueio ou eliminação)
  PORTABILITY = 'PORTABILITY',               // Art. 18, V (Portabilidade dos dados)
  REVOCATION_CONSENT = 'REVOCATION_CONSENT'  // Art. 18, IX (Revogação do consentimento)
}

export enum RetentionDomain {
  PAYROLL = 'PAYROLL',                     // Folha de pagamento, holerites, rescisões (5 anos - CF Art. 7º XXIX / CLT Art. 11)
  TIME_TRACKING = 'TIME_TRACKING',         // Cartões de ponto, AFD, AEJ (5 anos - Portaria MTP 671/2021)
  SST_HEALTH = 'SST_HEALTH',               // Atestados médicos, ASO, PCMSO, LTCAT (20 anos - NR-7 / Portaria SEPRT 6.734)
  FGTS_PREVIDENCIA = 'FGTS_PREVIDENCIA',   // Guias de recolhimento FGTS e histórico previdenciário (30 anos - Súmula 362 TST)
  SYSTEM_LOGS = 'SYSTEM_LOGS'              // Logs de acesso e conexão (6 meses - Art. 15 Marco Civil da Internet)
}

export interface RetentionPolicy {
  domain: RetentionDomain;
  title: string;
  retentionPeriodMonths: number;
  legalBasis: string;
  description: string;
}

export interface LgpdConsentEntity {
  id?: string;
  tenant_id: string;
  person_id: string;
  data_category: string;
  processing_purpose: string;
  legal_basis: string;
  granted_at?: string;
  revoked_at?: string | null;
  revocation_reason?: string | null;
  ip_address?: string | null;
  device_info?: string | null;
}

export interface LgpdSubjectRequestEntity {
  id?: string;
  tenant_id: string;
  worker_id: string;
  request_type: LgpdRequestType;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED';
  justification?: string;
  response_notes?: string;
  requested_at?: string;
  responded_at?: string;
  responded_by?: string;
}

export interface EmployeeDossierData {
  person: {
    full_name: string;
    cpf: string;
    birth_date?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  contract: {
    registration_number: string;
    admission_date: string;
    position: string;
    department: string;
    salary: number;
  };
  consents?: Array<{
    data_category: string;
    purpose: string;
    granted_at?: string;
    revoked_at?: string | null;
  }>;
  dataSharing?: Array<{
    recipient: string;
    purpose: string;
    legal_basis: string;
  }>;
  leavesSummary?: number;
  signedDocumentsCount?: number;
}

export interface DossierExport {
  generatedAt: string;
  titular: {
    nomeCompleto: string;
    cpfMascarado: string;
    dataNascimento?: string;
    emailMascarado?: string;
    telefoneMascarado?: string;
  };
  contrato: {
    matricula: string;
    dataAdmissao: string;
    cargo: string;
    departamento: string;
  };
  consentimentos: Array<{
    categoria: string;
    finalidade: string;
    dataConcessao?: string;
    status: 'ATIVO' | 'REVOGADO';
  }>;
  compartilhamentos: Array<{
    destinatario: string;
    finalidade: string;
    baseLegal: string;
  }>;
  observacoesLegais: string;
}

export class LGPDService {
  /**
   * Mascara CPF mantendo o bloco central (***.XXX.XXX-**) para conferência sem expor o titular
   */
  static maskCpf(cpf: string): string {
    if (!cpf) return '';
    const clean = cpf.replace(/\D/g, '');
    if (clean.length !== 11) return '***';
    return `***.${clean.substring(3, 6)}.${clean.substring(6, 9)}-**`;
  }

  /**
   * Mascara PIS/PASEP (***.XXXXX.**-*)
   */
  static maskPis(pis: string): string {
    if (!pis) return '';
    const clean = pis.replace(/\D/g, '');
    if (clean.length < 10) return '***';
    return `***.${clean.substring(3, 8)}.**-*`;
  }

  /**
   * Mascara número de Conta Bancária preservando os últimos dígitos
   */
  static maskBankAccount(account: string): string {
    if (!account) return '';
    const trimmed = account.trim();
    if (trimmed.length <= 4) return '***';
    const visibleLength = Math.min(4, trimmed.length - 2);
    const maskedLength = trimmed.length - visibleLength;
    return '*'.repeat(maskedLength) + trimmed.slice(-visibleLength);
  }

  /**
   * Mascara agência bancária
   */
  static maskBankAgency(agency: string): string {
    if (!agency) return '';
    const trimmed = agency.trim();
    if (trimmed.length <= 2) return '**';
    return '**' + trimmed.slice(-2);
  }

  /**
   * Mascara endereço de e-mail (ex: c***a@dominio.com)
   */
  static maskEmail(email: string): string {
    if (!email || !email.includes('@')) return '***';
    const [user, domain] = email.split('@');
    if (user.length <= 2) {
      return `${user[0]}***@${domain}`;
    }
    return `${user[0]}***${user[user.length - 1]}@${domain}`;
  }

  /**
   * Mascara número de telefone preservando DDD e últimos 4 dígitos
   */
  static maskPhone(phone: string): string {
    if (!phone) return '';
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 10) return '***';
    const ddd = clean.substring(0, 2);
    const lastDigits = clean.slice(-4);
    return `(${ddd}) 9****-${lastDigits}`;
  }

  /**
   * Sanitiza dados médicos de atestados e afastamentos (CID-10).
   * Conforme Resolução CFM nº 1.851/2008 e Art. 11 da LGPD, o diagnóstico médico (CID)
   * é estritamente sigiloso e só pode ser visualizado por especialista em SST ou médico do trabalho.
   */
  static sanitizeMedicalData(medicalRecord: any, userRole: string): any {
    if (!medicalRecord) return medicalRecord;
    const isMedicalAuthorized = userRole === 'sst_specialist' || userRole === 'system_admin';

    if (isMedicalAuthorized) {
      return { ...medicalRecord };
    }

    return {
      ...medicalRecord,
      cid_code: '[DADO MÉDICO RESTRITO - ART. 11 LGPD]',
      cid_description: '[CONFIDENCIALIDADE MÉDICA - RESOLUÇÃO CFM]',
    };
  }

  /**
   * Cria registro de consentimento explícito
   */
  static createConsentRecord(params: {
    tenant_id: string;
    person_id: string;
    data_category: string;
    processing_purpose: string;
    legal_basis: string;
    ip_address?: string;
    device_info?: string;
  }): LgpdConsentEntity {
    return {
      tenant_id: params.tenant_id,
      person_id: params.person_id,
      data_category: params.data_category,
      processing_purpose: params.processing_purpose,
      legal_basis: params.legal_basis || LgpdLegalBasis.CONSENT,
      granted_at: new Date().toISOString(),
      revoked_at: null,
      revocation_reason: null,
      ip_address: params.ip_address || null,
      device_info: params.device_info || null,
    };
  }

  /**
   * Revoga consentimento (Direito do Titular - Art. 8º §5º LGPD)
   */
  static revokeConsent(consent: LgpdConsentEntity, reason?: string): LgpdConsentEntity {
    return {
      ...consent,
      revoked_at: new Date().toISOString(),
      revocation_reason: reason || 'Revogação expressa realizada pelo titular',
    };
  }

  /**
   * Retorna a política de retenção legal por domínio de dados
   */
  static getRetentionPolicy(domain: RetentionDomain): RetentionPolicy {
    switch (domain) {
      case RetentionDomain.PAYROLL:
        return {
          domain,
          title: 'Folha de Pagamento e Holerites',
          retentionPeriodMonths: 60, // 5 anos
          legalBasis: 'Art. 7º, XXIX da CF e Art. 11 da CLT (Prazo Prescricional Trabalhista)',
          description: 'Recibos de salário, férias, rescisões e comprovação de recolhimentos previdenciários e fiscais.',
        };
      case RetentionDomain.TIME_TRACKING:
        return {
          domain,
          title: 'Ponto Eletrônico e Jornadas',
          retentionPeriodMonths: 60, // 5 anos
          legalBasis: 'Portaria MTP 671/2021 e Art. 74 da CLT',
          description: 'Marcações de ponto originais, arquivos AFD, relatórios AEJ e espelhos de ponto assinados.',
        };
      case RetentionDomain.SST_HEALTH:
        return {
          domain,
          title: 'Saúde Ocupacional e Segurança do Trabalho',
          retentionPeriodMonths: 240, // 20 anos
          legalBasis: 'Norma Regulamentadora nº 7 (NR-7) item 7.5.17 e NR-9',
          description: 'Prontuários médicos, ASOs, LTCAT e dados do Perfil Profissiográfico Previdenciário (PPP).',
        };
      case RetentionDomain.FGTS_PREVIDENCIA:
        return {
          domain,
          title: 'Histórico de FGTS e Vínculos Previdenciários',
          retentionPeriodMonths: 360, // 30 anos
          legalBasis: 'Súmula 362 do TST e Regra de Transição ARE 709.212/STF',
          description: 'Documentação histórica para fins de aposentadoria e comprovação de depósitos fundiários.',
        };
      case RetentionDomain.SYSTEM_LOGS:
      default:
        return {
          domain: RetentionDomain.SYSTEM_LOGS,
          title: 'Logs de Conexão e Acesso',
          retentionPeriodMonths: 6, // 6 meses
          legalBasis: 'Art. 15 da Lei nº 12.965/2014 (Marco Civil da Internet)',
          description: 'Registros de data, hora e endereço IP das conexões efetuadas à aplicação.',
        };
    }
  }

  /**
   * Avalia se um registro já ultrapassou o período de guarda legal
   */
  static evaluateRetentionStatus(
    createdDate: string | Date,
    domain: RetentionDomain
  ): { isExpired: boolean; remainingMonths: number; targetDate: Date } {
    const policy = this.getRetentionPolicy(domain);
    const origin = new Date(createdDate);
    const target = new Date(origin);
    target.setMonth(target.getMonth() + policy.retentionPeriodMonths);

    const now = new Date();
    const isExpired = now >= target;

    if (isExpired) {
      return { isExpired: true, remainingMonths: 0, targetDate: target };
    }

    const diffTime = target.getTime() - now.getTime();
    const remainingMonths = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.4375)));

    return { isExpired: false, remainingMonths, targetDate: target };
  }

  /**
   * Monta a estrutura canônica do Dossiê do Titular (LGPD Art. 18, II e V)
   */
  static buildDossierExport(rawData: EmployeeDossierData): DossierExport {
    return {
      generatedAt: new Date().toISOString(),
      titular: {
        nomeCompleto: rawData.person.full_name,
        cpfMascarado: this.maskCpf(rawData.person.cpf),
        dataNascimento: rawData.person.birth_date,
        emailMascarado: rawData.person.email ? this.maskEmail(rawData.person.email) : undefined,
        telefoneMascarado: rawData.person.phone ? this.maskPhone(rawData.person.phone) : undefined,
      },
      contrato: {
        matricula: rawData.contract.registration_number,
        dataAdmissao: rawData.contract.admission_date,
        cargo: rawData.contract.position,
        departamento: rawData.contract.department,
      },
      consentimentos: (rawData.consents || []).map((c) => ({
        categoria: c.data_category,
        finalidade: c.purpose,
        dataConcessao: c.granted_at,
        status: c.revoked_at ? 'REVOGADO' : 'ATIVO',
      })),
      compartilhamentos: (rawData.dataSharing || []).map((s) => ({
        destinatario: s.recipient,
        finalidade: s.purpose,
        baseLegal: s.legal_basis,
      })),
      observacoesLegais:
        'Dossiê expedido conforme Art. 18 da Lei nº 13.709/2018 (LGPD). Os dados funcionais e de pagamento são tratados primariamente com base no Art. 7º, II (Cumprimento de Obrigação Legal - CLT e eSocial) e Art. 7º, V (Execução de Contrato de Trabalho).',
    };
  }

  /**
   * Valida payload de abertura de solicitação do titular (Art. 18 LGPD)
   */
  static validateSubjectRequest(
    requestType: LgpdRequestType,
    justification?: string
  ): { valid: boolean; error?: string } {
    if (!requestType) {
      return { valid: false, error: 'O tipo de solicitação é obrigatório.' };
    }

    if (!justification || justification.trim().length < 10) {
      return {
        valid: false,
        error: 'Mínimo de 10 caracteres na justificativa para fundamentar a solicitação.',
      };
    }

    if (requestType === LgpdRequestType.ANONYMIZATION) {
      // Alerta de que contratos em vigor têm dados essenciais resguardados por obrigação legal (Art. 16, I da LGPD)
      return { valid: true };
    }

    return { valid: true };
  }

  /**
   * Busca registros de compartilhamento oficial de dados do tenant
   */
  static async fetchDataSharingRegistry(tenantId: string) {
    const { data, error } = await supabase
      .from('lgpd_data_sharing_registry')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Erro ao consultar compartilhamentos LGPD:', error);
      // Fallback padrão com os compartilhamentos obrigatórios por lei trabalhista brasileira
      return [
        {
          recipient_name: 'eSocial / Ministério do Trabalho e Emprego',
          recipient_type: 'PUBLIC_AGENCY',
          purpose: 'Transmissão obrigatória de eventos trabalhistas, fiscais e previdenciários',
          legal_basis: 'LEGAL_OBLIGATION',
          data_shared: 'Dados cadastrais, contratuais, folha de pagamento, afastamentos e SST',
        },
        {
          recipient_name: 'Caixa Econômica Federal (FGTS Digital)',
          recipient_type: 'PUBLIC_AGENCY',
          purpose: 'Arrecadação e individualização dos depósitos fundiários de FGTS',
          legal_basis: 'LEGAL_OBLIGATION',
          data_shared: 'Remunerações, bases de cálculo e identificadores cadastrais do trabalhador',
        },
        {
          recipient_name: 'Receita Federal do Brasil (DCTFWeb & DIRF)',
          recipient_type: 'PUBLIC_AGENCY',
          purpose: 'Apuração e quitação de tributos e retenções do IRPF',
          legal_basis: 'LEGAL_OBLIGATION',
          data_shared: 'Rendimentos tributáveis, deduções e imposto de renda retido na fonte',
        },
        {
          recipient_name: 'Instituição Bancária Pagadora',
          recipient_type: 'FINANCIAL_INSTITUTION',
          purpose: 'Crédito de proventos salariais, adiantamentos e férias em conta corrente/salário (CNAB 240)',
          legal_basis: 'CONTRACT_EXECUTION',
          data_shared: 'Nome, CPF, Banco, Agência, Conta e Valor Líquido',
        },
      ];
    }

    return data;
  }

  /**
   * Registra uma solicitação de direito do titular no banco
   */
  static async submitSubjectRequest(params: {
    tenant_id: string;
    worker_id: string;
    request_type: LgpdRequestType;
    justification: string;
  }): Promise<{ success: boolean; error?: string }> {
    const validation = this.validateSubjectRequest(params.request_type, params.justification);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const { error } = await supabase.from('lgpd_subject_requests').insert({
      tenant_id: params.tenant_id,
      worker_id: params.worker_id,
      request_type: params.request_type,
      justification: params.justification,
      status: 'PENDING',
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  }
}
