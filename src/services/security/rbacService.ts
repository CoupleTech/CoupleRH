/**
 * CoupleRH - Serviço de Controle de Acesso Baseado em Papéis (RBAC)
 * Conformidade com FASE P8: Matriz Granular de Papéis e Permissões
 */

export type UserRole = 
  | 'system_admin'
  | 'tenant_admin'
  | 'dp_analyst'
  | 'manager'
  | 'accountant'
  | 'auditor'
  | 'employee'
  | 'sst_specialist';

export type PermissionSlug = 
  | 'manage_users'
  | 'manage_settings'
  | 'manage_employees'
  | 'view_team_employees'
  | 'manage_payroll'
  | 'view_payroll_accounting'
  | 'export_financial_reports'
  | 'manage_time_tracking'
  | 'manage_team_time_tracking'
  | 'manage_sst'
  | 'view_reports'
  | 'view_audit_logs'
  | 'manage_legal_parameters'
  | 'self_service_portal';

export interface RoleDefinition {
  id: string;
  name: string;
  role: UserRole;
  description: string;
  isSystemRole: boolean;
  permissions: PermissionSlug[];
}

/**
 * Matriz Canônica de Permissões por Papel (Princípio do Menor Privilégio - Default Deny)
 */
export const ROLE_PERMISSIONS_MATRIX: Record<UserRole, readonly PermissionSlug[]> = {
  system_admin: [
    'manage_users',
    'manage_settings',
    'manage_employees',
    'view_team_employees',
    'manage_payroll',
    'view_payroll_accounting',
    'export_financial_reports',
    'manage_time_tracking',
    'manage_team_time_tracking',
    'manage_sst',
    'view_reports',
    'view_audit_logs',
    'manage_legal_parameters',
    'self_service_portal',
  ],
  tenant_admin: [
    'manage_users',
    'manage_settings',
    'manage_employees',
    'view_team_employees',
    'manage_payroll',
    'view_payroll_accounting',
    'export_financial_reports',
    'manage_time_tracking',
    'manage_team_time_tracking',
    'manage_sst',
    'view_reports',
    'view_audit_logs',
    'manage_legal_parameters',
  ],
  dp_analyst: [
    'manage_employees',
    'manage_payroll',
    'view_payroll_accounting',
    'export_financial_reports',
    'manage_time_tracking',
    'manage_sst',
    'view_reports',
    'manage_legal_parameters',
  ],
  manager: [
    'view_team_employees',
    'manage_team_time_tracking',
    'view_reports',
  ],
  accountant: [
    'view_payroll_accounting',
    'export_financial_reports',
    'view_reports',
  ],
  auditor: [
    'view_audit_logs',
    'view_reports',
  ],
  sst_specialist: [
    'manage_sst',
    'view_reports',
  ],
  employee: [
    'self_service_portal',
  ],
};

export class RBACService {
  /**
   * Verifica se o papel possui uma permissão específica
   */
  static hasPermission(role: UserRole | string | null | undefined, permission: PermissionSlug): boolean {
    if (!role) return false;
    const permissions = ROLE_PERMISSIONS_MATRIX[role as UserRole];
    if (!permissions) return false;
    return permissions.includes(permission);
  }

  /**
   * Assegura que o papel tem a permissão necessária ou lança exceção
   */
  static assertPermission(role: UserRole | string | null | undefined, permission: PermissionSlug, actionContext = "esta operação"): void {
    if (!this.hasPermission(role, permission)) {
      throw new Error(`Acesso negado: o perfil '${role ?? 'não autenticado'}' não possui permissão para ${actionContext} (Requer: ${permission}).`);
    }
  }

  /**
   * Verifica se o papel pode calcular, reabrir ou modificar a folha de pagamento
   */
  static canMutatePayroll(role: UserRole | string | null | undefined): boolean {
    return this.hasPermission(role, 'manage_payroll');
  }

  /**
   * Verifica se o papel pode criar ou editar colaboradores e contratos
   */
  static canMutateContracts(role: UserRole | string | null | undefined): boolean {
    return this.hasPermission(role, 'manage_employees');
  }

  /**
   * Verifica se o papel pode aprovar espelhos de ponto e banco de horas
   */
  static canApproveTimesheets(role: UserRole | string | null | undefined): boolean {
    return this.hasPermission(role, 'manage_time_tracking') || this.hasPermission(role, 'manage_team_time_tracking');
  }

  /**
   * Verifica se o papel pode acessar relatórios contábeis, guias e CNAB
   */
  static canAccessAccounting(role: UserRole | string | null | undefined): boolean {
    return this.hasPermission(role, 'view_payroll_accounting') || this.hasPermission(role, 'export_financial_reports');
  }

  /**
   * Verifica se o papel pode consultar logs imutáveis de auditoria
   */
  static canViewAuditLogs(role: UserRole | string | null | undefined): boolean {
    return this.hasPermission(role, 'view_audit_logs');
  }

  /**
   * Verifica se o papel é administrativo (não colaborador)
   */
  static isAdministrativeRole(role: UserRole | string | null | undefined): boolean {
    if (!role) return false;
    return role !== 'employee';
  }
}
