import { useState, useEffect } from "react";
import { Save, Loader2, AlertCircle, FileText, Plus, Trash2 } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../contexts/AuthContext";
import { toast } from 'sonner';
import { confirmDialog } from '..\..\..\components\ConfirmDialogProvider';

export default function ({ workerId, initialData, onSaved }: any) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [documents, setDocuments] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  const [formData, setFormData] = useState({
    document_type: "",
    document_number: "",
    issuer: "",
    issue_date: "",
    expiration_date: ""
  });

  useEffect(() => {
    if (workerId) {
      fetchDocuments();
    } else {
      setLoading(false);
    }
  }, [workerId]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("worker_personal_documents")
        .select("*")
        .eq("worker_id", workerId)
        .eq("status", "ACTIVE")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (err) {
      console.error("Erro ao buscar documentos:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerId || !user) {
      setErrorMsg("É necessário salvar os dados pessoais básicos primeiro.");
      return;
    }
    
    setErrorMsg("");
    setSaving(true);

    try {
      const { data: tenantData } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!tenantData) throw new Error("Tenant não encontrado");

      const payload = {
        tenant_id: tenantData.tenant_id,
        worker_id: workerId,
        ...formData,
        issue_date: formData.issue_date || null,
        expiration_date: formData.expiration_date || null
      };

      const { error } = await supabase
        .from("worker_personal_documents")
        .insert([payload]);
        
      if (error) throw error;
      
      setIsAdding(false);
      setFormData({
        document_type: "",
        document_number: "",
        issuer: "",
        issue_date: "",
        expiration_date: ""
      });
      fetchDocuments();
    } catch (err: any) {
      console.error("Erro ao adicionar documento:", err);
      setErrorMsg(err.message || "Ocorreu um erro ao adicionar o documento.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!await confirmDialog("Tem certeza que deseja remover este documento?")) return;
    
    try {
      const { error } = await supabase
        .from("worker_personal_documents")
        .update({ status: 'INACTIVE', deleted_at: new Date().toISOString() })
        .eq("id", docId);
        
      if (error) throw error;
      fetchDocuments();
    } catch (err) {
      console.error("Erro ao remover documento:", err);
      toast.error("Erro ao remover documento.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="text-red-500 mt-0.5" size={18} />
          <p className="text-sm text-red-700">{errorMsg}</p>
        </div>
      )}

      {!isAdding ? (
        <>
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                Documentos e Certidões
              </h3>
              <p className="text-sm text-slate-500">
                Gerencie os dados dos documentos (RG, CNH, ASOs). Armazenamento restrito a metadados para otimização de espaço.
              </p>
            </div>
            <button
              onClick={async () => setIsAdding(true)}
              className="btn-primary flex items-center gap-2"
              disabled={!workerId}
            >
              <Plus size={16} />
              Adicionar Documento
            </button>
          </div>

          {!workerId ? (
            <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
              <p className="text-slate-500 text-sm">
                Salve os dados pessoais básicos para habilitar o cadastro de documentos.
              </p>
            </div>
          ) : documents.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-slate-700 font-medium">Nenhum documento registrado</h4>
              <p className="text-slate-500 text-sm mt-1">
                Adicione as informações de RGs, CNHs ou atestados admissionais.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {documents.map((doc) => (
                <div key={doc.id} className="card p-5 border-l-4 border-l-primary-500 hover:shadow-md transition-shadow bg-white flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                      {doc.document_type}
                    </h4>
                    <div className="mt-2 space-y-1 text-sm text-slate-600">
                      <div><span className="font-medium text-slate-700">Número:</span> {doc.document_number || '-'}</div>
                      <div><span className="font-medium text-slate-700">Órgão Emissor:</span> {doc.issuer || '-'}</div>
                      {doc.issue_date && (
                        <div><span className="font-medium text-slate-700">Emissão:</span> {new Date(new Date(doc.issue_date).getTime() + new Date(doc.issue_date).getTimezoneOffset() * 60000).toLocaleDateString("pt-BR")}</div>
                      )}
                      {doc.expiration_date && (
                        <div><span className="font-medium text-slate-700">Validade:</span> {new Date(new Date(doc.expiration_date).getTime() + new Date(doc.expiration_date).getTimezoneOffset() * 60000).toLocaleDateString("pt-BR")}</div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={async () => handleDelete(doc.id)}
                    className="text-slate-400 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <form onSubmit={handleSubmit} className="card p-6 border-l-4 border-l-primary-500">
          <h2 className="text-lg font-semibold text-slate-800 mb-6 pb-2 border-b border-slate-100">Novo Documento</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Tipo de Documento <span className="text-red-500">*</span></label>
              <select
                required
                className="input"
                value={formData.document_type}
                onChange={(e) => setFormData({ ...formData, document_type: e.target.value })}
              >
                <option value="">Selecione...</option>
                <option value="RG">RG</option>
                <option value="CPF">CPF</option>
                <option value="CNH">CNH</option>
                <option value="CTPS">CTPS (Carteira de Trabalho)</option>
                <option value="PIS/PASEP">PIS/PASEP</option>
                <option value="TITULO_ELEITOR">Título de Eleitor</option>
                <option value="CERTIDAO_NASCIMENTO">Certidão de Nascimento</option>
                <option value="CERTIDAO_CASAMENTO">Certidão de Casamento</option>
                <option value="ASO_ADMISSIONAL">ASO Admissional</option>
                <option value="COMPROVANTE_RESIDENCIA">Comprovante de Residência</option>
                <option value="OUTROS">Outros</option>
              </select>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Número do Documento</label>
              <input
                type="text"
                className="input"
                value={formData.document_number}
                onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Órgão Emissor / UF</label>
              <input
                type="text"
                className="input"
                placeholder="Ex: SSP/SP"
                value={formData.issuer}
                onChange={(e) => setFormData({ ...formData, issuer: e.target.value })}
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Data de Emissão</label>
              <input
                type="date"
                className="input"
                value={formData.issue_date}
                onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Data de Validade</label>
              <input
                type="date"
                className="input"
                value={formData.expiration_date}
                onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={async () => setIsAdding(false)}
              className="btn-secondary"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save size={18} />
              )}
              <span>Salvar Documento</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
