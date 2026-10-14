import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Building2,
  Users,
  DollarSign,
  Download,
  X,
  Loader2,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  PieChart,
  UserPlus,
  UserMinus,
  CheckCircle2,
  Briefcase
} from 'lucide-react';
import {
  payrollComparisonService,
  type PayrollComparisonReport,
  type EmployeeComparisonItem,
  type CostCenterComparisonItem
} from '../../services/payroll/payrollComparisonService';
import { toast } from 'sonner';

interface PayrollComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodId: string;
}

export const PayrollComparisonModal: React.FC<PayrollComparisonModalProps> = ({
  isOpen,
  onClose,
  periodId
}) => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<PayrollComparisonReport | null>(null);
  const [activeTab, setActiveTab] = useState<'COST_CENTER' | 'EMPLOYEES'>('COST_CENTER');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCostCenter, setSelectedCostCenter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'ACTIVE' | 'NEW' | 'TERMINATED' | 'HIGH_VARIATION'>('ALL');

  useEffect(() => {
    if (isOpen && periodId) {
      loadComparison();
    }
  }, [isOpen, periodId]);

  const loadComparison = async () => {
    setLoading(true);
    try {
      const data = await payrollComparisonService.fetchPayrollComparison(periodId);
      setReport(data);
    } catch (err: any) {
      console.error('Erro ao carregar comparativo:', err);
      toast.error('Erro ao carregar comparativo: ' + (err.message || 'Falha de comunicação'));
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatPercent = (val: number) => {
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toFixed(1)}%`;
  };

  const exportToCSV = () => {
    if (!report) return;

    let csvContent = '\uFEFF'; // BOM para compatibilidade com Excel no Windows

    if (activeTab === 'COST_CENTER') {
      csvContent += 'Código;Centro de Custo;Vidas Atual;Vidas Anterior;Var. Vidas;Bruto Atual (R$);Bruto Anterior (R$);Var. Bruto (R$);Var. Bruto (%);Líquido Atual (R$);Líquido Anterior (R$);Encargos (R$);Custo Total (R$);% do Custo Empresa\n';
      report.by_cost_center.forEach(cc => {
        csvContent += `"${cc.cost_center_code}";"${cc.cost_center_name}";${cc.current_headcount};${cc.previous_headcount};${cc.diff_headcount};"${cc.current_earnings.toFixed(2)}";"${cc.previous_earnings.toFixed(2)}";"${cc.diff_earnings.toFixed(2)}";"${cc.percent_earnings.toFixed(1)}%";"${cc.current_net.toFixed(2)}";"${cc.previous_net.toFixed(2)}";"${cc.current_taxes.toFixed(2)}";"${cc.current_total_cost.toFixed(2)}";"${cc.percent_of_total_company_cost.toFixed(1)}%"\n`;
      });
    } else {
      csvContent += 'Colaborador;CPF;Cargo;Departamento;Centro de Custo;Status;Bruto Atual (R$);Bruto Anterior (R$);Var. Bruto (R$);Var. Bruto (%);Líquido Atual (R$);Líquido Anterior (R$);Var. Líquido (R$);Var. Líquido (%);Encargos (R$);Custo Total Empresa (R$)\n';
      report.by_employee.forEach(emp => {
        csvContent += `"${emp.employee_name}";"${emp.cpf || ''}";"${emp.position_title || ''}";"${emp.department_name || ''}";"${emp.cost_center_name}";"${emp.status}";"${emp.current_earnings.toFixed(2)}";"${emp.previous_earnings.toFixed(2)}";"${emp.diff_earnings.toFixed(2)}";"${emp.percent_earnings.toFixed(1)}%";"${emp.current_net.toFixed(2)}";"${emp.previous_net.toFixed(2)}";"${emp.diff_net.toFixed(2)}";"${emp.percent_net.toFixed(1)}%";"${emp.current_taxes.toFixed(2)}";"${emp.current_total_cost.toFixed(2)}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `comparativo_folha_${report.current_label.replace('/', '-')}_vs_${report.previous_label.replace('/', '-')}_${activeTab.toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Arquivo CSV exportado com sucesso.');
  };

  if (!isOpen) return null;

  const summary = report?.summary;

  // Filtragem dos colaboradores
  const filteredEmployees = (report?.by_employee || []).filter(emp => {
    if (selectedCostCenter !== 'ALL' && emp.cost_center_name !== selectedCostCenter) return false;

    if (selectedStatusFilter === 'NEW' && emp.status !== 'NEW') return false;
    if (selectedStatusFilter === 'TERMINATED' && emp.status !== 'TERMINATED') return false;
    if (selectedStatusFilter === 'ACTIVE' && emp.status !== 'ACTIVE') return false;
    if (selectedStatusFilter === 'HIGH_VARIATION' && Math.abs(emp.percent_net) < 15) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = emp.employee_name.toLowerCase().includes(q);
      const matchCpf = emp.cpf ? emp.cpf.includes(q) : false;
      const matchPos = emp.position_title ? emp.position_title.toLowerCase().includes(q) : false;
      if (!matchName && !matchCpf && !matchPos) return false;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95">
        
        {/* Top Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
              <PieChart size={22} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Comparativo Mês a Mês da Folha</h2>
                {report && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-700 flex items-center gap-1">
                    {report.current_label} vs {report.previous_label}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Análise orçamentária e gerencial de variações por centro de custo e colaborador
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportToCSV}
              disabled={loading || !report}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm transition-all disabled:opacity-50"
              title="Exportar dados para Excel/CSV"
            >
              <Download size={14} />
              Exportar CSV
            </button>
            <button
              onClick={loadComparison}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm transition-all disabled:opacity-50"
              title="Recarregar dados"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-24 text-center text-slate-400">
              <Loader2 className="animate-spin w-10 h-10 mx-auto text-indigo-600 mb-3" />
              <p className="text-sm font-semibold text-slate-700">Consolidando comparativo mês a mês...</p>
              <p className="text-xs text-slate-400 mt-1">Calculando variações de proventos, encargos patronais e centros de custo</p>
            </div>
          ) : report && summary ? (
            <>
              {/* Executive Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Custo Total Empresa */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider">Custo Total Empresa</span>
                    <DollarSign size={18} className="text-slate-600" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 font-mono">
                    {formatCurrency(summary.current_total_cost)}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-2 text-xs">
                    <span className={`px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-0.5 ${
                      summary.diff_total_cost > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {summary.diff_total_cost > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {formatPercent(summary.percent_total_cost)}
                    </span>
                    <span className="text-slate-500">
                      ({formatCurrency(summary.diff_total_cost)})
                    </span>
                  </div>
                </div>

                {/* Folha Bruta (Proventos) */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider">Folha Bruta (Vencimentos)</span>
                    <TrendingUp size={18} className="text-indigo-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 font-mono">
                    {formatCurrency(summary.current_earnings)}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-2 text-xs">
                    <span className={`px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-0.5 ${
                      summary.diff_earnings > 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-800'
                    }`}>
                      {formatPercent(summary.percent_earnings)}
                    </span>
                    <span className="text-slate-500">
                      Anterior: {formatCurrency(summary.previous_earnings)}
                    </span>
                  </div>
                </div>

                {/* Salário Líquido Total */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider">Líquido Depositado</span>
                    <Users size={18} className="text-emerald-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-emerald-600 font-mono">
                    {formatCurrency(summary.current_net)}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-2 text-xs">
                    <span className="text-slate-500">
                      Variação: <strong>{formatCurrency(summary.diff_net)}</strong> ({formatPercent(summary.percent_net)})
                    </span>
                  </div>
                </div>

                {/* Headcount (Vidas) */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider">Quadro de Pessoal (Vidas)</span>
                    <Briefcase size={18} className="text-blue-600" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-2xl font-black text-slate-900">{summary.current_headcount}</h3>
                    <span className="text-xs text-slate-400 font-medium">colaboradores</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 text-xs">
                    <span className={`px-2 py-0.5 rounded-full font-bold ${
                      summary.diff_headcount > 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : summary.diff_headcount < 0
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {summary.diff_headcount > 0 ? `+${summary.diff_headcount} admissão(ões)` : summary.diff_headcount < 0 ? `${summary.diff_headcount} desligamento(s)` : 'Sem alteração'}
                    </span>
                  </div>
                </div>

              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center justify-between border-b border-slate-200">
                <div className="flex items-center gap-4 text-sm font-bold">
                  <button
                    onClick={() => setActiveTab('COST_CENTER')}
                    className={`py-3 px-1 border-b-2 flex items-center gap-2 transition-all ${
                      activeTab === 'COST_CENTER'
                        ? 'border-indigo-600 text-indigo-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Building2 size={16} />
                    Por Centro de Custo ({report.by_cost_center.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('EMPLOYEES')}
                    className={`py-3 px-1 border-b-2 flex items-center gap-2 transition-all ${
                      activeTab === 'EMPLOYEES'
                        ? 'border-indigo-600 text-indigo-700'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Users size={16} />
                    Por Colaborador ({report.by_employee.length})
                  </button>
                </div>
              </div>

              {/* TAB 1: VISÃO POR CENTRO DE CUSTO */}
              {activeTab === 'COST_CENTER' && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 uppercase font-bold tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-4">Centro de Custo</th>
                          <th className="py-3 px-4 text-center">Vidas (At./Ant.)</th>
                          <th className="py-3 px-4 text-right">Bruto Mês Atual</th>
                          <th className="py-3 px-4 text-right">Bruto Mês Anterior</th>
                          <th className="py-3 px-4 text-right">Variação (R$ / %)</th>
                          <th className="py-3 px-4 text-right">Líquido Atual</th>
                          <th className="py-3 px-4 text-right">Encargos</th>
                          <th className="py-3 px-4 text-right font-bold text-slate-900">Custo Total</th>
                          <th className="py-3 px-4 w-36">Partic. no Custo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {report.by_cost_center.map(cc => {
                          const isUp = cc.diff_earnings > 0;
                          return (
                            <tr key={cc.cost_center_id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3 px-4 font-sans font-medium text-slate-900">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
                                    {cc.cost_center_code}
                                  </span>
                                  <span>{cc.cost_center_name}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="font-bold text-slate-900">{cc.current_headcount}</span>
                                <span className="text-slate-400 text-[11px]"> / {cc.previous_headcount}</span>
                                {cc.diff_headcount !== 0 && (
                                  <span className={`ml-1 text-[10px] font-bold ${cc.diff_headcount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    ({cc.diff_headcount > 0 ? `+${cc.diff_headcount}` : cc.diff_headcount})
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-slate-900">
                                {formatCurrency(cc.current_earnings)}
                              </td>
                              <td className="py-3 px-4 text-right text-slate-500">
                                {formatCurrency(cc.previous_earnings)}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className={`font-bold ${isUp ? 'text-amber-700' : cc.diff_earnings < 0 ? 'text-emerald-700' : 'text-slate-600'}`}>
                                  {formatCurrency(cc.diff_earnings)}
                                </span>
                                <span className="text-[10px] block opacity-80">
                                  {formatPercent(cc.percent_earnings)}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right text-slate-800">
                                {formatCurrency(cc.current_net)}
                              </td>
                              <td className="py-3 px-4 text-right text-slate-500">
                                {formatCurrency(cc.current_taxes)}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-slate-950">
                                {formatCurrency(cc.current_total_cost)}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                                    <div
                                      className="bg-indigo-600 h-2 rounded-full"
                                      style={{ width: `${Math.min(cc.percent_of_total_company_cost, 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-[11px] font-bold text-slate-700 min-w-[38px] text-right">
                                    {cc.percent_of_total_company_cost.toFixed(1)}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: VISÃO POR COLABORADOR */}
              {activeTab === 'EMPLOYEES' && (
                <div className="space-y-3">
                  {/* Filters Bar */}
                  <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                      <input
                        type="text"
                        placeholder="Buscar por colaborador ou CPF..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                      />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Centro de Custo Filter */}
                      <select
                        value={selectedCostCenter}
                        onChange={e => setSelectedCostCenter(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 font-medium"
                      >
                        <option value="ALL">Todos os Centros de Custo</option>
                        {report.by_cost_center.map(cc => (
                          <option key={cc.cost_center_id} value={cc.cost_center_name}>
                            {cc.cost_center_name}
                          </option>
                        ))}
                      </select>

                      {/* Status Filter */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSelectedStatusFilter('ALL')}
                          className={`px-2.5 py-1 text-xs rounded-lg font-bold border transition-all ${
                            selectedStatusFilter === 'ALL'
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          Todos
                        </button>
                        <button
                          onClick={() => setSelectedStatusFilter('NEW')}
                          className={`px-2.5 py-1 text-xs rounded-lg font-bold border transition-all ${
                            selectedStatusFilter === 'NEW'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                          }`}
                        >
                          Novos (+Admissões)
                        </button>
                        <button
                          onClick={() => setSelectedStatusFilter('TERMINATED')}
                          className={`px-2.5 py-1 text-xs rounded-lg font-bold border transition-all ${
                            selectedStatusFilter === 'TERMINATED'
                              ? 'bg-rose-600 text-white border-rose-600'
                              : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
                          }`}
                        >
                          Desligados/Ausentes
                        </button>
                        <button
                          onClick={() => setSelectedStatusFilter('HIGH_VARIATION')}
                          className={`px-2.5 py-1 text-xs rounded-lg font-bold border transition-all ${
                            selectedStatusFilter === 'HIGH_VARIATION'
                              ? 'bg-amber-500 text-white border-amber-500'
                              : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
                          }`}
                        >
                          Variação &gt; 15%
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Employees Table */}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 uppercase font-bold tracking-wider border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-4">Colaborador</th>
                            <th className="py-3 px-4">Centro de Custo</th>
                            <th className="py-3 px-4 text-center">Status</th>
                            <th className="py-3 px-4 text-right">Bruto Mês Atual</th>
                            <th className="py-3 px-4 text-right">Bruto Anterior</th>
                            <th className="py-3 px-4 text-right">Var. Bruta (R$ / %)</th>
                            <th className="py-3 px-4 text-right">Descontos</th>
                            <th className="py-3 px-4 text-right">Líquido Atual</th>
                            <th className="py-3 px-4 text-right">Líquido Anterior</th>
                            <th className="py-3 px-4 text-right font-bold text-slate-900">Var. Líquida</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {filteredEmployees.length === 0 ? (
                            <tr>
                              <td colSpan={10} className="py-12 text-center text-slate-400 font-sans">
                                Nenhum colaborador localizado com os filtros selecionados.
                              </td>
                            </tr>
                          ) : (
                            filteredEmployees.map(emp => {
                              const isUp = emp.diff_earnings > 0;
                              return (
                                <tr key={emp.contract_id} className="hover:bg-slate-50/70 transition-colors">
                                  <td className="py-3 px-4 font-sans font-medium text-slate-900">
                                    <div className="font-bold">{emp.employee_name}</div>
                                    <div className="text-[11px] text-slate-500 font-normal">
                                      {emp.position_title} &bull; {emp.department_name}
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 font-sans text-slate-600">
                                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 font-mono font-bold mr-1">
                                      {emp.cost_center_code}
                                    </span>
                                    {emp.cost_center_name}
                                  </td>
                                  <td className="py-3 px-4 text-center font-sans">
                                    {emp.status === 'NEW' ? (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                        Novo
                                      </span>
                                    ) : emp.status === 'TERMINATED' ? (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                        Desligado
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                                        Ativo
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-right font-bold text-slate-900">
                                    {formatCurrency(emp.current_earnings)}
                                  </td>
                                  <td className="py-3 px-4 text-right text-slate-500">
                                    {formatCurrency(emp.previous_earnings)}
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <span className={`font-bold ${isUp ? 'text-amber-700' : emp.diff_earnings < 0 ? 'text-rose-700' : 'text-slate-600'}`}>
                                      {formatCurrency(emp.diff_earnings)}
                                    </span>
                                    <span className="text-[10px] block opacity-80">
                                      {formatPercent(emp.percent_earnings)}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-right text-slate-500">
                                    {formatCurrency(emp.current_deductions)}
                                  </td>
                                  <td className="py-3 px-4 text-right font-bold text-slate-900">
                                    {formatCurrency(emp.current_net)}
                                  </td>
                                  <td className="py-3 px-4 text-right text-slate-500">
                                    {formatCurrency(emp.previous_net)}
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <span className={`font-bold ${emp.diff_net > 0 ? 'text-emerald-700' : emp.diff_net < 0 ? 'text-rose-700' : 'text-slate-600'}`}>
                                      {formatCurrency(emp.diff_net)}
                                    </span>
                                    <span className="text-[10px] block opacity-80">
                                      {formatPercent(emp.percent_net)}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center text-slate-400">
              Não foram encontrados dados comparativos para este período.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {report && (
              <span>
                Comparando: <strong>{report.current_label}</strong> com <strong>{report.previous_label}</strong> | Total Vidas: <strong>{summary?.current_headcount}</strong>
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm"
          >
            Fechar Painel
          </button>
        </div>

      </div>
    </div>
  );
};
