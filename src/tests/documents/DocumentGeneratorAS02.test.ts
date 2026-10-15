import { describe, it, expect } from 'vitest';
import {
  DocumentGeneratorService,
  type PayslipSnapshot,
  type VacationNoticeSnapshot,
  type VacationReceiptSnapshot,
  type TimeBankAgreementSnapshot
} from '../../services/documents/documentGeneratorService';
import { validateVerificationCode } from '../../services/documents/documentSignatureModel';

describe('AS-02: Geração de PDF a partir de Snapshots Imutáveis com Hash H1', () => {
  const mockCompany = {
    id: 'comp-1',
    corporateName: 'CoupleRH Tecnologia S/A',
    cnpj: '12.345.678/0001-90',
    address: 'Av. Paulista, 1000 - São Paulo, SP'
  };

  const mockWorker = {
    id: 'work-1',
    fullName: 'Maria Silva Oliveira',
    cpf: '123.456.789-00',
    pis: '123.45678.90-1',
    admissionDate: '01/02/2023',
    positionTitle: 'Engenheira de Software',
    baseSalary: 12500.00
  };

  it('deve gerar PDF de Holerite com H1 e código de verificação válidos', async () => {
    const snapshot: PayslipSnapshot = {
      payslipId: 'payslip-101',
      company: mockCompany,
      worker: mockWorker,
      periodMonth: 10,
      periodYear: 2026,
      periodType: 'MONTHLY',
      calculationDate: '2026-10-14',
      items: [
        { code: '101', name: 'Salário Base', type: 'EARNING', amount: 12500.00 },
        { code: '150', name: 'Horas Extras 50%', reference: '10:00', type: 'EARNING', amount: 1136.36 },
        { code: '901', name: 'INSS Folha', reference: '14.00%', type: 'DEDUCTION', amount: 951.62 },
        { code: '902', name: 'IRRF s/ Salário', reference: '27.50%', type: 'DEDUCTION', amount: 2450.15 }
      ],
      totalEarnings: 13636.36,
      totalDeductions: 3401.77,
      netSalary: 10234.59,
      baseInss: 8475.55,
      baseFgts: 13636.36,
      fgtsMonth: 1090.90,
      baseIrrf: 12684.74
    };

    const result = await DocumentGeneratorService.generatePayslipPdf(snapshot);

    expect(result.pdfBytes).toBeInstanceOf(Uint8Array);
    expect(result.pdfBytes.length).toBeGreaterThan(1000);
    expect(result.hashH1).toHaveLength(64);
    expect(result.hashH1).toMatch(/^[a-f0-9]{64}$/);
    expect(validateVerificationCode(result.verificationCode)).toBe(true);
    expect(result.metadata.docType).toBe('PAYSLIP');
    expect(result.metadata.netSalary).toBe(10234.59);
  });

  it('deve gerar PDF de Aviso Prévio de Férias (Art. 135 CLT)', async () => {
    const snapshot: VacationNoticeSnapshot = {
      vacationId: 'vac-1',
      company: mockCompany,
      worker: mockWorker,
      vestingPeriodStart: '01/02/2025',
      vestingPeriodEnd: '31/01/2026',
      concessivePeriodEnd: '31/12/2026',
      takeStartDate: '01/11/2026',
      takeEndDate: '30/11/2026',
      daysCount: 30,
      noticeDate: '01/10/2026',
      returnToWorkDate: '01/12/2026'
    };

    const result = await DocumentGeneratorService.generateVacationNoticePdf(snapshot);

    expect(result.pdfBytes.length).toBeGreaterThan(1000);
    expect(result.hashH1).toHaveLength(64);
    expect(result.metadata.docType).toBe('VACATION_NOTICE');
    expect(result.metadata.takeStartDate).toBe('01/11/2026');
  });

  it('deve gerar PDF de Recibo de Pagamento de Férias (Art. 145 CLT)', async () => {
    const snapshot: VacationReceiptSnapshot = {
      receiptId: 'rec-1',
      company: mockCompany,
      worker: mockWorker,
      takeStartDate: '01/11/2026',
      takeEndDate: '30/11/2026',
      daysCount: 30,
      items: [
        { code: '501', name: 'Férias Gozadas (30d)', type: 'EARNING', amount: 12500.00 },
        { code: '502', name: '1/3 Constitucional de Férias', type: 'EARNING', amount: 4166.67 },
        { code: '901', name: 'INSS Férias', type: 'DEDUCTION', amount: 951.62 },
        { code: '902', name: 'IRRF Férias', type: 'DEDUCTION', amount: 3345.20 }
      ],
      totalGross: 16666.67,
      totalDeductions: 4296.82,
      netAmount: 12369.85,
      paymentDueDate: '29/10/2026'
    };

    const result = await DocumentGeneratorService.generateVacationReceiptPdf(snapshot);

    expect(result.pdfBytes.length).toBeGreaterThan(1000);
    expect(result.hashH1).toHaveLength(64);
    expect(result.metadata.docType).toBe('VACATION_RECEIPT');
    expect(result.metadata.netAmount).toBe(12369.85);
  });

  it('deve gerar PDF de Termo de Acordo Individual de Banco de Horas (Art. 59 §5º CLT)', async () => {
    const snapshot: TimeBankAgreementSnapshot = {
      agreementId: 'tb-agr-1',
      company: mockCompany,
      worker: mockWorker,
      validFrom: '01/11/2026',
      validTo: '30/04/2027', // 6 meses
      maxDailyOvertimeHours: 2,
      termsVersion: '1.0-2026',
      agreementDate: '25/10/2026'
    };

    const result = await DocumentGeneratorService.generateTimeBankAgreementPdf(snapshot);

    expect(result.pdfBytes.length).toBeGreaterThan(1000);
    expect(result.hashH1).toHaveLength(64);
    expect(result.metadata.docType).toBe('TIME_BANK_AGREEMENT');
    expect(result.metadata.validTo).toBe('30/04/2027');
  });
});
