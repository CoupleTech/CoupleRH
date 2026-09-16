import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Loader2,
  User,
  FileText,
  Briefcase,
  Hash,
  MapPin,
  Bus,
} from "lucide-react";
import { supabase } from "../lib/supabase";

export default function EmployeeForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetchingOptions, setFetchingOptions] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [departments, setDepartments] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);

  // Form states
  const [formData, setFormData] = useState({
    // People
    fullName: "",
    socialName: "",
    cpf: "",
    rg: "",
    birthDate: "",
    gender: "Nao_Informado",

    // Workers
    esocialMatricula: "",
    pisPasep: "",

    // Address
    zipCode: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    country: "Brasil",
    referencePoint: "",
    residenceType: "Casa",

    // Contract
    departmentId: "",
    positionId: "",
    contractType: "CLT",
    admissionDate: new Date().toISOString().split("T")[0],
    baseSalary: "",
    workloadHours: "220",
    optsForTransportationVoucher: false,
    transportationTicketsPerDay: 0,
    vtOperator: "",
    vtCardNumber: "",
    vtTariffValue: "",
    vtDiscountPercentage: "6",

    receivesAdvance: true,
  });

  useEffect(() => {
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    try {
      const [depRes, posRes] = await Promise.all([
        supabase.from("departments").select("id, name").order("name"),
        supabase.from("positions").select("id, title").order("title"),
      ]);

      if (depRes.data) setDepartments(depRes.data);
      if (posRes.data) setPositions(posRes.data);
    } catch (err) {
      console.error("Failed to load options", err);
    } finally {
      setFetchingOptions(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleZipCodeChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    let zip = e.target.value.replace(/\D/g, "");
    setFormData((prev) => ({ ...prev, zipCode: zip }));

    if (zip.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${zip}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setFormData((prev) => ({
            ...prev,
            street: data.logradouro,
            neighborhood: data.bairro,
            city: data.localidade,
            state: data.uf,
          }));
        }
      } catch (err) {
        console.error("ViaCEP Error:", err);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      // 1. Get current tenant/company (simplified for this demo)
      const { data: companies } = await supabase
        .from("companies")
        .select("id, tenant_id")
        .limit(1);
      if (!companies || companies.length === 0) {
        throw new Error("Nenhuma empresa encontrada para o seu usuário.");
      }
      const company = companies[0];

      // 2. Create Person
      const { data: personData, error: personError } = await supabase
        .from("people")
        .insert({
          tenant_id: company.tenant_id,
          full_name: formData.fullName,
          social_name: formData.socialName || null,
          cpf: formData.cpf,
          rg: formData.rg || null,
          birth_date: formData.birthDate || null,
          gender: formData.gender,
          zip_code: formData.zipCode || null,
          street: formData.street || null,
          number: formData.number || null,
          complement: formData.complement || null,
          neighborhood: formData.neighborhood || null,
          city: formData.city || null,
          state: formData.state || null,
          country: formData.country,
          reference_point: formData.referencePoint || null,
          residence_type: formData.residenceType || null,
        })
        .select("id")
        .single();

      if (personError) throw personError;

      // 3. Create Worker
      const { data: workerData, error: workerError } = await supabase
        .from("workers")
        .insert({
          tenant_id: company.tenant_id,
          company_id: company.id,
          person_id: personData.id,
          esocial_matricula:
            formData.esocialMatricula ||
            `MAT-${Math.floor(Math.random() * 10000)}`,
          pis_pasep: formData.pisPasep || null,
        })
        .select("id")
        .single();

      if (workerError) throw workerError;

      // 4. Create Contract
      const { error: contractError } = await supabase
        .from("employment_contracts")
        .insert({
          tenant_id: company.tenant_id,
          company_id: company.id,
          worker_id: workerData.id,
          department_id: formData.departmentId || null,
          position_id: formData.positionId || null,
          contract_type: formData.contractType,
          admission_date: formData.admissionDate,
          base_salary: parseFloat(formData.baseSalary) || 0,
          workload_hours: parseFloat(formData.workloadHours) || null,
          receives_advance: formData.receivesAdvance,
          transportation_tickets_per_day:
            formData.transportationTicketsPerDay || 0,
          opts_for_transportation_voucher:
            formData.optsForTransportationVoucher,
          vt_operator: formData.vtOperator || null,
          vt_card_number: formData.vtCardNumber || null,
          vt_tariff_value: parseFloat(formData.vtTariffValue) || null,
          vt_discount_percentage:
            parseFloat(formData.vtDiscountPercentage) || 6,
          status: "ACTIVE",
        });

      if (contractError) throw contractError;

      // Success
      navigate("/funcionarios");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(
        err.message ||
          "Erro ao salvar colaborador. Verifique se o CPF já está cadastrado.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-up max-w-4xl mx-auto pb-12">
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate("/funcionarios")}
          className="btn-ghost p-2"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display">
            Novo Colaborador
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Preencha o cadastro completo para inclusão na folha e eSocial
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-lg mb-6 text-sm">
          {errorMsg}
        </div>
      )}

      {fetchingOptions ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Sessão: Dados Pessoais */}
          <div className="panel p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <User size={20} className="text-primary-600" />
              Dados Pessoais (Civil)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <label className="input-label">Nome Completo *</label>
                <input
                  required
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="Nome civil conforme documento"
                />
              </div>
              <div>
                <label className="input-label">Nome Social</label>
                <input
                  type="text"
                  name="socialName"
                  value={formData.socialName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="Opcional"
                />
              </div>

              <div>
                <label className="input-label">CPF *</label>
                <input
                  required
                  type="text"
                  name="cpf"
                  value={formData.cpf}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <label className="input-label">RG</label>
                <input
                  type="text"
                  name="rg"
                  value={formData.rg}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="Registro Geral"
                />
              </div>
              <div>
                <label className="input-label">Data de Nascimento</label>
                <input
                  type="date"
                  name="birthDate"
                  value={formData.birthDate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="input-label">Gênero</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                >
                  <option value="Nao_Informado">Não Informado</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Feminino">Feminino</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
            </div>
          </div>

          {/* Sessão: Profissional & eSocial */}
          <div className="panel p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Hash size={20} className="text-amber-600" />
              Identificação Profissional (eSocial)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="input-label">PIS/PASEP</label>
                <input
                  type="text"
                  name="pisPasep"
                  value={formData.pisPasep}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="Apenas números"
                />
              </div>
              <div>
                <label className="input-label">
                  Matrícula eSocial (Opcional)
                </label>
                <input
                  type="text"
                  name="esocialMatricula"
                  value={formData.esocialMatricula}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="Gerado automaticamente se vazio"
                />
              </div>
            </div>
          </div>

          {/* Sessão: Endereço */}
          <div className="panel p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <MapPin size={20} className="text-rose-600" />
              Endereço Residencial
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-1">
                <label className="input-label">CEP</label>
                <input
                  type="text"
                  name="zipCode"
                  value={formData.zipCode}
                  onChange={handleZipCodeChange}
                  maxLength={8}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="00000000"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="input-label">Logradouro</label>
                <input
                  type="text"
                  name="street"
                  value={formData.street}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 bg-slate-50"
                />
              </div>
              <div className="lg:col-span-1">
                <label className="input-label">Número</label>
                <input
                  type="text"
                  name="number"
                  value={formData.number}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div className="lg:col-span-1">
                <label className="input-label">Complemento</label>
                <input
                  type="text"
                  name="complement"
                  value={formData.complement}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div className="lg:col-span-1">
                <label className="input-label">Bairro</label>
                <input
                  type="text"
                  name="neighborhood"
                  value={formData.neighborhood}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 bg-slate-50"
                />
              </div>
              <div className="lg:col-span-1">
                <label className="input-label">Cidade</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 bg-slate-50"
                />
              </div>
              <div className="lg:col-span-1">
                <label className="input-label">Estado (UF)</label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  maxLength={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 bg-slate-50"
                  placeholder="EX"
                />
              </div>
              <div className="lg:col-span-1">
                <label className="input-label">País</label>
                <input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 bg-slate-50"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="input-label">Ponto de Referência</label>
                <input
                  type="text"
                  name="referencePoint"
                  value={formData.referencePoint}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div className="lg:col-span-1">
                <label className="input-label">Tipo de Residência</label>
                <select
                  name="residenceType"
                  value={formData.residenceType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                >
                  <option value="Casa">Casa</option>
                  <option value="Apartamento">Apartamento</option>
                  <option value="Condominio">Condomínio Fechado</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
            </div>
          </div>

          {/* Sessão: Contrato & Benefícios */}
          <div className="panel p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Briefcase size={20} className="text-emerald-600" />
              Vínculo Contratual e Benefícios
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              <div>
                <label className="input-label">Tipo de Contrato</label>
                <select
                  name="contractType"
                  value={formData.contractType}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                >
                  <option value="CLT">CLT</option>
                  <option value="PJ">PJ / Prestador</option>
                  <option value="Estagio">Estagiário</option>
                  <option value="Menor_Aprendiz">Menor Aprendiz</option>
                  <option value="Socio">Sócio / Pro-Labore</option>
                </select>
              </div>
              <div>
                <label className="input-label">Departamento</label>
                <select
                  name="departmentId"
                  value={formData.departmentId}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                >
                  <option value="">Selecione...</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="input-label">Cargo</label>
                <select
                  name="positionId"
                  value={formData.positionId}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                >
                  <option value="">Selecione...</option>
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="input-label">Data de Admissão *</label>
                <input
                  required
                  type="date"
                  name="admissionDate"
                  value={formData.admissionDate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="input-label">Salário Base (R$) *</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  name="baseSalary"
                  value={formData.baseSalary}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="input-label">Carga Horária (Mensal)</label>
                <input
                  type="number"
                  name="workloadHours"
                  value={formData.workloadHours}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="Ex: 220"
                />
              </div>
            </div>

            <div className="mt-4 mb-8 pb-8 border-b border-slate-200 flex items-center gap-3 bg-slate-50 p-4 rounded-lg border">
              <input
                type="checkbox"
                id="receivesAdvance"
                name="receivesAdvance"
                checked={formData.receivesAdvance}
                onChange={handleChange}
                className="w-5 h-5 text-primary-600 rounded border-slate-300 focus:ring-primary-500"
              />
              <div>
                <label htmlFor="receivesAdvance" className="font-medium text-slate-900 cursor-pointer block">
                  Recebe Adiantamento Quinzenal (Vale)
                </label>
                <p className="text-sm text-slate-500">
                  Se marcado, este colaborador terá um adiantamento de 40% gerado automaticamente na folha de adiantamento.
                </p>
              </div>
            </div>

            {/* Sub-Sessão: Benefícios (Vale Transporte) */}
            <div className="bg-slate-50 border border-slate-200 p-6 rounded-lg">
              <h3 className="text-md font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Bus size={18} className="text-purple-600" />
                Vale Transporte (Desconto 6%)
              </h3>
              <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="optsForTransportationVoucher"
                    checked={formData.optsForTransportationVoucher}
                    onChange={handleChange}
                    className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <p className="font-bold text-slate-700">
                      Optante pelo Vale Transporte
                    </p>
                    <p className="text-xs text-slate-500">
                      Autoriza desconto de até 6% do salário base
                    </p>
                  </div>
                </label>

                {formData.optsForTransportationVoucher && (
                  <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-widest">
                        Passagens / Dia
                      </label>
                      <input
                        type="number"
                        min="0"
                        name="transportationTicketsPerDay"
                        value={formData.transportationTicketsPerDay}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                        placeholder="2"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-widest">
                        Operadora
                      </label>
                      <input
                        type="text"
                        name="vtOperator"
                        value={formData.vtOperator}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                        placeholder="Ex: SPTrans"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-widest">
                        Número do Cartão
                      </label>
                      <input
                        type="text"
                        name="vtCardNumber"
                        value={formData.vtCardNumber}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                        placeholder="000.000.000"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-widest">
                        Tarifa (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        name="vtTariffValue"
                        value={formData.vtTariffValue}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                        placeholder="4.40"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => navigate("/funcionarios")}
              className="btn-secondary"
            >
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              <span>Efetivar Cadastro</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
