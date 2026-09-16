import { useState, useEffect } from "react";
import { 
  Save, 
  ArrowLeft,
  Loader2,
  AlertCircle,
  MapPin
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../contexts/AuthContext";
import { useCompany } from "../../../contexts/CompanyContext";

export default function WorkplaceForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedCompanyId, companies } = useCompany();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!id);
  const [errorMsg, setErrorMsg] = useState("");
  const [costCenters, setCostCenters] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    company_id: selectedCompanyId || (companies.length > 0 ? companies[0].id : ""),
    cost_center_id: "",
    name: "",
    address: "",
    status: "ACTIVE"
  });

  useEffect(() => {
    if (id) {
      fetchWorkplace();
    }
  }, [id]);

  useEffect(() => {
    if (formData.company_id) {
      fetchCostCenters(formData.company_id);
    } else {
      setCostCenters([]);
    }
    // Não limpa o cost_center_id automaticamente se for a montagem inicial com id
    if (!id || (id && !fetching)) {
      setFormData(prev => ({ ...prev, cost_center_id: "" }));
    }
  }, [formData.company_id, id, fetching]);

  const fetchWorkplace = async () => {
    try {
      const { data, error } = await supabase
        .from("workplaces")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      if (data) {
        setFormData({
          company_id: data.company_id,
          cost_center_id: data.cost_center_id || "",
          name: data.name,
          address: data.address || "",
          status: data.status
        });
      }
    } catch (err) {
      console.error("Erro ao buscar lotação:", err);
      setErrorMsg("Não foi possível carregar os dados da lotação.");
    } finally {
      setFetching(false);
    }
  };

  const fetchCostCenters = async (companyId: string) => {
    try {
      let query = supabase.from("cost_centers").select("id, name, code, company_id").eq("status", "ACTIVE");
      
      if (companyId) {
        query = query.or(`company_id.eq.${companyId},company_id.is.null`);
      }
      
      const { data, error } = await query.order("name");
      if (error) throw error;
      setCostCenters(data || []);
    } catch (err) {
      console.error("Erro ao buscar centros de custo:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setErrorMsg("");
    
    if (!formData.company_id) {
      setErrorMsg("A Empresa vinculada é obrigatória para locais de trabalho.");
      return;
    }

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
        company_id: formData.company_id,
        cost_center_id: formData.cost_center_id || null,
        name: formData.name,
        address: formData.address || null,
        status: formData.status,
      };

      if (id) {
        const { error } = await supabase
          .from("workplaces")
          .update(payload)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("workplaces")
          .insert([payload]);
        if (error) throw error;
      }

      navigate("/lotacoes");
    } catch (err: any) {
      console.error("Erro ao salvar lotação:", err);
      setErrorMsg(err.message || "Ocorreu um erro ao salvar a lotação.");
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
          onClick={() => navigate('/lotacoes')}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-display tracking-tight">
            {id ? 'Editar Lotação' : 'Nova Lotação'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Preencha os dados abaixo para {id ? 'atualizar a' : 'cadastrar uma nova'} lotação (local de trabalho).
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
            <MapPin className="text-primary-500" size={18} />
            <h2 className="text-base font-semibold text-slate-800">Dados da Lotação</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">
                Empresa Vinculada <span className="text-red-500">*</span>
              </label>
              <select
                className="input"
                required
                value={formData.company_id}
                onChange={(e) =>
                  setFormData({ ...formData, company_id: e.target.value })
                }
              >
                <option value="">Selecione uma empresa...</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.trade_name || c.corporate_name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">
                Toda lotação (local de trabalho) precisa obrigatoriamente pertencer a uma empresa.
              </p>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">
                Nome da Lotação <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Sede Administrativa / Filial Sul"
                className="input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                Centro de Custo <span className="text-slate-400 font-normal">(Opcional)</span>
              </label>
              <select
                className="input"
                value={formData.cost_center_id}
                onChange={(e) =>
                  setFormData({ ...formData, cost_center_id: e.target.value })
                }
                disabled={!formData.company_id || costCenters.length === 0}
              >
                <option value="">Nenhum centro de custo...</option>
                {costCenters.map((cc) => (
                  <option key={cc.id} value={cc.id}>
                    {cc.name} ({cc.code}) {cc.company_id ? '' : '- Geral'}
                  </option>
                ))}
              </select>
              {!formData.company_id ? (
                <p className="text-[11px] text-orange-500">
                  Selecione uma empresa primeiro.
                </p>
              ) : costCenters.length === 0 ? (
                <p className="text-[11px] text-orange-500">
                  Nenhum centro de custo ativo para esta empresa.
                </p>
              ) : null}
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
                Endereço Completo
              </label>
              <textarea
                rows={3}
                placeholder="Rua, Número, Bairro, Cidade, Estado, CEP"
                className="input resize-none"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => navigate('/lotacoes')}
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
            <span>{id ? 'Salvar Alterações' : 'Cadastrar Lotação'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
