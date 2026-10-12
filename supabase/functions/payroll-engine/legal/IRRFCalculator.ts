import { IrrfBracket, GeneralLegalParameters } from '../engine/PayrollContext.ts';

export interface IrrfCalculationResult {
  value: number;
  usedSimplified: boolean;
  legalBase: number;
  grossIncome: number;
  reductionAmount: number;
}

export class IRRFCalculator {
  public static calculate(
    grossIncome: number,
    inss: number,
    dependents: number,
    brackets?: IrrfBracket[],
    params?: GeneralLegalParameters,
    alimony: number = 0
  ): IrrfCalculationResult {
    if (!params || Object.keys(params).length === 0) {
      throw new Error('Parâmetros legais gerais ausentes para a competência.');
    }
    if (params.simplified_discount === undefined || params.simplified_discount === null) {
      throw new Error("Parâmetro legal 'simplified_discount' ausente.");
    }
    if (dependents > 0 && (params.dependent_deduction === undefined || params.dependent_deduction === null)) {
      throw new Error("Parâmetro legal 'dependent_deduction' ausente para cálculo com dependentes.");
    }

    // 1. Apuração da Dedução Legal (INSS + Dependentes + Pensão Alimentícia)
    const dependentesDeducao = dependents * (params.dependent_deduction || 0);
    const baseLegal = Math.max(0, grossIncome - inss - dependentesDeducao - alimony);

    // 2. Apuração da Dedução Simplificada (Desconto padrão sobre o bruto)
    const simplifiedDiscount = params.simplified_discount;
    const baseSimplificada = Math.max(0, grossIncome - simplifiedDiscount);

    // 3. Critério Legal: aplica-se a dedução mais benéfica ao trabalhador (menor base de cálculo tributável)
    const usedSimplified = baseSimplificada < baseLegal;
    const calcBase = usedSimplified ? baseSimplificada : baseLegal;

    // 4. Faixas da Tabela Progressiva do IRRF
    if (!brackets || brackets.length === 0) {
      throw new Error('Parâmetros legais de IRRF ausentes para a competência.');
    }

    const sortedBrackets = [...brackets].sort((a, b) => a.bracket_number - b.bracket_number);
    let irrfBruto = 0;
    let bracketFound = false;

    // Localizar faixa da base tributável
    for (let i = 0; i < sortedBrackets.length; i++) {
      const bracket = sortedBrackets[i];
      const limit = bracket.base_limit ?? Infinity;

      if (calcBase <= limit) {
        irrfBruto = (calcBase * (bracket.aliquot / 100)) - bracket.deduction;
        bracketFound = true;
        break;
      }
    }

    // Se ultrapassar a última faixa com teto definido, aplica a última faixa aberta
    if (!bracketFound && sortedBrackets.length > 0) {
      const lastBracket = sortedBrackets[sortedBrackets.length - 1];
      irrfBruto = (calcBase * (lastBracket.aliquot / 100)) - lastBracket.deduction;
    }

    irrfBruto = Math.max(0, irrfBruto);

    // 5. Redutor do IRRF 2026 (calculado sobre o RENDIMENTO BRUTO TRIBUTÁVEL - T1/Doc §4)
    let reductionAmount = 0;
    const reductionA = params.irrf_reduction_a ?? 978.62;
    const reductionB = params.irrf_reduction_b ?? 0.133145;

    if (grossIncome <= 5000) {
      // Isenção para rendimentos brutos até R$ 5.000,00 (redutor anula o imposto apurado)
      reductionAmount = irrfBruto;
    } else if (grossIncome <= 7350) {
      // Redutor progressivo decrescente para rendimentos brutos entre R$ 5.000,01 e R$ 7.350,00
      reductionAmount = Math.max(0, reductionA - (reductionB * grossIncome));
    }

    const finalIrrf = Math.max(0, irrfBruto - reductionAmount);

    return {
      value: Math.round(finalIrrf * 100) / 100,
      usedSimplified,
      legalBase: Math.max(0, Math.round(calcBase * 100) / 100),
      grossIncome: Math.round(grossIncome * 100) / 100,
      reductionAmount: Math.round(reductionAmount * 100) / 100
    };
  }
}
