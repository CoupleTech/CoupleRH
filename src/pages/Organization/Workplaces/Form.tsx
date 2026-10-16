import { useState, useEffect } from "react";
import { 
  Save, 
  ArrowLeft,
  Loader2,
  AlertCircle,
  MapPin,
  Navigation,
  ShieldCheck,
  ShieldAlert,
  Info
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../contexts/AuthContext";
import { useCompany } from "../../../contexts/CompanyContext";
import { toast } from "sonner";

export default function WorkplaceForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedCompanyId, companies } = useCompany();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!id);
  const [capturingGps, setCapturingGps] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [costCenters, setCostCenters] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    company_id: selectedCompanyId || (companies.length > 0 ? companies[0].id : ""),
    cost_center_id: "",
    name: "",
    address: "",
    status: "ACTIVE",
    latitude: "",
    longitude: "",
    radius_meters: 50,
    enforce_geofence: false
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
          status: data.status,
          latitude: data.latitude !== null && data.latitude !== undefined ? String(data.latitude) : "",
          longitude: data.longitude !== null && data.longitude !== undefined ? String(data.longitude) : "",
          radius_meters: data.radius_meters ? Number(data.radius_meters) : 50,
          enforce_geofence: Boolean(data.enforce_geofence)
        });
      }
    } catch (err) {
      console.error("Erro ao buscar lotação:", err);
      setErrorMsg("Não foi possível carregar os dados da lotação.");
    } finally {
      setFetching(false);
    }
  };

  const handleCaptureCurrentGps = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocalização não é suportada pelo seu navegador.");
      return;
    }

    setCapturingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((prev) => ({
          ...prev,
          latitude: String(pos.coords.latitude.toFixed(7)),
          longitude: String(pos.coords.longitude.toFixed(7))
        }));
        toast.success(`Coordenadas capturadas com sucesso! (Precisão: ±${Math.round(pos.coords.accuracy)}m)`);
        setCapturingGps(false);
      },
      (err) => {
        console.warn("Erro ao obter geolocalização:", err);
        toast.error("Não foi possível obter sua localização. Verifique as permissões de GPS.");
        setCapturingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
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
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        radius_meters: formData.radius_meters ? parseInt(String(formData.radius_meters), 10) : 50,
        enforce_geofence: formData.enforce_geofence
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

        {/* Seção de Geolocalização e Geofencing (TB-05) */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Navigation className="text-primary-600" size={18} />
              <div>
                <h2 className="text-base font-semibold text-slate-800">
                  Perímetro de Ponto Digital & Geofencing (REP-P)
                </h2>
                <p className="text-xs text-slate-500">
                  Delimite as coordenadas geográficas da unidade para controle de presença no ponto mobile.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCaptureCurrentGps}
              disabled={capturingGps}
              className="px-3 py-1.5 rounded-lg border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 self-start sm:self-auto"
            >
              {capturingGps ? (
                <Loader2 size={14} className="animate-spin text-primary-600" />
              ) : (
                <Navigation size={14} />
              )}
              <span>{capturingGps ? "Capturando..." : "Obter Meu GPS Atual"}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Latitude Decimal</label>
              <input
                type="number"
                step="any"
                placeholder="Ex: -23.5505200"
                className="input font-mono text-sm"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
              />
              <p className="text-[11px] text-slate-400">Coordenada norte-sul do estabelecimento.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Longitude Decimal</label>
              <input
                type="number"
                step="any"
                placeholder="Ex: -46.6333080"
                className="input font-mono text-sm"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
              />
              <p className="text-[11px] text-slate-400">Coordenada leste-oeste do estabelecimento.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                Raio de Tolerância em Metros
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="5"
                  max="5000"
                  step="5"
                  placeholder="50"
                  className="input font-semibold pr-16"
                  value={formData.radius_meters}
                  onChange={(e) =>
                    setFormData({ ...formData, radius_meters: Number(e.target.value) })
                  }
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  metros
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Distância máxima aceita a partir do centro da unidade (padrão sugerido: 50m a 100m).
              </p>
            </div>

            <div className="space-y-1.5 flex flex-col justify-center">
              <label className="text-sm font-medium text-slate-700 mb-1">
                Política de Validação de Presença
              </label>
              <label className="relative flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={formData.enforce_geofence}
                  onChange={(e) =>
                    setFormData({ ...formData, enforce_geofence: e.target.checked })
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-900 block">
                    {formData.enforce_geofence
                      ? "⛔ Geofencing Restritivo Ativado"
                      : "📍 Apenas Auditoria (Não Bloqueia)"}
                  </span>
                  <span className="text-slate-500 text-[11px] block mt-0.5">
                    {formData.enforce_geofence
                      ? "Colaboradores presenciais fora do raio ou sem GPS serão estritamente impedidos de bater ponto."
                      : "Registra a distância do colaborador na auditoria, permitindo a marcação mesmo fora do raio."}
                  </span>
                </div>
              </label>
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
