import { describe, it, expect, vi } from 'vitest';
import {
  ParallelPayrollService,
  type ParallelComparisonInput,
  type AccountantSignoff,
  type LegalSignoff,
  type TechLeadSignoff
} from '../../services/payroll/parallelPayrollService';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(async () => ({ error: null }))
    }))
  }
}));

describe('Fase P9: Folha Paralela (3 Competências), Ata do Contador e Checklist de Go-Live', () => {
  const accountantMock: AccountantSignoff = {
    name: 'Carlos Eduardo Mendes',
    crc: '1SP234567/O-8',
    approvedAt: '2026-10-18T10:00:00Z',
    comments:
      'Homologação concluída com sucesso. Divergências observadas situam-se na margem de centavos decorrentes do critério Half-Up do coupleRH, sem impacto contábil.'
  };

  const legalMock: LegalSignoff = {
    name: 'Dra. Vanessa Albuquerque',
    oab: 'SP 345.890',
    approvedAt: '2026-10-18T10:30:00Z',
    comments:
      'Conformidade trabalhista validada (CLT, Súmula 366 TST, Portaria MTP 671/2021 e Lei 14.063/2020 de assinaturas eletrônicas).'
  };

  const techLeadMock: TechLeadSignoff = {
    name: 'Eng. Roberto Farias',
    role: 'Tech Lead / Head de Engenharia',
    approvedAt: '2026-10-18T11:00:00Z',
    comments:
      'Pipeline de CI verde com 680+ testes unitários e de integração, RLS auditado, PITR e observabilidade operacional ativos.'
  };

  describe('1. Confronto Analítico de Folha Paralela Rubrica a Rubrica', () => {
    it('deve aprovar competência com diferença R$ 0,00 exata em todas as rubricas', () => {
      const input: ParallelComparisonInput = {
        tenantId: 'tenant-prod-01',
        competence: '2026-08',
        legacySystemName: 'Totvs RM Folha',
        legacyItems: [
          {
            workerCpf: '111.222.333-44',
            workerName: 'Mariana Souza',
            rubricCode: '101',
            rubricName: 'Salário Base',
            amount: 5000.0
          },
          {
            workerCpf: '111.222.333-44',
            workerName: 'Mariana Souza',
            rubricCode: '901',
            rubricName: 'INSS Mensal',
            amount: 518.82
          },
          {
            workerCpf: '111.222.333-44',
            workerName: 'Mariana Souza',
            rubricCode: '902',
            rubricName: 'IRRF Mensal',
            amount: 279.3
          }
        ],
        couplerhPayslips: [
          {
            worker_cpf: '11122233344',
            worker_name: 'Mariana Souza',
            items: [
              { code: '101', name: 'Salário Base', amount: 5000.0 },
              { code: '901', name: 'INSS Mensal', amount: 518.82 },
              { code: '902', name: 'IRRF Mensal', amount: 279.3 }
            ]
          }
        ]
      };

      const result = ParallelPayrollService.executeParallelComparison(input);

      expect(result.canBeApproved).toBe(true);
      expect(result.exactMatches).toBe(3);
      expect(result.acceptableCentDiffs).toBe(0);
      expect(result.unacceptableDiffs).toBe(0);
      expect(result.matchingWorkers).toBe(1);
    });

    it('deve aceitar divergências de até R$ 0,02 respaldadas pela política formalizada de centavos', () => {
      const input: ParallelComparisonInput = {
        tenantId: 'tenant-prod-01',
        competence: '2026-09',
        legacySystemName: 'Senior Rubi',
        legacyItems: [
          {
            workerCpf: '222.333.444-55',
            workerName: 'Carlos Silveira',
            rubricCode: '201',
            rubricName: 'Horas Extras 50%',
            amount: 340.91 // No legado truncado
          },
          {
            workerCpf: '222.333.444-55',
            workerName: 'Carlos Silveira',
            rubricCode: '301',
            rubricName: 'DSR sobre HE',
            amount: 68.18 // No legado truncado
          }
        ],
        couplerhPayslips: [
          {
            worker_cpf: '222.333.444-55',
            worker_name: 'Carlos Silveira',
            items: [
              { code: '201', name: 'Horas Extras 50%', amount: 340.92 }, // +0.01 por Half-Up
              { code: '301', name: 'DSR sobre HE', amount: 68.2 } // +0.02 por fração bancária
            ]
          }
        ]
      };

      const result = ParallelPayrollService.executeParallelComparison(input);

      expect(result.canBeApproved).toBe(true);
      expect(result.exactMatches).toBe(0);
      expect(result.acceptableCentDiffs).toBe(2);
      expect(result.unacceptableDiffs).toBe(0);
      expect(result.items[0].isAcceptableCentDiff).toBe(true);
      expect(result.items[0].justification).toContain('política de centavos');
    });

    it('deve reprovar a folha paralela se houver divergência acima de R$ 0,02', () => {
      const input: ParallelComparisonInput = {
        tenantId: 'tenant-prod-01',
        competence: '2026-10',
        legacySystemName: 'Domínio Sistemas',
        legacyItems: [
          {
            workerCpf: '333.444.555-66',
            workerName: 'Fernanda Lima',
            rubricCode: '902',
            rubricName: 'IRRF Mensal',
            amount: 150.0 // Divergência grave de cálculo no legado
          }
        ],
        couplerhPayslips: [
          {
            worker_cpf: '33344455566',
            worker_name: 'Fernanda Lima',
            items: [{ code: '902', name: 'IRRF Mensal', amount: 165.5 }] // Diferença de R$ 15,50
          }
        ]
      };

      const result = ParallelPayrollService.executeParallelComparison(input);

      expect(result.canBeApproved).toBe(false);
      expect(result.unacceptableDiffs).toBe(1);
      expect(result.items[0].diffAmount).toBe(15.5);
    });
  });

  describe('2. Ata Formal de Homologação da Folha Paralela', () => {
    it('deve gerar a Ata em Markdown com dados do CRC e hash criptográfico SHA-256', () => {
      const input: ParallelComparisonInput = {
        tenantId: 'tenant-prod-01',
        competence: '2026-10',
        legacySystemName: 'Totvs RM Folha',
        legacyItems: [
          {
            workerCpf: '444.555.666-77',
            workerName: 'Lucas Oliveira',
            rubricCode: '101',
            rubricName: 'Salário Base',
            amount: 3200.0
          }
        ],
        couplerhPayslips: [
          {
            worker_cpf: '44455566677',
            worker_name: 'Lucas Oliveira',
            items: [{ code: '101', name: 'Salário Base', amount: 3200.0 }]
          }
        ]
      };

      const run = ParallelPayrollService.executeParallelComparison(input);
      const ata = ParallelPayrollService.generateAccountantAta(run, accountantMock);

      expect(ata.documentHashSha256).toBeDefined();
      expect(ata.documentHashSha256.length).toBe(64);
      expect(ata.markdownContent).toContain('Carlos Eduardo Mendes');
      expect(ata.markdownContent).toContain('1SP234567/O-8');
      expect(ata.markdownContent).toContain('POLÍTICA FORMALIZADA DE CENTAVOS');
      expect(ata.markdownContent).toContain('APTA E HOMOLOGADA');
    });

    it('deve bloquear a emissão da Ata caso a folha paralela esteja reprovada', () => {
      const runReprovada = {
        tenantId: 'tenant-01',
        competence: '2026-10',
        legacySystemName: 'Legado X',
        totalWorkers: 1,
        matchingWorkers: 1,
        totalRubricsCompared: 1,
        exactMatches: 0,
        acceptableCentDiffs: 0,
        unacceptableDiffs: 2,
        roundingPolicyApplied: 'TOLERANCE',
        canBeApproved: false,
        items: [],
        summaryMessage: 'Reprovado'
      };

      expect(() =>
        ParallelPayrollService.generateAccountantAta(runReprovada, accountantMock)
      ).toThrowError(/Não é possível emitir a Ata do Contador/);
    });
  });

  describe('3. Avaliação dos 15 Critérios de Aceite e Assinatura do Checklist de Go-Live', () => {
    it('deve bloquear o Go-Live caso tenham sido aprovadas menos de 2 competências paralelas', () => {
      const checklist = ParallelPayrollService.evaluateGoLiveChecklist({
        tenantId: 'tenant-prod-01',
        releaseVersion: '2026.10.0',
        parallelRunsApprovedCount: 1, // Insuficiente (mínimo 2 a 3)
        accountantSignoff: accountantMock,
        legalSignoff: legalMock,
        techLeadSignoff: techLeadMock
      });

      expect(checklist.status).toBe('BLOCKED');
      expect(checklist.allCriteriaPassed).toBe(false);
      const gate15 = checklist.criteria.find((c) => c.id === 'GATE-15');
      expect(gate15?.passed).toBe(false);
    });

    it('deve autorizar o Go-Live com 3 assinaturas formais e gerar o Certificado Criptográfico', async () => {
      const checklist = ParallelPayrollService.evaluateGoLiveChecklist({
        tenantId: 'tenant-prod-01',
        releaseVersion: '2026.10.0',
        parallelRunsApprovedCount: 3, // 3 competências (Agosto, Setembro e Outubro/2026)
        accountantSignoff: accountantMock,
        legalSignoff: legalMock,
        techLeadSignoff: techLeadMock
      });

      expect(checklist.status).toBe('FULLY_SIGNED_GO_LIVE_AUTHORIZED');
      expect(checklist.allCriteriaPassed).toBe(true);
      expect(checklist.passedCriteria).toBe(15);
      expect(checklist.certificateHashSha256).toBeDefined();
      expect(checklist.certificateHashSha256.length).toBe(64);

      // Persistir no banco de dados
      const ok = await ParallelPayrollService.persistGoLiveChecklist(checklist);
      expect(ok).toBe(true);
    });
  });
});
