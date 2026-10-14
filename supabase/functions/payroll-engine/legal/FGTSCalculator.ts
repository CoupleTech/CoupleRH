import { round2 } from '../utils/money.ts';

export class FGTSCalculator {
  /**
   * Calcula o FGTS com base na categoria contratual (Menor Aprendiz vs Padrão CLT)
   * e nas alíquotas oficiais vigentes nos parâmetros legais (T19).
   * 
   * Legislação: Art. 15 da Lei nº 8.036/1990 e Art. 428 da CLT.
   * - Menor Aprendiz: 2%
   * - Empregado CLT padrão: 8%
   */
  public static calculate(
    base: number,
    isApprentice: boolean = false,
    standardAliquot?: number,
    apprenticeAliquot?: number
  ): { value: number; rate: number } {
    let rate: number;

    if (isApprentice) {
      if (apprenticeAliquot !== undefined && apprenticeAliquot !== null) {
        // Se a alíquota vier em fração decimal (ex: 0.02), converte para percentual (2.0)
        rate = apprenticeAliquot <= 1 ? apprenticeAliquot * 100 : apprenticeAliquot;
      } else {
        rate = 2.0;
      }
    } else {
      if (standardAliquot !== undefined && standardAliquot !== null) {
        // Se a alíquota vier em fração decimal (ex: 0.08), converte para percentual (8.0)
        rate = standardAliquot <= 1 ? standardAliquot * 100 : standardAliquot;
      } else {
        rate = 8.0;
      }
    }

    return {
      value: round2(base * (rate / 100)),
      rate,
    };
  }
}
