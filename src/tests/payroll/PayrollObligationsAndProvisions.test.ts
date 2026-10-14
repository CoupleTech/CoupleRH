import { describe, it, expect } from 'vitest';
import {
  PayrollObligationsService,
  TaxGuideCalculationInput,
  ProvisionCalculationInput,
  CnabEmployeePayment,
  AnnualIncomeRecord,
} from '../../services/payroll/payrollObligationsService';

describe('PayrollObligationsService - Guias, Provisões, Contabilidade, CNAB e Informe de Rendimentos (Fase P7)', () => {
  const service = new PayrollObligationsService();

  describe('1. Apuração de Guias Tributárias (INSS / FGTS / IRRF)', () => {
    it('deve calcular corretamente a guia DCTFWeb (INSS Segurados + Patronal 20% + RAT 2% + Terceiros 5.8%)', () => {
      const input: TaxGuideCalculationInput = {
        competenceMonth: 10,
        competenceYear: 2026,
        totalBaseInss: 100000.0,
        totalInssEmployee: 11000.0,
        totalBaseFgts: 100000.0,
        totalBaseIrrf: 89000.0,
        totalIrrfEmployee: 8500.0,
        taxRegime: 'LUCRO_PRESUMIDO', // regime com encargos integrais
        ratAliquot: 0.02,
        fapMultiplier: 1.0,
        terceirosAliquot: 0.058,
        inssPatronalAliquot: 0.20,
      };

      const guides = service.calculateTaxGuides(input);

      // INSS Patronal: 20% de 100.000 = 20.000
      // RAT Ajustado: 2% * 1.0 de 100.000 = 2.000
      // Terceiros: 5.8% de 100.000 = 5.800
      // INSS Segurados: 11.000
      // Total DCTFWeb: 11.000 + 20.000 + 2.000 + 5.800 = 38.800
      expect(guides.dctfWebInss.totalInssSegurados).toBe(11000.0);
      expect(guides.dctfWebInss.inssPatronal).toBe(20000.0);
      expect(guides.dctfWebInss.ratAdjusted).toBe(2000.0);
      expect(guides.dctfWebInss.terceiros).toBe(5800.0);
      expect(guides.dctfWebInss.totalDctfWeb).toBe(38800.0);
      expect(guides.dctfWebInss.code).toBe('0561-INSS');
      expect(guides.dctfWebInss.dueDate).toContain('2026-11-20');

      // FGTS Digital: 8% de 100.000 = 8.000
      expect(guides.fgtsDigital.baseFgts).toBe(100000.0);
      expect(guides.fgtsDigital.totalFgts).toBe(8000.0);
      expect(guides.fgtsDigital.dueDate).toContain('2026-11-20');

      // DARF IRRF (0561): 8.500
      expect(guides.darfIrrf.baseIrrf).toBe(89000.0);
      expect(guides.darfIrrf.totalIrrf).toBe(8500.0);
      expect(guides.darfIrrf.code).toBe('0561');
    });

    it('deve isentar INSS Patronal e Terceiros para empresas do SIMPLES_NACIONAL (Anexos I, II, III e V)', () => {
      const input: TaxGuideCalculationInput = {
        competenceMonth: 10,
        competenceYear: 2026,
        totalBaseInss: 50000.0,
        totalInssEmployee: 5200.0,
        totalBaseFgts: 50000.0,
        totalBaseIrrf: 44800.0,
        totalIrrfEmployee: 3100.0,
        taxRegime: 'SIMPLES_NACIONAL',
        ratAliquot: 0.02,
        fapMultiplier: 1.0,
        terceirosAliquot: 0.058,
        inssPatronalAliquot: 0.20,
      };

      const guides = service.calculateTaxGuides(input);

      // Simples Nacional sem desoneração de anexo IV recolhe patronal via DAS, então na DCTFWeb é 0
      expect(guides.dctfWebInss.inssPatronal).toBe(0);
      expect(guides.dctfWebInss.terceiros).toBe(0);
      expect(guides.dctfWebInss.ratAdjusted).toBe(0);
      expect(guides.dctfWebInss.totalDctfWeb).toBe(5200.0);
    });
  });

  describe('2. Provisões Trabalhistas Mensais (Férias e 13º Salário)', () => {
    it('deve apurar 1/12 de férias, 1/3 constitucional, 1/12 de 13º e respectivos encargos patronais', () => {
      const employeeProvisions: ProvisionCalculationInput[] = [
        {
          contractId: 'c1',
          employeeName: 'João da Silva',
          baseSalary: 6000.0,
          averageAdditionals: 600.0, // média de HE e adicionais
          monthsWorkedInYear: 10,
          inssPatronalAliquot: 0.20,
          ratAliquot: 0.02,
          terceirosAliquot: 0.058,
          fgtsAliquot: 0.08,
        },
      ];

      const report = service.calculatePayrollProvisions(employeeProvisions);

      // Remuneração base de cálculo = 6000 + 600 = 6600
      // Provisão Férias Mensal (1/12) = 6600 / 12 = 550
      // 1/3 Constitucional = 550 / 3 = 183.33
      // Total Férias Mensal = 550 + 183.33 = 733.33
      // Encargos Férias (20% + 2% + 5.8% + 8% = 35.8%) de 733.33 = 262.53
      // Provisão 13º Mensal (1/12) = 6600 / 12 = 550
      // Encargos 13º (35.8% de 550) = 196.90
      expect(report.totalMonthlyFerias).toBeCloseTo(550.0, 2);
      expect(report.totalMonthlyTercoFerias).toBeCloseTo(183.33, 2);
      expect(report.totalMonthlyThirteenth).toBeCloseTo(550.0, 2);
      expect(report.totalChargesFerias).toBeCloseTo(262.53, 2);
      expect(report.totalChargesThirteenth).toBeCloseTo(196.90, 2);
      expect(report.totalMonthlyLiability).toBeCloseTo(550 + 183.33 + 262.53 + 550 + 196.90, 1);
    });
  });

  describe('3. Resumo Contábil da Folha de Pagamento (Partidas Dobradas)', () => {
    it('deve gerar lançamentos contábeis perfeitamente balanceados onde Débito == Crédito', () => {
      const accounting = service.generateAccountingSummary({
        totalEarnings: 80000.0,
        totalDeductions: 18000.0,
        totalNetSalary: 62000.0,
        totalInssEmployee: 9000.0,
        totalIrrfEmployee: 7000.0,
        totalOtherDeductions: 2000.0,
        inssPatronal: 16000.0,
        ratAdjusted: 1600.0,
        terceiros: 4640.0,
        fgtsCompany: 6400.0,
      });

      // Total Débito:
      // Salários e Ordenados (80.000) + INSS Patronal/RAT/Terceiros (22.240) + FGTS (6.400) = 108.640
      // Total Crédito:
      // Salários a Pagar (62.000) + INSS a Recolher (9.000 + 22.240 = 31.240) + IRRF a Recolher (7.000) + Outros Descontos (2.000) + FGTS a Recolher (6.400) = 108.640
      expect(accounting.isBalanced).toBe(true);
      expect(accounting.totalDebit).toBe(108640.0);
      expect(accounting.totalCredit).toBe(108640.0);
      expect(accounting.entries.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe('4. Gerador de Arquivo CNAB 240 (Remessa Bancária FEBRABAN)', () => {
    it('deve gerar arquivo CNAB 240 com todas as linhas contendo exatamente 240 caracteres', () => {
      const company = {
        corporateName: 'EMPRESA EXEMPLO LTDA',
        cnpj: '12345678000199',
        bankCode: '001', // Banco do Brasil
        agency: '1234',
        agencyDigit: '5',
        accountNumber: '98765',
        accountDigit: '2',
      };

      const employees: CnabEmployeePayment[] = [
        {
          contractId: 'c1',
          name: 'ALICE SANTOS',
          cpf: '11122233344',
          bankCode: '001',
          agency: '1234',
          agencyDigit: '5',
          accountNumber: '11111',
          accountDigit: '1',
          accountType: 'CORRENTE',
          netAmount: 4500.50,
          paymentDate: '2026-11-05',
        },
        {
          contractId: 'c2',
          name: 'BRUNO COSTA',
          cpf: '55566677788',
          bankCode: '237', // Bradesco
          agency: '0500',
          agencyDigit: '',
          accountNumber: '22222',
          accountDigit: '3',
          accountType: 'POUPANCA',
          netAmount: 3200.00,
          paymentDate: '2026-11-05',
        },
      ];

      const cnabContent = service.generateCnab240({
        company,
        employees,
        sequentialFileNumber: 1,
      });

      const lines = cnabContent.split('\r\n').filter(l => l.length > 0);

      // Deve ter: Header Arquivo (1) + Header Lote (1) + 2 Segmentos A + Trailer Lote (1) + Trailer Arquivo (1) = 6 linhas
      expect(lines).toHaveLength(6);

      // Todas as linhas devem conter exatamente 240 caracteres
      lines.forEach((line, idx) => {
        expect(line.length, `Linha ${idx + 1} deve ter 240 caracteres`).toBe(240);
      });

      // Header de Arquivo
      expect(lines[0].substring(0, 3)).toBe('001'); // Banco
      expect(lines[0].substring(7, 8)).toBe('0');   // Tipo registro Header Arquivo

      // Header de Lote
      expect(lines[1].substring(7, 8)).toBe('1');   // Tipo registro Header Lote
      expect(lines[1].substring(9, 11)).toBe('30'); // Serviço 30 = Pagamento de Salários

      // Segmento A do primeiro empregado
      expect(lines[2].substring(7, 8)).toBe('3');   // Registro detalhe
      expect(lines[2].substring(13, 14)).toBe('A'); // Segmento A
      expect(lines[2]).toContain('ALICE SANTOS');

      // Trailer de Lote
      expect(lines[4].substring(7, 8)).toBe('5');

      // Trailer de Arquivo
      expect(lines[5].substring(7, 8)).toBe('9');
    });
  });

  describe('5. Informe de Rendimentos Anual (IRPF - Receita Federal)', () => {
    it('deve consolidar os rendimentos tributáveis, deduções de INSS, dependentes e tributação exclusiva do 13º', () => {
      const annualPayslips: AnnualIncomeRecord[] = [
        {
          competenceMonth: 1,
          competenceYear: 2026,
          isThirteenth: false,
          taxableEarnings: 6000.0,
          inssDeduction: 641.51,
          irrfDeduction: 385.10,
          dependentDeduction: 189.59,
          exemptEarnings: 0,
        },
        {
          competenceMonth: 2,
          competenceYear: 2026,
          isThirteenth: false,
          taxableEarnings: 6000.0,
          inssDeduction: 641.51,
          irrfDeduction: 385.10,
          dependentDeduction: 189.59,
          exemptEarnings: 0,
        },
        // 13º Salário (Tributação Exclusiva)
        {
          competenceMonth: 12,
          competenceYear: 2026,
          isThirteenth: true,
          taxableEarnings: 6000.0,
          inssDeduction: 641.51,
          irrfDeduction: 385.10,
          dependentDeduction: 189.59,
          exemptEarnings: 0,
        },
      ];

      const report = service.generateAnnualIncomeReport({
        calendarYear: 2026,
        employeeCpf: '111.222.333-44',
        employeeName: 'Carlos Silva',
        companyCnpj: '12.345.678/0001-99',
        companyName: 'ACME S/A',
        records: annualPayslips,
      });

      // Quadro 3: Rendimentos Tributáveis (só os mensais normais: 6000 + 6000 = 12000)
      expect(report.quadro3.totalRendimentosTributaveis).toBe(12000.0);
      expect(report.quadro3.contribuicaoPrevidenciariaOficial).toBe(1283.02);
      expect(report.quadro3.impostoRetido).toBe(770.20);

      // Quadro 5: Tributação Exclusiva (13º salário = 6000)
      expect(report.quadro5.decimoTerceiroSalario).toBe(6000.0);
      expect(report.quadro5.irrfDecimoTerceiro).toBe(385.10);
    });
  });
});
