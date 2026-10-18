import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Mail, UserPlus, Briefcase, Shield } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { resolveRoleEnum, type WorkerOption } from "../../../services/settings/userManagementService";
import { toast } from "sonner";

interface Role {
  id: string;
  name: string;
}

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  roles: Role[];
  workers?: WorkerOption[];
  onSuccess: () => void;
}

export default function InviteUserModal({ isOpen, onClose, roles, workers = [], onSuccess }: InviteUserModalProps) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [roleId, setRoleId] = useState("");
  const [workerId, setWorkerId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !roleId || !fullName) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const selectedRole = roles.find(r => r.id === roleId);
      const effectiveRole = resolveRoleEnum(selectedRole?.name);

      // Chamada para a Edge Function que usará o supabase admin para convidar o usuário
      // e criar o registro em tenant_users com a role devida
      const { data, error: invokeError } = await supabase.functions.invoke('invite-user', {
        body: { 
          email: email.trim().toLowerCase(), 
          full_name: fullName.trim(), 
          role_id: roleId,
          role: effectiveRole,
          worker_id: workerId || null
        }
      });

      if (invokeError) throw invokeError;
      
      toast.success("Convite enviado com sucesso!");
      onSuccess();
      onClose();
      setEmail("");
      setFullName("");
      setRoleId("");
      setWorkerId("");
    } catch (err: any) {
      console.error("Erro ao convidar usuário:", err);
      setError(err.message || "Ocorreu um erro ao convidar o usuário.");
      toast.error("Falha ao enviar convite.");
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <UserPlus size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 font-display">Convidar Usuário</h2>
              <p className="text-xs text-slate-500">Enviar acesso corporativo ao sistema</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 text-sm rounded-lg border border-rose-100">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Nome Completo *</label>
            <input 
              type="text" 
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
              placeholder="Ex: João da Silva"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">E-mail Profissional *</label>
            <div className="relative">
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                placeholder="nome@empresa.com.br"
                required
              />
              <Mail className="absolute left-3 top-2.5 text-slate-400" size={16} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Shield size={14} className="text-blue-500" />
              Perfil de Acesso (Role) *
            </label>
            <select 
              value={roleId}
              onChange={e => setRoleId(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
              required
            >
              <option value="">Selecione um perfil...</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {workers.length > 0 && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Briefcase size={14} className="text-amber-500" />
                Vincular Colaborador (Opcional)
              </label>
              <select 
                value={workerId}
                onChange={e => setWorkerId(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm font-medium"
              >
                <option value="">Nenhum (Acesso exclusivamente administrativo)</option>
                {workers.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.full_name} {w.cpf ? `(${w.cpf})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Vincula o usuário ao seu registro de empregado para liberar o Portal do Colaborador.
              </p>
            </div>
          )}

          <div className="pt-4 flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 bg-white border border-slate-200 text-slate-700 rounded-lg font-bold text-sm hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 px-4 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
            >
              {loading ? "Enviando..." : "Enviar Convite"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
