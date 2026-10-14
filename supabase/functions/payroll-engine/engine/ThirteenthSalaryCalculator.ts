/**
 * Módulo de Apuração do 13º Salário (Gratificação Natalina - T19)
 * Legislação: Lei nº 4.090/1962, Lei nº 4.749/1965, Decreto nº 10.854/2021 (Art. 76)
 * e Súmulas 45 e 60 do TST (médias de horas extras e adicionais).
 */

import { round2, sumMoney } from '../utils/money.ts';

export interface ThirteenthMonthDetail {
  month: number;
  workedDays: number;
  unjustifiedAbsences: number;
  hasAvo: boolean;
  reason: string;
}

export interface ThirteenthAvosResult {
  totalAvos: number;
  monthDetails: ThirteenthMonthDetail[];
}

/**
 * Retorna o número de dias de um determinado mês e ano.
 */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Calcula os avos de direito de 13º salário considerando a data de admissão e as faltas injustificadas.
 * Regras (Lei 4.090/62 art. 1º §2º e Decreto 10.854/2021 art. 76):
 * 1. Fração igual ou superior a 15 dias trabalhados no mês civil garante 1 avo (1/12).
 * 2. No mês de admissão: verifica se trabalhou pelo menos 15 dias (ex: 30 - dia + 1 >= 15).
 * 3. Faltas injustificadas superiores a 15 dias no mesmo mês civil acarretam a perda do avo correspondente.
 * 
 * @param admissionDate Data de admissão no formato YYYY-MM-DD
 * @param year Ano da competência do 13º
 * @param upToMonth Mês limite para apuração (ex: 12 para 13º integral, ou 11 para 1ª parcela)
 * @param monthlyUnjustifiedAbsences Mapa de mês (1-12) para quantidade de faltas injustificadas
 */
export function calculateThirteenthAvos(
  admissionDate: string | undefined | null,
  year: number,
  upToMonth: number = 12,
  monthlyUnjustifiedAbsences: Record<number, number> = {}
): ThirteenthAvosResult {
  const monthDetails: ThirteenthMonthDetail[] = [];
  let totalAvos = 0;

  let admYear = 0;
  let admMonth = 0;
  let admDay = 0;

  if (admissionDate) {
    const parts = admissionDate.split('-');
    if (parts.length >= 3) {
      admYear = parseInt(parts[0], 10);
      admMonth = parseInt(parts[1], 10);
      admDay = parseInt(parts[2], 10);
    }
  }

  for (let m = 1; m <= upToMonth; m++) {
    const daysInCurrentMonth = getDaysInMonth(year, m);
    const absences = monthlyUnjustifiedAbsences[m] || 0;

    // Caso 1: Admitido em ano futuro
    if (admYear > year) {
      monthDetails.push({
        month: m,
        workedDays: 0,
        unjustifiedAbsences: absences,
        hasAvo: false,
        reason: 'Contrato não iniciado neste ano civil',
      });
      continue;
    }

    // Caso 2: Mês anterior à admissão no mesmo ano
    if (admYear === year && m < admMonth) {
      monthDetails.push({
        month: m,
        workedDays: 0,
        unjustifiedAbsences: absences,
        hasAvo: false,
        reason: 'Mês anterior à admissão do colaborador',
      });
      continue;
    }

    // Caso 3: Mês de admissão no mesmo ano
    if (admYear === year && m === admMonth) {
      const workedDays = Math.max(0, daysInCurrentMonth - admDay + 1);
      // Se trabalhou 15 dias ou mais no mês da admissão, tem direito ao avo
      if (workedDays >= 15) {
        if (absences > 15) {
          monthDetails.push({
            month: m,
            workedDays,
            unjustifiedAbsences: absences,
            hasAvo: false,
            reason: `Perda do avo por mais de 15 faltas injustificadas no mês (${absences} faltas)`,
          });
        } else {
          totalAvos += 1;
          monthDetails.push({
            month: m,
            workedDays,
            unjustifiedAbsences: absences,
            hasAvo: true,
            reason: `Admitido no mês com ${workedDays} dias trabalhados (>= 15 dias)`,
          });
        }
      } else {
        monthDetails.push({
          month: m,
          workedDays,
          unjustifiedAbsences: absences,
          hasAvo: false,
          reason: `Menos de 15 dias trabalhados na admissão (${workedDays} dias)`,
        });
      }
      continue;
    }

    // Caso 4: Meses após a admissão (ou admitido em ano anterior)
    const workedDays = Math.max(0, daysInCurrentMonth - absences);
    if (absences > 15) {
      monthDetails.push({
        month: m,
        workedDays,
        unjustifiedAbsences: absences,
        hasAvo: false,
        reason: `Perda do avo por mais de 15 faltas injustificadas no mês (${absences} faltas)`,
      });
    } else {
      totalAvos += 1;
      monthDetails.push({
        month: m,
        workedDays,
        unjustifiedAbsences: absences,
        hasAvo: true,
        reason: 'Mês integralmente computado (>= 15 dias de efetivo trabalho)',
      });
    }
  }

  return {
    totalAvos: Math.min(12, Math.max(0, totalAvos)),
    monthDetails,
  };
}

export interface ThirteenthSalaryValues {
  baseRemunerationWithAverages: number;
  totalThirteenthGross: number;
  firstInstallmentGross: number;
  secondInstallmentGross: number;
  advanceDeduction: number;
  netPayable: number;
}

/**
 * Calcula a remuneração integral de 13º salário com médias de variáveis (Súmulas 45 e 60 TST).
 * 
 * @param baseSalary Salário contratual base
 * @param variableAverages Média de horas extras, adicionais e comissões do ano
 * @param avos Quantidade de avos de direito (0 a 12)
 * @param type Tipo de folha ('THIRTEENTH_1' ou 'THIRTEENTH_2')
 * @param advancesPaid Valor total de adiantamentos de 13º pagos no ano (para desconto na 2ª parcela)
 */
export function calculateThirteenthValues(
  baseSalary: number,
  variableAverages: number,
  avos: number,
  type: 'THIRTEENTH_1' | 'THIRTEENTH_2' | '13TH',
  advancesPaid: number = 0
): ThirteenthSalaryValues {
  const baseRemunerationWithAverages = sumMoney([baseSalary, variableAverages]);
  const totalThirteenthGross = round2((baseRemunerationWithAverages / 12) * avos);

  if (type === 'THIRTEENTH_1') {
    const firstInstallmentGross = round2(totalThirteenthGross / 2);
    return {
      baseRemunerationWithAverages,
      totalThirteenthGross,
      firstInstallmentGross,
      secondInstallmentGross: 0,
      advanceDeduction: 0,
      netPayable: firstInstallmentGross,
    };
  }

  // 2ª Parcela ou Parcela Única
  const advanceDeduction = round2(advancesPaid);
  const netPayable = Math.max(0, round2(totalThirteenthGross - advanceDeduction));

  return {
    baseRemunerationWithAverages,
    totalThirteenthGross,
    firstInstallmentGross: 0,
    secondInstallmentGross: totalThirteenthGross,
    advanceDeduction,
    netPayable,
  };
}
