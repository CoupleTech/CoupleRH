import { useState, useEffect } from "react";
import { 
  Briefcase, 
  Save, 
  ArrowLeft,
  Loader2,
  AlertCircle
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../contexts/AuthContext";
import { useCompany } from "../../../contexts/CompanyContext";

const HIERARCHY_LEVELS = [
  { value: "estagiario", label: "Estagiário" },
  { value: "junior", label: "Júnior / Assistente" },
  { value: "pleno", label: "Pleno / Analista" },
  { value: "senior", label: "Sênior / Especialista" },
  { value: "coordenador", label: "Coordenador / Supervisor" },
  { value: "gerente", label: "Gerente" },
  { value: "diretor", label: "Diretor" },
  { value: "c_level", label: "C-Level / Sócio" },
];

export default function PositionForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedCompanyId, companies } = useCompany();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!id);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [formData, setFormData] = useState({
    company_id: selectedCompanyId || "",
    title: "",
    cbo: "",
    description: "",
    level: "",
    status: "ACTIVE"
  });

  useEffect(() => {
    if (id) {
      fetchPosition();
    }
  }, [id]);

  const fetchPosition = async () => {
    try {
      const { data, error } = await supabase
        .from("positions")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      if (data) {
        setFormData({
          company_id: data.company_id || "",
          title: data.title,
          cbo: data.cbo || "",
          description: data.description || "",
          level: data.level || "",
          status: data.status
        });
      }
    } catch (err) {
      console.error("Erro ao buscar cargo:", err);
      setErrorMsg("Não foi possível carregar os dados do cargo.");
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setErrorMsg("");
    setLoading(true);

    try {
      const { data: tenantData } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!tenantData) throw new Error("Tenant não encontrado");

      const payload = {
        tenant_id: tenantData.tenant_id,
        company_id: formData.company_id || null, // null se for geral
        title: formData.title,
        cbo: formData.cbo || null,
        description: formData.description || null,
        level: formData.level || null,
        status: formData.status,
      };

      if (id) {
        const { error } = await supabase
          .from("positions")
          .update(payload)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("positions")
          .insert([payload]);
        if (error) throw error;
      }

      navigate("/cargos");
    } catch (err: any) {
      console.error("Erro ao salvar cargo:", err);
      setErrorMsg(err.message || "Ocorreu um erro ao salvar o cargo.");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/cargos')}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-display tracking-tight">
            {id ? 'Editar Cargo' : 'Novo Cargo'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Preencha os dados abaixo para {id ? 'atualizar o' : 'cadastrar um novo'} cargo.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="text-red-500 mt-0.5" size={18} />
          <p className="text-sm text-red-700">{errorMsg}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-6 space-y-8">
        {/* Seção Principal */}
        <div>
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
            <Briefcase className="text-primary-500" size={18} />
            <h2 className="text-base font-semibold text-slate-800">Dados do Cargo</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">
                Empresa Vinculada
              </label>
              <select
                className="input"
                value={formData.company_id}
                onChange={(e) =>
                  setFormData({ ...formData, company_id: e.target.value })
                }
              >
                <option value="">Geral (Todas as empresas)</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.trade_name || c.corporate_name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">
                Se for um cargo que existe em todas as filiais/empresas, deixe como "Geral".
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                Título do Cargo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Analista de Sistemas"
                className="input"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                CBO
              </label>
              <input
                type="text"
                placeholder="Ex: 2124-05"
                className="input font-mono"
                value={formData.cbo}
                onChange={(e) => setFormData({ ...formData, cbo: e.target.value })}
              />
              <p className="text-[11px] text-slate-400">
                Classificação Brasileira de Ocupações (para eSocial).
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                Nível Hierárquico
              </label>
              <select
                className="input"
                value={formData.level}
                onChange={(e) => setFormData({ ...formData, level: e.target.value })}
              >
                <option value="">Selecione um nível...</option>
                {HIERARCHY_LEVELS.map(level => (
                  <option key={level.value} value={level.value}>{level.label}</option>
                ))}
              </select>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Status</label>
              <select
                className="input"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
              </select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">
                Descrição e Atividades (Opcional)
              </label>
              <textarea
                rows={4}
                placeholder="Descreva as responsabilidades e requisitos deste cargo..."
                className="input resize-none"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => navigate('/cargos')}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save size={18} />
            )}
            <span>{id ? 'Salvar Alterações' : 'Cadastrar Cargo'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
