import { useState, useEffect } from "react";
import { Users, Plus, Shield, Edit, Trash2, Mail, UserPlus, Key, Check } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import InviteUserModal from "./InviteUserModal";
import RoleModal from "./RoleModal";
import { toast } from 'sonner';

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

interface TenantUser {
  id: string;
  user_id: string;
  role_id: string;
  role_name: string;
  full_name: string;
  email: string;
  created_at: string;
}

export default function () {
  const [activeSubTab, setActiveSubTab] = useState<'usuarios' | 'perfis'>('usuarios');
  
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch Roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('*')
        .order('name');
      if (rolesError) throw rolesError;
      setRoles(rolesData || []);
      
      if (rolesData && rolesData.length > 0 && !selectedRoleId) {
        setSelectedRoleId(rolesData[0].id);
      }

      // Fetch Permissions
      const { data: permsData, error: permsError } = await supabase
        .from('permissions')
        .select('*');
      if (permsError) throw permsError;
      setPermissions(permsData || []);

      // Fetch Users 
      const { data: usersData, error: usersError } = await supabase
        .from('tenant_users')
        .select(`
          id,
          user_id,
          role_id,
          created_at,
          roles ( name )
        `);
      if (usersError) throw usersError;

      // Manual join with user_profiles since FK might not be strictly defined
      const userIds = (usersData || []).map(u => u.user_id);
      
      let profilesMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('user_profiles')
          .select('id, full_name, email')
          .in('id', userIds);
          
        if (!profilesError && profilesData) {
          profilesData.forEach(p => {
            profilesMap[p.id] = p;
          });
        }
      }
      
      const formattedUsers = (usersData || []).map((u: any) => ({
        id: u.id,
        user_id: u.user_id,
        role_id: u.role_id,
        role_name: u.roles?.name || 'Sem Perfil',
        full_name: profilesMap[u.user_id]?.full_name || 'Usuário Existente',
        email: profilesMap[u.user_id]?.email || 'E-mail Oculto',
        created_at: u.created_at
      }));
      setUsers(formattedUsers);

    } catch (err) {
      console.error("Erro ao buscar dados RBAC:", err);
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

  const selectedRole = roles.find(r => r.id === selectedRoleId);

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
                Acessos e Perfis (RBAC)
              </h2>
              <p className="text-sm text-slate-500">
                Gerencie permissões e os usuários que têm acesso ao sistema.
              </p>
            </div>
          </div>
          
          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={async () => setActiveSubTab('usuarios')}
              className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${activeSubTab === 'usuarios' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Usuários
            </button>
            <button 
              onClick={async () => setActiveSubTab('perfis')}
              className={`px-4 py-2 text-sm font-bold rounded-md transition-all ${activeSubTab === 'perfis' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Perfis de Acesso
            </button>
          </div>
        </div>
      </div>
      
      <div className="p-6">
        {loading ? (
          <div className="flex justify-center py-12 text-slate-400">Carregando...</div>
        ) : activeSubTab === 'usuarios' ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800">Usuários Ativos</h3>
              <button 
                onClick={async () => setIsInviteModalOpen(true)}
                className="btn-primary py-2 px-4 shadow-md text-sm">
                <UserPlus size={16} />
                <span>Convidar Usuário</span>
              </button>
            </div>
            
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Usuário</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Perfil (Role)</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900 text-sm">{u.full_name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Mail size={12} /> {u.email}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                          {u.role_name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          Ativo
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-slate-400 hover:text-primary-600 p-1 transition-colors">
                          <Edit size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500 text-sm">
                        Nenhum usuário encontrado.
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
            <div className="col-span-1 border border-slate-200 rounded-lg overflow-hidden flex flex-col h-[500px]">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                <span className="font-bold text-sm text-slate-700">Perfis Cadastrados</span>
                <button 
                  onClick={async () => { setEditingRole(null); setIsRoleModalOpen(true); }}
                  className="text-primary-600 hover:text-primary-700 p-1">
                  <Plus size={18} />
                </button>
              </div>
              <div className="divide-y divide-slate-100 overflow-y-auto flex-1 bg-white">
                {roles.map(r => (
                  <div 
                    key={r.id} 
                    onClick={async () => setSelectedRoleId(r.id)}
                    className={`px-4 py-3 cursor-pointer transition-colors border-l-4 ${selectedRoleId === r.id ? 'bg-primary-50 border-primary-500' : 'hover:bg-slate-50 border-transparent'}`}
                  >
                    <div className={`font-bold text-sm ${selectedRoleId === r.id ? 'text-primary-900' : 'text-slate-700'}`}>
                      {r.name}
                    </div>
                    <div className={`text-xs mt-0.5 line-clamp-1 ${selectedRoleId === r.id ? 'text-primary-700' : 'text-slate-500'}`}>
                      {r.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Permissões do Perfil Selecionado */}
            <div className="col-span-1 md:col-span-2 border border-slate-200 rounded-lg overflow-hidden flex flex-col h-[500px]">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                <span className="font-bold text-sm text-slate-700">
                  Permissões: {selectedRole?.name || 'Selecione um perfil'}
                </span>
                {selectedRole?.is_system_role ? (
                  <span className="text-[10px] uppercase bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-extrabold flex items-center gap-1">
                    <Shield size={10} /> Sistema
                  </span>
                ) : selectedRole ? (
                  <div className="flex gap-2">
                    <button 
                      onClick={async () => { setEditingRole(selectedRole); setIsRoleModalOpen(true); }}
                      className="text-slate-400 hover:text-primary-600 transition-colors p-1" title="Editar Perfil">
                      <Edit size={16} />
                    </button>
                    <button 
                      onClick={async () => handleDeleteRole(selectedRole)}
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
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-100 pb-1">
                          Módulo: {module}
                        </h4>
                        <div className="space-y-3">
                          {permissions.filter(p => p.module === module).map(perm => {
                            const hasPerm = rolePermissions.includes(perm.slug);
                            return (
                              <div key={perm.slug} className="flex items-start gap-3">
                                <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 ${hasPerm ? 'bg-primary-500' : 'bg-slate-200'}`}>
                                  {hasPerm && <Check size={12} className="text-white" />}
                                </div>
                                <div>
                                  <div className="text-sm font-bold text-slate-800">{perm.name}</div>
                                  <div className="text-xs text-slate-500">{perm.description}</div>
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
                          <strong>Perfil de Sistema:</strong> Este é um perfil padrão e não pode ser alterado. Para permissões customizadas, crie um novo perfil.
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
