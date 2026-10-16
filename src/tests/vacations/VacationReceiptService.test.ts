import { describe, it, expect } from 'vitest';
import { VacationReceiptService } from '../../services/vacations/vacationReceiptService';

describe('VacationReceiptService - Prazos e Vencimentos CLT e Demonstrativo de Férias (TB-06)', () => {
  describe('Cálculo da Data Limite Legal de Pagamento (Art. 145 CLT)', () => {
    it('deve calcular a data limite como 2 dias corridos antes do início do gozo em dia útil', () => {
      // Início na quinta-feira 15/10/2026 -> 2 dias antes é terça-feira 13/10/2026
      const paymentDue = VacationReceiptService.calculatePaymentDueDate('2026-10-15');
      expect(paymentDue.dueDateIso).toBe('2026-10-13');
      expect(paymentDue.dueDateFormatted).toBe('13/10/2026');
      expect(paymentDue.wasAdjustedForWeekend).toBe(false);
    });

    it('deve antecipar para sexta-feira quando 2 dias antes cair em domingo (proteção bancária CLT)', () => {
      // Início na terça-feira 10/11/2026 -> 2 dias antes é domingo 08/11/2026 -> antecipa para sexta 06/11/2026
      const paymentDue = VacationReceiptService.calculatePaymentDueDate('2026-11-10');
      expect(paymentDue.dueDateIso).toBe('2026-11-06');
      expect(paymentDue.dueDateFormatted).toBe('06/11/2026');
      expect(paymentDue.wasAdjustedForWeekend).toBe(true);
    });

    it('deve antecipar para sexta-feira quando 2 dias antes cair em sábado', () => {
      // Início na segunda-feira 09/11/2026 -> 2 dias antes é sábado 07/11/2026 -> antecipa para sexta 06/11/2026
      const paymentDue = VacationReceiptService.calculatePaymentDueDate('2026-11-09');
      expect(paymentDue.dueDateIso).toBe('2026-11-06');
      expect(paymentDue.dueDateFormatted).toBe('06/11/2026');
      expect(paymentDue.wasAdjustedForWeekend).toBe(true);
    });
  });

  describe('Conformidade do Período Concessivo e Controle de Dobra (Arts. 134 e 137 CLT)', () => {
    it('deve classificar como REGULAR quando o gozo ocorre dentro do limite concessivo', () => {
      const compliance = VacationReceiptService.evaluateConcessiveCompliance(
        '2026-05-01',
        '2026-06-30'
      );
      expect(compliance.isDoubled).toBe(false);
      expect(compliance.status).toBe('REGULAR');
      expect(compliance.statusLabel).toBe('Dentro do Prazo Legal');
    });

    it('deve acusar DOBRA TRABALHISTA (Art. 137 CLT) quando o gozo inicia após o limite concessivo', () => {
      const compliance = VacationReceiptService.evaluateConcessiveCompliance(
        '2026-07-05',
        '2026-06-30'
      );
      expect(compliance.isDoubled).toBe(true);
      expect(compliance.status).toBe('DOUBLE_PAY');
      expect(compliance.statusLabel).toBe('Férias em Dobro (Art. 137 CLT)');
    });
  });

  describe('Demonstrativo Contábil e Discriminação de Verbas (501, 502, 503, 504 e Extenso)', () => {
    it('deve apurar proventos de 30 dias de férias e 1/3 constitucional com exatidão', () => {
      const receipt = VacationReceiptService.calculateVacationAccounting({
        baseSalary: 3000,
        daysTaken: 30,
        cashAllowanceDays: 0,
        startDate: '2026-10-01',
        inssRate: 8.5 // Simulação
      });

      // 501 Férias: 3000
      // 502 1/3: 1000
      // Total Bruto: 4000
      expect(receipt.earningsTotal).toBe(4000);
      const item501 = receipt.items.find(i => i.code === '501');
      const item502 = receipt.items.find(i => i.code === '502');
      expect(item501?.amount).toBe(3000);
      expect(item502?.amount).toBe(1000);
      expect(receipt.netAmountExtenso).toContain('reais');
    });

    it('deve apurar abono pecuniário (10 dias) e 1/3 do abono quando solicitado (cód 503 e 504)', () => {
      const receipt = VacationReceiptService.calculateVacationAccounting({
        baseSalary: 3000,
        daysTaken: 20,
        cashAllowanceDays: 10,
        startDate: '2026-10-01'
      });

      // 501 Férias (20 dias): (3000/30)*20 = 2000
      // 502 1/3 Férias: 2000 / 3 = 666.67
      // 503 Abono (10 dias): (3000/30)*10 = 1000
      // 504 1/3 Abono: 1000 / 3 = 333.33
      // Total Proventos = 2000 + 666.67 + 1000 + 333.33 = 4000.00
      const item503 = receipt.items.find(i => i.code === '503');
      const item504 = receipt.items.find(i => i.code === '504');
      expect(item503?.amount).toBe(1000);
      expect(item504?.amount).toBe(333.33);
      expect(receipt.earningsTotal).toBe(4000);
    });

    it('deve incorporar médias de adicionais habituais (Art. 142 § 5º CLT) na remuneração base', () => {
      const receipt = VacationReceiptService.calculateVacationAccounting({
        baseSalary: 3000,
        daysTaken: 30,
        cashAllowanceDays: 0,
        startDate: '2026-10-01',
        averageHabitualAdditions: 600 // Ex: Médias de HE e Adic Noturno
      });

      // Remuneração base efetiva = 3600
      // 501 Férias Normais: 3600
      // 502 1/3: 1200
      // Total Bruto: 4800
      expect(receipt.earningsTotal).toBe(4800);
      const item501 = receipt.items.find(i => i.code === '501');
      expect(item501?.amount).toBe(3600);
    });
  });
});
