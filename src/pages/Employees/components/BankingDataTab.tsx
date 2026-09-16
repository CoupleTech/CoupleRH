import { useState, useEffect } from "react";
import { Save, Loader2, AlertCircle, Building, Wallet } from "lucide-react";
import { supabase } from "../../../lib/supabase";

export default function BankingDataTab({ workerId, initialData, onSaved }: any) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [formData, setFormData] = useState({
    bank_code: "",
    bank_name: "",
    agency: "",
    agency_digit: "",
    account_number: "",
    account_digit: "",
    account_type: "CORRENTE",
    pix_type: "",
    pix_key: ""
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        bank_code: initialData.bank_code || "",
        bank_name: initialData.bank_name || "",
        agency: initialData.agency || "",
        agency_digit: initialData.agency_digit || "",
        account_number: initialData.account_number || "",
        account_digit: initialData.account_digit || "",
        account_type: initialData.account_type || "CORRENTE",
        pix_type: initialData.pix_type || "",
        pix_key: initialData.pix_key || ""
      });
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerId || !initialData?.id) {
      setErrorMsg("É necessário salvar os dados pessoais básicos primeiro.");
      return;
    }
    
    setErrorMsg("");
    setLoading(true);

    try {
      const { error } = await supabase
        .from("workers")
        .update(formData)
        .eq("id", initialData.id); // initialData must be the worker object
        
      if (error) throw error;
      onSaved(workerId);
    } catch (err: any) {
      console.error("Erro ao salvar dados bancários:", err);
      setErrorMsg(err.message || "Ocorreu um erro ao salvar os dados bancários.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="text-red-500 mt-0.5" size={18} />
          <p className="text-sm text-red-700">{errorMsg}</p>
        </div>
      )}

      {/* Conta Bancária */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-6 pb-2 border-b border-slate-100">
          <Building className="text-primary-500" size={20} />
          <h2 className="text-base font-semibold text-slate-800">Conta Bancária (Depósito de Salário)</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-6 gap-5">
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium text-slate-700">Código do Banco</label>
            <input
              type="text"
              className="input"
              placeholder="Ex: 341"
              value={formData.bank_code}
              onChange={(e) => setFormData({ ...formData, bank_code: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 md:col-span-4">
            <label className="text-sm font-medium text-slate-700">Nome do Banco</label>
            <input
              type="text"
              className="input"
              placeholder="Ex: Itaú Unibanco S.A."
              value={formData.bank_name}
              onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
            />
          </div>
          
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium text-slate-700">Agência</label>
            <input
              type="text"
              className="input"
              value={formData.agency}
              onChange={(e) => setFormData({ ...formData, agency: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 md:col-span-1">
            <label className="text-sm font-medium text-slate-700">Dígito</label>
            <input
              type="text"
              className="input"
              value={formData.agency_digit}
              onChange={(e) => setFormData({ ...formData, agency_digit: e.target.value })}
            />
          </div>
          
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium text-slate-700">Conta</label>
            <input
              type="text"
              className="input"
              value={formData.account_number}
              onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 md:col-span-1">
            <label className="text-sm font-medium text-slate-700">Dígito</label>
            <input
              type="text"
              className="input"
              value={formData.account_digit}
              onChange={(e) => setFormData({ ...formData, account_digit: e.target.value })}
            />
          </div>
          
          <div className="space-y-1.5 md:col-span-3">
            <label className="text-sm font-medium text-slate-700">Tipo de Conta</label>
            <select
              className="input"
              value={formData.account_type}
              onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
            >
              <option value="CORRENTE">Conta Corrente</option>
              <option value="POUPANCA">Conta Poupança</option>
              <option value="SALARIO">Conta Salário</option>
            </select>
          </div>
        </div>
      </div>

      {/* Chave Pix */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-6 pb-2 border-b border-slate-100">
          <Wallet className="text-emerald-500" size={20} />
          <h2 className="text-base font-semibold text-slate-800">Chave PIX</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Tipo de Chave</label>
            <select
              className="input"
              value={formData.pix_type}
              onChange={(e) => setFormData({ ...formData, pix_type: e.target.value })}
            >
              <option value="">Selecione...</option>
              <option value="CPF">CPF</option>
              <option value="CNPJ">CNPJ</option>
              <option value="EMAIL">E-mail</option>
              <option value="PHONE">Telefone / Celular</option>
              <option value="RANDOM">Chave Aleatória</option>
            </select>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Chave PIX</label>
            <input
              type="text"
              className="input"
              value={formData.pix_key}
              onChange={(e) => setFormData({ ...formData, pix_key: e.target.value })}
              placeholder={formData.pix_type === 'CPF' ? '000.000.000-00' : ''}
            />
          </div>
        </div>
      </div>


    </form>
  );
}
