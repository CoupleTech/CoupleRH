import { supabase } from "../../lib/supabase";
import type { UserRole } from "../security/rbacService";

export interface TenantUserDetails {
  tenant_user_id: string;
  user_id: string;
  tenant_id: string;
  role: UserRole;
  role_id: string | null;
  role_name: string;
  worker_id: string | null;
  worker_name: string | null;
  worker_cpf: string | null;
  full_name: string;
  email: string;
  is_active: boolean;
  created_at: string;
}
export const TenantUserDetails = {} as const;

export interface WorkerOption {
  id: string;
  full_name: string;
  cpf: string;
  matricula?: string;
}
export const WorkerOption = {} as const;

export interface UpdateUserAccessPayload {
  tenant_user_id: string;
  role: UserRole;
  role_id: string | null;
  worker_id: string | null;
  is_active: boolean;
}
export const UpdateUserAccessPayload = {} as const;

/**
 * Mapeamento canônico entre descritivo da role e enum técnico
 */
export function resolveRoleEnum(roleNameOrSlug?: string): UserRole {
  if (!roleNameOrSlug) return 'employee';
  const lower = roleNameOrSlug.toLowerCase().trim();

  const validRoles: UserRole[] = [
    'system_admin', 'tenant_admin', 'dp_analyst', 'manager', 
    'accountant', 'auditor', 'employee', 'sst_specialist'
  ];
  if (validRoles.includes(lower as UserRole)) return lower as UserRole;

  if (lower.includes('global') || lower.includes('sistema') || lower.includes('system')) return 'system_admin';
  if (lower.includes('administrador') || lower.includes('admin')) return 'tenant_admin';
  if (lower.includes('analista') || lower.includes('dp')) return 'dp_analyst';
  if (lower.includes('sst')) return 'sst_specialist';
  if (lower.includes('gestor')) return 'manager';
  if (lower.includes('contador') || lower.includes('fiscal')) return 'accountant';
  if (lower.includes('auditor')) return 'auditor';
  if (lower.includes('colaborador')) return 'employee';

  return 'employee';
}

export const UserManagementService = {
  /**
   * Busca lista enriquecida de usuários do tenant
   */
  async fetchTenantUsers(): Promise<TenantUserDetails[]> {
    try {
      // 1. Tentar RPC enriquecida de alta performance
      const { data, error } = await supabase.rpc('list_tenant_users_with_profiles');
      if (!error && Array.isArray(data)) {
        return data.map((u: any) => ({
          tenant_user_id: u.tenant_user_id,
          user_id: u.user_id,
          tenant_id: u.tenant_id,
          role: u.role as UserRole,
          role_id: u.role_id,
          role_name: u.role_name || u.role,
          worker_id: u.worker_id,
          worker_name: u.worker_name,
          worker_cpf: u.worker_cpf,
          full_name: u.full_name || 'Usuário do Sistema',
          email: u.email || 'E-mail não informado',
          is_active: u.is_active !== false,
          created_at: u.created_at,
        }));
      }

      // 2. Fallback resiliente caso a RPC não tenha sido encontrada
      const { data: usersData, error: usersError } = await supabase
        .from('tenant_users')
        .select(`
          id,
          user_id,
          tenant_id,
          role,
          role_id,
          worker_id,
          created_at,
          roles ( name ),
          workers (
            id,
            people ( full_name, cpf )
          )
        `);

      if (usersError) {
        // Fallback básico para evitar travamento da tela em casos extremos
        const { data: basicUsers, error: basicError } = await supabase
          .from('tenant_users')
          .select('id, user_id, tenant_id, role, role_id, created_at');
        if (basicError) throw basicError;

        return (basicUsers || []).map((u: any) => ({
          tenant_user_id: u.id,
          user_id: u.user_id,
          tenant_id: u.tenant_id,
          role: (u.role || 'employee') as UserRole,
          role_id: u.role_id,
          role_name: u.role || 'Colaborador',
          worker_id: null,
          worker_name: null,
          worker_cpf: null,
          full_name: 'Usuário Registrado',
          email: 'Consulte perfil',
          is_active: true,
          created_at: u.created_at,
        }));
      }

      const userIds = (usersData || []).map((u: any) => u.user_id);
      let profilesMap: Record<string, any> = {};

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('user_profiles')
          .select('id, full_name, email')
          .in('id', userIds);

        if (profilesData) {
          profilesData.forEach((p: any) => {
            profilesMap[p.id] = p;
          });
        }
      }

      return (usersData || []).map((u: any) => {
        const workerPerson = u.workers?.people;
        const profile = profilesMap[u.user_id];
        return {
          tenant_user_id: u.id,
          user_id: u.user_id,
          tenant_id: u.tenant_id,
          role: (u.role || 'employee') as UserRole,
          role_id: u.role_id,
          role_name: u.roles?.name || u.role || 'Sem Perfil',
          worker_id: u.worker_id || null,
          worker_name: workerPerson?.full_name || null,
          worker_cpf: workerPerson?.cpf || null,
          full_name: profile?.full_name || workerPerson?.full_name || 'Usuário Existente',
          email: profile?.email || 'E-mail Oculto',
          is_active: (u as any).is_active !== false,
          created_at: u.created_at,
        };
      });
    } catch (err) {
      console.error("Erro ao carregar usuários do tenant:", err);
      throw err;
    }
  },

  /**
   * Busca colaboradores do tenant para vinculação de acesso
   */
  async fetchAvailableWorkers(): Promise<WorkerOption[]> {
    try {
      const { data, error } = await supabase
        .from('workers')
        .select(`
          id,
          esocial_matricula,
          people ( full_name, cpf )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((w: any) => ({
        id: w.id,
        full_name: w.people?.full_name || 'Colaborador sem nome',
        cpf: w.people?.cpf || '',
        matricula: w.esocial_matricula || '',
      })).sort((a, b) => a.full_name.localeCompare(b.full_name));
    } catch (err) {
      console.error("Erro ao buscar trabalhadores disponíveis:", err);
      return [];
    }
  },

  /**
   * Atualiza permissões, papel, status ativo e colaborador vinculado do usuário
   */
  async updateUserAccess(payload: UpdateUserAccessPayload): Promise<void> {
    try {
      // 1. Tentar RPC segura
      const { error: rpcError } = await supabase.rpc('update_tenant_user_access', {
        p_tenant_user_id: payload.tenant_user_id,
        p_role: payload.role,
        p_role_id: payload.role_id || null,
        p_worker_id: payload.worker_id || null,
        p_is_active: payload.is_active,
      });

      if (!rpcError) return;

      // 2. Fallback direto caso RPC não exista
      const { error: updateError } = await supabase
        .from('tenant_users')
        .update({
          role: payload.role,
          role_id: payload.role_id,
          worker_id: payload.worker_id,
          is_active: payload.is_active,
        })
        .eq('id', payload.tenant_user_id);

      if (updateError) throw updateError;
    } catch (err) {
      console.error("Erro ao atualizar acesso do usuário:", err);
      throw err;
    }
  }
};
