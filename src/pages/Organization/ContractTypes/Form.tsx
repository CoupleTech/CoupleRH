import { useState, useEffect } from "react";
import { 
  Save, 
  ArrowLeft,
  Loader2,
  AlertCircle,
  FileText,
  ShieldCheck
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../contexts/AuthContext";
import { useCompany } from "../../../contexts/CompanyContext";

export default function ContractTypeForm() {
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
    category: "CLT",
    term_type: "INDETERMINADO",
    default_days: "",
    has_fgts: true,
    has_13th: true,
    has_vacation: true,
    has_inss: true,
    status: "ACTIVE"
  });

  useEffect(() => {
    if (id) {
      fetchContractType();
    }
  }, [id]);

  // Limpa o prazo (default_days) se mudar para Indeterminado
  useEffect(() => {
    if (formData.term_type === 'INDETERMINADO' && !fetching) {
      setFormData(prev => ({ ...prev, default_days: "" }));
    }
  }, [formData.term_type, fetching]);

  const fetchContractType = async () => {
    try {
      const { data, error } = await supabase
        .from("contract_types")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      if (data) {
        setFormData({
          company_id: data.company_id || "",
          name: data.name,
          category: data.category,
          term_type: data.term_type,
          default_days: data.default_days ? String(data.default_days) : "",
          has_fgts: data.has_fgts,
          has_13th: data.has_13th,
          has_vacation: data.has_vacation,
          has_inss: data.has_inss,
          status: data.status
        });
      }
    } catch (err) {
      console.error("Erro ao buscar tipo de contrato:", err);
      setErrorMsg("Não foi possível carregar os dados.");
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
        company_id: formData.company_id || null, 
        name: formData.name,
        category: formData.category,
        term_type: formData.term_type,
        default_days: formData.term_type === 'DETERMINADO' && formData.default_days ? Number(formData.default_days) : null,
        has_fgts: formData.has_fgts,
        has_13th: formData.has_13th,
        has_vacation: formData.has_vacation,
        has_inss: formData.has_inss,
        status: formData.status,
      };

      if (id) {
        const { error } = await supabase
          .from("contract_types")
          .update(payload)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("contract_types")
          .insert([payload]);
        if (error) throw error;
      }

      navigate("/tipos-de-contrato");
    } catch (err: any) {
      console.error("Erro ao salvar tipo de contrato:", err);
      setErrorMsg(err.message || "Ocorreu um erro ao salvar o tipo de contrato.");
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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/tipos-de-contrato')}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-display tracking-tight">
            {id ? 'Editar Modelo' : 'Novo Modelo de Contrato'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure as regras do contrato que serão herdadas pelos funcionários.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="text-red-500 mt-0.5" size={18} />
          <p className="text-sm text-red-700">{errorMsg}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* PARTE 1: Dados Gerais */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-6 pb-2 border-b border-slate-100">
            <FileText className="text-primary-500" size={18} />
            <h2 className="text-base font-semibold text-slate-800">Definições Básicas</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">
                Nome do Modelo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: CLT Indeterminado, Contrato de Experiência..."
                className="input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Categoria Legal</label>
              <select
                className="input"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <option value="CLT">CLT (Consolidação das Leis do Trabalho)</option>
                <option value="ESTAGIO">Estágio</option>
                <option value="APRENDIZ">Jovem Aprendiz</option>
                <option value="TEMPORARIO">Temporário (Lei 6.019)</option>
                <option value="PJ">Pessoa Jurídica (PJ)</option>
                <option value="OUTROS">Outros / Avulso</option>
              </select>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Prazo do Contrato</label>
              <select
                className="input"
                value={formData.term_type}
                onChange={(e) => setFormData({ ...formData, term_type: e.target.value })}
              >
                <option value="INDETERMINADO">Indeterminado</option>
                <option value="DETERMINADO">Determinado</option>
              </select>
            </div>

            {formData.term_type === 'DETERMINADO' && (
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">
                  Dias Padrão do Contrato <span className="text-red-500">*</span>
                </label>
                <div className="relative max-w-xs">
                  <input
                    type="number"
                    required
                    placeholder="Ex: 90"
                    className="input pr-12"
                    value={formData.default_days}
                    onChange={(e) => setFormData({ ...formData, default_days: e.target.value })}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">dias</span>
                </div>
                <p className="text-[11px] text-slate-400">Tempo de vigência inicial sugerido para a admissão.</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Empresa Específica</label>
              <select
                className="input"
                value={formData.company_id}
                onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
              >
                <option value="">Todas as empresas (Geral)</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.trade_name || c.corporate_name}
                  </option>
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
          </div>
        </div>

        {/* PARTE 2: Direitos e Obrigações */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-6 pb-2 border-b border-slate-100">
            <ShieldCheck className="text-primary-500" size={18} />
            <h2 className="text-base font-semibold text-slate-800">Direitos e Incidências (Motor de Cálculo)</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
              <input 
                type="checkbox"
                className="mt-1 w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-600"
                checked={formData.has_fgts}
                onChange={(e) => setFormData({ ...formData, has_fgts: e.target.checked })}
              />
              <div>
                <p className="text-sm font-medium text-slate-800">Incidência de FGTS</p>
                <p className="text-xs text-slate-500 mt-0.5">Calcula e recolhe FGTS mensalmente para este modelo de contrato.</p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
              <input 
                type="checkbox"
                className="mt-1 w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-600"
                checked={formData.has_inss}
                onChange={(e) => setFormData({ ...formData, has_inss: e.target.checked })}
              />
              <div>
                <p className="text-sm font-medium text-slate-800">Incidência de INSS</p>
                <p className="text-xs text-slate-500 mt-0.5">Calcula e desconta contribuição previdenciária.</p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
              <input 
                type="checkbox"
                className="mt-1 w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-600"
                checked={formData.has_13th}
                onChange={(e) => setFormData({ ...formData, has_13th: e.target.checked })}
              />
              <div>
                <p className="text-sm font-medium text-slate-800">Direito a 13º Salário</p>
                <p className="text-xs text-slate-500 mt-0.5">Acumula avos para pagamento da gratificação natalina.</p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
              <input 
                type="checkbox"
                className="mt-1 w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-600"
                checked={formData.has_vacation}
                onChange={(e) => setFormData({ ...formData, has_vacation: e.target.checked })}
              />
              <div>
                <p className="text-sm font-medium text-slate-800">Direito a Férias</p>
                <p className="text-xs text-slate-500 mt-0.5">Acumula período aquisitivo e permite descanso remunerado.</p>
              </div>
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/tipos-de-contrato')}
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
            <span>{id ? 'Salvar Alterações' : 'Cadastrar Modelo'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
