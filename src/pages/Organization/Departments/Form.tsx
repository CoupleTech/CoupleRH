import { useState, useEffect } from "react";
import { ArrowLeft, Save, Building } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../contexts/AuthContext";
import { useCompany } from "../../../contexts/CompanyContext";

export default function DepartmentForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedCompanyId } = useCompany();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!id);
  const [errorMsg, setErrorMsg] = useState("");
  const [companies, setCompanies] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    company_id: selectedCompanyId || "",
    name: "",
    code: "",
    status: "ACTIVE",
  });

  useEffect(() => {
    fetchCompanies();
    if (id) {
      fetchDepartment();
    }
  }, [id]);

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from("companies")
        .select("id, corporate_name, trade_name")
        .order("corporate_name");
      
      if (error) throw error;
      if (data) {
        setCompanies(data);
      }
    } catch (err) {
      console.error("Erro ao buscar empresas:", err);
    }
  };

  const fetchDepartment = async () => {
    try {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .eq("id", id)
        .single();
        
      if (error) throw error;
      if (data) {
        setFormData({
          company_id: data.company_id || "",
          name: data.name || "",
          code: data.code || "",
          status: data.status || "ACTIVE",
        });
      }
    } catch (err: any) {
      console.error("Erro ao carregar departamento:", err);
      setErrorMsg("Falha ao carregar dados do departamento.");
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      if (!user) throw new Error("Usuário não autenticado.");

      // Buscar o tenant_id do usuário logado
      const { data: tenantData, error: tenantError } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (tenantError || !tenantData) {
        throw new Error(
          "Não foi possível identificar o tenant do usuário (organização).",
        );
      }

      const payload = {
        tenant_id: tenantData.tenant_id,
        company_id: formData.company_id || null, // null se for geral
        name: formData.name,
        code: formData.code,
        status: formData.status,
      };

      if (id) {
        const { error } = await supabase.from("departments").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("departments").insert([payload]);
        if (error) throw error;
      }

      navigate("/departamentos");
    } catch (error: any) {
      console.error("Erro ao salvar departamento:", error);
      setErrorMsg(
        error.message || "Ocorreu um erro inesperado ao salvar o departamento.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-up max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate("/departamentos")}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display">
            {id ? "Editar Departamento" : "Novo Departamento"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Cadastre as unidades organizacionais para vinculação de funcionários e custos.
          </p>
        </div>
      </div>

      <div className="panel p-0 min-h-[400px]">
        <div className="p-6 lg:p-8">
          {fetching ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              Carregando dados...
            </div>
          ) : (
            <>
              {errorMsg && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium">
                  {errorMsg}
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                    <Building size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">
                      Dados do Departamento
                    </h2>
                    <p className="text-sm text-slate-500">
                      Informações básicas
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="input-label">Empresa Vinculada</label>
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
                    <p className="text-xs text-slate-500 mt-1">Selecione a qual empresa este departamento pertence, ou deixe "Geral" para compartilhar entre todas.</p>
                  </div>

                  <div>
                    <label className="input-label">Nome do Departamento *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Recursos Humanos"
                      className="input"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label className="input-label">Código Interno</label>
                    <input
                      type="text"
                      placeholder="Ex: RH"
                      className="input"
                      value={formData.code}
                      onChange={(e) =>
                        setFormData({ ...formData, code: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label className="input-label">Status *</label>
                    <select
                      required
                      className="input"
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value })
                      }
                    >
                      <option value="ACTIVE">Ativo</option>
                      <option value="INACTIVE">Inativo</option>
                    </select>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex justify-end gap-3 mt-8">
                  <button
                    type="button"
                    onClick={() => navigate("/departamentos")}
                    className="btn-secondary"
                  >
                    Cancelar
                  </button>
                  <button type="submit" disabled={loading} className="btn-primary">
                    <Save size={18} />
                    {loading ? "Salvando..." : "Salvar Departamento"}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
