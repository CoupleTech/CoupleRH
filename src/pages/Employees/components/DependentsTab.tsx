import { useState, useEffect } from "react";
import { Plus, Users, Loader2, AlertCircle, Pencil, Trash2, Calendar, FileText } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../contexts/AuthContext";
import { format, parseISO } from "date-fns";
import { toast } from 'sonner';
import { confirmDialog } from '../../../components/ConfirmDialogProvider';

const RELATIONSHIPS = [
  { value: "FILHO", label: "Filho(a)" },
  { value: "CONJUGE", label: "Cônjuge / Companheiro(a)" },
  { value: "ENTEADO", label: "Enteado(a)" },
  { value: "PAI_MAE", label: "Pai / Mãe" },
  { value: "OUTRO", label: "Outro" }
];

export default function ({ workerId, onSaved }: any) {
  const { user } = useAuth();
  const [dependents, setDependents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [formData, setFormData] = useState<any>({
    id: null,
    name: "",
    cpf: "",
    birth_date: "",
    relationship: "FILHO",
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: "",
    is_irrf_dependent: false,
    is_family_allowance_dependent: false,
    has_disability: false,
    birth_certificate_number: "",
    vaccination_card_date: "",
    school_frequency_date: ""
  });

  useEffect(() => {
    if (workerId) {
      fetchDependents();
    } else {
      setLoading(false);
    }
  }, [workerId]);

  const fetchDependents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("dependents")
        .select("*")
        .eq("worker_id", workerId)
        .order("start_date", { ascending: false });

      if (error) throw error;
      setDependents(data || []);
    } catch (err) {
      console.error("Erro ao buscar dependentes:", err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = async () => {
    setFormData({
      id: null,
      name: "",
      cpf: "",
      birth_date: "",
      relationship: "FILHO",
      start_date: format(new Date(), "yyyy-MM-dd"),
      end_date: "",
      is_irrf_dependent: false,
      is_family_allowance_dependent: false,
      has_disability: false,
      birth_certificate_number: "",
      vaccination_card_date: "",
      school_frequency_date: ""
    });
    setErrorMsg("");
  };

  const handleEdit = async (dep: any) => {
    setFormData({
      id: dep.id,
      name: dep.name,
      cpf: dep.cpf || "",
      birth_date: dep.birth_date,
      relationship: dep.relationship,
      start_date: dep.start_date,
      end_date: dep.end_date || "",
      is_irrf_dependent: dep.is_irrf_dependent,
      is_family_allowance_dependent: dep.is_family_allowance_dependent,
      has_disability: dep.has_disability,
      birth_certificate_number: dep.birth_certificate_number || "",
      vaccination_card_date: dep.vaccination_card_date || "",
      school_frequency_date: dep.school_frequency_date || ""
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!await confirmDialog("Tem certeza que deseja excluir este dependente? Esta ação apagará o histórico folha para ele.")) return;
    try {
      const { error } = await supabase.from("dependents").delete().eq("id", id);
      if (error) throw error;
      fetchDependents();
      onSaved();
    } catch (err) {
      console.error("Erro ao excluir", err);
      toast.error("Erro ao excluir dependente.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
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
        name: formData.name,
        cpf: formData.cpf || null,
        birth_date: formData.birth_date,
        relationship: formData.relationship,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        is_irrf_dependent: formData.is_irrf_dependent,
        is_family_allowance_dependent: formData.is_family_allowance_dependent,
        has_disability: formData.has_disability,
        birth_certificate_number: formData.birth_certificate_number || null,
        vaccination_card_date: formData.vaccination_card_date || null,
        school_frequency_date: formData.school_frequency_date || null
      };

      if (formData.id) {
        const { error } = await supabase.from("dependents").update(payload).eq("id", formData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("dependents").insert([payload]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      resetForm();
      fetchDependents();
      onSaved();
    } catch (err: any) {
      console.error("Erro ao salvar dependente:", err);
      setErrorMsg(err.message || "Erro ao salvar dependente.");
    } finally {
      setSaving(false);
    }
  };

  if (!workerId) {
    return (
      <div className="card p-8 text-center text-slate-500">
        Você precisa salvar os <strong>Dados Pessoais</strong> primeiro antes de cadastrar dependentes.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center">
            <Users className="text-primary-600" size={24} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Dependentes e Beneficiários</h2>
            <p className="text-sm text-slate-500">Gerencie dependentes de IRRF, Salário-Família e benefícios.</p>
          </div>
        </div>
        <button
          onClick={async () => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="btn-primary"
        >
          <Plus size={18} />
          Adicionar Dependente
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : dependents.length === 0 ? (
        <div className="card p-12 text-center text-slate-500 border-dashed border-2">
          Nenhum dependente cadastrado ainda.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {dependents.map((dep) => (
            <div key={dep.id} className="card p-5 hover:border-primary-200 transition-colors">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-slate-800">{dep.name}</h3>
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mt-0.5">
                    {RELATIONSHIPS.find(r => r.value === dep.relationship)?.label || dep.relationship}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={async () => handleEdit(dep)} className="p-1.5 text-slate-400 hover:text-primary-600 rounded-md hover:bg-primary-50">
                    <Pencil size={16} />
                  </button>
                  <button onClick={async () => handleDelete(dep.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2 mb-4">
                {dep.is_irrf_dependent && (
                  <span className="px-2 py-1 bg-purple-50 text-purple-700 text-xs font-medium rounded-md border border-purple-100">IRRF</span>
                )}
                {dep.is_family_allowance_dependent && (
                  <span className="px-2 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-md border border-green-100">Salário Família</span>
                )}
                {dep.has_disability && (
                  <span className="px-2 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-md border border-amber-100">Inválido/Deficiência</span>
                )}
                {!dep.is_irrf_dependent && !dep.is_family_allowance_dependent && !dep.has_disability && (
                  <span className="px-2 py-1 bg-slate-50 text-slate-600 text-xs font-medium rounded-md border border-slate-200">Apenas Cadastro</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-y-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-slate-400" />
                  <span>Nasc: {format(parseISO(dep.birth_date), "dd/MM/yyyy")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-slate-400" />
                  <span>CPF: {dep.cpf || 'Não inf.'}</span>
                </div>
                <div className="flex items-center gap-2 col-span-2 text-xs">
                  <Calendar size={14} className="text-slate-400" />
                  <span>
                    Vigência: {format(parseISO(dep.start_date), "dd/MM/yyyy")} 
                    {dep.end_date ? ` até ${format(parseISO(dep.end_date), "dd/MM/yyyy")}` : ' em diante'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 sticky top-0 bg-white z-10 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">
                {formData.id ? "Editar Dependente" : "Novo Dependente"}
              </h2>
              <button onClick={async () => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                &times;
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {errorMsg && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                  <AlertCircle className="text-red-500 mt-0.5" size={18} />
                  <p className="text-sm text-red-700">{errorMsg}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Nome Completo <span className="text-red-500">*</span></label>
                  <input required type="text" className="input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">CPF</label>
                  <input type="text" className="input" placeholder="000.000.000-00" value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Data de Nascimento <span className="text-red-500">*</span></label>
                  <input required type="date" className="input" value={formData.birth_date} onChange={e => setFormData({...formData, birth_date: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Grau de Parentesco <span className="text-red-500">*</span></label>
                  <select required className="input" value={formData.relationship} onChange={e => setFormData({...formData, relationship: e.target.value})}>
                    {RELATIONSHIPS.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Nº Certidão Nascimento (Matrícula)</label>
                  <input type="text" className="input" value={formData.birth_certificate_number} onChange={e => setFormData({...formData, birth_certificate_number: e.target.value})} />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6">
                <h3 className="font-semibold text-slate-800 mb-4">Vigência (Controle para Folha)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Início da Dependência <span className="text-red-500">*</span></label>
                    <input required type="date" className="input" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Fim da Dependência</label>
                    <input type="date" className="input" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} />
                    <p className="text-xs text-slate-500 mt-1">Deixe em branco se for prazo indeterminado.</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6">
                <h3 className="font-semibold text-slate-800 mb-4">Marcadores Legais</h3>
                <div className="space-y-4">
                  <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg bg-slate-50 cursor-pointer hover:bg-slate-100">
                    <input type="checkbox" className="w-5 h-5 text-primary-600 rounded" checked={formData.is_irrf_dependent} onChange={e => setFormData({...formData, is_irrf_dependent: e.target.checked})} />
                    <div>
                      <p className="font-medium text-slate-800">Dependente de IRRF</p>
                      <p className="text-xs text-slate-500">Deduz R$ 189,59 da base de cálculo do IR mensal.</p>
                    </div>
                  </label>
                  
                  <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg bg-slate-50 cursor-pointer hover:bg-slate-100">
                    <input type="checkbox" className="w-5 h-5 text-primary-600 rounded" checked={formData.is_family_allowance_dependent} onChange={e => setFormData({...formData, is_family_allowance_dependent: e.target.checked})} />
                    <div>
                      <p className="font-medium text-slate-800">Dependente para Salário-Família</p>
                      <p className="text-xs text-slate-500">Garante cota de Salário-Família se o funcionário estiver na faixa.</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg bg-slate-50 cursor-pointer hover:bg-slate-100">
                    <input type="checkbox" className="w-5 h-5 text-primary-600 rounded" checked={formData.has_disability} onChange={e => setFormData({...formData, has_disability: e.target.checked})} />
                    <div>
                      <p className="font-medium text-slate-800">Possui invalidez / Deficiência severa</p>
                      <p className="text-xs text-slate-500">Remove o limite de idade para recebimento de benefícios atrelados ao dependente.</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6">
                <h3 className="font-semibold text-slate-800 mb-4">Comprovações Adicionais (Opcional)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Última Vacinação (Até 6 anos)</label>
                    <input type="date" className="input" value={formData.vaccination_card_date} onChange={e => setFormData({...formData, vaccination_card_date: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Frequência Escolar (7 a 14 anos)</label>
                    <input type="date" className="input" value={formData.school_frequency_date} onChange={e => setFormData({...formData, school_frequency_date: e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button type="button" onClick={async () => setIsModalOpen(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Salvar Dependente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
