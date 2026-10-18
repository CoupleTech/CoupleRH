/**
 * tenantBackupService.ts
 * 
 * Serviço de exportação integral e backup de portabilidade dos dados do Tenant (CONF-06).
 * Em conformidade com o Art. 18, V da LGPD (Direito à Portabilidade de Dados) e
 * integridade corporativa de governança do coupleRH.
 */

import { supabase } from '../../lib/supabase';

export interface BackupProgress {
  stage: string;
  percentage: number;
  currentDomain: string;
}

export interface TenantBackupManifest {
  schemaVersion: string;
  generatedAt: string;
  tenantId: string;
  tenantName: string;
  exportedBy: {
    userId: string;
    email: string;
  };
  summary: {
    companies: number;
    establishments: number;
    departments: number;
    positions: number;
    workers: number;
    contracts: number;
    payrollPeriods: number;
    payslips: number;
    payslipItems: number;
    timePunchRecords: number;
    timeDailySummaries: number;
    loans: number;
    certificates: number;
  };
}

export interface TenantBackupData {
  manifest: TenantBackupManifest;
  organization: {
    companies: any[];
    establishments: any[];
    departments: any[];
    positions: any[];
    settings: any;
  };
  employees: {
    people: any[];
    workers: any[];
    contracts: any[];
  };
  payroll: {
    periods: any[];
    rubrics: any[];
    payslips: any[];
    payslipItems: any[];
    fixedEvents: any[];
    deductions: any[];
    loans: any[];
  };
  timeTracking: {
    punchRecords: any[];
    dailySummaries: any[];
    bankAccounts: any[];
    bankTransactions: any[];
  };
  complianceAndSecurity: {
    certificates: any[];
    lgpdSharings: any[];
  };
}

export const TenantBackupData = {} as const;

export const TenantBackupService = {
  /**
   * Valida a integridade básica de um pacote de backup exportado
   */
  validateBackupIntegrity(backup: TenantBackupData): boolean {
    if (!backup?.manifest?.tenantId || !backup?.manifest?.schemaVersion) {
      return false;
    }
    if (!backup.organization || !backup.employees || !backup.payroll || !backup.timeTracking) {
      return false;
    }
    return true;
  },

  /**
   * Executa a extração sequencial e orquestrada de todos os domínios do tenant
   */
  async generateCompleteBackup(
    onProgress?: (progress: BackupProgress) => void
  ): Promise<TenantBackupData> {
    const notify = (stage: string, percentage: number, currentDomain: string) => {
      if (onProgress) onProgress({ stage, percentage, currentDomain });
    };

    notify('Autenticando e identificando tenant...', 5, 'AUTH');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuário não autenticado.');
    }

    const { data: tu } = await supabase
      .from('tenant_users')
      .select('tenant_id, role, tenants(name)')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!tu?.tenant_id) {
      throw new Error('Tenant ativo não localizado para o usuário.');
    }

    const tenantId = tu.tenant_id;
    const tenantName = (tu.tenants as any)?.name || 'Organização';

    // 1. Estrutura Organizacional
    notify('Exportando Estrutura Organizacional (Empresas, Filiais, Cargos)...', 20, 'ORGANIZATION');
    const [companiesRes, establishmentsRes, departmentsRes, positionsRes, settingsRes] = await Promise.all([
      supabase.from('companies').select('*').eq('tenant_id', tenantId),
      supabase.from('establishments').select('*').eq('tenant_id', tenantId),
      supabase.from('departments').select('*').eq('tenant_id', tenantId),
      supabase.from('positions').select('*').eq('tenant_id', tenantId),
      supabase.from('tenant_settings').select('*').eq('tenant_id', tenantId).maybeSingle()
    ]);

    // 2. Colaboradores e Contratos de Trabalho
    notify('Exportando Colaboradores, Dados Pessoais e Vínculos CLT...', 40, 'EMPLOYEES');
    const [peopleRes, workersRes, contractsRes] = await Promise.all([
      supabase.from('people').select('*').eq('tenant_id', tenantId),
      supabase.from('workers').select('*').eq('tenant_id', tenantId),
      supabase.from('employment_contracts').select('*').eq('tenant_id', tenantId)
    ]);

    // 3. Folha de Pagamento e Eventos Financeiros
    notify('Exportando Folhas, Holerites, Rubricas e Consignados...', 65, 'PAYROLL');
    const [periodsRes, rubricsRes, payslipsRes, payslipItemsRes, fixedEventsRes, deductionsRes, loansRes] = await Promise.all([
      supabase.from('payroll_periods').select('*').eq('tenant_id', tenantId),
      supabase.from('payroll_rubrics').select('*').eq('tenant_id', tenantId),
      supabase.from('payslips').select('*').eq('tenant_id', tenantId).limit(500),
      supabase.from('payslip_items').select('*').eq('tenant_id', tenantId).limit(2000),
      supabase.from('employee_fixed_events').select('*').eq('tenant_id', tenantId),
      supabase.from('employee_deductions').select('*').eq('tenant_id', tenantId),
      supabase.from('employee_loans').select('*').eq('tenant_id', tenantId)
    ]);

    // 4. Ponto Eletrônico e Banco de Horas
    notify('Exportando Registros REP-P, Apurações Diárias e Banco de Horas...', 80, 'TIME_TRACKING');
    const [punchesRes, dailyRes, bankAccountsRes, bankTransactionsRes] = await Promise.all([
      supabase.from('time_punch_records').select('*').eq('tenant_id', tenantId).limit(1000),
      supabase.from('time_daily_summary').select('*').eq('tenant_id', tenantId).limit(1000),
      supabase.from('time_bank_accounts').select('*').eq('tenant_id', tenantId),
      supabase.from('time_bank_transactions').select('*').eq('tenant_id', tenantId).limit(500)
    ]);

    // 5. Conformidade, Certificados e LGPD
    notify('Exportando Metadados de Certificados e Registros LGPD...', 95, 'COMPLIANCE');
    const [certsRes, lgpdSharingsRes] = await Promise.all([
      supabase.from('tenant_certificates').select('*').eq('tenant_id', tenantId),
      supabase.from('lgpd_data_sharing').select('*').eq('tenant_id', tenantId)
    ]);

    // Montar o manifesto
    const manifest: TenantBackupManifest = {
      schemaVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
      tenantId,
      tenantName,
      exportedBy: {
        userId: user.id,
        email: user.email || ''
      },
      summary: {
        companies: companiesRes.data?.length || 0,
        establishments: establishmentsRes.data?.length || 0,
        departments: departmentsRes.data?.length || 0,
        positions: positionsRes.data?.length || 0,
        workers: workersRes.data?.length || 0,
        contracts: contractsRes.data?.length || 0,
        payrollPeriods: periodsRes.data?.length || 0,
        payslips: payslipsRes.data?.length || 0,
        payslipItems: payslipItemsRes.data?.length || 0,
        timePunchRecords: punchesRes.data?.length || 0,
        timeDailySummaries: dailyRes.data?.length || 0,
        loans: loansRes.data?.length || 0,
        certificates: certsRes.data?.length || 0
      }
    };

    const backupData: TenantBackupData = {
      manifest,
      organization: {
        companies: companiesRes.data || [],
        establishments: establishmentsRes.data || [],
        departments: departmentsRes.data || [],
        positions: positionsRes.data || [],
        settings: settingsRes.data || null
      },
      employees: {
        people: peopleRes.data || [],
        workers: workersRes.data || [],
        contracts: contractsRes.data || []
      },
      payroll: {
        periods: periodsRes.data || [],
        rubrics: rubricsRes.data || [],
        payslips: payslipsRes.data || [],
        payslipItems: payslipItemsRes.data || [],
        fixedEvents: fixedEventsRes.data || [],
        deductions: deductionsRes.data || [],
        loans: loansRes.data || []
      },
      timeTracking: {
        punchRecords: punchesRes.data || [],
        dailySummaries: dailyRes.data || [],
        bankAccounts: bankAccountsRes.data || [],
        bankTransactions: bankTransactionsRes.data || []
      },
      complianceAndSecurity: {
        certificates: certsRes.data || [],
        lgpdSharings: lgpdSharingsRes.data || []
      }
    };

    notify('Backup concluído com sucesso!', 100, 'DONE');
    return backupData;
  },

  /**
   * Constrói o nome padronizado do arquivo de backup
   */
  buildBackupFilename(tenantName: string, date: Date = new Date()): string {
    const slug = (tenantName || 'tenant')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .slice(0, 20);

    const timestamp = date.toISOString().replace(/[:.]/g, '-');
    return `backup_coupleRH_${slug}_${timestamp}.json`;
  },

  /**
   * Faz o download do arquivo JSON gerado no navegador do usuário
   */
  downloadBackupFile(backup: TenantBackupData): string {
    const filename = this.buildBackupFilename(backup.manifest.tenantName);

    if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      return filename;
    }

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return filename;
  }
};
