import { InssBracket } from '../engine/PayrollContext.ts';

export class INSSCalculator {
  public static calculate(base: number, brackets: InssBracket[] = []): { value: number, breakdown: { bracket: number, amount: number, rate: number }[] } {
    let inss = 0;
    const breakdown = [];
    
    // Fallback para 2026 se o banco estiver vazio
    if (!brackets || brackets.length === 0) {
      brackets = [
        { bracket_number: 1, base_limit: 1621.00, aliquot: 7.5, deduction: 0 },
        { bracket_number: 2, base_limit: 2902.84, aliquot: 9.0, deduction: 0 },
        { bracket_number: 3, base_limit: 4354.27, aliquot: 12.0, deduction: 0 },
        { bracket_number: 4, base_limit: 8475.55, aliquot: 14.0, deduction: 0 }
      ];
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
      value: Math.round(inss * 100) / 100,
      breakdown
    };
  }
}
