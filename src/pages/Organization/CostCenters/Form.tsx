import { useState, useEffect } from "react";
import { 
  Save, 
  ArrowLeft,
  Loader2,
  AlertCircle,
  Landmark
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../contexts/AuthContext";
import { useCompany } from "../../../contexts/CompanyContext";

export default function CostCenterForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedCompanyId, companies } = useCompany();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!id);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [formData, setFormData] = useState({
    company_id: selectedCompanyId || "",
    code: "",
    name: "",
    status: "ACTIVE"
  });

  useEffect(() => {
    if (id) {
      fetchCostCenter();
    }
  }, [id]);

  const fetchCostCenter = async () => {
    try {
      const { data, error } = await supabase
        .from("cost_centers")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      if (data) {
        setFormData({
          company_id: data.company_id || "",
          code: data.code,
          name: data.name,
          status: data.status
        });
      }
    } catch (err) {
      console.error("Erro ao buscar centro de custo:", err);
      setErrorMsg("Não foi possível carregar os dados do centro de custo.");
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
        code: formData.code,
        name: formData.name,
        status: formData.status,
      };

      if (id) {
        const { error } = await supabase
          .from("cost_centers")
          .update(payload)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cost_centers")
          .insert([payload]);
        if (error) throw error;
      }

      navigate("/centros-de-custo");
    } catch (err: any) {
      console.error("Erro ao salvar centro de custo:", err);
      setErrorMsg(err.message || "Ocorreu um erro ao salvar o centro de custo.");
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
          onClick={() => navigate('/centros-de-custo')}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-display tracking-tight">
            {id ? 'Editar Centro de Custo' : 'Novo Centro de Custo'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Preencha os dados abaixo para {id ? 'atualizar o' : 'cadastrar um novo'} centro de custo.
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
            <Landmark className="text-primary-500" size={18} />
            <h2 className="text-base font-semibold text-slate-800">Dados do Centro de Custo</h2>
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
                Se for um centro de custo corporativo, deixe como "Geral".
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                Código Contábil/Gerencial <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: 1.01.04"
                className="input font-mono"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                Nome do Centro de Custo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Diretoria Comercial"
                className="input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
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
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => navigate('/centros-de-custo')}
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
            <span>{id ? 'Salvar Alterações' : 'Cadastrar Centro de Custo'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
