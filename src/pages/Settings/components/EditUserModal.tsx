import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Shield, User, Check, Power, AlertCircle, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { 
  UserManagementService, 
  resolveRoleEnum,
  type TenantUserDetails, 
  type WorkerOption, 
} from "../../../services/settings/userManagementService";
import type { UserRole } from "../../../services/security/rbacService";

interface RoleOption {
  id: string;
  name: string;
  description: string;
  is_system_role: boolean;
}

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: TenantUserDetails | null;
  roles: RoleOption[];
  workers: WorkerOption[];
  onSuccess: () => void;
}

export default function EditUserModal({
  isOpen,
  onClose,
  user,
  roles,
  workers,
  onSuccess
}: EditUserModalProps) {
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [selectedRoleEnum, setSelectedRoleEnum] = useState<UserRole>("employee");
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>("");
  const [isActive, setIsActive] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && user) {
      setSelectedRoleId(user.role_id || "");
      setSelectedRoleEnum(user.role);
      setSelectedWorkerId(user.worker_id || "");
      setIsActive(user.is_active);
      setError(null);
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const handleRoleChange = (roleId: string) => {
    setSelectedRoleId(roleId);
    const foundRole = roles.find(r => r.id === roleId);
    if (foundRole) {
      setSelectedRoleEnum(resolveRoleEnum(foundRole.name));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoleEnum) {
      setError("Selecione um perfil de acesso.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await UserManagementService.updateUserAccess({
        tenant_user_id: user.tenant_user_id,
        role: selectedRoleEnum,
        role_id: selectedRoleId || null,
        worker_id: selectedWorkerId || null,
        is_active: isActive,
      });

      toast.success("Acessos do usuário atualizados com sucesso!");
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Erro ao salvar permissões:", err);
      setError(err.message || "Ocorreu um erro ao atualizar os acessos do usuário.");
      toast.error("Falha ao atualizar usuário.");
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Shield size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 font-display">Editar Permissões do Usuário</h2>
              <p className="text-xs text-slate-500">Governança de acesso e vinculação corporativa</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 text-sm rounded-lg border border-rose-100 flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* User Summary Card */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm">
                {user.full_name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">{user.full_name}</p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
            </div>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
              isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
            }`}>
              {isActive ? 'Ativo' : 'Inativo'}
            </span>
          </div>

          {/* Perfil de Acesso (Role) */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Shield size={16} className="text-blue-500" />
              Perfil de Acesso (RBAC)
            </label>
            <select
              value={selectedRoleId}
              onChange={e => handleRoleChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-800"
            >
              <option value="">Selecione um perfil...</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.is_system_role ? '(Sistema)' : '(Personalizado)'}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">
              Papel operacional: <strong className="text-slate-600 font-mono">{selectedRoleEnum}</strong>
            </p>
          </div>

          {/* Vínculo com Colaborador (Worker ID) */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Briefcase size={16} className="text-amber-500" />
              Vincular a Colaborador da Folha / RH (Opcional)
            </label>
            <select
              value={selectedWorkerId}
              onChange={e => setSelectedWorkerId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium text-slate-800"
            >
              <option value="">Nenhum colaborador vinculado (Acesso estritamente administrativo)</option>
              {workers.map(w => (
                <option key={w.id} value={w.id}>
                  {w.full_name} {w.cpf ? `(CPF: ${w.cpf})` : ''} {w.matricula ? `· Matrícula: ${w.matricula}` : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Necessário caso este usuário vá acessar o <strong>Portal do Colaborador</strong>, bater ponto mobile (REP-P) ou assinar recibos e documentos digitais.
            </p>
          </div>

          {/* Status Ativo/Inativo */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Power size={18} className={isActive ? "text-emerald-500" : "text-slate-400"} />
              <div>
                <p className="text-sm font-bold text-slate-800">Status de Acesso</p>
                <p className="text-xs text-slate-500">
                  {isActive ? "Usuário pode acessar e operar o sistema" : "Acesso bloqueado temporariamente"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                isActive ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-bold bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Salvar Alterações</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
