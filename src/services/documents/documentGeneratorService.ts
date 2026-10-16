/**
 * documentGeneratorService.ts
 * 
 * Serviço de Geração de PDFs a partir de Snapshots Imutáveis com Cálculo de Hash H1
 * Suporta:
 * 1. Holerite / Demonstrativo de Pagamento (CLT / Folha Fechada)
 * 2. Aviso Prévio de Férias (Art. 135 CLT)
 * 3. Recibo de Pagamento de Férias (Art. 145 CLT / CF Art. 7º XVII)
 * 4. Espelho Mensal de Ponto (Art. 84 Portaria MTP 671/2021)
 * 5. Termo de Acordo Individual de Banco de Horas (Art. 59 §5º CLT)
 * 
 * Tarefa: AS-02 (Fase P6)
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { computeCanonicalHash, generateVerificationCode, maskCpfForManifest } from './documentSignatureModel';

export interface CompanySnapshot {
  id: string;
  corporateName: string;
  tradeName?: string;
  cnpj: string;
  address?: string;
}

export interface WorkerSnapshot {
  id: string;
  fullName: string;
  cpf: string;
  pis?: string;
  admissionDate: string;
  positionTitle: string;
  department?: string;
  baseSalary: number;
}

export interface PayslipItemSnapshot {
  code: string;
  name: string;
  reference?: string;
  type: 'EARNING' | 'DEDUCTION' | 'NEUTRAL';
  amount: number;
}

export interface PayslipSnapshot {
  payslipId: string;
  company: CompanySnapshot;
  worker: WorkerSnapshot;
  periodMonth: number;
  periodYear: number;
  periodType: string; // 'MONTHLY', 'VACATION', 'THIRTEENTH_1ST', 'THIRTEENTH_2ND', 'COMPLEMENTARY'
  calculationDate: string;
  items: PayslipItemSnapshot[];
  totalEarnings: number;
  totalDeductions: number;
  netSalary: number;
  baseInss: number;
  baseFgts: number;
  fgtsMonth: number;
  baseIrrf: number;
  irrfExemptBracket?: boolean;
}

export interface VacationNoticeSnapshot {
  vacationId: string;
  company: CompanySnapshot;
  worker: WorkerSnapshot;
  vestingPeriodStart: string; // Período aquisitivo início
  vestingPeriodEnd: string;   // Período aquisitivo fim
  concessivePeriodEnd: string;// Limite concessivo
  takeStartDate: string;      // Início do gozo
  takeEndDate: string;        // Fim do gozo
  daysCount: number;          // Dias de férias
  cashAllowanceDays?: number; // Abono pecuniário (venda)
  noticeDate: string;         // Data do aviso
  returnToWorkDate: string;   // Retorno ao trabalho
}

export interface VacationReceiptSnapshot {
  receiptId: string;
  company: CompanySnapshot;
  worker: WorkerSnapshot;
  takeStartDate: string;
  takeEndDate: string;
  daysCount: number;
  cashAllowanceDays?: number;
  items: PayslipItemSnapshot[];
  totalGross: number;
  totalDeductions: number;
  netAmount: number;
  paymentDueDate: string;     // Até 2 dias antes do início (Art. 145 CLT)
  paymentDate?: string;
  vestingPeriodStart?: string;
  vestingPeriodEnd?: string;
  concessivePeriodEnd?: string;
  concessiveStatusLabel?: string;
  netAmountExtenso?: string;
}

export interface TimesheetSnapshot {
  timesheetId: string;
  company: CompanySnapshot;
  worker: WorkerSnapshot;
  periodMonth: number;
  periodYear: number;
  workScheduleName?: string;
  days: Array<{
    date: string;
    dayOfWeek: string;
    scheduleHours?: string;
    punches: string[];
    workedHours: string;
    overtime50?: string;
    overtime100?: string;
    nightHours?: string;
    lateMinutes?: number;
    occurrences?: string;
  }>;
  totalWorkedHours: string;
  totalOvertime50: string;
  totalOvertime100: string;
  totalNightHours: string;
  totalLateMinutes: number;
  timeBankStartingBalance?: string;
  timeBankPeriodBalance?: string;
  timeBankEndingBalance?: string;
}

export interface TimeBankAgreementSnapshot {
  agreementId: string;
  company: CompanySnapshot;
  worker: WorkerSnapshot;
  validFrom: string;
  validTo: string; // Máximo 6 meses para acordo individual escrito (Art. 59 §5º CLT)
  maxDailyOvertimeHours: number; // Max 2 horas (Art. 59 caput)
  monthlyHourCap?: number;
  termsVersion: string;
  agreementDate: string;
}

export interface GeneratedDocumentResult {
  pdfBytes: Uint8Array;
  hashH1: string;
  verificationCode: string;
  metadata: Record<string, any>;
}

export class DocumentGeneratorService {
  /**
   * 1. Gera PDF do Holerite a partir de snapshot imutável
   */
  public static async generatePayslipPdf(snapshot: PayslipSnapshot): Promise<GeneratedDocumentResult> {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const verificationCode = generateVerificationCode();

    // Cabeçalho da Empresa
    doc.setFillColor(248, 250, 252);
    doc.rect(10, 10, 190, 25, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(10, 10, 190, 25, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text(snapshot.company.corporateName.toUpperCase(), 14, 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`CNPJ: ${snapshot.company.cnpj} ${snapshot.company.address ? '· ' + snapshot.company.address : ''}`, 14, 24);
    doc.text(`Demonstrativo de Pagamento de Salário · Competência: ${String(snapshot.periodMonth).padStart(2, '0')}/${snapshot.periodYear}`, 14, 30);

    // Dados do Trabalhador
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(10, 38, 190, 22, 'S');

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text('Nome do Colaborador:', 14, 44);
    doc.text('Cargo:', 14, 50);
    doc.text('Salário Base:', 14, 56);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(snapshot.worker.fullName, 52, 44);
    doc.text(snapshot.worker.positionTitle || 'Não informado', 52, 50);
    doc.text(`R$ ${snapshot.worker.baseSalary.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 52, 56);

    doc.setFont('helvetica', 'bold');
    doc.text('CPF:', 120, 44);
    doc.text('Admissão:', 120, 50);
    doc.text('Código Doc:', 120, 56);

    doc.setFont('helvetica', 'normal');
    doc.text(maskCpfForManifest(snapshot.worker.cpf), 142, 44);
    doc.text(snapshot.worker.admissionDate || '—', 142, 50);
    doc.setFont('courier', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text(verificationCode, 142, 56);

    // Tabela de Rubricas / Eventos
    const earnings = snapshot.items.filter(i => i.type === 'EARNING');
    const deductions = snapshot.items.filter(i => i.type === 'DEDUCTION');

    const tableRows = snapshot.items.map(item => [
      item.code,
      item.name,
      item.reference || '—',
      item.type === 'EARNING' ? item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
      item.type === 'DEDUCTION' ? item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''
    ]);

    autoTable(doc, {
      startY: 64,
      head: [['Cód.', 'Descrição da Rubrica', 'Ref.', 'Vencimentos (R$)', 'Descontos (R$)']],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [30, 41, 59],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'left'
      },
      columnStyles: {
        0: { cellWidth: 16, halign: 'center' },
        1: { cellWidth: 90 },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 32, halign: 'right' },
        4: { cellWidth: 32, halign: 'right' }
      },
      styles: { fontSize: 8, cellPadding: 2, textColor: [30, 41, 59] },
      margin: { left: 10, right: 10 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 4;

    // Resumo de Totais
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.rect(10, finalY, 190, 18, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Total Vencimentos:', 14, finalY + 6);
    doc.text('Total Descontos:', 75, finalY + 6);
    doc.text('VALOR LÍQUIDO A RECEBER:', 130, finalY + 6);

    doc.setFontSize(10);
    doc.setTextColor(22, 101, 52); // green
    doc.text(`R$ ${snapshot.totalEarnings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14, finalY + 13);
    doc.setTextColor(185, 28, 28); // red
    doc.text(`R$ ${snapshot.totalDeductions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 75, finalY + 13);
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(`R$ ${snapshot.netSalary.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 130, finalY + 13);

    // Bases de Cálculo
    const basesY = finalY + 22;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Sal. Base: R$ ${snapshot.worker.baseSalary.toFixed(2)}  |  Base INSS: R$ ${snapshot.baseInss.toFixed(2)}  |  Base FGTS: R$ ${snapshot.baseFgts.toFixed(2)}  |  FGTS do Mês: R$ ${snapshot.fgtsMonth.toFixed(2)}  |  Base IRRF: R$ ${snapshot.baseIrrf.toFixed(2)}`, 14, basesY);

    // Rodapé de Integridade H1
    doc.setDrawColor(203, 213, 225);
    doc.line(10, 275, 200, 275);
    doc.setFontSize(7);
    doc.setFont('courier', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(`CoupleRH · Snapshot Imutável de Folha Fechada · Verificação: ${verificationCode}`, 10, 280);

    const pdfBytes = new Uint8Array(doc.output('arraybuffer'));
    const hashH1 = await computeCanonicalHash(pdfBytes);

    return {
      pdfBytes,
      hashH1,
      verificationCode,
      metadata: {
        docType: 'PAYSLIP',
        payslipId: snapshot.payslipId,
        period: `${snapshot.periodMonth}/${snapshot.periodYear}`,
        workerId: snapshot.worker.id,
        netSalary: snapshot.netSalary
      }
    };
  }

  /**
   * 2. Gera PDF do Aviso Prévio de Férias (Art. 135 CLT)
   */
  public static async generateVacationNoticePdf(snapshot: VacationNoticeSnapshot): Promise<GeneratedDocumentResult> {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const verificationCode = generateVerificationCode();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(30, 41, 59);
    doc.text('AVISO PRÉVIO DE FÉRIAS', 105, 25, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('(Artigo 135 da Consolidação das Leis do Trabalho - CLT)', 105, 31, { align: 'center' });

    doc.setDrawColor(226, 232, 240);
    doc.line(20, 36, 190, 36);

    const bodyText = [
      `Empregador: ${snapshot.company.corporateName.toUpperCase()}, CNPJ nº ${snapshot.company.cnpj}.`,
      `Empregado: ${snapshot.worker.fullName}, CPF nº ${maskCpfForManifest(snapshot.worker.cpf)}, Cargo: ${snapshot.worker.positionTitle || 'Geral'}.`,
      '',
      `Vimos por meio deste comunicar-lhe que, nos termos da legislação trabalhista vigente, ser-lhe-ão concedidas férias relativas ao Período Aquisitivo de ${snapshot.vestingPeriodStart} a ${snapshot.vestingPeriodEnd}.`,
      '',
      `O período de fruição (gozo) terá início em ${snapshot.takeStartDate} e término em ${snapshot.takeEndDate}, perfazendo o total de ${snapshot.daysCount} dias de descanso remunerado.`,
      snapshot.cashAllowanceDays ? `Houve solicitação de conversão de ${snapshot.cashAllowanceDays} dias de férias em abono pecuniário (Art. 143 CLT).` : 'Não houve conversão em abono pecuniário.',
      `Deverá retornar às suas atividades regulares no dia ${snapshot.returnToWorkDate}.`,
      '',
      `O pagamento da remuneração das férias e, se for o caso, do abono pecuniário, será efetuado em até 2 (dois) dias antes do início do respectivo período, nos termos do Art. 145 da CLT.`,
      '',
      `Data da Comunicação do Aviso: ${snapshot.noticeDate}.`
    ];

    let currentY = 48;
    doc.setFontSize(10.5);
    doc.setTextColor(30, 41, 59);
    for (const paragraph of bodyText) {
      if (paragraph === '') {
        currentY += 4;
        continue;
      }
      const lines = doc.splitTextToSize(paragraph, 170);
      doc.text(lines, 20, currentY);
      currentY += (lines.length * 5.5) + 2;
    }

    // Caixa de Ciência
    currentY += 10;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.rect(20, currentY, 170, 32, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text('TERMO DE CIÊNCIA E ASSINATURA ELETRÔNICA', 25, currentY + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Declaro ter recebido a presente notificação com a antecedência mínima legal de 30 dias.', 25, currentY + 15);
    doc.text(`Código de Verificação de Integridade: ${verificationCode}`, 25, currentY + 22);

    const pdfBytes = new Uint8Array(doc.output('arraybuffer'));
    const hashH1 = await computeCanonicalHash(pdfBytes);

    return {
      pdfBytes,
      hashH1,
      verificationCode,
      metadata: {
        docType: 'VACATION_NOTICE',
        vacationId: snapshot.vacationId,
        takeStartDate: snapshot.takeStartDate,
        workerId: snapshot.worker.id
      }
    };
  }

  /**
   * 3. Gera PDF do Recibo de Pagamento de Férias (Art. 145 CLT)
   */
  public static async generateVacationReceiptPdf(snapshot: VacationReceiptSnapshot): Promise<GeneratedDocumentResult> {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const verificationCode = generateVerificationCode();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text('RECIBO DE PAGAMENTO DE FÉRIAS E 1/3 CONSTITUCIONAL', 105, 20, { align: 'center' });

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('(Art. 145 da CLT e Art. 7º, Inciso XVII da Constituição Federal)', 105, 26, { align: 'center' });

    // Empregador, Empregado e Prazos Legais CLT
    doc.setFillColor(248, 250, 252);
    doc.rect(14, 30, 182, 32, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`Empresa: ${snapshot.company.corporateName} (CNPJ: ${snapshot.company.cnpj})`, 18, 36);
    doc.text(`Colaborador: ${snapshot.worker.fullName} (CPF: ${maskCpfForManifest(snapshot.worker.cpf)})`, 18, 42);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const paText = snapshot.vestingPeriodStart && snapshot.vestingPeriodEnd
      ? `${snapshot.vestingPeriodStart} a ${snapshot.vestingPeriodEnd}`
      : 'Conforme Livro de Registro';
    const concText = snapshot.concessivePeriodEnd
      ? `${snapshot.concessivePeriodEnd} ${snapshot.concessiveStatusLabel ? '(' + snapshot.concessiveStatusLabel + ')' : ''}`
      : 'Art. 134 CLT';

    doc.text(`Período Aquisitivo: ${paText}  ·  Limite Concessivo: ${concText}`, 18, 48);
    doc.text(`Período de Gozo: ${snapshot.takeStartDate} a ${snapshot.takeEndDate} (${snapshot.daysCount} dias)  ·  Data Limite Pgto: ${snapshot.paymentDueDate} (Art. 145 CLT)`, 18, 54);

    const tableRows = snapshot.items.map(item => [
      item.code,
      item.name,
      item.reference || '—',
      item.type === 'EARNING' ? item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
      item.type === 'DEDUCTION' ? item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''
    ]);

    // Linha de totais na tabela
    tableRows.push([
      '—',
      'TOTAL CONSOLIDADO',
      '—',
      snapshot.totalGross.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
      snapshot.totalDeductions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    ]);

    autoTable(doc, {
      startY: 65,
      head: [['Cód.', 'Verba de Férias', 'Ref.', 'Proventos (R$)', 'Descontos (R$)']],
      body: tableRows,
      theme: 'grid',
      headStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontSize: 8.5 },
      styles: { fontSize: 8 },
      footStyles: { fillColor: [248, 250, 252], textColor: [30, 41, 59], fontStyle: 'bold' }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 4;

    // Bloco de Líquido e Quitação por Extenso
    doc.setFillColor(248, 250, 252);
    doc.rect(14, finalY, 182, 34, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`VALOR LÍQUIDO A RECEBER: R$ ${snapshot.netAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 18, finalY + 8);
    
    doc.setFontSize(8);
    doc.setFont('courier', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text(`Autenticação: ${verificationCode}`, 135, finalY + 8);

    if (snapshot.netAmountExtenso) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(`Valor por extenso: (${snapshot.netAmountExtenso})`, 18, finalY + 14, { maxWidth: 174 });
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    const declaracaoQuitacao = 'Recebi da empresa empregadora supra qualificada a importância líquida discriminada neste recibo, referente à remuneração das minhas férias regulamentares com o acréscimo de um terço constitucional (Art. 7º, XVII da CF/88), para os devidos fins de direito.';
    doc.text(declaracaoQuitacao, 18, finalY + 22, { maxWidth: 174 });

    const pdfBytes = new Uint8Array(doc.output('arraybuffer'));
    const hashH1 = await computeCanonicalHash(pdfBytes);

    return {
      pdfBytes,
      hashH1,
      verificationCode,
      metadata: {
        docType: 'VACATION_RECEIPT',
        receiptId: snapshot.receiptId,
        netAmount: snapshot.netAmount,
        workerId: snapshot.worker.id
      }
    };
  }

  /**
   * 4. Gera PDF do Termo de Acordo Individual de Banco de Horas (Art. 59 §5º CLT)
   */
  public static async generateTimeBankAgreementPdf(snapshot: TimeBankAgreementSnapshot): Promise<GeneratedDocumentResult> {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const verificationCode = generateVerificationCode();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text('ACORDO INDIVIDUAL ESCRITO PARA COMPENSAÇÃO DE JORNADA', 105, 22, { align: 'center' });
    doc.setFontSize(11);
    doc.text('SISTEMA DE BANCO DE HORAS (ART. 59, §5º DA CLT)', 105, 29, { align: 'center' });

    doc.setDrawColor(203, 213, 225);
    doc.line(20, 34, 190, 34);

    const clauses = [
      `EMPREGADOR: ${snapshot.company.corporateName.toUpperCase()}, inscrito no CNPJ sob o nº ${snapshot.company.cnpj}.`,
      `EMPREGADO: ${snapshot.worker.fullName}, inscrito no CPF sob o nº ${maskCpfForManifest(snapshot.worker.cpf)}, Cargo: ${snapshot.worker.positionTitle || 'Geral'}.`,
      '',
      'As partes acima qualificadas resolvem celebrar o presente ACORDO INDIVIDUAL ESCRITO DE BANCO DE HORAS, nos termos do Art. 59, §5º da Consolidação das Leis do Trabalho (CLT), mediante as seguintes cláusulas:',
      '',
      `CLÁUSULA PRIMEIRA - DA VIGÊNCIA E COMPENSAÇÃO: O presente acordo terá vigência de ${snapshot.validFrom} até ${snapshot.validTo}, respeitando o prazo máximo legal de 6 (seis) meses para compensação individual.`,
      `CLÁUSULA SEGUNDA - DO LIMITE DIÁRIO: A jornada extraordinária não excederá 2 (duas) horas diárias, nos termos do caput do Art. 59 da CLT.`,
      'CLÁUSULA TERCEIRA - DO CONTROLE E EXTRATO: O empregador disponibilizará acesso contínuo ao saldo e extrato do banco de horas por meio do Portal do Colaborador.',
      'CLÁUSULA QUARTA - DA RESCISÃO OU VENCIMENTO: Em caso de rescisão contratual ou se decorrido o prazo máximo de vigência sem a devida compensação, as horas excedentes não compensadas serão pagas como horas extras calculadas sobre o valor da remuneração da época do pagamento, com o adicional legal ou convencional correspondente (Art. 59, §3º CLT).',
      '',
      `Data de Celebração: ${snapshot.agreementDate}. Versão dos Termos: ${snapshot.termsVersion}.`
    ];

    let currentY = 44;
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    for (const paragraph of clauses) {
      if (paragraph === '') {
        currentY += 3;
        continue;
      }
      const lines = doc.splitTextToSize(paragraph, 170);
      doc.text(lines, 20, currentY);
      currentY += (lines.length * 4.8) + 1.5;
    }

    currentY += 8;
    doc.setFillColor(248, 250, 252);
    doc.rect(20, currentY, 170, 25, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text('AUTORIZAÇÃO E MANIFESTAÇÃO DE VONTADE', 25, currentY + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Declaro que li, compreendi e concordo integralmente com as condições estipuladas neste acordo.', 25, currentY + 14);
    doc.text(`Identificador de Verificação Digital: ${verificationCode}`, 25, currentY + 20);

    const pdfBytes = new Uint8Array(doc.output('arraybuffer'));
    const hashH1 = await computeCanonicalHash(pdfBytes);

    return {
      pdfBytes,
      hashH1,
      verificationCode,
      metadata: {
        docType: 'TIME_BANK_AGREEMENT',
        agreementId: snapshot.agreementId,
        validFrom: snapshot.validFrom,
        validTo: snapshot.validTo,
        workerId: snapshot.worker.id
      }
    };
  }
}
