import { useState, useEffect } from "react";
import { 
  Save, 
  ArrowLeft,
  Loader2,
  AlertCircle,
  CalendarHeart
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../contexts/AuthContext";
import { useCompany } from "../../../contexts/CompanyContext";

export default function HolidayForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedCompanyId, companies } = useCompany();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!id);
  const [errorMsg, setErrorMsg] = useState("");
  
  const [formData, setFormData] = useState({
    company_id: selectedCompanyId || "",
    name: "",
    date: "",
    type: "NACIONAL",
    status: "ACTIVE"
  });

  useEffect(() => {
    if (id) {
      fetchHoliday();
    }
  }, [id]);

  useEffect(() => {
    // Feriado Nacional geralmente não tem empresa vinculada.
    if (formData.type === 'NACIONAL') {
      setFormData(prev => ({ ...prev, company_id: "" }));
    }
  }, [formData.type]);

  const fetchHoliday = async () => {
    try {
      const { data, error } = await supabase
        .from("holidays")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      if (data) {
        setFormData({
          company_id: data.company_id || "",
          name: data.name,
          date: data.date,
          type: data.type,
          status: data.status
        });
      }
    } catch (err) {
      console.error("Erro ao buscar feriado:", err);
      setErrorMsg("Não foi possível carregar os dados do feriado.");
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
        company_id: formData.company_id || null, // null para Nacional ou Feriados Gerais
        name: formData.name,
        date: formData.date,
        type: formData.type,
        status: formData.status,
      };

      if (id) {
        const { error } = await supabase
          .from("holidays")
          .update(payload)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("holidays")
          .insert([payload]);
        if (error) throw error;
      }

      navigate("/feriados");
    } catch (err: any) {
      console.error("Erro ao salvar feriado:", err);
      setErrorMsg(err.message || "Ocorreu um erro ao salvar o feriado.");
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
          onClick={() => navigate('/feriados')}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-display tracking-tight">
            {id ? 'Editar Feriado' : 'Novo Feriado'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Cadastre os feriados que afetarão o cálculo de dias úteis e ponto.
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
            <CalendarHeart className="text-primary-500" size={18} />
            <h2 className="text-base font-semibold text-slate-800">Dados do Feriado</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">
                Nome / Descrição do Feriado <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Confraternização Universal / Ano Novo"
                className="input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                Data do Feriado <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                className="input"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Tipo de Feriado</label>
              <select
                className="input"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="NACIONAL">Nacional</option>
                <option value="ESTADUAL">Estadual</option>
                <option value="MUNICIPAL">Municipal</option>
                <option value="EMPRESA">Recesso da Empresa</option>
              </select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">
                Empresa Aplicável
              </label>
              <select
                className="input"
                disabled={formData.type === 'NACIONAL'}
                value={formData.company_id}
                onChange={(e) =>
                  setFormData({ ...formData, company_id: e.target.value })
                }
              >
                <option value="">Todas as empresas (Geral)</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.trade_name || c.corporate_name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">
                {formData.type === 'NACIONAL' 
                  ? 'Feriados Nacionais afetam automaticamente todas as filiais e empresas.'
                  : 'Feriados municipais/estaduais devem ser vinculados à empresa específica (filial).'}
              </p>
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
            onClick={() => navigate('/feriados')}
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
            <span>{id ? 'Salvar Alterações' : 'Cadastrar Feriado'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
