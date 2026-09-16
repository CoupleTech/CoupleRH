import { useState, useEffect } from "react";
import { 
  Building2, 
  Save, 
  ArrowLeft,
  Loader2,
  GitBranch,
  AlertCircle
} from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../contexts/AuthContext";
import { useCompany } from "../../../contexts/CompanyContext";

export default function SectorForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedCompanyId, companies } = useCompany();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!id);
  const [errorMsg, setErrorMsg] = useState("");
  const [departments, setDepartments] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    company_id: selectedCompanyId || "",
    department_id: "",
    name: "",
    status: "ACTIVE"
  });

  useEffect(() => {
    if (id) {
      fetchSector();
    }
  }, [id]);

  useEffect(() => {
    fetchDepartments(formData.company_id);
    // Reset department_id if company changes and the current department is not in the new company
    setFormData(prev => ({ ...prev, department_id: "" }));
  }, [formData.company_id]);

  const fetchSector = async () => {
    try {
      const { data, error } = await supabase
        .from("sectors")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      if (data) {
        setFormData({
          company_id: data.company_id || "",
          department_id: data.department_id,
          name: data.name,
          status: data.status
        });
      }
    } catch (err) {
      console.error("Erro ao buscar setor:", err);
      setErrorMsg("Não foi possível carregar os dados do setor.");
    } finally {
      setFetching(false);
    }
  };

  const fetchDepartments = async (companyId: string) => {
    try {
      let query = supabase.from("departments").select("id, name, company_id").eq("status", "ACTIVE");
      
      if (companyId) {
        query = query.or(`company_id.eq.${companyId},company_id.is.null`);
      } else {
        query = query.is("company_id", null);
      }
      
      const { data, error } = await query.order("name");
      if (error) throw error;
      setDepartments(data || []);
    } catch (err) {
      console.error("Erro ao buscar departamentos:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setErrorMsg("");
    
    if (!formData.department_id) {
      setErrorMsg("O departamento é obrigatório.");
      return;
    }

    setLoading(true);

    try {
      // Pega o tenant_id do usuário atual
      const { data: tenantData } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!tenantData) throw new Error("Tenant não encontrado");

      const payload = {
        tenant_id: tenantData.tenant_id,
        company_id: formData.company_id || null, // null se for geral
        department_id: formData.department_id,
        name: formData.name,
        status: formData.status,
      };

      if (id) {
        const { error } = await supabase
          .from("sectors")
          .update(payload)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("sectors")
          .insert([payload]);
        if (error) throw error;
      }

      navigate("/setores");
    } catch (err: any) {
      console.error("Erro ao salvar setor:", err);
      setErrorMsg(err.message || "Ocorreu um erro ao salvar o setor.");
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
          onClick={() => navigate('/setores')}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-display tracking-tight">
            {id ? 'Editar Setor' : 'Novo Setor'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Preencha os dados abaixo para {id ? 'atualizar o' : 'cadastrar um novo'} setor.
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
            <GitBranch className="text-primary-500" size={18} />
            <h2 className="text-base font-semibold text-slate-800">Dados do Setor</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
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
                Se for um setor corporativo/compartilhado, deixe como "Geral".
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                Departamento <span className="text-red-500">*</span>
              </label>
              <select
                className="input"
                required
                value={formData.department_id}
                onChange={(e) =>
                  setFormData({ ...formData, department_id: e.target.value })
                }
                disabled={departments.length === 0}
              >
                <option value="">Selecione o departamento...</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} {d.company_id ? '' : '(Geral)'}
                  </option>
                ))}
              </select>
              {departments.length === 0 && (
                <p className="text-[11px] text-orange-500">
                  Nenhum departamento cadastrado para a empresa selecionada.
                </p>
              )}
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">
                Nome do Setor <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Folha de Pagamento"
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
            onClick={() => navigate('/setores')}
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
            <span>{id ? 'Salvar Alterações' : 'Cadastrar Setor'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
