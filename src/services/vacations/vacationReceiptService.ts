/**
 * vacationReceiptService.ts
 * 
 * Serviço de Gestão e Apuração de Recibos de Férias CLT (TB-06 / Fase P6)
 * - Exibição formal do Período Aquisitivo e Limite do Período Concessivo (CLT art. 134 — controle de dobra)
 * - Data Limite Legal de Pagamento (CLT art. 145 — até 2 dias antes do início do gozo)
 * - Demonstrativo contábil com discriminação (501, 502, 503, 504, médias CLT art. 142 § 5º, deduções)
 * - Líquido de Férias por extenso
 * - Geração de snapshot canônico para PDF timbrado com QR Code e Hash H1
 */

import { round2, sumMoney, subtractMoney } from '../../utils/money';
import { numberToWordsPtBr } from '../../utils/numberToWordsPtBr';
import type { PayslipItemSnapshot, VacationReceiptSnapshot } from '../documents/documentGeneratorService';

export interface PaymentDueDateResult {
  dueDateIso: string;
  dueDateFormatted: string;
  wasAdjustedForWeekend: boolean;
  legalNotice: string;
}

export type ConcessiveStatus = 'REGULAR' | 'WARNING' | 'DOUBLE_PAY';

export interface ConcessiveComplianceResult {
  isDoubled: boolean;
  status: ConcessiveStatus;
  statusLabel: string;
  daysRemainingOrOverdue: number;
  badgeVariant: 'success' | 'warning' | 'danger';
}

export interface VacationAccountingInput {
  baseSalary: number;
  daysTaken: number;
  cashAllowanceDays?: number;
  startDate: string;
  averageHabitualAdditions?: number;
  inssRate?: number;
  inssAmount?: number;
  irrfAmount?: number;
  alimonyAmount?: number;
  otherDeductions?: number;
}

export interface VacationAccountingResult {
  baseSalary: number;
  effectiveBaseSalary: number;
  daysTaken: number;
  cashAllowanceDays: number;
  earningsTotal: number;
  deductionsTotal: number;
  netSalary: number;
  netAmountExtenso: string;
  items: PayslipItemSnapshot[];
}

export class VacationReceiptService {
  /**
   * Calcula a data limite legal para pagamento das férias (Art. 145 da CLT e Súmula 450 do STF).
   * Deve ser efetuado até 2 dias corridos antes do início do gozo.
   * Se o 2º dia anterior recair em sábado ou domingo, antecipa-se para a sexta-feira útil anterior,
   * garantindo a liquidação bancária dentro do prazo legal.
   */
  public static calculatePaymentDueDate(startDateStr: string): PaymentDueDateResult {
    const [year, month, day] = startDateStr.split('-').map(Number);
    // Cria data UTC pura para evitar desvios de fuso
    const startUtc = new Date(Date.UTC(year, month - 1, day));
    
    // Subtrai 2 dias corridos
    const dueUtc = new Date(startUtc.getTime() - 2 * 24 * 60 * 60 * 1000);
    const dayOfWeek = dueUtc.getUTCDay(); // 0 = Domingo, 6 = Sábado

    let adjustedDays = 0;
    if (dayOfWeek === 0) {
      // Domingo -> antecipa 2 dias para Sexta-feira
      adjustedDays = 2;
    } else if (dayOfWeek === 6) {
      // Sábado -> antecipa 1 dia para Sexta-feira
      adjustedDays = 1;
    }

    const finalDueUtc = adjustedDays > 0
      ? new Date(dueUtc.getTime() - adjustedDays * 24 * 60 * 60 * 1000)
      : dueUtc;

    const finalY = finalDueUtc.getUTCFullYear();
    const finalM = String(finalDueUtc.getUTCMonth() + 1).padStart(2, '0');
    const finalD = String(finalDueUtc.getUTCDate()).padStart(2, '0');

    const dueDateIso = `${finalY}-${finalM}-${finalD}`;
    const dueDateFormatted = `${finalD}/${finalM}/${finalY}`;

    const wasAdjustedForWeekend = adjustedDays > 0;
    const legalNotice = wasAdjustedForWeekend
      ? 'Prazo legal de 2 dias corridos recai em fim de semana; antecipado para o dia útil anterior para cumprimento do Art. 145 da CLT.'
      : 'Até 2 dias antes do início do gozo, conforme Art. 145 da CLT.';

    return {
      dueDateIso,
      dueDateFormatted,
      wasAdjustedForWeekend,
      legalNotice
    };
  }

  /**
   * Avalia a conformidade com o Período Concessivo (Art. 134 e 137 da CLT — Controle de Dobra).
   */
  public static evaluateConcessiveCompliance(
    startDateStr: string,
    concessiveEndDateStr?: string | null
  ): ConcessiveComplianceResult {
    if (!concessiveEndDateStr) {
      return {
        isDoubled: false,
        status: 'REGULAR',
        statusLabel: 'Dentro do Prazo Legal',
        daysRemainingOrOverdue: 999,
        badgeVariant: 'success'
      };
    }

    const [sy, sm, sd] = startDateStr.split('-').map(Number);
    const [cy, cm, cd] = concessiveEndDateStr.split('-').map(Number);

    const startUtc = new Date(Date.UTC(sy, sm - 1, sd));
    const concUtc = new Date(Date.UTC(cy, cm - 1, cd));

    const diffMs = concUtc.getTime() - startUtc.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      // Data de início após o limite concessivo
      return {
        isDoubled: true,
        status: 'DOUBLE_PAY',
        statusLabel: 'Férias em Dobro (Art. 137 CLT)',
        daysRemainingOrOverdue: Math.abs(diffDays),
        badgeVariant: 'danger'
      };
    }

    if (diffDays <= 30) {
      return {
        isDoubled: false,
        status: 'WARNING',
        statusLabel: `Vence em ${diffDays} dias`,
        daysRemainingOrOverdue: diffDays,
        badgeVariant: 'warning'
      };
    }

    return {
      isDoubled: false,
      status: 'REGULAR',
      statusLabel: 'Dentro do Prazo Legal',
      daysRemainingOrOverdue: diffDays,
      badgeVariant: 'success'
    };
  }

  /**
   * Apura o demonstrativo contábil de férias discriminando todas as rubricas legais:
   * 501: Férias Normais (gozadas)
   * 502: 1/3 Constitucional de Férias (Art. 7º, XVII CF/88)
   * 503: Abono Pecuniário (Art. 143 CLT)
   * 504: 1/3 Constitucional do Abono Pecuniário
   * Médias de adicionais habituais (Art. 142 § 5º CLT)
   * Descontos (INSS 901, IRRF 902, Pensão 804)
   * Líquido por Extenso
   */
  public static calculateVacationAccounting(input: VacationAccountingInput): VacationAccountingResult {
    const {
      baseSalary,
      daysTaken,
      cashAllowanceDays = 0,
      averageHabitualAdditions = 0,
      inssAmount,
      irrfAmount,
      alimonyAmount = 0,
      otherDeductions = 0,
      inssRate
    } = input;

    // Remuneração base efetiva = Salário Contratual + Médias de Adicionais Habituais (Art. 142 § 5º CLT)
    const effectiveBaseSalary = round2(baseSalary + averageHabitualAdditions);

    const items: PayslipItemSnapshot[] = [];

    // 1. Férias Normais (Cód 501)
    const feriasNormais = round2((effectiveBaseSalary / 30) * daysTaken);
    items.push({
      code: '501',
      name: 'Férias Normais Gozadas',
      reference: `${daysTaken} dias`,
      type: 'EARNING',
      amount: feriasNormais
    });

    // 2. 1/3 Constitucional de Férias (Cód 502)
    const tercoFerias = round2(feriasNormais / 3);
    items.push({
      code: '502',
      name: '1/3 Constitucional de Férias',
      reference: '33,33%',
      type: 'EARNING',
      amount: tercoFerias
    });

    // 3. Abono Pecuniário (Cód 503)
    let abonoPecuniario = 0;
    let tercoAbono = 0;
    if (cashAllowanceDays > 0) {
      abonoPecuniario = round2((effectiveBaseSalary / 30) * cashAllowanceDays);
      items.push({
        code: '503',
        name: 'Abono Pecuniário de Férias',
        reference: `${cashAllowanceDays} dias`,
        type: 'EARNING',
        amount: abonoPecuniario
      });

      // 4. 1/3 Constitucional do Abono Pecuniário (Cód 504)
      tercoAbono = round2(abonoPecuniario / 3);
      items.push({
        code: '504',
        name: '1/3 Constitucional sobre Abono',
        reference: '33,33%',
        type: 'EARNING',
        amount: tercoAbono
      });
    }

    const earningsTotal = sumMoney([feriasNormais, tercoFerias, abonoPecuniario, tercoAbono]);

    // Deduções
    // Base de INSS: incide sobre Férias + 1/3 (o abono e seu 1/3 são isentos de INSS e FGTS)
    const baseInssFerias = feriasNormais + tercoFerias;
    let calcInss = inssAmount;
    if (calcInss === undefined) {
      if (inssRate) {
        calcInss = round2(baseInssFerias * (inssRate / 100));
      } else {
        // Estimativa previdenciária padrão se não informado
        calcInss = round2(baseInssFerias * 0.09);
      }
    }

    if (calcInss > 0) {
      items.push({
        code: '901',
        name: 'Contribuição Previdenciária INSS',
        reference: inssRate ? `${inssRate}%` : 'Tabela Oficial',
        type: 'DEDUCTION',
        amount: calcInss
      });
    }

    // IRRF Férias (Cód 902)
    let calcIrrf = irrfAmount ?? 0;
    if (calcIrrf > 0) {
      items.push({
        code: '902',
        name: 'Imposto de Renda Retido na Fonte (IRRF)',
        reference: 'Tributação Exclusiva',
        type: 'DEDUCTION',
        amount: calcIrrf
      });
    }

    // Pensão Alimentícia (Cód 804)
    if (alimonyAmount > 0) {
      items.push({
        code: '804',
        name: 'Pensão Alimentícia Judicial',
        reference: 'Ordem Judicial',
        type: 'DEDUCTION',
        amount: alimonyAmount
      });
    }

    // Outros descontos autorizados
    if (otherDeductions > 0) {
      items.push({
        code: '850',
        name: 'Outros Descontos Autorizados',
        reference: 'Férias',
        type: 'DEDUCTION',
        amount: otherDeductions
      });
    }

    const deductionsTotal = sumMoney([calcInss, calcIrrf, alimonyAmount, otherDeductions]);
    const netSalary = subtractMoney(earningsTotal, deductionsTotal);
    const netAmountExtenso = numberToWordsPtBr(netSalary);

    return {
      baseSalary,
      effectiveBaseSalary,
      daysTaken,
      cashAllowanceDays,
      earningsTotal,
      deductionsTotal,
      netSalary,
      netAmountExtenso,
      items
    };
  }
}
