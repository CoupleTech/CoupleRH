import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  TenantBackupService, 
  type TenantBackupData, 
  type BackupProgress 
} from '../../services/settings/tenantBackupService';
import { supabase } from '../../lib/supabase';

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn()
    },
    from: vi.fn()
  }
}));

describe('CONF-06: TenantBackupService (Exportação e Backup Consolidado do Tenant)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validMockBackup: TenantBackupData = {
    manifest: {
      schemaVersion: '1.0.0',
      generatedAt: '2026-10-17T21:00:00Z',
      tenantId: 'ten-123',
      tenantName: 'Empresa Teste',
      exportedBy: {
        userId: 'usr-1',
        email: 'admin@empresa.com'
      },
      summary: {
        companies: 1,
        establishments: 1,
        departments: 2,
        positions: 3,
        workers: 5,
        contracts: 5,
        payrollPeriods: 2,
        payslips: 10,
        payslipItems: 40,
        timePunchRecords: 50,
        timeDailySummaries: 20,
        loans: 1,
        certificates: 1
      }
    },
    organization: {
      companies: [{ id: 'comp-1', corporate_name: 'Empresa Teste LTDA' }],
      establishments: [{ id: 'est-1', name: 'Matriz' }],
      departments: [{ id: 'dep-1', name: 'TI' }],
      positions: [{ id: 'pos-1', name: 'Engenheiro' }],
      settings: { timezone: 'America/Sao_Paulo' }
    },
    employees: {
      people: [{ id: 'peo-1', full_name: 'Colaborador Teste' }],
      workers: [{ id: 'wor-1', person_id: 'peo-1' }],
      contracts: [{ id: 'con-1', worker_id: 'wor-1', base_salary: 5000 }]
    },
    payroll: {
      periods: [{ id: 'per-1', name: '10/2026' }],
      rubrics: [{ id: 'rub-1', code: '101' }],
      payslips: [{ id: 'pay-1', net_salary: 4000 }],
      payslipItems: [{ id: 'item-1', code: '101' }],
      fixedEvents: [],
      deductions: [],
      loans: [{ id: 'loan-1', bank_name: 'CEF' }]
    },
    timeTracking: {
      punchRecords: [{ id: 'pun-1', punch_time: '08:00' }],
      dailySummaries: [{ id: 'dai-1', total_worked_minutes: 480 }],
      bankAccounts: [{ id: 'bnk-1', balance_minutes: 60 }],
      bankTransactions: []
    },
    complianceAndSecurity: {
      certificates: [{ id: 'cert-1', issuer: 'AC SERASA' }],
      lgpdSharings: []
    }
  };

  describe('1. Validação de Integridade do Backup (validateBackupIntegrity)', () => {
    it('deve aprovar backup íntegro contendo todos os domínios e manifesto', () => {
      expect(TenantBackupService.validateBackupIntegrity(validMockBackup)).toBe(true);
    });

    it('deve reprovar backups sem manifesto ou com campos essenciais ausentes', () => {
      expect(TenantBackupService.validateBackupIntegrity({} as any)).toBe(false);

      const semTenantId = {
        ...validMockBackup,
        manifest: { ...validMockBackup.manifest, tenantId: '' }
      };
      expect(TenantBackupService.validateBackupIntegrity(semTenantId)).toBe(false);

      const semFolha = {
        ...validMockBackup,
        payroll: undefined as any
      };
      expect(TenantBackupService.validateBackupIntegrity(semFolha)).toBe(false);
    });
  });

  describe('2. Extração Sequencial e Notificação de Progresso (generateCompleteBackup)', () => {
    it('deve lançar erro caso o usuário não esteja autenticado', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
        data: { user: null },
        error: null
      } as any);

      await expect(TenantBackupService.generateCompleteBackup()).rejects.toThrow('Usuário não autenticado.');
    });

    it('deve extrair todas as entidades, emitir etapas de progresso e calcular sumário', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
        data: { user: { id: 'usr-999', email: 'dp@empresa.com' } },
        error: null
      } as any);

      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'tenant_users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                tenant_id: 'ten-999',
                role: 'tenant_admin',
                tenants: { name: 'Acme Corporativa' }
              },
              error: null
            })
          };
        }

        if (table === 'companies') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'comp-1', corporate_name: 'Acme LTDA' }],
              error: null
            })
          };
        }

        if (table === 'employment_contracts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [{ id: 'c-1' }, { id: 'c-2' }],
              error: null
            })
          };
        }

        if (table === 'payslips') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [{ id: 'p-1' }, { id: 'p-2' }, { id: 'p-3' }],
              error: null
            })
          };
        }

        if (table === 'tenant_settings') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { timezone: 'America/Sao_Paulo' },
              error: null
            })
          };
        }

        // Retorno genérico para as demais tabelas
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null })
        };
      });

      vi.mocked(supabase.from).mockImplementation(mockFrom as any);

      const progressHistory: BackupProgress[] = [];
      const backup = await TenantBackupService.generateCompleteBackup((p) => {
        progressHistory.push(p);
      });

      expect(backup.manifest.tenantId).toBe('ten-999');
      expect(backup.manifest.tenantName).toBe('Acme Corporativa');
      expect(backup.manifest.summary.companies).toBe(1);
      expect(backup.manifest.summary.contracts).toBe(2);
      expect(backup.manifest.summary.payslips).toBe(3);

      // Verificar histórico de progresso
      expect(progressHistory.length).toBeGreaterThanOrEqual(5);
      expect(progressHistory[0].percentage).toBe(5);
      expect(progressHistory[progressHistory.length - 1].percentage).toBe(100);
      expect(progressHistory[progressHistory.length - 1].currentDomain).toBe('DONE');
    });
  });

  describe('3. Geração de Nome e Download do Pacote (buildBackupFilename e downloadBackupFile)', () => {
    it('deve gerar nome padronizado do backup contendo slug do tenant e data', () => {
      const fixedDate = new Date('2026-10-17T15:30:00Z');
      const filename = TenantBackupService.buildBackupFilename('Minha Empresa LTDA', fixedDate);
      expect(filename).toContain('backup_coupleRH_minha_empresa_ltda_');
      expect(filename).toContain('2026-10-17T15-30-00-000Z.json');
    });

    it('deve executar download de forma resiliente e retornar o nome do arquivo', () => {
      const filename = TenantBackupService.downloadBackupFile(validMockBackup);
      expect(filename).toContain('backup_coupleRH_empresa_teste_');
      expect(filename.endsWith('.json')).toBe(true);
    });
  });
});
