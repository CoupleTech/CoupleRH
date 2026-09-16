import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Shield, Check } from "lucide-react";
import { supabase } from "../../../lib/supabase";

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

interface RoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  roleToEdit: Role | null;
  allPermissions: Permission[];
  currentRolePermissions: string[];
  onSuccess: () => void;
}

export default function RoleModal({ isOpen, onClose, roleToEdit, allPermissions, currentRolePermissions, onSuccess }: RoleModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (roleToEdit) {
        setName(roleToEdit.name);
        setDescription(roleToEdit.description);
        setSelectedPerms(currentRolePermissions);
      } else {
        setName("");
        setDescription("");
        setSelectedPerms([]);
      }
      setError(null);
    }
  }, [isOpen, roleToEdit, currentRolePermissions]);

  if (!isOpen) return null;

  const togglePermission = (slug: string) => {
    if (selectedPerms.includes(slug)) {
      setSelectedPerms(selectedPerms.filter(p => p !== slug));
    } else {
      setSelectedPerms([...selectedPerms, slug]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("O nome do perfil é obrigatório.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Obter tenant atual
      const { data: tenantUsers } = await supabase.from('tenant_users').select('tenant_id').limit(1);
      const tenantId = tenantUsers?.[0]?.tenant_id;
      if (!tenantId) throw new Error("Tenant não encontrado");

      let roleId = roleToEdit?.id;

      if (roleId) {
        // Atualizar
        const { error: updateError } = await supabase
          .from('roles')
          .update({ name, description })
          .eq('id', roleId);
        if (updateError) throw updateError;
        
        // Limpar permissões antigas
        await supabase.from('role_permissions').delete().eq('role_id', roleId);
      } else {
        // Inserir
        const { data: newRole, error: insertError } = await supabase
          .from('roles')
          .insert({ tenant_id: tenantId, name, description, is_system_role: false })
          .select()
          .single();
        if (insertError) throw insertError;
        roleId = newRole.id;
      }

      // Inserir novas permissões
      if (selectedPerms.length > 0) {
        const permsToInsert = selectedPerms.map(slug => ({
          role_id: roleId,
          permission_slug: slug
        }));
        const { error: permError } = await supabase.from('role_permissions').insert(permsToInsert);
        if (permError) throw permError;
      }

      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Ocorreu um erro ao salvar o perfil.");
    } finally {
      setLoading(false);
    }
  };

  // Agrupar permissões por módulo
  const modules = Array.from(new Set(allPermissions.map(p => p.module)));

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center">
              <Shield size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 font-display">
                {roleToEdit ? "Editar Perfil" : "Novo Perfil de Acesso"}
              </h2>
              <p className="text-xs text-slate-500">Defina o nome e as permissões</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            {error && (
              <div className="p-3 bg-rose-50 text-rose-700 text-sm rounded-lg border border-rose-100 shrink-0">
                {error}
              </div>
            )}

            <div className="space-y-4 shrink-0">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Nome do Perfil</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                  placeholder="Ex: Gerente de Loja"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Descrição</label>
                <textarea 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm resize-none h-20"
                  placeholder="Descreva a função deste perfil..."
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <h3 className="font-bold text-slate-800 mb-4">Permissões de Acesso</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6">
                {modules.map(module => (
                  <div key={module} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pb-2 border-b border-slate-200">
                      {module}
                    </h4>
                    <div className="space-y-3">
                      {allPermissions.filter(p => p.module === module).map(perm => {
                        const isSelected = selectedPerms.includes(perm.slug);
                        return (
                          <label key={perm.slug} className="flex items-start gap-3 cursor-pointer group">
                            <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-primary-500 border-primary-500' : 'bg-white border-slate-300 group-hover:border-primary-400'}`}>
                              {isSelected && <Check size={12} className="text-white" />}
                            </div>
                            <input 
                              type="checkbox"
                              className="hidden"
                              checked={isSelected}
                              onChange={() => togglePermission(perm.slug)}
                            />
                            <div>
                              <div className="text-sm font-bold text-slate-700 group-hover:text-primary-700 transition-colors">{perm.name}</div>
                              <div className="text-[10px] text-slate-500 leading-tight mt-0.5">{perm.description}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-slate-100 bg-slate-50/50 shrink-0 flex justify-end gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="py-2.5 px-6 bg-white border border-slate-200 text-slate-700 rounded-lg font-bold text-sm hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="py-2.5 px-6 bg-primary-600 text-white rounded-lg font-bold text-sm hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? "Salvando..." : "Salvar Perfil"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
