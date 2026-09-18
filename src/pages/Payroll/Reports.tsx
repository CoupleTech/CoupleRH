import { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Download,
  Calendar,
  Filter,
  PieChart,
  FileText,
  FileSpreadsheet
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function PayrollReports() {
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [reportData, setReportData] = useState<any>(null);
  const [detailedPayslips, setDetailedPayslips] = useState<any[]>([]);

  useEffect(() => {
    fetchPeriods();
  }, []);

  useEffect(() => {
    if (selectedPeriod) {
      fetchReportData(selectedPeriod);
    }
  }, [selectedPeriod]);

  const fetchPeriods = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }

    const { data: tenantData } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", userData.user.id)
      .single();

    if (tenantData) {
      const { data } = await supabase
        .from("payroll_periods")
        .select("*")
        .eq("tenant_id", tenantData.tenant_id)
        .eq("status", "CLOSED")
        .order("year", { ascending: false })
        .order("month", { ascending: false });

      if (data && data.length > 0) {
        setPeriods(data);
        setSelectedPeriod(data[0].id);
      }
    }
    setLoading(false);
  };

  const fetchReportData = async (periodId: string) => {
    setLoading(true);
    
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }

    const { data: tenantData } = await supabase
      .from("tenant_users")
      .select("tenant_id")
      .eq("user_id", userData.user.id)
      .single();

    if (tenantData) {
      // Buscar todos os recibos do período selecionado
      const { data: payslips, error } = await supabase
        .from("payslips")
        .select(`
          id,
          total_earnings,
          total_deductions,
          net_salary,
          base_inss,
          base_irrf,
          base_fgts,
          fgts_month,
          contract_id,
          payslip_items (
            reference,
            amount,
            type,
            payroll_rubrics (code, name)
          ),
          employment_contracts (
            admission_date,
            contract_type,
            base_salary,
            positions (title),
            departments (name),
            cost_centers (name),
            companies (corporate_name, cnpj),
            workers (
              esocial_matricula,
              pis_pasep,
              bank_code,
              bank_name,
              agency,
              agency_digit,
              account_number,
              account_digit,
              account_type,
              pix_key,
              pix_type,
              people (full_name, cpf, birth_date)
            )
          )
        `)
        .eq("tenant_id", tenantData.tenant_id)
        .eq("period_id", periodId);

      if (error) {
        console.error("Error fetching payslips:", error);
      }

      if (payslips && payslips.length > 0) {
        setDetailedPayslips(payslips);
        
        const summary = {
          totalEarnings: 0,
          totalDeductions: 0,
          totalNet: 0,
          totalTaxes: 0,
          totalEmployees: payslips.length,
          byDepartment: {} as Record<string, number>,
          byCostCenter: {} as Record<string, number>
        };

        payslips.forEach((p) => {
          summary.totalEarnings += Number(p.total_earnings) || 0;
          summary.totalDeductions += Number(p.total_deductions) || 0;
          summary.totalNet += Number(p.net_salary) || 0;
          
          const estimatedTaxes = (Number(p.total_earnings) || 0) * 0.358;
          summary.totalTaxes += estimatedTaxes;

          const deptName = p.employment_contracts?.departments?.name || "Sem Departamento";
          summary.byDepartment[deptName] = (summary.byDepartment[deptName] || 0) + (Number(p.total_earnings) || 0);

          const ccName = p.employment_contracts?.cost_centers?.name || "Geral";
          summary.byCostCenter[ccName] = (summary.byCostCenter[ccName] || 0) + (Number(p.total_earnings) || 0);
        });

        setReportData(summary);
      } else {
        setReportData(null);
        setDetailedPayslips([]);
      }
    }
    
    setLoading(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };
  
  const formatCPF = (cpf: string) => {
    if (!cpf) return "";
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const formatCNPJ = (cnpj: string) => {
    if (!cnpj) return "";
    const clean = cnpj.replace(/\D/g, "");
    if (clean.length === 14) {
      return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
    }
    return cnpj;
  };

  const getPeriodLabel = () => {
    const period = periods.find(p => p.id === selectedPeriod);
    if (!period) return "";
    return `${String(period.month).padStart(2, '0')}/${period.year} - ${period.type === 'MONTHLY' ? 'Folha Mensal' : period.type}`;
  };

  const exportExtratoMensalPDF = () => {
    if (!detailedPayslips.length) return;
    
    const doc = new jsPDF('portrait');
    const periodLabel = getPeriodLabel();
    
    // Pegar a primeira empresa encontrada nos recibos (assumindo que todos são da mesma empresa no filtro atual)
    const company = detailedPayslips[0]?.employment_contracts?.companies;
    const empresaNome = company?.corporate_name || "EMPRESA NÃO IDENTIFICADA";
    const empresaCNPJ = company?.cnpj || "00.000.000/0000-00";

    // Header Global
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(`Empresa:`, 14, 15);
    doc.text(`${empresaNome}`, 40, 15);
    
    doc.text(`CNPJ:`, 14, 20);
    doc.setFont("helvetica", "normal");
    doc.text(`${empresaCNPJ}`, 40, 20);
    
    doc.setFont("helvetica", "bold");
    doc.text(`Cálculo:`, 14, 25);
    doc.setFont("helvetica", "normal");
    doc.text(`Folha Mensal`, 40, 25);
    
    doc.setFont("helvetica", "bold");
    doc.text(`Competência:`, 14, 30);
    doc.setFont("helvetica", "normal");
    doc.text(`${periodLabel}`, 40, 30);
    
    doc.line(14, 35, 196, 35); // Linha separadora
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("EXTRATO MENSAL", 105, 40, { align: "center" });
    doc.line(14, 42, 196, 42);

    let startY = 48;

    detailedPayslips.forEach((p, index) => {
      // Se não couber na página, cria nova
      if (startY > 250) {
        doc.addPage();
        startY = 20;
      }

      const contract = p.employment_contracts;
      const worker = contract?.workers;
      const person = worker?.people;
      const matricula = worker?.esocial_matricula || contract?.id?.substring(0, 5) || "";

      // Cabeçalho do Funcionário
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      
      // Linha 1
      doc.text(`Empr.:`, 14, startY);
      doc.setFont("helvetica", "normal");
      doc.text(`${matricula} ${person?.full_name?.substring(0,35) || ""}`, 30, startY);
      
      doc.setFont("helvetica", "bold");
      doc.text(`Situação:`, 100, startY);
      doc.setFont("helvetica", "normal");
      doc.text(contract?.status === 'ACTIVE' ? 'Trabalhando' : contract?.status || '', 115, startY);
      
      doc.setFont("helvetica", "bold");
      doc.text(`CPF:`, 145, startY);
      doc.setFont("helvetica", "normal");
      doc.text(formatCPF(person?.cpf), 155, startY);
      
      doc.setFont("helvetica", "bold");
      doc.text(`PIS:`, 175, startY);
      doc.setFont("helvetica", "normal");
      doc.text(worker?.pis_pasep || "", 185, startY);

      // Linha 2
      startY += 4;
      doc.setFont("helvetica", "bold");
      doc.text(`Cargo:`, 14, startY);
      doc.setFont("helvetica", "normal");
      doc.text(`${contract?.positions?.title?.substring(0, 25) || ""}`, 30, startY);
      
      doc.setFont("helvetica", "bold");
      doc.text(`Vínculo:`, 100, startY);
      doc.setFont("helvetica", "normal");
      doc.text(`${contract?.contract_type || "Celetista"}`, 115, startY);
      
      doc.setFont("helvetica", "bold");
      doc.text(`Adm:`, 145, startY);
      doc.setFont("helvetica", "normal");
      doc.text(contract?.admission_date ? new Date(contract.admission_date).toLocaleDateString('pt-BR') : "", 155, startY);
      
      doc.setFont("helvetica", "bold");
      doc.text(`Salário:`, 175, startY);
      doc.setFont("helvetica", "normal");
      doc.text(formatCurrency(Number(contract?.base_salary)), 185, startY);

      // Linha 3
      startY += 4;
      doc.setFont("helvetica", "bold");
      doc.text(`CC:`, 14, startY);
      doc.setFont("helvetica", "normal");
      doc.text(`${contract?.cost_centers?.name || "Geral"}`, 30, startY);
      
      doc.setFont("helvetica", "bold");
      doc.text(`Depto:`, 100, startY);
      doc.setFont("helvetica", "normal");
      doc.text(`${contract?.departments?.name || "Geral"}`, 115, startY);

      startY += 6;

      // Itens (Proventos e Descontos)
      const items = p.payslip_items || [];
      const earnings = items.filter((i: any) => i.type === 'EARNING');
      const deductions = items.filter((i: any) => i.type === 'DEDUCTION');
      
      let itemY = startY;
      
      // Proventos e Descontos listados
      const allItems = [...earnings, ...deductions].sort((a: any, b: any) => {
        return (a.payroll_rubrics?.code || "").localeCompare(b.payroll_rubrics?.code || "");
      });

      doc.setFont("helvetica", "normal");
      allItems.forEach((i: any) => {
        const cod = i.payroll_rubrics?.code || "000";
        const nome = i.payroll_rubrics?.name || "Desconhecido";
        const ref = i.reference || "";
        const valor = formatCurrency(Number(i.amount));
        const tipoStr = i.type === 'EARNING' ? 'P' : 'D';

        doc.text(`${cod} ${nome.substring(0, 25)}`, 20, itemY);
        doc.text(ref, 80, itemY, { align: "right" });
        doc.text(`${valor} ${tipoStr}`, 110, itemY, { align: "right" });
        itemY += 4;
      });

      // Se tivermos poucos itens, dá um espacinho
      itemY = Math.max(itemY, startY + 5);
      itemY += 4;

      // Rodapé do Funcionário (Totais)
      doc.setFont("helvetica", "bold");
      
      // Linha 1 Totais
      doc.text(`Proventos:`, 14, itemY);
      doc.setFont("helvetica", "normal");
      doc.text(formatCurrency(Number(p.total_earnings)), 35, itemY);
      
      doc.setFont("helvetica", "bold");
      doc.text(`Descontos:`, 55, itemY);
      doc.setFont("helvetica", "normal");
      doc.text(formatCurrency(Number(p.total_deductions)), 75, itemY);
      
      doc.setFont("helvetica", "bold");
      doc.text(`Líquido:`, 145, itemY);
      doc.setFont("helvetica", "normal");
      doc.text(formatCurrency(Number(p.net_salary)), 165, itemY);

      itemY += 4;
      // Linha 2 Totais
      doc.setFont("helvetica", "bold");
      doc.text(`Base INSS:`, 14, itemY);
      doc.setFont("helvetica", "normal");
      doc.text(formatCurrency(Number(p.base_inss)), 35, itemY);
      
      doc.setFont("helvetica", "bold");
      doc.text(`Base FGTS:`, 55, itemY);
      doc.setFont("helvetica", "normal");
      doc.text(formatCurrency(Number(p.base_fgts)), 75, itemY);
      
      doc.setFont("helvetica", "bold");
      doc.text(`Valor FGTS:`, 95, itemY);
      doc.setFont("helvetica", "normal");
      doc.text(formatCurrency(Number(p.fgts_month)), 115, itemY);
      
      doc.setFont("helvetica", "bold");
      doc.text(`Base IRRF:`, 145, itemY);
      doc.setFont("helvetica", "normal");
      doc.text(formatCurrency(Number(p.base_irrf)), 165, itemY);

      itemY += 6;
      doc.line(14, itemY, 196, itemY); // Linha fim do funcionário
      startY = itemY + 6;
    });

    doc.save(`extrato_mensal_${periodLabel.replace('/', '-')}.pdf`);
  };

  const exportFinancialReportPDF = () => {
    if (!detailedPayslips.length) return;
    
    const doc = new jsPDF('landscape');
    const periodLabel = getPeriodLabel();
    const company = detailedPayslips[0]?.employment_contracts?.companies;
    const companyText = company ? `${company.corporate_name} - CNPJ: ${formatCNPJ(company.cnpj)}` : "";
    
    // Header
    doc.setFontSize(18);
    doc.text("Relatório Financeiro de Pagamento", 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    
    let tableStartY = 45;
    if (companyText) {
      doc.setFont("helvetica", "bold");
      doc.text(companyText, 14, 30);
      doc.setFont("helvetica", "normal");
      doc.text(`Competência: ${periodLabel}`, 14, 36);
      doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 14, 42);
      tableStartY = 50;
    } else {
      doc.text(`Competência: ${periodLabel}`, 14, 30);
      doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 14, 36);
    }

    const tableColumn = ["Nome", "CPF", "Banco", "Agência", "Conta", "Tipo", "Pix", "Líquido (R$)"];
    const tableRows: any[] = [];

    detailedPayslips.forEach(p => {
      const worker = p.employment_contracts?.workers;
      const person = worker?.people;
      
      const agencia = worker?.agency ? `${worker.agency}${worker.agency_digit ? `-${worker.agency_digit}` : ''}` : '-';
      const conta = worker?.account_number ? `${worker.account_number}${worker.account_digit ? `-${worker.account_digit}` : ''}` : '-';
      
      const rowData = [
        person?.full_name || "N/A",
        formatCPF(person?.cpf),
        worker?.bank_name || worker?.bank_code || "-",
        agencia,
        conta,
        worker?.account_type || "-",
        worker?.pix_key ? `${worker.pix_type}: ${worker.pix_key}` : "-",
        formatCurrency(Number(p.net_salary))
      ];
      tableRows.push(rowData);
    });

    // Total Row
    tableRows.push([
      "TOTAL GERAL", "", "", "", "", "", "",
      formatCurrency(reportData.totalNet)
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: tableStartY,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [63, 81, 181] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      didParseCell: function (data: any) {
        if (data.row.index === tableRows.length - 1) {
           data.cell.styles.fontStyle = 'bold';
           data.cell.styles.fillColor = [220, 230, 240];
        }
      }
    });

    doc.save(`financeiro_folha_${periodLabel.replace('/', '-')}.pdf`);
  };

  const exportAccountingReportPDF = () => {
    if (!detailedPayslips.length) return;
    
    const doc = new jsPDF('landscape');
    const periodLabel = getPeriodLabel();
    const company = detailedPayslips[0]?.employment_contracts?.companies;
    const companyText = company ? `${company.corporate_name} - CNPJ: ${formatCNPJ(company.cnpj)}` : "";
    
    // Header
    doc.setFontSize(18);
    doc.text("Relatório Analítico Contábil - Folha de Pagamento", 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    
    let tableStartY = 45;
    if (companyText) {
      doc.setFont("helvetica", "bold");
      doc.text(companyText, 14, 30);
      doc.setFont("helvetica", "normal");
      doc.text(`Competência: ${periodLabel}`, 14, 36);
      doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 14, 42);
      tableStartY = 50;
    } else {
      doc.text(`Competência: ${periodLabel}`, 14, 30);
      doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 14, 36);
    }

    const tableColumn = [
      "Nome", 
      "CPF", 
      "Departamento", 
      "Proventos", 
      "Descontos", 
      "Líquido", 
      "Base INSS", 
      "Base IRRF", 
      "Base FGTS", 
      "FGTS Mês"
    ];
    const tableRows: any[] = [];

    let totalProv = 0, totalDesc = 0, totalLiq = 0;
    let tBaseInss = 0, tBaseIrrf = 0, tBaseFgts = 0, tFgtsMes = 0;

    detailedPayslips.forEach(p => {
      const worker = p.employment_contracts?.workers;
      const person = worker?.people;
      
      const proventos = Number(p.total_earnings) || 0;
      const descontos = Number(p.total_deductions) || 0;
      const liquido = Number(p.net_salary) || 0;
      const baseInss = Number(p.base_inss) || 0;
      const baseIrrf = Number(p.base_irrf) || 0;
      const baseFgts = Number(p.base_fgts) || 0;
      const fgtsMes = Number(p.fgts_month) || 0;

      totalProv += proventos;
      totalDesc += descontos;
      totalLiq += liquido;
      tBaseInss += baseInss;
      tBaseIrrf += baseIrrf;
      tBaseFgts += baseFgts;
      tFgtsMes += fgtsMes;

      const rowData = [
        person?.full_name || "N/A",
        formatCPF(person?.cpf),
        p.employment_contracts?.departments?.name || "-",
        formatCurrency(proventos),
        formatCurrency(descontos),
        formatCurrency(liquido),
        formatCurrency(baseInss),
        formatCurrency(baseIrrf),
        formatCurrency(baseFgts),
        formatCurrency(fgtsMes)
      ];
      tableRows.push(rowData);
    });

    // Total Row
    tableRows.push([
      "TOTAIS DA FOLHA", 
      "", 
      "", 
      formatCurrency(totalProv),
      formatCurrency(totalDesc),
      formatCurrency(totalLiq),
      formatCurrency(tBaseInss),
      formatCurrency(tBaseIrrf),
      formatCurrency(tBaseFgts),
      formatCurrency(tFgtsMes)
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: tableStartY,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [15, 118, 110] },
      alternateRowStyles: { fillColor: [240, 253, 250] },
      didParseCell: function (data: any) {
        if (data.row.index === tableRows.length - 1) {
           data.cell.styles.fontStyle = 'bold';
           data.cell.styles.fillColor = [204, 251, 241];
        }
      }
    });

    doc.save(`contabilidade_folha_${periodLabel.replace('/', '-')}.pdf`);
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-display tracking-tight flex items-center gap-2">
            <BarChart3 className="text-primary-600" /> Dashboard Analítico de Folha
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Visão gerencial de custos e relatórios contábeis/financeiros.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="pl-10 pr-8 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none appearance-none shadow-sm cursor-pointer"
            >
              <option value="" disabled>Selecione um período</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {String(p.month).padStart(2, '0')}/{p.year} - {p.type}
                </option>
              ))}
            </select>
          </div>
          
          <button 
            onClick={exportExtratoMensalPDF}
            disabled={!detailedPayslips.length}
            className="btn-primary py-2.5 flex items-center gap-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet size={18} /> Extrato Mensal (PDF)
          </button>
          
          <button 
            onClick={exportFinancialReportPDF}
            disabled={!detailedPayslips.length}
            className="btn-primary py-2.5 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={18} /> Financeiro (PDF)
          </button>
          
          <button 
            onClick={exportAccountingReportPDF}
            disabled={!detailedPayslips.length}
            className="btn-primary py-2.5 flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileText size={18} /> Contábil (PDF)
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center bg-white rounded-2xl border border-slate-200">
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-primary-500 rounded-full animate-spin"></div>
            <p className="text-sm font-medium">Carregando dados...</p>
          </div>
        </div>
      ) : reportData ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <DollarSign size={64} className="text-slate-900" />
              </div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">
                Custo Total (Folha + Encargos)
              </p>
              <h3 className="text-3xl font-black text-slate-900 font-mono">
                {formatCurrency(reportData.totalEarnings + reportData.totalTaxes)}
              </h3>
              <div className="mt-4 flex items-center gap-2 text-sm">
                <span className="flex items-center gap-1 text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">
                   {reportData.totalEmployees} vidas processadas
                </span>
              </div>
            </div>

            <div className="glass bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <TrendingUp size={64} className="text-emerald-500" />
              </div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">
                Total Vencimentos (Bruto)
              </p>
              <h3 className="text-2xl font-bold text-emerald-600 font-mono">
                {formatCurrency(reportData.totalEarnings)}
              </h3>
              <p className="text-xs text-slate-400 mt-2">Soma de todos os proventos</p>
            </div>

            <div className="glass bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <TrendingDown size={64} className="text-rose-500" />
              </div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">
                Total Descontos
              </p>
              <h3 className="text-2xl font-bold text-rose-600 font-mono">
                {formatCurrency(reportData.totalDeductions)}
              </h3>
              <p className="text-xs text-slate-400 mt-2">INSS, IRRF, Faltas, Benefícios</p>
            </div>

            <div className="glass bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <PieChart size={64} className="text-indigo-500" />
              </div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">
                Total Líquido Pago
              </p>
              <h3 className="text-2xl font-bold text-indigo-600 font-mono">
                {formatCurrency(reportData.totalNet)}
              </h3>
              <p className="text-xs text-slate-400 mt-2">Valor depositado aos funcionários</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             {/* Chart 1 - By Department */}
             <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                   <h3 className="font-bold text-slate-800">Custo (Bruto) por Departamento</h3>
                   <Filter size={16} className="text-slate-400" />
                </div>
                <div className="space-y-4">
                   {Object.entries(reportData.byDepartment).map(([dept, value]) => {
                      const percentage = ((Number(value) / reportData.totalEarnings) * 100).toFixed(1);
                      return (
                         <div key={dept}>
                            <div className="flex justify-between text-sm mb-1">
                               <span className="font-medium text-slate-700">{dept}</span>
                               <span className="font-bold text-slate-900 font-mono">
                                  {formatCurrency(Number(value))}
                               </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                               <div className="bg-primary-500 h-2 rounded-full" style={{ width: `${percentage}%` }}></div>
                            </div>
                         </div>
                      );
                   })}
                   {Object.keys(reportData.byDepartment).length === 0 && (
                      <p className="text-center text-sm text-slate-500 py-4">Sem dados departamentais</p>
                   )}
                </div>
             </div>

             {/* Chart 2 - By Cost Center */}
             <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                   <h3 className="font-bold text-slate-800">Custo (Bruto) por Centro de Custo</h3>
                   <Filter size={16} className="text-slate-400" />
                </div>
                <div className="space-y-4">
                   {Object.entries(reportData.byCostCenter).map(([cc, value]) => {
                      const percentage = ((Number(value) / reportData.totalEarnings) * 100).toFixed(1);
                      return (
                         <div key={cc}>
                            <div className="flex justify-between text-sm mb-1">
                               <span className="font-medium text-slate-700">{cc}</span>
                               <span className="font-bold text-slate-900 font-mono">
                                  {formatCurrency(Number(value))}
                               </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2">
                               <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${percentage}%` }}></div>
                            </div>
                         </div>
                      );
                   })}
                   {Object.keys(reportData.byCostCenter).length === 0 && (
                      <p className="text-center text-sm text-slate-500 py-4">Sem dados de centro de custo</p>
                   )}
                </div>
             </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
           <BarChart3 size={48} className="mx-auto text-slate-300 mb-4" />
           <h3 className="text-lg font-bold text-slate-900 mb-2">Nenhum dado encontrado</h3>
           <p className="text-slate-500 max-w-md mx-auto">
              Não há dados de folha consolidada (status FECHADA) para o período selecionado.
           </p>
        </div>
      )}
    </div>
  );
}
