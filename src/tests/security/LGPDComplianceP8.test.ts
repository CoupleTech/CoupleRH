import { describe, it, expect } from 'vitest';
import {
  LGPDService,
  LgpdRequestType,
  RetentionDomain,
  EmployeeDossierData,
} from '../../services/security/lgpdService';

describe('FASE P8: LGPD Operacional e Governança de Dados (Lei 13.709/2018 & CLT)', () => {
  describe('1. Mascaramento e Proteção de Dados Pessoais Sensíveis', () => {
    it('deve mascarar CPF preservando apenas dígitos centrais para conferência', () => {
      expect(LGPDService.maskCpf('123.456.789-00')).toBe('***.456.789-**');
      expect(LGPDService.maskCpf('12345678900')).toBe('***.456.789-**');
      expect(LGPDService.maskCpf('')).toBe('');
      expect(LGPDService.maskCpf('123')).toBe('***');
    });

    it('deve mascarar PIS/PASEP protegendo a identificação cadastral', () => {
      expect(LGPDService.maskPis('123.45678.90-1')).toBe('***.45678.**-*');
      expect(LGPDService.maskPis('12345678901')).toBe('***.45678.**-*');
      expect(LGPDService.maskPis('')).toBe('');
    });

    it('deve mascarar Dados Bancários (Conta e Agência)', () => {
      expect(LGPDService.maskBankAccount('12345-6')).toBe('***45-6');
      expect(LGPDService.maskBankAccount('000123456')).toBe('*****3456');
      expect(LGPDService.maskBankAgency('1234')).toBe('**34');
    });

    it('deve mascarar e-mails e telefones de contato', () => {
      expect(LGPDService.maskEmail('carlos.silva@empresa.com.br')).toBe('c***a@empresa.com.br');
      expect(LGPDService.maskEmail('user@test.co')).toBe('u***r@test.co');
      expect(LGPDService.maskPhone('(11) 98765-4321')).toBe('(11) 9****-4321');
    });

    it('deve proteger dados de saúde ocupacional (CID-10) para usuários não autorizados (Resolução CFM 1.851/2008)', () => {
      const atestadoSST = {
        id: 'att-123',
        employee_name: 'João da Silva',
        days_off: 5,
        cid_code: 'M54.5',
        cid_description: 'Dor lombar baixa',
        doctor_crm: 'CRM/SP 123456',
      };

      // Gestor comum ou DP operacional sem perfil médico: CID deve ser suprimido
      const sanitizedForManager = LGPDService.sanitizeMedicalData(atestadoSST, 'manager');
      expect(sanitizedForManager.cid_code).toBe('[DADO MÉDICO RESTRITO - ART. 11 LGPD]');
      expect(sanitizedForManager.cid_description).toBe('[CONFIDENCIALIDADE MÉDICA - RESOLUÇÃO CFM]');
      expect(sanitizedForManager.days_off).toBe(5);

      // Especialista SST / Médico do Trabalho: acesso autorizado
      const sanitizedForSST = LGPDService.sanitizeMedicalData(atestadoSST, 'sst_specialist');
      expect(sanitizedForSST.cid_code).toBe('M54.5');
      expect(sanitizedForSST.cid_description).toBe('Dor lombar baixa');
    });
  });

  describe('2. Gestão de Consentimento e Revogação (Art. 8º §5º LGPD)', () => {
    it('deve gerar payload canônico de consentimento com finalidade e base legal', () => {
      const consent = LGPDService.createConsentRecord({
        tenant_id: 'tenant-001',
        person_id: 'person-001',
        data_category: 'Geolocalização para Registro de Ponto',
        processing_purpose: 'Validação de Perímetro Geofence no Ponto Eletrônico Mobile REP-P',
        legal_basis: 'CONSENT',
        ip_address: '177.136.24.10',
        device_info: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',
      });

      expect(consent.tenant_id).toBe('tenant-001');
      expect(consent.data_category).toBe('Geolocalização para Registro de Ponto');
      expect(consent.legal_basis).toBe('CONSENT');
      expect(consent.granted_at).toBeDefined();
      expect(consent.revoked_at).toBeNull();
    });

    it('deve revogar consentimento preservando a trilha histórica', () => {
      const originalConsent = LGPDService.createConsentRecord({
        tenant_id: 'tenant-001',
        person_id: 'person-001',
        data_category: 'Biometria Facial',
        processing_purpose: 'Acesso às dependências físicas',
        legal_basis: 'CONSENT',
      });

      const revoked = LGPDService.revokeConsent(originalConsent, 'Revogação solicitada pelo titular via Portal');
      expect(revoked.revoked_at).toBeDefined();
      expect(new Date(revoked.revoked_at!).getTime()).toBeGreaterThanOrEqual(new Date(originalConsent.granted_at!).getTime());
      expect(revoked.revocation_reason).toBe('Revogação solicitada pelo titular via Portal');
    });
  });

  describe('3. Prazos Legais de Retenção e Ciclo de Vida (Data Retention Policies)', () => {
    it('deve validar prazo de 5 anos para documentos de Folha e Ponto (CF Art. 7º XXIX / CLT Art. 11)', () => {
      const policyFolha = LGPDService.getRetentionPolicy(RetentionDomain.PAYROLL);
      expect(policyFolha.retentionPeriodMonths).toBe(60); // 5 anos
      expect(policyFolha.legalBasis).toContain('Art. 7º, XXIX da CF');

      const policyPonto = LGPDService.getRetentionPolicy(RetentionDomain.TIME_TRACKING);
      expect(policyPonto.retentionPeriodMonths).toBe(60); // 5 anos
      expect(policyPonto.legalBasis).toContain('Portaria MTP 671/2021');
    });

    it('deve validar prazo de 20 anos para Documentos de Saúde e Segurança (NR-7 e NR-9)', () => {
      const policySST = LGPDService.getRetentionPolicy(RetentionDomain.SST_HEALTH);
      expect(policySST.retentionPeriodMonths).toBe(240); // 20 anos
      expect(policySST.legalBasis).toContain('NR-7');
    });

    it('deve validar prazo de 30 anos para FGTS e histórico previdenciário', () => {
      const policyFGTS = LGPDService.getRetentionPolicy(RetentionDomain.FGTS_PREVIDENCIA);
      expect(policyFGTS.retentionPeriodMonths).toBe(360); // 30 anos
    });

    it('deve avaliar status de expiração de um dado conforme a data de corte', () => {
      // Registro de 2 anos atrás: Ativo (dentro dos 5 anos)
      const dataRecente = new Date();
      dataRecente.setFullYear(dataRecente.getFullYear() - 2);
      const evalAtivo = LGPDService.evaluateRetentionStatus(dataRecente, RetentionDomain.PAYROLL);
      expect(evalAtivo.isExpired).toBe(false);
      expect(evalAtivo.remainingMonths).toBeGreaterThan(0);

      // Registro de 6 anos atrás: Expirado
      const dataAntiga = new Date();
      dataAntiga.setFullYear(dataAntiga.getFullYear() - 6);
      const evalExpirado = LGPDService.evaluateRetentionStatus(dataAntiga, RetentionDomain.PAYROLL);
      expect(evalExpirado.isExpired).toBe(true);
      expect(evalExpirado.remainingMonths).toBe(0);
    });
  });

  describe('4. Direitos do Titular (LGPD Art. 18): Dossiê e Solicitações', () => {
    it('deve estruturar Dossiê do Titular (Direito de Acesso e Portabilidade - Art. 18, II e V)', () => {
      const rawData: EmployeeDossierData = {
        person: {
          full_name: 'Maria Eduarda Santos',
          cpf: '987.654.321-11',
          birth_date: '1992-05-14',
          email: 'maria.santos@exemplo.com.br',
          phone: '(11) 97777-8888',
        },
        contract: {
          registration_number: 'MAT-0042',
          admission_date: '2023-02-01',
          position: 'Analista Financeiro Pleno',
          department: 'Controladoria',
          salary: 5800,
        },
        consents: [
          {
            data_category: 'Geolocalização',
            purpose: 'Ponto mobile',
            granted_at: '2023-02-01T08:00:00Z',
            revoked_at: null,
          },
        ],
        dataSharing: [
          {
            recipient: 'eSocial / Caixa Econômica Federal',
            purpose: 'Cumprimento de Obrigações Trabalhistas e FGTS Digital',
            legal_basis: 'Obrigação Legal (Art. 7º, II da LGPD)',
          },
        ],
      };

      const dossier = LGPDService.buildDossierExport(rawData);
      expect(dossier.generatedAt).toBeDefined();
      expect(dossier.titular.nomeCompleto).toBe('Maria Eduarda Santos');
      expect(dossier.titular.cpfMascarado).toBe('***.654.321-**');
      expect(dossier.contrato.matricula).toBe('MAT-0042');
      expect(dossier.compartilhamentos.length).toBe(1);
      expect(dossier.consentimentos.length).toBe(1);
    });

    it('deve validar criação de solicitação do titular (Art. 18)', () => {
      const validReq = LGPDService.validateSubjectRequest(
        LgpdRequestType.ACCESS_DATA,
        'Solicito a cópia integral de todos os meus dados armazenados na plataforma.'
      );
      expect(validReq.valid).toBe(true);

      const invalidReq = LGPDService.validateSubjectRequest(
        LgpdRequestType.ANONYMIZATION,
        'Apagar' // muito curto para justificar solicitação (< 10 caracteres)
      );
      expect(invalidReq.valid).toBe(false);
      expect(invalidReq.error).toContain('Mínimo de 10 caracteres');
    });
  });
});
