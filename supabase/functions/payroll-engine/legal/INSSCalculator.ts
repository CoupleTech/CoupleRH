import { InssBracket } from '../engine/PayrollContext.ts';
import { round2 } from '../utils/money.ts';

export class INSSCalculator {
  public static calculate(base: number, brackets: InssBracket[] = []): { value: number, breakdown: { bracket: number, amount: number, rate: number }[] } {
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
}
