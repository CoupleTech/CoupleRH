import React, { useState, useEffect } from 'react';
import {
  FileText,
  DollarSign,
  Building,
  CreditCard,
  Download,
  Copy,
  Check,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
  X,
  Loader2,
  AlertCircle,
  FileCheck2,
  ShieldCheck,
  Receipt
} from 'lucide-react';
import {
  payrollObligationsService,
  TaxGuidesReport,
  PayrollProvisionsReport,
  AccountingSummaryReport
} from '../../services/payroll/payrollObligationsService';
import { toast } from 'sonner';

interface PayrollObligationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodId: string;
  periodLabel: string;
}

export const PayrollObligationsModal: React.FC<PayrollObligationsModalProps> = ({
  isOpen,
  onClose,
  periodId,
  periodLabel,
}) => {
  const [activeTab, setActiveTab] = useState<'GUIDES' | 'PROVISIONS' | 'ACCOUNTING' | 'CNAB' | 'INCOME'>('GUIDES');
  const [loading, setLoading] = useState(true);
  const [taxGuides, setTaxGuides] = useState<TaxGuidesReport | null>(null);
  const [provisions, setProvisions] = useState<PayrollProvisionsReport | null>(null);
  const [accounting, setAccounting] = useState<AccountingSummaryReport | null>(null);
  const [cnabData, setCnabData] = useState<{ cnabContent: string; totalEmployees: number; totalAmount: number } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && periodId) {
      loadAllData();
    }
  }, [isOpen, periodId]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [guidesRes, provRes, accRes, cnabRes] = await Promise.all([
        payrollObligationsService.fetchPeriodTaxGuides(periodId).catch(() => null),
        payrollObligationsService.fetchPeriodProvisions(periodId).catch(() => null),
        payrollObligationsService.fetchPeriodAccounting(periodId).catch(() => null),
        payrollObligationsService.fetchPeriodCnab(periodId).catch(() => null),
      ]);

      setTaxGuides(guidesRes);
      setProvisions(provRes);
      setAccounting(accRes);
      setCnabData(cnabRes);
    } catch (err) {
      console.error('Erro ao carregar obrigações da folha:', err);
      toast.error('Erro ao consolidar guias e relatórios do período.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const formatCurrency = (val: number) => {
    return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    toast.success('Copiado para a área de transferência!');
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleDownloadCnab = () => {
    if (!cnabData?.cnabContent) {
      toast.error('Arquivo CNAB não gerado.');
      return;
    }
    const blob = new Blob([cnabData.cnabContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FOLHA_CNAB240_${periodLabel.replace(/\D/g, '')}.rem`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Download do arquivo de remessa CNAB 240 iniciado!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-600 text-white flex items-center justify-center shadow-md">
              <Receipt size={22} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Guias, Provisões & Relatórios Fiscais</h3>
              <p className="text-xs text-slate-500">Competência: {periodLabel} · Conformidade DCTFWeb, FGTS Digital e Sped</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-100/60 px-6 shrink-0 gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('GUIDES')}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'GUIDES'
                ? 'border-primary-600 text-primary-700 bg-white shadow-sm'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <DollarSign size={16} /> Guias Tributárias (INSS / FGTS / IRRF)
          </button>

          <button
            onClick={() => setActiveTab('PROVISIONS')}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'PROVISIONS'
                ? 'border-primary-600 text-primary-700 bg-white shadow-sm'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Layers size={16} /> Provisões (Férias e 13º)
          </button>

          <button
            onClick={() => setActiveTab('ACCOUNTING')}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'ACCOUNTING'
                ? 'border-primary-600 text-primary-700 bg-white shadow-sm'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Building size={16} /> Resumo Contábil (D/C)
          </button>

          <button
            onClick={() => setActiveTab('CNAB')}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'CNAB'
                ? 'border-primary-600 text-primary-700 bg-white shadow-sm'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <CreditCard size={16} /> Remessa CNAB 240
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 size={32} className="animate-spin text-primary-600" />
              <p className="text-xs font-semibold text-slate-600">Calculando guias e provisões do período...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: GUIAS TRIBUTÁRIAS */}
              {activeTab === 'GUIDES' && taxGuides && (
                <div className="space-y-6">
                  {/* Resumo Totalizador */}
                  <div className="p-4 bg-primary-50/70 border border-primary-200 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-primary-900 uppercase tracking-wider">Total de Obrigações a Recolher no Mês</span>
                      <h4 className="text-2xl font-black text-primary-700 font-mono mt-0.5">{formatCurrency(taxGuides.totalTaxesDue)}</h4>
                    </div>
                    <div className="text-right text-xs text-primary-800">
                      <p className="font-semibold">Vencimento Legal Unificado:</p>
                      <p className="font-bold text-primary-900">Dia 20 do mês subsequente</p>
                    </div>
                  </div>

                  {/* 3 Cards de Guias */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Guia 1: DCTFWeb / INSS */}
                    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 hover:border-slate-300 transition-all flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono">
                            DARF {taxGuides.dctfWebInss.code}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500">Venc: {taxGuides.dctfWebInss.dueDate}</span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 mt-2">DCTFWeb Previdenciária</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          INSS dos Segurados + Quota Patronal, RAT ajustado pelo FAP e Outras Entidades (Sistema S).
                        </p>

                        <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                          <div className="flex justify-between text-slate-600">
                            <span>INSS Segurados:</span>
                            <span className="font-mono font-medium">{formatCurrency(taxGuides.dctfWebInss.totalInssSegurados)}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>INSS Patronal (20%):</span>
                            <span className="font-mono font-medium">{formatCurrency(taxGuides.dctfWebInss.inssPatronal)}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>RAT / FAP:</span>
                            <span className="font-mono font-medium">{formatCurrency(taxGuides.dctfWebInss.ratAdjusted)}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>Terceiros / Outros:</span>
                            <span className="font-mono font-medium">{formatCurrency(taxGuides.dctfWebInss.terceiros)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">Total a Recolher:</span>
                        <span className="text-lg font-black text-blue-700 font-mono">{formatCurrency(taxGuides.dctfWebInss.totalDctfWeb)}</span>
                      </div>
                    </div>

                    {/* Guia 2: FGTS Digital */}
                    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 hover:border-slate-300 transition-all flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono">
                            FGTS DIGITAL
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500">Venc: {taxGuides.fgtsDigital.dueDate}</span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 mt-2">Guia FGTS Digital</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          Recolhimento unificado via PIX Copia e Cola / QR Code vinculado ao CPF de cada trabalhador.
                        </p>

                        <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                          <div className="flex justify-between text-slate-600">
                            <span>Base de Cálculo FGTS:</span>
                            <span className="font-mono font-medium">{formatCurrency(taxGuides.fgtsDigital.baseFgts)}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>Alíquota CLT Geral:</span>
                            <span className="font-mono font-medium">8,0%</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">Total a Recolher:</span>
                        <span className="text-lg font-black text-emerald-700 font-mono">{formatCurrency(taxGuides.fgtsDigital.totalFgts)}</span>
                      </div>
                    </div>

                    {/* Guia 3: DARF IRRF */}
                    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4 hover:border-slate-300 transition-all flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-mono">
                            CÓDIGO 0561
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500">Venc: {taxGuides.darfIrrf.dueDate}</span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 mt-2">DARF IRRF Retido</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          Retenção na fonte dos rendimentos de trabalho assalariado apurados e informados na DCTFWeb.
                        </p>

                        <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                          <div className="flex justify-between text-slate-600">
                            <span>Base Tributável IRRF:</span>
                            <span className="font-mono font-medium">{formatCurrency(taxGuides.darfIrrf.baseIrrf)}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>Código de Receita:</span>
                            <span className="font-mono font-medium">0561</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">Total a Recolher:</span>
                        <span className="text-lg font-black text-amber-700 font-mono">{formatCurrency(taxGuides.darfIrrf.totalIrrf)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PROVISÕES TRABALHISTAS */}
              {activeTab === 'PROVISIONS' && provisions && (
                <div className="space-y-6">
                  {/* Cards de Resumo */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-xs font-bold text-slate-500">Provisão Férias + 1/3</span>
                      <h4 className="text-lg font-bold text-slate-900 font-mono mt-1">
                        {formatCurrency(provisions.totalMonthlyFerias + provisions.totalMonthlyTercoFerias)}
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">Férias: {formatCurrency(provisions.totalMonthlyFerias)} | 1/3: {formatCurrency(provisions.totalMonthlyTercoFerias)}</p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-xs font-bold text-slate-500">Encargos sobre Férias</span>
                      <h4 className="text-lg font-bold text-slate-900 font-mono mt-1">
                        {formatCurrency(provisions.totalChargesFerias)}
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">INSS Patronal + FGTS (35,8%)</p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-xs font-bold text-slate-500">Provisão 13º Salário</span>
                      <h4 className="text-lg font-bold text-slate-900 font-mono mt-1">
                        {formatCurrency(provisions.totalMonthlyThirteenth)}
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">1/12 avos mensais</p>
                    </div>

                    <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200">
                      <span className="text-xs font-bold text-indigo-900">Passivo Mensal Total</span>
                      <h4 className="text-lg font-black text-indigo-700 font-mono mt-1">
                        {formatCurrency(provisions.totalMonthlyLiability)}
                      </h4>
                      <p className="text-[10px] text-indigo-800 mt-0.5">Férias + 13º + Encargos</p>
                    </div>
                  </div>

                  {/* Tabela de Colaboradores */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Detalhamento por Colaborador</h4>
                      <span className="text-xs text-slate-500">{provisions.items.length} colaboradores</span>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 uppercase font-bold sticky top-0">
                          <tr>
                            <th className="px-4 py-2.5">Colaborador</th>
                            <th className="px-4 py-2.5 text-right">Férias (1/12)</th>
                            <th className="px-4 py-2.5 text-right">1/3 Férias</th>
                            <th className="px-4 py-2.5 text-right">Enc. Férias</th>
                            <th className="px-4 py-2.5 text-right">13º (1/12)</th>
                            <th className="px-4 py-2.5 text-right">Enc. 13º</th>
                            <th className="px-4 py-2.5 text-right font-bold">Total Mensal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 font-mono">
                          {provisions.items.map((emp) => (
                            <tr key={emp.contractId} className="hover:bg-slate-50">
                              <td className="px-4 py-2 font-sans font-medium text-slate-900">{emp.employeeName}</td>
                              <td className="px-4 py-2 text-right">{formatCurrency(emp.monthlyFerias)}</td>
                              <td className="px-4 py-2 text-right">{formatCurrency(emp.monthlyTercoFerias)}</td>
                              <td className="px-4 py-2 text-right text-slate-500">{formatCurrency(emp.chargesFerias)}</td>
                              <td className="px-4 py-2 text-right">{formatCurrency(emp.monthlyThirteenth)}</td>
                              <td className="px-4 py-2 text-right text-slate-500">{formatCurrency(emp.chargesThirteenth)}</td>
                              <td className="px-4 py-2 text-right font-bold text-indigo-600">{formatCurrency(emp.totalMonthly)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: RESUMO CONTÁBIL (D/C) */}
              {activeTab === 'ACCOUNTING' && accounting && (
                <div className="space-y-6">
                  {/* Status de Balanço */}
                  <div className={`p-4 rounded-xl border flex items-center justify-between ${
                    accounting.isBalanced
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}>
                    <div className="flex items-center gap-3">
                      {accounting.isBalanced ? (
                        <CheckCircle2 size={24} className="text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle size={24} className="text-rose-600 shrink-0" />
                      )}
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider">
                          {accounting.isBalanced ? 'Balanço Contábil Equilibrado (Partidas Dobradas)' : 'Inconsistência no Balanço Contábil'}
                        </h4>
                        <p className="text-xs mt-0.5">
                          {accounting.isBalanced
                            ? 'A somatória dos lançamentos a Débito confere com exatidão com os lançamentos a Crédito.'
                            : 'A diferença entre débito e crédito excede os limites de centavos.'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-4 font-mono text-xs">
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-slate-500">Total Débitos</span>
                        <strong className="text-slate-900">{formatCurrency(accounting.totalDebit)}</strong>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-slate-500">Total Créditos</span>
                        <strong className="text-slate-900">{formatCurrency(accounting.totalCredit)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Lançamentos Contábeis */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 uppercase font-bold">
                        <tr>
                          <th className="px-4 py-2.5">Conta</th>
                          <th className="px-4 py-2.5">Descrição da Conta</th>
                          <th className="px-4 py-2.5">Histórico do Lançamento</th>
                          <th className="px-4 py-2.5 text-center">Tipo</th>
                          <th className="px-4 py-2.5 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {accounting.entries.map((entry, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-4 py-2 font-mono font-bold text-slate-800">{entry.accountCode}</td>
                            <td className="px-4 py-2 font-semibold text-slate-900">{entry.accountName}</td>
                            <td className="px-4 py-2 text-slate-500">{entry.history}</td>
                            <td className="px-4 py-2 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                entry.type === 'DEBIT' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {entry.type === 'DEBIT' ? 'DÉBITO' : 'CRÉDITO'}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-right font-mono font-bold text-slate-900">
                              {formatCurrency(entry.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: REMESSA CNAB 240 */}
              {activeTab === 'CNAB' && (
                <div className="space-y-6">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Layout Padrão FEBRABAN CNAB 240</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Crédito em Conta Corrente, Salário e Poupança para pagamento em lote de folha de pagamento.
                      </p>
                    </div>
                    {cnabData && (
                      <button
                        onClick={handleDownloadCnab}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold shadow-md transition-all"
                      >
                        <Download size={16} /> Baixar Arquivo de Remessa (.REM)
                      </button>
                    )}
                  </div>

                  {cnabData ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                          <span className="text-xs text-slate-500">Colaboradores na Remessa</span>
                          <p className="text-xl font-bold text-slate-900 mt-0.5">{cnabData.totalEmployees} vidas</p>
                        </div>
                        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                          <span className="text-xs text-slate-500">Valor Total do Lote</span>
                          <p className="text-xl font-bold text-emerald-600 font-mono mt-0.5">{formatCurrency(cnabData.totalAmount)}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                          <span className="text-xs text-slate-500">Estrutura do Arquivo</span>
                          <p className="text-xs font-bold text-slate-700 mt-1">240 colunas por linha (Padrão Bancário)</p>
                        </div>
                      </div>

                      {/* Pré-visualização do Arquivo */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-slate-700">Prévia do Arquivo de Remessa:</span>
                          <button
                            onClick={() => handleCopy(cnabData.cnabContent, 'cnab')}
                            className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-800 font-semibold"
                          >
                            {copiedKey === 'cnab' ? <Check size={14} /> : <Copy size={14} />}
                            {copiedKey === 'cnab' ? 'Copiado!' : 'Copiar Texto'}
                          </button>
                        </div>
                        <textarea
                          readOnly
                          value={cnabData.cnabContent}
                          className="w-full h-44 p-3 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-xl border border-slate-700 focus:outline-none resize-none leading-relaxed overflow-x-auto whitespace-pre"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-slate-400">
                      Nenhum dado bancário disponível para gerar a remessa neste período.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            CoupleRH · Sistema Integrado de Folha, Guias Fiscais e Compliance
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
