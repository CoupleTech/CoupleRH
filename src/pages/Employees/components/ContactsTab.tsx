import { useState, useEffect } from "react";
import { Save, Loader2, AlertCircle, Phone, Mail, UserRound } from "lucide-react";
import { supabase } from "../../../lib/supabase";

export default function ContactsTab({ workerId, initialData, onSaved }: any) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [formData, setFormData] = useState({
    email: "",
    corporate_email: "",
    phone: "",
    mobile: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    emergency_contact_relation: ""
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        email: initialData.email || "",
        corporate_email: initialData.corporate_email || "",
        phone: initialData.phone || "",
        mobile: initialData.mobile || "",
        emergency_contact_name: initialData.emergency_contact_name || "",
        emergency_contact_phone: initialData.emergency_contact_phone || "",
        emergency_contact_relation: initialData.emergency_contact_relation || ""
      });
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerId || !initialData?.id) {
      setErrorMsg("É necessário salvar os dados pessoais básicos primeiro.");
      return;
    }
    
    setErrorMsg("");
    setLoading(true);

    try {
      const { error } = await supabase
        .from("people")
        .update(formData)
        .eq("id", initialData.id);
        
      if (error) throw error;
      onSaved(workerId);
    } catch (err: any) {
      console.error("Erro ao salvar contatos:", err);
      setErrorMsg(err.message || "Ocorreu um erro ao salvar os contatos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="text-red-500 mt-0.5" size={18} />
          <p className="text-sm text-red-700">{errorMsg}</p>
        </div>
      )}

      {/* Contatos Pessoais */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-6 pb-2 border-b border-slate-100">
          <Phone className="text-primary-500" size={20} />
          <h2 className="text-base font-semibold text-slate-800">Telefones e E-mails</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">E-mail Pessoal</label>
            <input
              type="email"
              className="input"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">E-mail Corporativo</label>
            <input
              type="email"
              className="input"
              value={formData.corporate_email}
              onChange={(e) => setFormData({ ...formData, corporate_email: e.target.value })}
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Celular / WhatsApp <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              className="input"
              placeholder="(00) 00000-0000"
              value={formData.mobile}
              onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Telefone Fixo / Recado</label>
            <input
              type="text"
              className="input"
              placeholder="(00) 0000-0000"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Contato de Emergência */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-6 pb-2 border-b border-slate-100">
          <UserRound className="text-orange-500" size={20} />
          <h2 className="text-base font-semibold text-slate-800">Contato de Emergência</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium text-slate-700">Nome do Contato</label>
            <input
              type="text"
              className="input"
              value={formData.emergency_contact_name}
              onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Grau de Parentesco</label>
            <input
              type="text"
              className="input"
              placeholder="Ex: Mãe, Cônjuge, Irmão"
              value={formData.emergency_contact_relation}
              onChange={(e) => setFormData({ ...formData, emergency_contact_relation: e.target.value })}
            />
          </div>

          <div className="space-y-1.5 md:col-span-1">
            <label className="text-sm font-medium text-slate-700">Telefone de Emergência</label>
            <input
              type="text"
              className="input"
              placeholder="(00) 00000-0000"
              value={formData.emergency_contact_phone}
              onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
            />
          </div>
        </div>
      </div>


    </form>
  );
}
