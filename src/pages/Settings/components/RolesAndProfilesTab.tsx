import { useState, useEffect } from "react";
import { Users, Plus, Shield, Edit, Trash2, Mail, UserPlus, Key, Check, Briefcase, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import InviteUserModal from "./InviteUserModal";
import RoleModal from "./RoleModal";
import EditUserModal from "./EditUserModal";
import { toast } from 'sonner';
import { confirmDialog } from '../../../components/ConfirmDialogProvider';
import { 
  UserManagementService, 
  type TenantUserDetails, 
  type WorkerOption 
} from "../../../services/settings/userManagementService";

interface Role {
  id: string;
  name: string;
  description: string;
  is_system_role: boolean;
}

interface Permission {
  slug: string;
  name: string;
  module: string;
  description: string;
}

export default function RolesAndProfilesTab() {
  const [activeSubTab, setActiveSubTab] = useState<'usuarios' | 'perfis'>('usuarios');
  
  const [users, setUsers] = useState<TenantUserDetails[]>([]);
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<TenantUserDetails | null>(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);

      // 1. Fetch Roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('*')
        .order('name');
      if (rolesError) throw rolesError;
      setRoles(rolesData || []);
      
      if (rolesData && rolesData.length > 0 && !selectedRoleId) {
        setSelectedRoleId(rolesData[0].id);
      }

      // 2. Fetch Permissions
      const { data: permsData, error: permsError } = await supabase
        .from('permissions')
        .select('*');
      if (permsError) throw permsError;
      setPermissions(permsData || []);

      // 3. Fetch Enriched Users and Workers using UserManagementService
      const [enrichedUsers, availableWorkers] = await Promise.all([
        UserManagementService.fetchTenantUsers(),
        UserManagementService.fetchAvailableWorkers(),
      ]);

      setUsers(enrichedUsers);
      setWorkers(availableWorkers);

    } catch (err) {
      console.error("Erro ao buscar dados RBAC:", err);
      toast.error("Falha ao carregar usuários e perfis.");
    } finally {
      setLoading(false);
    }
  };

  const fetchRolePermissions = async (roleId: string) => {
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('permission_slug')
        .eq('role_id', roleId);
      if (error) throw error;
      setRolePermissions((data || []).map(d => d.permission_slug));
    } catch (err) {
      console.error("Erro ao buscar permissões da role:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedRoleId) {
      fetchRolePermissions(selectedRoleId);
    }
  }, [selectedRoleId]);

  const handleDeleteRole = async (role: Role) => {
    if (role.is_system_role) {
      toast.error("Não é possível excluir um perfil de sistema.");
      return;
    }
    if (await confirmDialog(`Tem certeza que deseja excluir o perfil '${role.name}'?`)) {
      await supabase.from('roles').delete().eq('id', role.id);
      if (selectedRoleId === role.id) setSelectedRoleId(null);
      fetchData();
    }
  };

  const handleOpenEditUser = (user: TenantUserDetails) => {
    setEditingUser(user);
    setIsEditUserModalOpen(true);
  };

  const selectedRole = roles.find(r => r.id === selectedRoleId);

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'system_admin':
      case 'tenant_admin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'dp_analyst':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'sst_specialist':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'manager':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'accountant':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'auditor':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="card overflow-hidden animate-in fade-in slide-in-from-bottom-2">
      <div className="p-6 bg-slate-50/50 border-b border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <Users size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 font-display">
                Acessos e Perfis (RBAC & Governança)
              </h2>
              <p className="text-sm text-slate-500">
                Gerencie permissões granulares, usuários ativos e vinculação com colaboradores da folha.
              </p>
            </div>
          </div>
          
          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => setActiveSubTab('usuarios')}
              className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${activeSubTab === 'usuarios' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Usuários ({users.length})
            </button>
            <button 
              onClick={() => setActiveSubTab('perfis')}
              className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${activeSubTab === 'perfis' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Perfis de Acesso ({roles.length})
            </button>
          </div>
        </div>
      </div>
      
      <div className="p-6">
        {loading ? (
          <div className="flex justify-center items-center py-16 text-slate-400 gap-3">
            <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            <span>Carregando governança de acessos...</span>
          </div>
        ) : activeSubTab === 'usuarios' ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-bold text-slate-800">Usuários Vinculados à Empresa</h3>
                <p className="text-xs text-slate-500">Controle de credenciais, papéis e colaboradores vinculados</p>
              </div>
              <button 
                onClick={() => setIsInviteModalOpen(true)}
                className="btn-primary py-2 px-4 shadow-sm text-sm flex items-center gap-2">
                <UserPlus size={16} />
                <span>Convidar Usuário</span>
              </button>
            </div>
            
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Usuário</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Perfil (Role)</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Colaborador Vinculado</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map(u => (
                    <tr key={u.tenant_user_id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900 text-sm">{u.full_name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <Mail size={12} className="text-slate-400" /> {u.email}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getRoleBadgeColor(u.role)}`}>
                          {u.role_name}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {u.worker_name ? (
                          <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                            <Briefcase size={13} className="text-amber-500" />
                            <span>{u.worker_name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Não vinculado</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {u.is_active ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                            <CheckCircle2 size={12} />
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                            <XCircle size={12} />
                            Inativo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button 
                          onClick={() => handleOpenEditUser(u)}
                          className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                          title="Editar Permissões do Usuário"
                        >
                          <Edit size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-500 text-sm">
                        Nenhum usuário cadastrado nesta empresa.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Lista de Perfis */}
            <div className="col-span-1 border border-slate-200 rounded-xl overflow-hidden flex flex-col h-[520px]">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                <span className="font-bold text-sm text-slate-700">Perfis Cadastrados</span>
                <button 
                  onClick={() => { setEditingRole(null); setIsRoleModalOpen(true); }}
                  className="text-blue-600 hover:text-blue-700 p-1 rounded-md hover:bg-blue-50 transition-colors"
                  title="Novo Perfil"
                >
                  <Plus size={18} />
                </button>
              </div>
              <div className="divide-y divide-slate-100 overflow-y-auto flex-1 bg-white">
                {roles.map(r => (
                  <div 
                    key={r.id} 
                    onClick={() => setSelectedRoleId(r.id)}
                    className={`px-4 py-3 cursor-pointer transition-colors border-l-4 ${selectedRoleId === r.id ? 'bg-blue-50/70 border-blue-500' : 'hover:bg-slate-50 border-transparent'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className={`font-bold text-sm ${selectedRoleId === r.id ? 'text-blue-900' : 'text-slate-700'}`}>
                        {r.name}
                      </div>
                      {r.is_system_role && (
                        <span className="text-[10px] uppercase bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-extrabold">
                          Sistema
                        </span>
                      )}
                    </div>
                    <div className={`text-xs mt-0.5 line-clamp-1 ${selectedRoleId === r.id ? 'text-blue-700' : 'text-slate-500'}`}>
                      {r.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Permissões do Perfil Selecionado */}
            <div className="col-span-1 md:col-span-2 border border-slate-200 rounded-xl overflow-hidden flex flex-col h-[520px]">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                <span className="font-bold text-sm text-slate-700">
                  Permissões: {selectedRole?.name || 'Selecione um perfil'}
                </span>
                {selectedRole?.is_system_role ? (
                  <span className="text-[10px] uppercase bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-extrabold flex items-center gap-1">
                    <Shield size={10} /> Sistema (Imutável)
                  </span>
                ) : selectedRole ? (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => { setEditingRole(selectedRole); setIsRoleModalOpen(true); }}
                      className="text-slate-400 hover:text-blue-600 transition-colors p-1" title="Editar Perfil">
                      <Edit size={16} />
                    </button>
                    <button 
                      onClick={() => handleDeleteRole(selectedRole)}
                      className="text-slate-400 hover:text-rose-600 transition-colors p-1" title="Excluir Perfil">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : null}
              </div>
              
              <div className="p-4 flex-1 overflow-y-auto space-y-6 bg-white">
                {selectedRole ? (
                  <>
                    <p className="text-sm text-slate-600 mb-4">{selectedRole.description}</p>
                    
                    {Array.from(new Set(permissions.map(p => p.module))).map(module => (
                      <div key={module} className="mb-6">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-100 pb-1 flex items-center justify-between">
                          <span>Módulo: {module}</span>
                          <span className="text-[10px] font-normal text-slate-400">
                            {permissions.filter(p => p.module === module && rolePermissions.includes(p.slug)).length} de {permissions.filter(p => p.module === module).length} autorizadas
                          </span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {permissions.filter(p => p.module === module).map(perm => {
                            const hasPerm = rolePermissions.includes(perm.slug);
                            return (
                              <div key={perm.slug} className={`p-2.5 rounded-lg border flex items-start gap-2.5 transition-all ${
                                hasPerm ? 'bg-blue-50/40 border-blue-200' : 'bg-slate-50/50 border-slate-100 opacity-60'
                              }`}>
                                <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 ${hasPerm ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                                  {hasPerm && <Check size={12} strokeWidth={3} />}
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-slate-800">{perm.name}</div>
                                  <div className="text-[11px] text-slate-500 leading-tight mt-0.5">{perm.description}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {selectedRole.is_system_role && (
                      <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-3 mt-8">
                        <Shield className="text-blue-500 mt-0.5 shrink-0" size={16} />
                        <p className="text-xs text-blue-800">
                          <strong>Perfil Canônico do Sistema:</strong> Este perfil segue a matriz canônica da CLT e RBAC P8. Para criar regras personalizadas para sua empresa, clique em "+ Novo Perfil".
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400">
                    <Key size={48} className="mb-4 opacity-20" />
                    <p>Selecione um perfil para ver as permissões</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <InviteUserModal 
        isOpen={isInviteModalOpen} 
        onClose={() => setIsInviteModalOpen(false)}
        roles={roles}
        workers={workers}
        onSuccess={fetchData}
      />

      <EditUserModal
        isOpen={isEditUserModalOpen}
        onClose={() => { setIsEditUserModalOpen(false); setEditingUser(null); }}
        user={editingUser}
        roles={roles}
        workers={workers}
        onSuccess={fetchData}
      />
      
      <RoleModal 
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        roleToEdit={editingRole}
        allPermissions={permissions}
        currentRolePermissions={rolePermissions}
        onSuccess={() => { setIsRoleModalOpen(false); fetchData(); }}
      />
    </div>
  );
}
