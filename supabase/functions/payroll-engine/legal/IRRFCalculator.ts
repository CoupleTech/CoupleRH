import { IrrfBracket, GeneralLegalParameters } from '../engine/PayrollContext.ts';

export class IRRFCalculator {
  public static calculate(base: number, inss: number, dependents: number, brackets: IrrfBracket[] = [], params: GeneralLegalParameters = {}): { value: number, usedSimplified: boolean, legalBase: number } {
    // Fallback para 2026
    const dependentesDeducao = dependents * (params.dependent_deduction || 189.59);
    const baseLegal = base - inss - dependentesDeducao;

    const baseSimplificada = base - (params.simplified_discount || 607.20);

    const usedSimplified = baseSimplificada < baseLegal;
    const calcBase = usedSimplified ? baseSimplificada : baseLegal;

    if (!brackets || brackets.length === 0) {
      brackets = [
        { bracket_number: 1, base_limit: 2428.80, aliquot: 0, deduction: 0 },
        { bracket_number: 2, base_limit: 2826.65, aliquot: 7.5, deduction: 182.16 },
        { bracket_number: 3, base_limit: 3751.05, aliquot: 15.0, deduction: 394.16 },
        { bracket_number: 4, base_limit: 4664.68, aliquot: 22.5, deduction: 675.49 },
        { bracket_number: 5, base_limit: null, aliquot: 27.5, deduction: 908.73 }
      ];
    }

    const sortedBrackets = [...brackets].sort((a, b) => a.bracket_number - b.bracket_number);
    let irrf = 0;
    
    // O IRRF não é "fatiado" como o INSS. Você acha a faixa e subtrai a dedução inteira.
    for (let i = 0; i < sortedBrackets.length; i++) {
      const bracket = sortedBrackets[i];
      const limit = bracket.base_limit || 99999999;
      
      if (calcBase <= limit) {
        irrf = (calcBase * (bracket.aliquot / 100)) - bracket.deduction;
        break;
      }
    }
    
    irrf = Math.max(0, irrf);

    // Redutor IRRF 2026 (fase.md)
    if (base <= 5000) {
      irrf = Math.max(0, irrf - 312.89);
    } else if (base <= 7350) {
      const redutor = 978.62 - (0.133145 * base);
      irrf = Math.max(0, irrf - Math.max(0, redutor));
    }
    
    return {
      value: Math.round(irrf * 100) / 100,
      usedSimplified,
      legalBase: Math.max(0, calcBase)
    };
  }
}
