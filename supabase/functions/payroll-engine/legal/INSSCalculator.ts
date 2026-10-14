import { InssBracket } from '../engine/PayrollContext.ts';
import { round2, addMoney, subtractMoney } from '../utils/money.ts';

export class INSSCalculator {
  public static calculateSingle(
    base: number, 
    brackets: InssBracket[] = []
  ): { value: number; breakdown: { bracket: number; amount: number; rate: number }[] } {
    let inss = 0;
    const breakdown = [];
    
    if (!brackets || brackets.length === 0) {
      throw new Error('Parâmetros legais de INSS ausentes para a competência.');
    }

    // Ordena as faixas para garantir progressividade
    const sortedBrackets = [...brackets].sort((a, b) => a.bracket_number - b.bracket_number);
    const TETO = sortedBrackets[sortedBrackets.length - 1].base_limit || 99999999;
    const calcBase = Math.min(base, TETO);

    if (calcBase > 0) {
      let currentBase = 0;
      
      for (let i = 0; i < sortedBrackets.length; i++) {
        const bracket = sortedBrackets[i];
        const limit = bracket.base_limit || 99999999;
        const rate = bracket.aliquot;
        
        if (calcBase > currentBase) {
          const taxableInBracket = Math.min(calcBase, limit) - currentBase;
          if (taxableInBracket > 0) {
            inss += taxableInBracket * (rate / 100);
            breakdown.push({ bracket: bracket.bracket_number, amount: taxableInBracket, rate: rate });
          }
        }
        currentBase = limit;
      }
    }

    return {
      value: round2(inss),
      breakdown
    };
  }

  public static calculate(
    base: number, 
    brackets: InssBracket[] = [],
    baseAlreadyTaxed: number = 0
  ): { 
    value: number; 
    breakdown: { bracket: number; amount: number; rate: number }[];
    totalCalculated: number;
    alreadyTaxedValue: number;
  } {
    if (!brackets || brackets.length === 0) {
      throw new Error('Parâmetros legais de INSS ausentes para a competência.');
    }

    const safeBaseAlreadyTaxed = Math.max(0, baseAlreadyTaxed || 0);
    const safeBase = Math.max(0, base || 0);

    // Se não há base já tributada anterior na competência
    if (safeBaseAlreadyTaxed === 0) {
      const single = this.calculateSingle(safeBase, brackets);
      return {
        value: single.value,
        breakdown: single.breakdown,
        totalCalculated: single.value,
        alreadyTaxedValue: 0
      };
    }

    // T16: Consolidação por competência entre folhas
    // inssTotal = calc(baseJaTributada + baseAtual) - calc(baseJaTributada)
    const combinedBase = addMoney(safeBaseAlreadyTaxed, safeBase);
    const inssCombined = this.calculateSingle(combinedBase, brackets);
    const inssAlreadyTaxed = this.calculateSingle(safeBaseAlreadyTaxed, brackets);

    const inssCurrent = Math.max(0, subtractMoney(inssCombined.value, inssAlreadyTaxed.value));
    const currentBreakdown = this.calculateIncrementalBreakdown(safeBaseAlreadyTaxed, combinedBase, brackets);

    return {
      value: inssCurrent,
      breakdown: currentBreakdown,
      totalCalculated: inssCombined.value,
      alreadyTaxedValue: inssAlreadyTaxed.value
    };
  }

  private static calculateIncrementalBreakdown(
    baseAlreadyTaxed: number,
    combinedBase: number,
    brackets: InssBracket[]
  ): { bracket: number; amount: number; rate: number }[] {
    const breakdown = [];
    const sortedBrackets = [...brackets].sort((a, b) => a.bracket_number - b.bracket_number);
    const TETO = sortedBrackets[sortedBrackets.length - 1].base_limit || 99999999;

    const effStart = Math.min(baseAlreadyTaxed, TETO);
    const effEnd = Math.min(combinedBase, TETO);

    if (effEnd <= effStart) return [];

    let currentLower = 0;
    for (let i = 0; i < sortedBrackets.length; i++) {
      const bracket = sortedBrackets[i];
      const currentUpper = bracket.base_limit || 99999999;
      const rate = bracket.aliquot;

      // Interseção de [effStart, effEnd] com [currentLower, currentUpper]
      const overlapStart = Math.max(effStart, currentLower);
      const overlapEnd = Math.min(effEnd, currentUpper);

      if (overlapEnd > overlapStart) {
        const taxable = round2(overlapEnd - overlapStart);
        breakdown.push({
          bracket: bracket.bracket_number,
          amount: taxable,
          rate: rate
        });
      }

      currentLower = currentUpper;
    }

    return breakdown;
  }
}
