import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  resolveRoleEnum, 
  UserManagementService, 
  type UpdateUserAccessPayload 
} from '../../services/settings/userManagementService';
import { supabase } from '../../lib/supabase';
import { ROLE_PERMISSIONS_MATRIX, type UserRole } from '../../services/security/rbacService';

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  }
}));

describe('CONF-02: Gestão e Governança de Usuários e Acessos (RBAC & Profiles)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Resolução Canônica de Papéis (resolveRoleEnum)', () => {
    it('deve mapear corretamente nomes amigáveis em português para enum UserRole', () => {
      expect(resolveRoleEnum('Administrador Global')).toBe('system_admin');
      expect(resolveRoleEnum('Admin do Sistema')).toBe('system_admin');
      expect(resolveRoleEnum('Analista de DP')).toBe('dp_analyst');
      expect(resolveRoleEnum('Especialista SST')).toBe('sst_specialist');
      expect(resolveRoleEnum('Gestor de Equipe')).toBe('manager');
      expect(resolveRoleEnum('Contador / Fiscal')).toBe('accountant');
      expect(resolveRoleEnum('Auditor de Conformidade')).toBe('auditor');
      expect(resolveRoleEnum('Colaborador')).toBe('employee');
    });

    it('deve aceitar os slugs técnicos válidos diretamente', () => {
      const validRoles: UserRole[] = [
        'system_admin', 'tenant_admin', 'dp_analyst', 'manager', 
        'accountant', 'auditor', 'employee', 'sst_specialist'
      ];
      for (const role of validRoles) {
        expect(resolveRoleEnum(role)).toBe(role);
      }
    });

    it('deve adotar fallback seguro para employee quando perfil for desconhecido ou vazio', () => {
      expect(resolveRoleEnum('')).toBe('employee');
      expect(resolveRoleEnum(undefined)).toBe('employee');
      expect(resolveRoleEnum('Cargo Inexistente')).toBe('employee');
    });
  });

  describe('2. Listagem Enriquecida de Usuários (fetchTenantUsers)', () => {
    it('deve invocar e mapear corretamente o retorno da RPC list_tenant_users_with_profiles', async () => {
      const mockRpcUsers = [
        {
          tenant_user_id: 'tu-001',
          user_id: 'u-001',
          tenant_id: 'tenant-100',
          role: 'dp_analyst',
          role_id: 'role-002',
          role_name: 'Analista de DP',
          worker_id: 'w-001',
          worker_name: 'Carlos Oliveira',
          worker_cpf: '123.456.789-00',
          full_name: 'Carlos Oliveira (DP)',
          email: 'carlos.dp@empresa.com.br',
          is_active: true,
          created_at: '2026-10-16T10:00:00Z',
        },
        {
          tenant_user_id: 'tu-002',
          user_id: 'u-002',
          tenant_id: 'tenant-100',
          role: 'employee',
          role_id: 'role-007',
          role_name: 'Colaborador',
          worker_id: null,
          worker_name: null,
          worker_cpf: null,
          full_name: 'Maria Souza',
          email: 'maria@empresa.com.br',
          is_active: false,
          created_at: '2026-10-16T11:00:00Z',
        }
      ];

      (supabase.rpc as any).mockResolvedValueOnce({
        data: mockRpcUsers,
        error: null,
      });

      const result = await UserManagementService.fetchTenantUsers();

      expect(supabase.rpc).toHaveBeenCalledWith('list_tenant_users_with_profiles');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        tenant_user_id: 'tu-001',
        user_id: 'u-001',
        tenant_id: 'tenant-100',
        role: 'dp_analyst',
        role_id: 'role-002',
        role_name: 'Analista de DP',
        worker_id: 'w-001',
        worker_name: 'Carlos Oliveira',
        worker_cpf: '123.456.789-00',
        full_name: 'Carlos Oliveira (DP)',
        email: 'carlos.dp@empresa.com.br',
        is_active: true,
        created_at: '2026-10-16T10:00:00Z',
      });
      expect(result[1].is_active).toBe(false);
      expect(result[1].worker_name).toBeNull();
    });

    it('deve acionar fallback resiliente com joins de tabelas caso RPC não esteja disponível', async () => {
      // Mock RPC error (simulando ambiente pré-migration)
      (supabase.rpc as any).mockResolvedValueOnce({
        data: null,
        error: { message: 'function list_tenant_users_with_profiles() does not exist' },
      });

      const mockTableData = [
        {
          id: 'tu-101',
          user_id: 'u-101',
          tenant_id: 'tenant-100',
          role: 'manager',
          role_id: 'role-004',
          worker_id: 'w-101',
          is_active: true,
          created_at: '2026-10-16T12:00:00Z',
          roles: { name: 'Gestor de Equipe' },
          workers: {
            id: 'w-101',
            people: { full_name: 'Fernanda Gestora', cpf: '987.654.321-99' }
          }
        }
      ];

      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === 'tenant_users') {
          return {
            select: vi.fn().mockResolvedValue({ data: mockTableData, error: null }),
          };
        }
        if (table === 'user_profiles') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'u-101', full_name: 'Fernanda Gestora', email: 'fernanda@empresa.com' }],
                error: null
              }),
            }),
          };
        }
        return { select: vi.fn() };
      });

      (supabase.from as any).mockImplementation(fromMock);

      const result = await UserManagementService.fetchTenantUsers();

      expect(result).toHaveLength(1);
      expect(result[0].tenant_user_id).toBe('tu-101');
      expect(result[0].role).toBe('manager');
      expect(result[0].role_name).toBe('Gestor de Equipe');
      expect(result[0].email).toBe('fernanda@empresa.com');
      expect(result[0].worker_name).toBe('Fernanda Gestora');
    });
  });

  describe('3. Atualização de Acessos e Vínculo de Colaborador (updateUserAccess)', () => {
    it('deve chamar a RPC update_tenant_user_access com os parâmetros corretos', async () => {
      (supabase.rpc as any).mockResolvedValueOnce({
        data: { success: true },
        error: null,
      });

      const payload: UpdateUserAccessPayload = {
        tenant_user_id: 'tu-001',
        role: 'sst_specialist',
        role_id: 'role-003',
        worker_id: 'w-005',
        is_active: true,
      };

      await UserManagementService.updateUserAccess(payload);

      expect(supabase.rpc).toHaveBeenCalledWith('update_tenant_user_access', {
        p_tenant_user_id: 'tu-001',
        p_role: 'sst_specialist',
        p_role_id: 'role-003',
        p_worker_id: 'w-005',
        p_is_active: true,
      });
    });

    it('deve acionar fallback de update direto em tenant_users se RPC falhar', async () => {
      (supabase.rpc as any).mockResolvedValueOnce({
        data: null,
        error: { message: 'RPC not found' },
      });

      const eqMock = vi.fn().mockResolvedValue({ data: null, error: null });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      (supabase.from as any).mockReturnValue({ update: updateMock });

      const payload: UpdateUserAccessPayload = {
        tenant_user_id: 'tu-001',
        role: 'accountant',
        role_id: 'role-005',
        worker_id: null,
        is_active: false,
      };

      await UserManagementService.updateUserAccess(payload);

      expect(supabase.from).toHaveBeenCalledWith('tenant_users');
      expect(updateMock).toHaveBeenCalledWith({
        role: 'accountant',
        role_id: 'role-005',
        worker_id: null,
        is_active: false,
      });
      expect(eqMock).toHaveBeenCalledWith('id', 'tu-001');
    });
  });

  describe('4. Governança de Permissões Granulares P8', () => {
    it('deve assegurar que todos os 8 papéis possuem sua matriz de permissões canônica em RBAC', () => {
      const roles: UserRole[] = [
        'system_admin', 'tenant_admin', 'dp_analyst', 'manager', 
        'accountant', 'auditor', 'employee', 'sst_specialist'
      ];

      for (const role of roles) {
        const perms = ROLE_PERMISSIONS_MATRIX[role];
        expect(perms).toBeDefined();
        expect(Array.isArray(perms)).toBe(true);
      }

      // Validar papéis específicos
      expect(ROLE_PERMISSIONS_MATRIX.system_admin).toContain('manage_users');
      expect(ROLE_PERMISSIONS_MATRIX.tenant_admin).toContain('manage_users');
      expect(ROLE_PERMISSIONS_MATRIX.dp_analyst).toContain('manage_payroll');
      expect(ROLE_PERMISSIONS_MATRIX.dp_analyst).not.toContain('manage_users');
      expect(ROLE_PERMISSIONS_MATRIX.sst_specialist).toEqual(['manage_sst', 'view_reports']);
      expect(ROLE_PERMISSIONS_MATRIX.auditor).toEqual(['view_audit_logs', 'view_reports']);
    });
  });
});
