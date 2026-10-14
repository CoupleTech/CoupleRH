import { supabase } from '../../lib/supabase';

export interface TaxGuideCalculationInput {
  competenceMonth: number;
  competenceYear: number;
  totalBaseInss: number;
  totalInssEmployee: number;
  totalBaseFgts: number;
  totalBaseIrrf: number;
  totalIrrfEmployee: number;
  taxRegime?: 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL' | string;
  ratAliquot?: number;
  fapMultiplier?: number;
  terceirosAliquot?: number;
  inssPatronalAliquot?: number;
}

export interface DctfWebInssGuide {
  code: string;
  name: string;
  dueDate: string;
  totalInssSegurados: number;
  inssPatronal: number;
  ratAdjusted: number;
  terceiros: number;
  totalDctfWeb: number;
}

export interface FgtsDigitalGuide {
  code: string;
  name: string;
  dueDate: string;
  baseFgts: number;
  totalFgts: number;
}

export interface DarfIrrfGuide {
  code: string;
  name: string;
  dueDate: string;
  baseIrrf: number;
  totalIrrf: number;
}

export interface TaxGuidesReport {
  competence: string;
  dctfWebInss: DctfWebInssGuide;
  fgtsDigital: FgtsDigitalGuide;
  darfIrrf: DarfIrrfGuide;
  totalTaxesDue: number;
}

export interface ProvisionCalculationInput {
  contractId: string;
  employeeName: string;
  baseSalary: number;
  averageAdditionals?: number;
  monthsWorkedInYear?: number;
  inssPatronalAliquot?: number;
  ratAliquot?: number;
  terceirosAliquot?: number;
  fgtsAliquot?: number;
}

export interface EmployeeProvisionResult {
  contractId: string;
  employeeName: string;
  monthlyFerias: number;
  monthlyTercoFerias: number;
  monthlyThirteenth: number;
  chargesFerias: number;
  chargesThirteenth: number;
  totalMonthly: number;
}

export interface PayrollProvisionsReport {
  totalMonthlyFerias: number;
  totalMonthlyTercoFerias: number;
  totalMonthlyThirteenth: number;
  totalChargesFerias: number;
  totalChargesThirteenth: number;
  totalMonthlyLiability: number;
  items: EmployeeProvisionResult[];
}

export interface AccountingSummaryInput {
  totalEarnings: number;
  totalDeductions: number;
  totalNetSalary: number;
  totalInssEmployee: number;
  totalIrrfEmployee: number;
  totalOtherDeductions: number;
  inssPatronal: number;
  ratAdjusted: number;
  terceiros: number;
  fgtsCompany: number;
}

export interface AccountingEntry {
  accountCode: string;
  accountName: string;
  type: 'DEBIT' | 'CREDIT';
  amount: number;
  history: string;
}

export interface AccountingSummaryReport {
  isBalanced: boolean;
  totalDebit: number;
  totalCredit: number;
  entries: AccountingEntry[];
}

export interface CnabCompanyInfo {
  corporateName: string;
  cnpj: string;
  bankCode: string;
  agency: string;
  agencyDigit?: string;
  accountNumber: string;
  accountDigit?: string;
}

export interface CnabEmployeePayment {
  contractId: string;
  name: string;
  cpf: string;
  bankCode: string;
  agency: string;
  agencyDigit?: string;
  accountNumber: string;
  accountDigit?: string;
  accountType?: 'CORRENTE' | 'POUPANCA' | 'SALARIO' | string;
  pixKey?: string;
  netAmount: number;
  paymentDate: string; // YYYY-MM-DD
}

export interface Cnab240Input {
  company: CnabCompanyInfo;
  employees: CnabEmployeePayment[];
  sequentialFileNumber?: number;
}

export interface AnnualIncomeRecord {
  competenceMonth: number;
  competenceYear: number;
  isThirteenth?: boolean;
  taxableEarnings: number;
  inssDeduction: number;
  irrfDeduction: number;
  dependentDeduction?: number;
  exemptEarnings?: number;
}

export interface AnnualIncomeReportInput {
  calendarYear: number;
  employeeCpf: string;
  employeeName: string;
  companyCnpj: string;
  companyName: string;
  records: AnnualIncomeRecord[];
}

export interface AnnualIncomeReport {
  calendarYear: number;
  fontePagadora: {
    cnpj: string;
    nome: string;
  };
  pessoaFisica: {
    cpf: string;
    nome: string;
  };
  quadro3: {
    totalRendimentosTributaveis: number;
    contribuicaoPrevidenciariaOficial: number;
    previdenciaPrivada: number;
    pensaoAlimenticia: number;
    impostoRetido: number;
  };
  quadro4: {
    totalIsentos: number;
  };
  quadro5: {
    decimoTerceiroSalario: number;
    irrfDecimoTerceiro: number;
  };
}

export class PayrollObligationsService {
  /**
   * 1. Apuração de Guias Tributárias (INSS / FGTS / IRRF)
   */
  public calculateTaxGuides(input: TaxGuideCalculationInput): TaxGuidesReport {
    const isSimples = input.taxRegime === 'SIMPLES_NACIONAL';

    // Competência e vencimento padrão: dia 20 do mês subsequente
    const nextMonth = input.competenceMonth === 12 ? 1 : input.competenceMonth + 1;
    const nextYear = input.competenceMonth === 12 ? input.competenceYear + 1 : input.competenceYear;
    const dueDateStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-20`;

    // 1. INSS / DCTFWeb
    const inssSegurados = Math.round((Number(input.totalInssEmployee) || 0) * 100) / 100;
    let inssPatronal = 0;
    let ratAdjusted = 0;
    let terceiros = 0;

    if (!isSimples) {
      const patronalRate = input.inssPatronalAliquot ?? 0.20;
      const ratRate = (input.ratAliquot ?? 0.02) * (input.fapMultiplier ?? 1.0);
      const terceirosRate = input.terceirosAliquot ?? 0.058;

      inssPatronal = Math.round((input.totalBaseInss * patronalRate) * 100) / 100;
      ratAdjusted = Math.round((input.totalBaseInss * ratRate) * 100) / 100;
      terceiros = Math.round((input.totalBaseInss * terceirosRate) * 100) / 100;
    }

    const totalDctfWeb = Math.round((inssSegurados + inssPatronal + ratAdjusted + terceiros) * 100) / 100;

    // 2. FGTS Digital (8% sobre a base FGTS)
    const totalFgts = Math.round((Number(input.totalBaseFgts || 0) * 0.08) * 100) / 100;

    // 3. DARF IRRF (Código 0561)
    const totalIrrf = Math.round((Number(input.totalIrrfEmployee) || 0) * 100) / 100;

    return {
      competence: `${String(input.competenceMonth).padStart(2, '0')}/${input.competenceYear}`,
      dctfWebInss: {
        code: '0561-INSS',
        name: 'DCTFWeb - Contribuição Previdenciária & Outras Entidades',
        dueDate: dueDateStr,
        totalInssSegurados: inssSegurados,
        inssPatronal,
        ratAdjusted,
        terceiros,
        totalDctfWeb,
      },
      fgtsDigital: {
        code: 'FGTS-DIGITAL',
        name: 'Guia FGTS Digital Mensal',
        dueDate: dueDateStr,
        baseFgts: Math.round(Number(input.totalBaseFgts || 0) * 100) / 100,
        totalFgts,
      },
      darfIrrf: {
        code: '0561',
        name: 'DARF IRRF - Rendimento do Trabalho Assalariado',
        dueDate: dueDateStr,
        baseIrrf: Math.round(Number(input.totalBaseIrrf || 0) * 100) / 100,
        totalIrrf,
      },
      totalTaxesDue: Math.round((totalDctfWeb + totalFgts + totalIrrf) * 100) / 100,
    };
  }

  /**
   * 2. Provisões Trabalhistas Mensais (Férias + 1/3 e 13º Salário)
   */
  public calculatePayrollProvisions(inputs: ProvisionCalculationInput[]): PayrollProvisionsReport {
    let sumMonthlyFerias = 0;
    let sumMonthlyTercoFerias = 0;
    let sumMonthlyThirteenth = 0;
    let sumChargesFerias = 0;
    let sumChargesThirteenth = 0;

    const items: EmployeeProvisionResult[] = inputs.map((emp) => {
      const baseSalary = Number(emp.baseSalary || 0);
      const additionals = Number(emp.averageAdditionals || 0);
      const remunBase = baseSalary + additionals;

      // Provisão Mensal (1/12 avos)
      const monthlyFerias = Math.round((remunBase / 12) * 100) / 100;
      const monthlyTercoFerias = Math.round((monthlyFerias / 3) * 100) / 100;
      const monthlyThirteenth = Math.round((remunBase / 12) * 100) / 100;

      // Encargos Patronais sobre provisões (INSS Patronal + RAT + Terceiros + FGTS)
      const patronalRate = emp.inssPatronalAliquot ?? 0.20;
      const ratRate = emp.ratAliquot ?? 0.02;
      const terceirosRate = emp.terceirosAliquot ?? 0.058;
      const fgtsRate = emp.fgtsAliquot ?? 0.08;
      const totalChargesRate = patronalRate + ratRate + terceirosRate + fgtsRate;

      const baseFeriasComTerco = monthlyFerias + monthlyTercoFerias;
      const chargesFerias = Math.round((baseFeriasComTerco * totalChargesRate) * 100) / 100;
      const chargesThirteenth = Math.round((monthlyThirteenth * totalChargesRate) * 100) / 100;

      const totalMonthly = Math.round(
        (baseFeriasComTerco + chargesFerias + monthlyThirteenth + chargesThirteenth) * 100
      ) / 100;

      sumMonthlyFerias += monthlyFerias;
      sumMonthlyTercoFerias += monthlyTercoFerias;
      sumMonthlyThirteenth += monthlyThirteenth;
      sumChargesFerias += chargesFerias;
      sumChargesThirteenth += chargesThirteenth;

      return {
        contractId: emp.contractId,
        employeeName: emp.employeeName,
        monthlyFerias,
        monthlyTercoFerias,
        monthlyThirteenth,
        chargesFerias,
        chargesThirteenth,
        totalMonthly,
      };
    });

    const totalMonthlyLiability = Math.round(
      (sumMonthlyFerias + sumMonthlyTercoFerias + sumMonthlyThirteenth + sumChargesFerias + sumChargesThirteenth) * 100
    ) / 100;

    return {
      totalMonthlyFerias: Math.round(sumMonthlyFerias * 100) / 100,
      totalMonthlyTercoFerias: Math.round(sumMonthlyTercoFerias * 100) / 100,
      totalMonthlyThirteenth: Math.round(sumMonthlyThirteenth * 100) / 100,
      totalChargesFerias: Math.round(sumChargesFerias * 100) / 100,
      totalChargesThirteenth: Math.round(sumChargesThirteenth * 100) / 100,
      totalMonthlyLiability,
      items,
    };
  }

  /**
   * 3. Resumo Contábil da Folha de Pagamento (Partidas Dobradas)
   */
  public generateAccountingSummary(input: AccountingSummaryInput): AccountingSummaryReport {
    const entries: AccountingEntry[] = [];

    // Débitos (Despesas e Encargos da Empresa)
    entries.push({
      accountCode: '3.1.1.01',
      accountName: 'Despesas com Salários e Ordenados',
      type: 'DEBIT',
      amount: input.totalEarnings,
      history: 'Valor bruto da folha de pagamento do período',
    });

    const totalEncargosInssPatronal = Math.round(
      (Number(input.inssPatronal || 0) + Number(input.ratAdjusted || 0) + Number(input.terceiros || 0)) * 100
    ) / 100;

    if (totalEncargosInssPatronal > 0) {
      entries.push({
        accountCode: '3.1.2.01',
        accountName: 'Encargos Sociais - INSS Patronal / RAT / Terceiros',
        type: 'DEBIT',
        amount: totalEncargosInssPatronal,
        history: 'Encargos previdenciários e outras entidades a recolher',
      });
    }

    if (input.fgtsCompany > 0) {
      entries.push({
        accountCode: '3.1.2.02',
        accountName: 'Encargos Sociais - FGTS Despesa',
        type: 'DEBIT',
        amount: input.fgtsCompany,
        history: 'Depósito do FGTS incidente sobre a folha mensal',
      });
    }

    // Créditos (Passivo Circulante - Obrigações a Pagar)
    entries.push({
      accountCode: '2.1.2.01',
      accountName: 'Salários a Pagar (Líquido)',
      type: 'CREDIT',
      amount: input.totalNetSalary,
      history: 'Remuneração líquida creditada aos colaboradores',
    });

    const inssTotalRecolher = Math.round(
      (Number(input.totalInssEmployee || 0) + totalEncargosInssPatronal) * 100
    ) / 100;

    if (inssTotalRecolher > 0) {
      entries.push({
        accountCode: '2.1.3.01',
        accountName: 'INSS e Outras Entidades a Recolher',
        type: 'CREDIT',
        amount: inssTotalRecolher,
        history: 'Retenção de empregados e quota patronal da DCTFWeb',
      });
    }

    if (input.totalIrrfEmployee > 0) {
      entries.push({
        accountCode: '2.1.3.02',
        accountName: 'IRRF a Recolher',
        type: 'CREDIT',
        amount: input.totalIrrfEmployee,
        history: 'Imposto de Renda Retido na Fonte dos colaboradores (DARF 0561)',
      });
    }

    if (input.fgtsCompany > 0) {
      entries.push({
        accountCode: '2.1.3.03',
        accountName: 'FGTS a Recolher',
        type: 'CREDIT',
        amount: input.fgtsCompany,
        history: 'Guia do FGTS Digital a recolher no mês',
      });
    }

    if (input.totalOtherDeductions > 0) {
      entries.push({
        accountCode: '2.1.2.02',
        accountName: 'Outros Descontos / Convênios / Benefícios',
        type: 'CREDIT',
        amount: input.totalOtherDeductions,
        history: 'Descontos diversos retidos em folha (VT, VR, Coparticipação, etc.)',
      });
    }

    const totalDebit = Math.round(
      entries.filter((e) => e.type === 'DEBIT').reduce((acc, e) => acc + e.amount, 0) * 100
    ) / 100;

    const totalCredit = Math.round(
      entries.filter((e) => e.type === 'CREDIT').reduce((acc, e) => acc + e.amount, 0) * 100
    ) / 100;

    const isBalanced = Math.abs(totalDebit - totalCredit) <= 0.02;

    return {
      isBalanced,
      totalDebit,
      totalCredit,
      entries,
    };
  }

  /**
   * 4. Gerador de Arquivo CNAB 240 (Padrão FEBRABAN para Folha de Pagamento)
   */
  public generateCnab240(input: Cnab240Input): string {
    const pad = (str: string | number, length: number, char = ' '): string => {
      const s = String(str ?? '');
      if (s.length >= length) return s.substring(0, length);
      return char === '0' ? s.padStart(length, '0') : s.padEnd(length, ' ');
    };

    const cleanNum = (str: string | number): string => String(str ?? '').replace(/\D/g, '');

    const bankCode = pad(cleanNum(input.company.bankCode) || '001', 3, '0');
    const cnpj = pad(cleanNum(input.company.cnpj), 14, '0');
    const companyName = pad(input.company.corporateName.toUpperCase(), 30);
    const agency = pad(cleanNum(input.company.agency), 5, '0');
    const agencyDigit = pad(input.company.agencyDigit || ' ', 1);
    const account = pad(cleanNum(input.company.accountNumber), 12, '0');
    const accountDigit = pad(input.company.accountDigit || ' ', 1);
    const dateToday = new Date().toISOString().replace(/\D/g, '').substring(0, 8); // YYYYMMDD
    const seqFile = pad(input.sequentialFileNumber || 1, 6, '0');

    const lines: string[] = [];

    // 1. Header de Arquivo (Registro 0 - 240 posições)
    let headerArquivo = bankCode; // 1-3
    headerArquivo += '0000'; // 4-7 Lote
    headerArquivo += '0'; // 8 Tipo Registro (0 = Header de Arquivo)
    headerArquivo += pad('', 9); // 9-17 Reservado
    headerArquivo += '2'; // 18 Tipo Inscrição (2 = CNPJ)
    headerArquivo += cnpj; // 19-32 CNPJ
    headerArquivo += pad('', 20); // 33-52 Convênio
    headerArquivo += agency + agencyDigit; // 53-58 Agência
    headerArquivo += account + accountDigit; // 59-71 Conta
    headerArquivo += ' '; // 72 DAC
    headerArquivo += companyName; // 73-102 Nome Empresa
    headerArquivo += pad('BANCO', 30); // 103-132 Nome Banco
    headerArquivo += pad('', 10); // 133-142 Reservado
    headerArquivo += '1'; // 143 Código Remessa (1 = Remessa)
    headerArquivo += dateToday; // 144-151 Data Geração
    headerArquivo += '120000'; // 152-157 Hora Geração
    headerArquivo += seqFile; // 158-163 NSA
    headerArquivo += '084'; // 164-166 Layout 084
    headerArquivo += '01600'; // 167-171 Densidade
    headerArquivo += pad('', 69); // 172-240 Reservado
    lines.push(pad(headerArquivo, 240));

    // 2. Header de Lote (Registro 1 - Serviço 30 Pagamento Salários)
    let headerLote = bankCode; // 1-3
    headerLote += '0001'; // 4-7 Lote 1
    headerLote += '1'; // 8 Tipo Registro (1 = Header de Lote)
    headerLote += 'C'; // 9 Tipo Operação (C = Crédito)
    headerLote += '30'; // 10-11 Tipo Serviço (30 = Pagamento Salários)
    headerLote += '01'; // 12-13 Forma Lançamento (01 = Crédito em Conta Corrente/Salário)
    headerLote += '043'; // 14-16 Layout Lote
    headerLote += ' '; // 17 Reservado
    headerLote += '2'; // 18 Inscrição Empresa
    headerLote += cnpj; // 19-32 CNPJ
    headerLote += pad('', 20); // 33-52 Convênio
    headerLote += agency + agencyDigit; // 53-58 Agência
    headerLote += account + accountDigit; // 59-71 Conta
    headerLote += ' '; // 72 DAC
    headerLote += companyName; // 73-102 Nome
    headerLote += pad('', 40); // 103-142 Mensagem
    headerLote += pad('', 38); // 143-180 Endereço
    headerLote += pad('', 60); // 181-240 Reservado
    lines.push(pad(headerLote, 240));

    // 3. Segmento A (Registro Detalhe 3 - Pagamento ao Empregado)
    let seqRecordInLot = 1;
    let sumTotalAmount = 0;

    for (const emp of input.employees) {
      const empBank = pad(cleanNum(emp.bankCode) || bankCode, 3, '0');
      const empAgency = pad(cleanNum(emp.agency), 5, '0');
      const empAgencyDigit = pad(emp.agencyDigit || ' ', 1);
      const empAccount = pad(cleanNum(emp.accountNumber), 12, '0');
      const empAccountDigit = pad(emp.accountDigit || ' ', 1);
      const empName = pad(emp.name.toUpperCase(), 30);
      const amountCents = Math.round(emp.netAmount * 100);
      sumTotalAmount += emp.netAmount;
      const formattedAmount = pad(amountCents, 15, '0');
      const payDate = emp.paymentDate.replace(/\D/g, '') || dateToday;

      let segA = bankCode; // 1-3
      segA += '0001'; // 4-7 Lote 1
      segA += '3'; // 8 Detalhe
      segA += pad(seqRecordInLot++, 5, '0'); // 9-13 Nº Sequencial no Lote
      segA += 'A'; // 14 Segmento A
      segA += '000'; // 15-17 Tipo Movimento (000 = Inclusão)
      segA += '000'; // 18-20 Código Câmara
      segA += empBank; // 21-23 Banco Favorecido
      segA += empAgency + empAgencyDigit; // 24-29 Agência Favorecida
      segA += empAccount + empAccountDigit; // 30-42 Conta Favorecida
      segA += ' '; // 43 DAC
      segA += empName; // 44-73 Nome Favorecido
      segA += pad(cleanNum(emp.contractId).substring(0, 20), 20); // 74-93 Nº Documento / Matrícula
      segA += payDate; // 94-101 Data Pagamento
      segA += 'BRL'; // 102-104 Moeda
      segA += pad(0, 15, '0'); // 105-119 Qtd Moeda
      segA += formattedAmount; // 120-134 Valor Pagamento
      segA += pad('', 20); // 135-154 Nosso Número
      segA += payDate; // 155-162 Data Real
      segA += formattedAmount; // 163-177 Valor Real
      segA += pad('', 63); // 178-240 Informações Complementares
      lines.push(pad(segA, 240));
    }

    // 4. Trailer de Lote (Registro 5)
    const totalLinesInLot = seqRecordInLot + 1; // Segmentos + HeaderLote + TrailerLote
    const sumCentsLot = Math.round(sumTotalAmount * 100);

    let trailerLote = bankCode; // 1-3
    trailerLote += '0001'; // 4-7 Lote 1
    trailerLote += '5'; // 8 Trailer de Lote
    trailerLote += pad('', 9); // 9-17 Reservado
    trailerLote += pad(totalLinesInLot, 6, '0'); // 18-23 Qtd Registros no Lote
    trailerLote += pad(sumCentsLot, 18, '0'); // 24-41 Somatória de Valores
    trailerLote += pad(0, 18, '0'); // 42-59 Qtd Moeda
    trailerLote += pad('', 181); // 60-240 Reservado
    lines.push(pad(trailerLote, 240));

    // 5. Trailer de Arquivo (Registro 9)
    const totalLinesFile = lines.length + 1;

    let trailerArquivo = bankCode; // 1-3
    trailerArquivo += '9999'; // 4-7 Lote 9999
    trailerArquivo += '9'; // 8 Trailer de Arquivo
    trailerArquivo += pad('', 9); // 9-17 Reservado
    trailerArquivo += '000001'; // 18-23 Qtd de Lotes
    trailerArquivo += pad(totalLinesFile, 6, '0'); // 24-29 Qtd Total de Registros
    trailerArquivo += pad(0, 6, '0'); // 30-35 Qtd Contas Conciliação
    trailerArquivo += pad('', 205); // 36-240 Reservado
    lines.push(pad(trailerArquivo, 240));

    return lines.join('\r\n') + '\r\n';
  }

  /**
   * 5. Informe de Rendimentos Anual (Comprovante Oficial da Receita Federal)
   */
  public generateAnnualIncomeReport(input: AnnualIncomeReportInput): AnnualIncomeReport {
    let totalRendimentosTributaveis = 0;
    let totalInss = 0;
    let totalIrrf = 0;
    let totalIsentos = 0;
    let decimoTerceiro = 0;
    let irrfDecimoTerceiro = 0;

    for (const rec of input.records) {
      if (rec.isThirteenth) {
        decimoTerceiro += Number(rec.taxableEarnings || 0);
        irrfDecimoTerceiro += Number(rec.irrfDeduction || 0);
      } else {
        totalRendimentosTributaveis += Number(rec.taxableEarnings || 0);
        totalInss += Number(rec.inssDeduction || 0);
        totalIrrf += Number(rec.irrfDeduction || 0);
        totalIsentos += Number(rec.exemptEarnings || 0);
      }
    }

    return {
      calendarYear: input.calendarYear,
      fontePagadora: {
        cnpj: input.companyCnpj,
        nome: input.companyName,
      },
      pessoaFisica: {
        cpf: input.employeeCpf,
        nome: input.employeeName,
      },
      quadro3: {
        totalRendimentosTributaveis: Math.round(totalRendimentosTributaveis * 100) / 100,
        contribuicaoPrevidenciariaOficial: Math.round(totalInss * 100) / 100,
        previdenciaPrivada: 0,
        pensaoAlimenticia: 0,
        impostoRetido: Math.round(totalIrrf * 100) / 100,
      },
      quadro4: {
        totalIsentos: Math.round(totalIsentos * 100) / 100,
      },
      quadro5: {
        decimoTerceiroSalario: Math.round(decimoTerceiro * 100) / 100,
        irrfDecimoTerceiro: Math.round(irrfDecimoTerceiro * 100) / 100,
      },
    };
  }

  /**
   * Métodos assíncronos de consulta ao banco de dados para a interface
   */
  public async fetchPeriodTaxGuides(periodId: string): Promise<TaxGuidesReport> {
    const { data: period, error: pErr } = await supabase
      .from('payroll_periods')
      .select('id, month, year, company_id')
      .eq('id', periodId)
      .single();

    if (pErr || !period) throw new Error('Período de folha não localizado.');

    // Consulta os holerites do período
    const { data: payslips, error: psErr } = await supabase
      .from('payslips')
      .select('base_inss, base_fgts, base_irrf, total_earnings, total_deductions, net_salary')
      .eq('period_id', periodId);

    if (psErr) throw new Error(`Falha ao buscar holerites: ${psErr.message}`);

    // Consulta os impostos da empresa já consolidados na tabela payroll_company_taxes
    const { data: taxes } = await supabase
      .from('payroll_company_taxes')
      .select('*')
      .eq('period_id', periodId)
      .maybeSingle();

    // Consulta rubricas de desconto de INSS e IRRF dos holerites
    const { data: items } = await supabase
      .from('payslip_items')
      .select(`
        amount,
        payroll_rubrics (code)
      `)
      .in('payslip_id', (payslips || []).map((p: any) => p.id));

    let inssEmpregados = 0;
    let irrfEmpregados = 0;

    (items || []).forEach((it: any) => {
      const code = it.payroll_rubrics?.code;
      if (code === '901') inssEmpregados += Number(it.amount || 0);
      if (code === '902') irrfEmpregados += Number(it.amount || 0);
    });

    const totalBaseInss = (payslips || []).reduce((acc: number, p: any) => acc + (Number(p.base_inss) || 0), 0);
    const totalBaseFgts = (payslips || []).reduce((acc: number, p: any) => acc + (Number(p.base_fgts) || 0), 0);
    const totalBaseIrrf = (payslips || []).reduce((acc: number, p: any) => acc + (Number(p.base_irrf) || 0), 0);

    return this.calculateTaxGuides({
      competenceMonth: period.month,
      competenceYear: period.year,
      totalBaseInss,
      totalInssEmployee: inssEmpregados,
      totalBaseFgts,
      totalBaseIrrf,
      totalIrrfEmployee: irrfEmpregados,
      inssPatronalAliquot: taxes?.inss_patronal ? (taxes.inss_patronal / (totalBaseInss || 1)) : 0.20,
    });
  }

  public async fetchPeriodProvisions(periodId: string): Promise<PayrollProvisionsReport> {
    const { data: payslips, error } = await supabase
      .from('payslips')
      .select(`
        contract_id,
        employment_contracts (
          base_salary,
          workers (
            people (full_name)
          )
        )
      `)
      .eq('period_id', periodId);

    if (error) throw new Error(`Falha ao buscar provisões: ${error.message}`);

    const inputs: ProvisionCalculationInput[] = (payslips || []).map((p: any) => ({
      contractId: p.contract_id,
      employeeName: p.employment_contracts?.workers?.people?.full_name || 'Colaborador',
      baseSalary: Number(p.employment_contracts?.base_salary || 0),
      averageAdditionals: 0,
      inssPatronalAliquot: 0.20,
      ratAliquot: 0.02,
      terceirosAliquot: 0.058,
      fgtsAliquot: 0.08,
    }));

    return this.calculatePayrollProvisions(inputs);
  }

  public async fetchPeriodAccounting(periodId: string): Promise<AccountingSummaryReport> {
    const { data: payslips, error } = await supabase
      .from('payslips')
      .select('id, total_earnings, total_deductions, net_salary, base_inss, base_fgts')
      .eq('period_id', periodId);

    if (error) throw new Error(`Falha ao buscar dados contábeis: ${error.message}`);

    let totalEarnings = 0;
    let totalDeductions = 0;
    let totalNetSalary = 0;
    let totalBaseInss = 0;
    let totalBaseFgts = 0;

    (payslips || []).forEach((p: any) => {
      totalEarnings += Number(p.total_earnings || 0);
      totalDeductions += Number(p.total_deductions || 0);
      totalNetSalary += Number(p.net_salary || 0);
      totalBaseInss += Number(p.base_inss || 0);
      totalBaseFgts += Number(p.base_fgts || 0);
    });

    // Encargos
    const inssPatronal = Math.round((totalBaseInss * 0.20) * 100) / 100;
    const ratAdjusted = Math.round((totalBaseInss * 0.02) * 100) / 100;
    const terceiros = Math.round((totalBaseInss * 0.058) * 100) / 100;
    const fgtsCompany = Math.round((totalBaseFgts * 0.08) * 100) / 100;

    // Busca INSS e IRRF dos funcionários
    const { data: items } = await supabase
      .from('payslip_items')
      .select('amount, payroll_rubrics(code)')
      .in('payslip_id', (payslips || []).map((p: any) => p.id));

    let inssFunc = 0;
    let irrfFunc = 0;

    (items || []).forEach((it: any) => {
      if (it.payroll_rubrics?.code === '901') inssFunc += Number(it.amount || 0);
      if (it.payroll_rubrics?.code === '902') irrfFunc += Number(it.amount || 0);
    });

    const otherDeductions = Math.max(0, Math.round((totalDeductions - inssFunc - irrfFunc) * 100) / 100);

    return this.generateAccountingSummary({
      totalEarnings,
      totalDeductions,
      totalNetSalary,
      totalInssEmployee: inssFunc,
      totalIrrfEmployee: irrfFunc,
      totalOtherDeductions: otherDeductions,
      inssPatronal,
      ratAdjusted,
      terceiros,
      fgtsCompany,
    });
  }

  public async fetchPeriodCnab(periodId: string): Promise<{
    cnabContent: string;
    totalEmployees: number;
    totalAmount: number;
  }> {
    const { data: payslips, error } = await supabase
      .from('payslips')
      .select(`
        contract_id,
        net_salary,
        employment_contracts (
          companies (
            corporate_name,
            cnpj
          ),
          workers (
            bank_code,
            agency,
            agency_digit,
            account_number,
            account_digit,
            account_type,
            people (
              full_name,
              cpf
            )
          )
        )
      `)
      .eq('period_id', periodId);

    if (error || !payslips) throw new Error('Falha ao obter dados bancários dos holerites.');

    const firstCompany = payslips[0]?.employment_contracts?.companies;
    const company: CnabCompanyInfo = {
      corporateName: firstCompany?.corporate_name || 'EMPRESA PADRAO',
      cnpj: firstCompany?.cnpj || '00000000000100',
      bankCode: '001',
      agency: '1234',
      agencyDigit: '5',
      accountNumber: '99999',
      accountDigit: '9',
    };

    const employees: CnabEmployeePayment[] = payslips.map((p: any) => {
      const worker = p.employment_contracts?.workers;
      const person = worker?.people;
      return {
        contractId: p.contract_id,
        name: person?.full_name || 'COLABORADOR',
        cpf: person?.cpf || '00000000000',
        bankCode: worker?.bank_code || '001',
        agency: worker?.agency || '1234',
        agencyDigit: worker?.agency_digit || '',
        accountNumber: worker?.account_number || '12345',
        accountDigit: worker?.account_digit || '',
        accountType: worker?.account_type || 'CORRENTE',
        netAmount: Number(p.net_salary || 0),
        paymentDate: new Date().toISOString().substring(0, 10),
      };
    });

    const cnabContent = this.generateCnab240({
      company,
      employees,
      sequentialFileNumber: 1,
    });

    const totalAmount = employees.reduce((acc, e) => acc + e.netAmount, 0);

    return {
      cnabContent,
      totalEmployees: employees.length,
      totalAmount,
    };
  }
}

export const payrollObligationsService = new PayrollObligationsService();
