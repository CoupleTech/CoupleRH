import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, Calculator, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface Bracket {
  id?: string;
  bracket_number: number;
  base_limit: number | null;
  aliquot: number;
  deduction: number;
}

export default function LegalTablesForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'inss' | 'irrf'>('general');

  const [formData, setFormData] = useState({
    version_name: '',
    valid_from: '',
    valid_to: '',
    source: ''
  });

  const [generalParams, setGeneralParams] = useState({
    minimum_wage: 0,
    dependent_deduction: 0,
    simplified_discount: 0,
    family_salary_quota: 0,
    family_salary_limit: 0,
    fgts_standard_aliquot: 0,
    fgts_apprentice_aliquot: 0,
    vt_max_discount_percentage: 0,
    irrf_exemption_limit: 0,
    irrf_reduction_formula_limit: 0,
    irrf_base_reduction: 0
  });

  const [inssBrackets, setInssBrackets] = useState<Bracket[]>([]);
  const [irrfBrackets, setIrrfBrackets] = useState<Bracket[]>([]);

  useEffect(() => {
    if (isEditing) {
      fetchVersion();
    }
  }, [id]);

  async function fetchVersion() {
    setLoading(true);
    try {
      const { data: versionData, error: versionError } = await supabase
        .from('legal_versions')
        .select('*')
        .eq('id', id)
        .single();

      if (versionError) throw versionError;

      setFormData({
        version_name: versionData.version_name,
        valid_from: versionData.valid_from,
        valid_to: versionData.valid_to || '',
        source: versionData.source || ''
      });

      // Parâmetros gerais
      const { data: generalData } = await supabase
        .from('general_legal_parameters')
        .select('*')
        .eq('version_id', id)
        .single();

      if (generalData) {
        setGeneralParams({
          minimum_wage: generalData.minimum_wage,
          dependent_deduction: generalData.dependent_deduction,
          simplified_discount: generalData.simplified_discount,
          family_salary_quota: generalData.family_salary_quota,
          family_salary_limit: generalData.family_salary_limit,
          fgts_standard_aliquot: generalData.fgts_standard_aliquot,
          fgts_apprentice_aliquot: generalData.fgts_apprentice_aliquot,
          vt_max_discount_percentage: generalData.vt_max_discount_percentage,
          irrf_exemption_limit: generalData.irrf_exemption_limit || 0,
          irrf_reduction_formula_limit: generalData.irrf_reduction_formula_limit || 0,
          irrf_base_reduction: generalData.irrf_base_reduction || 0
        });
      }

      // Faixas INSS
      const { data: inssData } = await supabase
        .from('inss_parameters')
        .select('*')
        .eq('version_id', id)
        .order('bracket_number');

      if (inssData && inssData.length > 0) {
        setInssBrackets(inssData.map(b => ({
          id: b.id,
          bracket_number: b.bracket_number,
          base_limit: b.base_limit,
          aliquot: b.aliquot,
          deduction: b.deduction
        })));
      }

      // Faixas IRRF
      const { data: irrfData } = await supabase
        .from('irrf_parameters')
        .select('*')
        .eq('version_id', id)
        .order('bracket_number');

      if (irrfData && irrfData.length > 0) {
        setIrrfBrackets(irrfData.map(b => ({
          id: b.id,
          bracket_number: b.bracket_number,
          base_limit: b.base_limit,
          aliquot: b.aliquot,
          deduction: b.deduction
        })));
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Erro ao buscar versão');
      navigate('/configuracoes/tabelas-legais');
    } finally {
      setLoading(false);
    }
  }

  function addInssBracket() {
    setInssBrackets(prev => [
      ...prev,
      { bracket_number: prev.length + 1, base_limit: 0, aliquot: 0, deduction: 0 }
    ]);
  }

  function removeInssBracket(index: number) {
    setInssBrackets(prev => prev.filter((_, i) => i !== index).map((b, i) => ({ ...b, bracket_number: i + 1 })));
  }

  function updateInssBracket(index: number, field: keyof Bracket, value: string) {
    setInssBrackets(prev => prev.map((b, i) => {
      if (i !== index) return b;
      if (field === 'base_limit') {
        return { ...b, [field]: value === '' ? null : parseFloat(value) };
      }
      return { ...b, [field]: parseFloat(value) || 0 };
    }));
  }

  function addIrrfBracket() {
    setIrrfBrackets(prev => [
      ...prev,
      { bracket_number: prev.length + 1, base_limit: null, aliquot: 0, deduction: 0 }
    ]);
  }

  function removeIrrfBracket(index: number) {
    setIrrfBrackets(prev => prev.filter((_, i) => i !== index).map((b, i) => ({ ...b, bracket_number: i + 1 })));
  }

  function updateIrrfBracket(index: number, field: keyof Bracket, value: string) {
    setIrrfBrackets(prev => prev.map((b, i) => {
      if (i !== index) return b;
      if (field === 'base_limit') {
        return { ...b, [field]: value === '' ? null : parseFloat(value) };
      }
      return { ...b, [field]: parseFloat(value) || 0 };
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      let versionId = id;

      const payload = {
        version_name: formData.version_name,
        valid_from: formData.valid_from,
        valid_to: formData.valid_to ? formData.valid_to : null,
        source: formData.source
      };

      if (isEditing) {
        const { error } = await supabase.from('legal_versions').update(payload).eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('legal_versions').insert(payload).select().single();
        if (error) throw error;
        versionId = data.id;
      }

      // Parâmetros Gerais — upsert
      const generalPayload = { version_id: versionId, ...generalParams };
      if (isEditing) {
        const { data: existing } = await supabase
          .from('general_legal_parameters')
          .select('id')
          .eq('version_id', id)
          .maybeSingle();

        if (existing) {
          await supabase.from('general_legal_parameters').update(generalPayload).eq('version_id', id);
        } else {
          await supabase.from('general_legal_parameters').insert(generalPayload);
        }
      } else {
        await supabase.from('general_legal_parameters').insert(generalPayload);
      }

      // INSS Brackets — delete all then re-insert
      if (isEditing) {
        await supabase.from('inss_parameters').delete().eq('version_id', id);
      }
      if (inssBrackets.length > 0) {
        const inssPayload = inssBrackets.map((b, i) => ({
          version_id: versionId,
          bracket_number: i + 1,
          base_limit: b.base_limit,
          aliquot: b.aliquot,
          deduction: b.deduction
        }));
        const { error: inssErr } = await supabase.from('inss_parameters').insert(inssPayload);
        if (inssErr) throw inssErr;
      }

      // IRRF Brackets — delete all then re-insert
      if (isEditing) {
        await supabase.from('irrf_parameters').delete().eq('version_id', id);
      }
      if (irrfBrackets.length > 0) {
        const irrfPayload = irrfBrackets.map((b, i) => ({
          version_id: versionId,
          bracket_number: i + 1,
          base_limit: b.base_limit,
          aliquot: b.aliquot,
          deduction: b.deduction
        }));
        const { error: irrfErr } = await supabase.from('irrf_parameters').insert(irrfPayload);
        if (irrfErr) throw irrfErr;
      }

      alert('Versão salva com sucesso!');
      navigate('/configuracoes/tabelas-legais');
    } catch (error: any) {
      console.error('Error saving:', error);
      alert('Erro ao salvar versão: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  const handleGeneralChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setGeneralParams(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const tabs = [
    { key: 'general' as const, label: 'Parâmetros Gerais' },
    { key: 'inss' as const, label: `Faixas INSS (${inssBrackets.length})` },
    { key: 'irrf' as const, label: `Faixas IRRF (${irrfBrackets.length})` },
  ];

  return (
    <div className="animate-fade-up space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Link
          to="/configuracoes/tabelas-legais"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-display flex items-center gap-2">
            <Calculator className="text-primary-500" />
            {isEditing ? 'Editar Parâmetros Legais' : 'Nova Versão de Parâmetros'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Preencha as informações para consolidar regras de INSS, IRRF, FGTS, etc.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identificação da Versão */}
        <div className="panel">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">Identificação da Versão</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className="input-label">Nome da Versão</label>
              <input
                type="text"
                required
                value={formData.version_name}
                onChange={e => setFormData({ ...formData, version_name: e.target.value })}
                placeholder="Ex: CLT 2026"
                className="input-field"
              />
            </div>
            <div>
              <label className="input-label">Vigência Início</label>
              <input
                type="date"
                required
                value={formData.valid_from}
                onChange={e => setFormData({ ...formData, valid_from: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="input-label">Vigência Fim</label>
              <input
                type="date"
                value={formData.valid_to}
                onChange={e => setFormData({ ...formData, valid_to: e.target.value })}
                className="input-field"
              />
              <p className="text-xs text-slate-400 mt-1">Deixe em branco se for a versão vigente atual</p>
            </div>
            <div className="col-span-2">
              <label className="input-label">Fonte de Referência</label>
              <input
                type="text"
                value={formData.source}
                onChange={e => setFormData({ ...formData, source: e.target.value })}
                placeholder="Ex: Tabela do Governo, Medida Provisória..."
                className="input-field"
              />
            </div>
          </div>
        </div>

        {/* Abas de conteúdo */}
        <div className="panel">
          <div className="border-b border-slate-200">
            <nav className="flex -mb-px">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                    activeTab === tab.key
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* TAB: Parâmetros Gerais */}
          {activeTab === 'general' && (
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="input-label">Salário Mínimo</label>
                <input type="number" step="0.01" required name="minimum_wage" value={generalParams.minimum_wage} onChange={handleGeneralChange} className="input-field" />
              </div>
              <div>
                <label className="input-label">Dedução p/ Dependente (IRRF)</label>
                <input type="number" step="0.01" required name="dependent_deduction" value={generalParams.dependent_deduction} onChange={handleGeneralChange} className="input-field" />
              </div>
              <div>
                <label className="input-label">Desconto Simplificado</label>
                <input type="number" step="0.01" required name="simplified_discount" value={generalParams.simplified_discount} onChange={handleGeneralChange} className="input-field" />
              </div>
              <div>
                <label className="input-label">Cota Salário-Família</label>
                <input type="number" step="0.01" required name="family_salary_quota" value={generalParams.family_salary_quota} onChange={handleGeneralChange} className="input-field" />
              </div>
              <div>
                <label className="input-label">Limite Salário-Família</label>
                <input type="number" step="0.01" required name="family_salary_limit" value={generalParams.family_salary_limit} onChange={handleGeneralChange} className="input-field" />
              </div>
              <div>
                <label className="input-label">Alíquota FGTS (Padrão %)</label>
                <input type="number" step="0.01" required name="fgts_standard_aliquot" value={generalParams.fgts_standard_aliquot} onChange={handleGeneralChange} className="input-field" />
              </div>
              <div>
                <label className="input-label">Alíquota FGTS (Aprendiz %)</label>
                <input type="number" step="0.01" required name="fgts_apprentice_aliquot" value={generalParams.fgts_apprentice_aliquot} onChange={handleGeneralChange} className="input-field" />
              </div>
              <div>
                <label className="input-label">VT - Desconto Máximo (%)</label>
                <input type="number" step="0.01" required name="vt_max_discount_percentage" value={generalParams.vt_max_discount_percentage} onChange={handleGeneralChange} className="input-field" />
              </div>
              <div>
                <label className="input-label">Isenção IRRF (Redutor até)</label>
                <input type="number" step="0.01" name="irrf_exemption_limit" value={generalParams.irrf_exemption_limit} onChange={handleGeneralChange} className="input-field" />
              </div>
              <div>
                <label className="input-label">Limite Fórmula Redutor IRRF</label>
                <input type="number" step="0.01" name="irrf_reduction_formula_limit" value={generalParams.irrf_reduction_formula_limit} onChange={handleGeneralChange} className="input-field" />
              </div>
              <div>
                <label className="input-label">Redutor Base IRRF (R$)</label>
                <input type="number" step="0.01" name="irrf_base_reduction" value={generalParams.irrf_base_reduction} onChange={handleGeneralChange} className="input-field" />
              </div>
            </div>
          )}

          {/* TAB: Faixas INSS */}
          {activeTab === 'inss' && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-700">Tabela Progressiva INSS</h3>
                  <p className="text-xs text-slate-400">Cada faixa é calculada progressivamente (por intervalo). A última faixa define o teto.</p>
                </div>
                <button type="button" onClick={addInssBracket} className="btn-primary !py-1.5 !px-3 !text-sm">
                  <Plus size={16} /> Faixa
                </button>
              </div>

              {inssBrackets.length === 0 ? (
                <div className="text-center p-8 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                  <p className="text-sm text-slate-500">Nenhuma faixa cadastrada. Clique em "Faixa" para adicionar.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left font-semibold text-slate-600">
                        <th className="pb-2 px-2 w-16">#</th>
                        <th className="pb-2 px-2">Limite da Faixa (R$)</th>
                        <th className="pb-2 px-2">Alíquota (%)</th>
                        <th className="pb-2 px-2">Parcela a Deduzir (R$)</th>
                        <th className="pb-2 px-2 w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {inssBrackets.map((bracket, index) => (
                        <tr key={index} className="hover:bg-slate-50">
                          <td className="py-2 px-2 font-bold text-slate-400">{index + 1}</td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              step="0.01"
                              value={bracket.base_limit ?? ''}
                              onChange={e => updateInssBracket(index, 'base_limit', e.target.value)}
                              placeholder="Teto (vazio = sem limite)"
                              className="input-field !py-1.5"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              step="0.01"
                              value={bracket.aliquot}
                              onChange={e => updateInssBracket(index, 'aliquot', e.target.value)}
                              className="input-field !py-1.5"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              step="0.01"
                              value={bracket.deduction}
                              onChange={e => updateInssBracket(index, 'deduction', e.target.value)}
                              className="input-field !py-1.5"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <button
                              type="button"
                              onClick={() => removeInssBracket(index)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs text-blue-700">
                <strong>Como funciona:</strong> O INSS é progressivo. Ex: Faixa 1 cobra 7,5% até R$ 1.621. Faixa 2 cobra 9% sobre o que excede R$ 1.621 até R$ 2.902,84, e assim por diante. A "Parcela a Deduzir" é usada como atalho de cálculo alternativo.
              </div>
            </div>
          )}

          {/* TAB: Faixas IRRF */}
          {activeTab === 'irrf' && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-700">Tabela Progressiva IRRF</h3>
                  <p className="text-xs text-slate-400">Faixas com alíquota e parcela a deduzir. A primeira faixa é de isenção (alíquota 0%).</p>
                </div>
                <button type="button" onClick={addIrrfBracket} className="btn-primary !py-1.5 !px-3 !text-sm">
                  <Plus size={16} /> Faixa
                </button>
              </div>

              {irrfBrackets.length === 0 ? (
                <div className="text-center p-8 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                  <p className="text-sm text-slate-500">Nenhuma faixa cadastrada. Clique em "Faixa" para adicionar.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left font-semibold text-slate-600">
                        <th className="pb-2 px-2 w-16">#</th>
                        <th className="pb-2 px-2">Limite da Faixa (R$)</th>
                        <th className="pb-2 px-2">Alíquota (%)</th>
                        <th className="pb-2 px-2">Parcela a Deduzir (R$)</th>
                        <th className="pb-2 px-2 w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {irrfBrackets.map((bracket, index) => (
                        <tr key={index} className="hover:bg-slate-50">
                          <td className="py-2 px-2 font-bold text-slate-400">{index + 1}</td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              step="0.01"
                              value={bracket.base_limit ?? ''}
                              onChange={e => updateIrrfBracket(index, 'base_limit', e.target.value)}
                              placeholder="Vazio = sem limite (última faixa)"
                              className="input-field !py-1.5"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              step="0.01"
                              value={bracket.aliquot}
                              onChange={e => updateIrrfBracket(index, 'aliquot', e.target.value)}
                              className="input-field !py-1.5"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              step="0.01"
                              value={bracket.deduction}
                              onChange={e => updateIrrfBracket(index, 'deduction', e.target.value)}
                              className="input-field !py-1.5"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <button
                              type="button"
                              onClick={() => removeIrrfBracket(index)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-700">
                <strong>Redutor 2026:</strong> O redutor adicional (isenção expandida até R$ 5.000 e fórmula até R$ 7.350) é configurado nos Parâmetros Gerais (aba anterior).
              </div>
            </div>
          )}
        </div>

        {/* Botões */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            to="/configuracoes/tabelas-legais"
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
          >
            Cancelar
          </Link>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Save size={18} />
                <span>Salvar Versão</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
