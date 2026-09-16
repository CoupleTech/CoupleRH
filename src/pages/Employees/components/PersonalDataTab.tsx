import { useState, useEffect } from "react";
import { Save, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../contexts/AuthContext";
import { useCompany } from "../../../contexts/CompanyContext";

export default function PersonalDataTab({ workerId, initialData, onSaved }: any) {
  const { user } = useAuth();
  const { selectedCompanyId } = useCompany();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [formData, setFormData] = useState({
    full_name: "",
    social_name: "",
    cpf: "",
    rg: "",
    birth_date: "",
    gender: "",
    zip_code: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    country: "Brasil",
    reference_point: "",
    residence_type: ""
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        full_name: initialData.full_name || "",
        social_name: initialData.social_name || "",
        cpf: initialData.cpf || "",
        rg: initialData.rg || "",
        birth_date: initialData.birth_date || "",
        gender: initialData.gender || "",
        zip_code: initialData.zip_code || "",
        street: initialData.street || "",
        number: initialData.number || "",
        complement: initialData.complement || "",
        neighborhood: initialData.neighborhood || "",
        city: initialData.city || "",
        state: initialData.state || "",
        country: initialData.country || "Brasil",
        reference_point: initialData.reference_point || "",
        residence_type: initialData.residence_type || ""
      });
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCompanyId) {
      setErrorMsg("Selecione uma empresa no topo antes de cadastrar.");
      return;
    }
    
    setErrorMsg("");
    setLoading(true);

    try {
      const { data: tenantData } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!tenantData) throw new Error("Tenant não encontrado");

      let finalPersonId = initialData?.id;

      // Se for novo, criar a Pessoa primeiro
      if (!workerId) {
        // 1. Inserir Pessoa
        const personPayload = {
          tenant_id: tenantData.tenant_id,
          ...formData,
          birth_date: formData.birth_date || null
        };
        
        const { data: personObj, error: personError } = await supabase
          .from("people")
          .insert([personPayload])
          .select("id")
          .single();
          
        if (personError) throw personError;
        finalPersonId = personObj.id;

        // 2. Criar o vínculo Worker (Empregado da empresa)
        const workerPayload = {
          tenant_id: tenantData.tenant_id,
          company_id: selectedCompanyId,
          person_id: finalPersonId
        };

        const { data: workerObj, error: workerError } = await supabase
          .from("workers")
          .insert([workerPayload])
          .select("id")
          .single();

        if (workerError) throw workerError;

        onSaved(workerObj.id); // Avisa o Profile que temos um novo worker
      } else {
        // Se já existe, apenas atualiza a Pessoa
        const updatePayload = {
          ...formData,
          birth_date: formData.birth_date || null
        };
        const { error } = await supabase
          .from("people")
          .update(updatePayload)
          .eq("id", finalPersonId);
          
        if (error) throw error;
        onSaved(workerId); // Mantém no mesmo
      }

    } catch (err: any) {
      console.error("Erro ao salvar dados pessoais:", err);
      // Tratamento para CPF duplicado (violação da constraint unique)
      if (err.code === '23505' && err.message.includes('cpf')) {
        setErrorMsg("Já existe uma pessoa cadastrada com este CPF neste sistema.");
      } else {
        setErrorMsg(err.message || "Ocorreu um erro ao salvar os dados.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="text-red-500 mt-0.5" size={18} />
          <p className="text-sm text-red-700">{errorMsg}</p>
        </div>
      )}

      {/* Identificação */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-6 pb-2 border-b border-slate-100">Identificação Civil</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium text-slate-700">Nome Completo <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              className="input"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Nome Social</label>
            <input
              type="text"
              className="input"
              value={formData.social_name}
              onChange={(e) => setFormData({ ...formData, social_name: e.target.value })}
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Gênero (eSocial)</label>
            <select
              className="input"
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
            >
              <option value="">Selecione...</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">CPF <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              className="input"
              value={formData.cpf}
              onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">RG</label>
            <input
              type="text"
              className="input"
              value={formData.rg}
              onChange={(e) => setFormData({ ...formData, rg: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Data de Nascimento</label>
            <input
              type="date"
              className="input"
              value={formData.birth_date}
              onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Endereço */}
      <div className="card p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-6 pb-2 border-b border-slate-100">Endereço (eSocial)</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-6 gap-5">
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium text-slate-700">CEP</label>
            <input
              type="text"
              className="input"
              value={formData.zip_code}
              onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 md:col-span-4">
            <label className="text-sm font-medium text-slate-700">Logradouro / Rua</label>
            <input
              type="text"
              className="input"
              value={formData.street}
              onChange={(e) => setFormData({ ...formData, street: e.target.value })}
            />
          </div>
          
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium text-slate-700">Número</label>
            <input
              type="text"
              className="input"
              value={formData.number}
              onChange={(e) => setFormData({ ...formData, number: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 md:col-span-4">
            <label className="text-sm font-medium text-slate-700">Complemento</label>
            <input
              type="text"
              className="input"
              value={formData.complement}
              onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
            />
          </div>

          <div className="space-y-1.5 md:col-span-3">
            <label className="text-sm font-medium text-slate-700">Bairro</label>
            <input
              type="text"
              className="input"
              value={formData.neighborhood}
              onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium text-slate-700">Cidade</label>
            <input
              type="text"
              className="input"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 md:col-span-1">
            <label className="text-sm font-medium text-slate-700">UF</label>
            <input
              type="text"
              className="input uppercase"
              maxLength={2}
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            />
          </div>
        </div>
      </div>


    </form>
  );
}
