import { describe, it, expect } from 'vitest';
import { VacationReceiptService } from '../../services/vacations/vacationReceiptService';
import { DocumentGeneratorService, type VacationReceiptSnapshot } from '../../services/documents/documentGeneratorService';
import { DocumentSigningService, type SignDocumentParams } from '../../services/documents/documentSigningService';

describe('TB-06: Recibo de Férias Completo com Vencimentos, Períodos e Prazos CLT no Portal', () => {
  const mockCompany = {
    id: 'comp-10',
    corporateName: 'TechSolutions Engenharia Ltda',
    tradeName: 'TechSolutions',
    cnpj: '12.345.678/0001-90',
    address: 'Av. Paulista, 1000 - São Paulo/SP'
  };

  const mockWorker = {
    id: 'work-10',
    fullName: 'Mariana Silveira Rodrigues',
    cpf: '12345678909',
    admissionDate: '01/02/2024',
    positionTitle: 'Desenvolvedora Sênior',
    department: 'Engenharia de Software',
    baseSalary: 6000.00
  };

  it('Critério 1: Exibição formal do Período Aquisitivo e Limite do Período Concessivo (CLT art. 134 — controle de dobra)', () => {
    // Cenário Regular: Gozo dentro do período concessivo
    const regularCompliance = VacationReceiptService.evaluateConcessiveCompliance(
      '2026-08-10',
      '2026-10-31'
    );
    expect(regularCompliance.isDoubled).toBe(false);
    expect(regularCompliance.status).toBe('REGULAR');
    expect(regularCompliance.statusLabel).toBe('Dentro do Prazo Legal');

    // Cenário Dobra: Gozo iniciado após o limite concessivo (Art. 137 da CLT)
    const doubleCompliance = VacationReceiptService.evaluateConcessiveCompliance(
      '2026-11-05',
      '2026-10-31'
    );
    expect(doubleCompliance.isDoubled).toBe(true);
    expect(doubleCompliance.status).toBe('DOUBLE_PAY');
    expect(doubleCompliance.statusLabel).toBe('Férias em Dobro (Art. 137 CLT)');
  });

  it('Critério 2: Data Limite Legal de Pagamento (CLT art. 145 — até 2 dias antes do início do gozo)', () => {
    // Início na sexta-feira 14/08/2026 -> 2 dias antes é quarta-feira 12/08/2026
    const paymentRegular = VacationReceiptService.calculatePaymentDueDate('2026-08-14');
    expect(paymentRegular.dueDateFormatted).toBe('12/08/2026');
    expect(paymentRegular.wasAdjustedForWeekend).toBe(false);

    // Início na segunda-feira 17/08/2026 -> 2 dias antes é sábado 15/08/2026 -> antecipa para sexta-feira 14/08/2026
    const paymentWeekend = VacationReceiptService.calculatePaymentDueDate('2026-08-17');
    expect(paymentWeekend.dueDateFormatted).toBe('14/08/2026');
    expect(paymentWeekend.wasAdjustedForWeekend).toBe(true);
    expect(paymentWeekend.legalNotice).toContain('Art. 145');
  });

  it('Critério 3: Demonstrativo contábil discriminando: 501, 502, 503, 504, médias habituais e Líquido por extenso', () => {
    const accounting = VacationReceiptService.calculateVacationAccounting({
      baseSalary: 6000.00,
      daysTaken: 20,
      cashAllowanceDays: 10,
      startDate: '2026-09-01',
      averageHabitualAdditions: 600.00, // Médias HE e Adicional Noturno Súmula 264 / CLT 142 § 5º
      inssAmount: 750.00,
      irrfAmount: 620.00
    });

    // Remuneração base efetiva = 6600
    // 501 Férias Normais (20 dias): (6600 / 30) * 20 = 4400.00
    // 502 1/3 Férias: 4400 / 3 = 1466.67
    // 503 Abono (10 dias): (6600 / 30) * 10 = 2200.00
    // 504 1/3 Abono: 2200 / 3 = 733.33
    // Total Proventos: 4400 + 1466.67 + 2200 + 733.33 = 8800.00
    expect(accounting.earningsTotal).toBe(8800.00);

    const rubric501 = accounting.items.find(i => i.code === '501');
    const rubric502 = accounting.items.find(i => i.code === '502');
    const rubric503 = accounting.items.find(i => i.code === '503');
    const rubric504 = accounting.items.find(i => i.code === '504');

    expect(rubric501?.amount).toBe(4400.00);
    expect(rubric502?.amount).toBe(1466.67);
    expect(rubric503?.amount).toBe(2200.00);
    expect(rubric504?.amount).toBe(733.33);

    // Descontos: 750 (INSS) + 620 (IRRF) = 1370.00
    expect(accounting.deductionsTotal).toBe(1370.00);

    // Líquido: 8800 - 1370 = 7430.00
    expect(accounting.netSalary).toBe(7430.00);

    // Valor por Extenso
    expect(accounting.netAmountExtenso).toBe('Sete mil, quatrocentos e trinta reais');
  });

  it('Critério 4: Geração de PDF oficial timbrado com QR Code e chancela de Assinatura Eletrônica Avançada pelo colaborador no celular', async () => {
    const accounting = VacationReceiptService.calculateVacationAccounting({
      baseSalary: mockWorker.baseSalary,
      daysTaken: 30,
      cashAllowanceDays: 0,
      startDate: '2026-10-01',
      inssAmount: 680.00,
      irrfAmount: 510.00
    });

    const paymentDue = VacationReceiptService.calculatePaymentDueDate('2026-10-01');
    const concessive = VacationReceiptService.evaluateConcessiveCompliance('2026-10-01', '2026-12-31');

    const snapshot: VacationReceiptSnapshot = {
      receiptId: 'vac-rec-tb06-01',
      company: mockCompany,
      worker: mockWorker,
      takeStartDate: '01/10/2026',
      takeEndDate: '30/10/2026',
      daysCount: 30,
      cashAllowanceDays: 0,
      vestingPeriodStart: '01/02/2024',
      vestingPeriodEnd: '31/01/2025',
      concessivePeriodEnd: '31/01/2026',
      concessiveStatusLabel: concessive.statusLabel,
      paymentDueDate: paymentDue.dueDateFormatted,
      items: accounting.items,
      totalGross: accounting.earningsTotal,
      totalDeductions: accounting.deductionsTotal,
      netAmount: accounting.netSalary,
      netAmountExtenso: accounting.netAmountExtenso
    };

    // 1. Gera PDF timbrado no servidor com código de verificação e Hash H1
    const generated = await DocumentGeneratorService.generateVacationReceiptPdf(snapshot);

    expect(generated.pdfBytes.length).toBeGreaterThan(1000);
    expect(generated.hashH1).toHaveLength(64);
    expect(generated.verificationCode).toMatch(/^CRH-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(generated.metadata.docType).toBe('VACATION_RECEIPT');

    // 2. Simula assinatura eletrônica avançada com rubrica desenhada em tela de celular (AS-04/AS-05)
    // 1x1 transparent PNG base64
    const mockSignaturePng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const signParams: SignDocumentParams = {
      originalPdfBytes: generated.pdfBytes,
      expectedHashH1: generated.hashH1,
      signaturePngBase64: mockSignaturePng,
      signer: {
        name: mockWorker.fullName,
        cpf: mockWorker.cpf,
        role: mockWorker.positionTitle,
        companyName: mockCompany.corporateName,
        companyCnpj: mockCompany.cnpj
      },
      audit: {
        ip: '177.18.29.40',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        signedAt: new Date('2026-09-29T14:30:00Z'),
        authMethod: 'SESSION_OTP'
      },
      verificationCode: generated.verificationCode,
      documentTitle: 'Recibo de Pagamento de Férias e 1/3 Constitucional'
    };

    const signedOutput = await DocumentSigningService.stampSignatureAndManifest(signParams);

    expect(signedOutput.signedPdfBytes.length).toBeGreaterThan(generated.pdfBytes.length);
    expect(signedOutput.hashH1).toBe(generated.hashH1);
    expect(signedOutput.hashH2).toHaveLength(64);
    expect(signedOutput.hashH2).not.toBe(signedOutput.hashH1);
    expect(signedOutput.manifestData.verificationUrl).toContain(generated.verificationCode);
  });
});
