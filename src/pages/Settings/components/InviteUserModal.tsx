import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Mail, UserPlus } from "lucide-react";
import { supabase } from "../../../lib/supabase";

interface Role {
  id: string;
  name: string;
}

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  roles: Role[];
  onSuccess: () => void;
}

export default function InviteUserModal({ isOpen, onClose, roles, onSuccess }: InviteUserModalProps) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [roleId, setRoleId] = useState("");
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
      
      // Chamada para a Edge Function que usará o supabase admin para convidar o usuário
      // e criar o registro em tenant_users
      const { data, error: invokeError } = await supabase.functions.invoke('invite-user', {
        body: { email, full_name: fullName, role_id: roleId }
      });

      if (invokeError) throw invokeError;
      
      onSuccess();
      onClose();
      setEmail("");
      setFullName("");
      setRoleId("");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Ocorreu um erro ao convidar o usuário.");
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center">
              <UserPlus size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 font-display">Convidar Colaborador</h2>
              <p className="text-xs text-slate-500">Enviar acesso ao sistema</p>
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
            <label className="block text-sm font-bold text-slate-700 mb-1">Nome Completo</label>
            <input 
              type="text" 
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
              placeholder="Ex: João da Silva"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">E-mail Profissional</label>
            <div className="relative">
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                placeholder="nome@empresa.com.br"
              />
              <Mail className="absolute left-3 top-2.5 text-slate-400" size={16} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Perfil de Acesso (Role)</label>
            <select 
              value={roleId}
              onChange={e => setRoleId(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm appearance-none"
            >
              <option value="">Selecione um perfil...</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

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
              className="flex-1 py-2.5 px-4 bg-primary-600 text-white rounded-lg font-bold text-sm hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
