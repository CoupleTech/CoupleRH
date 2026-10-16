import { describe, it, expect } from "vitest";
import { RBACService, ROLE_PERMISSIONS_MATRIX, type UserRole, type PermissionSlug } from "../../services/security/rbacService";

describe("RBAC Granular - Matriz de Papéis e Princípio do Menor Privilégio (Fase P8)", () => {
  it("deve permitir que system_admin e tenant_admin tenham controle amplo de gestão", () => {
    expect(RBACService.hasPermission('system_admin', 'manage_payroll')).toBe(true);
    expect(RBACService.hasPermission('system_admin', 'manage_employees')).toBe(true);
    expect(RBACService.hasPermission('system_admin', 'manage_users')).toBe(true);
    expect(RBACService.hasPermission('system_admin', 'view_audit_logs')).toBe(true);

    expect(RBACService.hasPermission('tenant_admin', 'manage_payroll')).toBe(true);
    expect(RBACService.hasPermission('tenant_admin', 'manage_employees')).toBe(true);
    expect(RBACService.hasPermission('tenant_admin', 'view_audit_logs')).toBe(true);
  });

  it("deve restringir o Analista de DP estritamente às rotas de folha, contratos, ponto e encargos", () => {
    const role: UserRole = 'dp_analyst';
    expect(RBACService.canMutatePayroll(role)).toBe(true);
    expect(RBACService.canMutateContracts(role)).toBe(true);
    expect(RBACService.canApproveTimesheets(role)).toBe(true);
    expect(RBACService.canAccessAccounting(role)).toBe(true);

    // Não deve ter permissão de gerenciar outros usuários administradores nem ver logs globais de auditoria
    expect(RBACService.hasPermission(role, 'manage_users')).toBe(false);
    expect(RBACService.hasPermission(role, 'view_audit_logs')).toBe(false);
  });

  it("deve garantir que o Gestor de Equipe só trate ponto e escalas da sua equipe, bloqueado de folha salarial", () => {
    const role: UserRole = 'manager';
    expect(RBACService.canApproveTimesheets(role)).toBe(true);
    expect(RBACService.hasPermission(role, 'view_team_employees')).toBe(true);
    expect(RBACService.hasPermission(role, 'manage_team_time_tracking')).toBe(true);

    // Estritamente proibido de calcular folha, cadastrar contratos ou ver resumo contábil global
    expect(RBACService.canMutatePayroll(role)).toBe(false);
    expect(RBACService.canMutateContracts(role)).toBe(false);
    expect(RBACService.canAccessAccounting(role)).toBe(false);
    expect(RBACService.hasPermission(role, 'manage_users')).toBe(false);
  });

  it("deve garantir que o Contador/Fiscal acesse guias e contabilidade, bloqueado de mutação em folha e contratos", () => {
    const role: UserRole = 'accountant';
    expect(RBACService.canAccessAccounting(role)).toBe(true);
    expect(RBACService.hasPermission(role, 'view_payroll_accounting')).toBe(true);
    expect(RBACService.hasPermission(role, 'export_financial_reports')).toBe(true);

    // Estritamente bloqueado de criar ou modificar folhas, eventos ou contratos
    expect(RBACService.canMutatePayroll(role)).toBe(false);
    expect(RBACService.canMutateContracts(role)).toBe(false);
    expect(RBACService.canApproveTimesheets(role)).toBe(false);
    expect(RBACService.hasPermission(role, 'manage_users')).toBe(false);
  });

  it("deve garantir que o Auditor tenha permissão somente-leitura em logs forenses, bloqueado de qualquer mutação", () => {
    const role: UserRole = 'auditor';
    expect(RBACService.canViewAuditLogs(role)).toBe(true);
    expect(RBACService.hasPermission(role, 'view_audit_logs')).toBe(true);
    expect(RBACService.hasPermission(role, 'view_reports')).toBe(true);

    // Proibido de qualquer mutação operacional no sistema
    expect(RBACService.canMutatePayroll(role)).toBe(false);
    expect(RBACService.canMutateContracts(role)).toBe(false);
    expect(RBACService.canApproveTimesheets(role)).toBe(false);
    expect(RBACService.hasPermission(role, 'manage_users')).toBe(false);
    expect(RBACService.hasPermission(role, 'manage_settings')).toBe(false);
  });

  it("deve isolar o Colaborador estritamente ao Portal de Autoatendimento", () => {
    const role: UserRole = 'employee';
    expect(RBACService.hasPermission(role, 'self_service_portal')).toBe(true);
    expect(RBACService.isAdministrativeRole(role)).toBe(false);

    // Bloqueado de todas as funções administrativas
    expect(RBACService.canMutatePayroll(role)).toBe(false);
    expect(RBACService.canMutateContracts(role)).toBe(false);
    expect(RBACService.canApproveTimesheets(role)).toBe(false);
    expect(RBACService.canAccessAccounting(role)).toBe(false);
    expect(RBACService.canViewAuditLogs(role)).toBe(false);
    expect(RBACService.hasPermission(role, 'view_reports')).toBe(false);
  });

  it("deve disparar exceção em assertPermission quando o usuário não possuir a permissão requerida", () => {
    expect(() => {
      RBACService.assertPermission('employee', 'manage_payroll', 'fechar a folha de pagamento');
    }).toThrowError(/Acesso negado: o perfil 'employee' não possui permissão para fechar a folha de pagamento \(Requer: manage_payroll\)/);

    expect(() => {
      RBACService.assertPermission('accountant', 'manage_employees', 'admitir colaborador');
    }).toThrowError(/Acesso negado: o perfil 'accountant' não possui permissão para admitir colaborador/);
  });

  it("deve aplicar Default Deny para papéis ou permissões inválidas ou nulas", () => {
    expect(RBACService.hasPermission(null, 'manage_payroll')).toBe(false);
    expect(RBACService.hasPermission(undefined, 'view_reports')).toBe(false);
    expect(RBACService.hasPermission('papel_inexistente', 'manage_payroll')).toBe(false);
    expect(RBACService.hasPermission('dp_analyst', 'permissao_inventada' as PermissionSlug)).toBe(false);
  });
});
