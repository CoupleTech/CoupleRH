import { describe, it, expect } from 'vitest';
import { IRRFCalculator } from '../../../supabase/functions/payroll-engine/legal/IRRFCalculator';

describe('IRRFCalculator', () => {
  it('deve usar o desconto simplificado se for mais vantajoso (1 dependente vs simplificado)', () => {
    // Base: 3000
    // INSS: ~248.60 (da faixa 3)
    // 1 dependente = 189.59
    // Dedução Legal = 248.60 + 189.59 = 438.19
    // Desconto Simplificado = 607.20
    // Como 607.20 > 438.19, deve usar simplificado.
    
    const result = IRRFCalculator.calculate(3000.00, 248.60, 1);
    
    expect(result.usedSimplified).toBe(true);
    // Base IRRF = 3000 - 607.20 = 2392.80
    // 2392.80 está na Faixa 1 (Isento até 2428.80)
    // IRRF Bruto = 0
    expect(result.legalBase).toBe(3000.00 - 607.20);
    expect(result.value).toBe(0);
  });

  it('deve usar deducao legal se for mais vantajoso (3 dependentes vs simplificado)', () => {
    // Base: 4000
    // INSS: aprox 368.60
    // 3 dependentes = 3 * 189.59 = 568.77
    // Dedução Legal = 368.60 + 568.77 = 937.37
    // Desconto Simplificado = 607.20
    // Como 937.37 > 607.20, deve usar legal.
    
    const result = IRRFCalculator.calculate(4000.00, 368.60, 3);
    
    expect(result.usedSimplified).toBe(false);
    const expectedBase = 4000.00 - 368.60 - (3 * 189.59); // 3062.63
    expect(result.legalBase).toBeCloseTo(expectedBase, 2);
  });

  it('deve calcular IRRF com redutor de 2026 (isenção para rendimentos até 5000)', () => {
    // Base Bruta: 5000
    // INSS: 501.52
    // Sem dependentes.
    // Dedução Legal = 501.52
    // Simplificado = 607.20
    // Usa simplificado -> Base = 5000 - 607.20 = 4392.80
    // Faixa: 4392.80 está na faixa 3 (até 4664.68, alíquota 22.5%, dedução 675.49)
    // IRRF Bruto = (4392.80 * 22.5%) - 675.49 = 988.38 - 675.49 = 312.89
    // Como Base <= 5000, aplica o redutor adicional de 2026 (Max 312.89)
    // IRRF Líquido = 312.89 - 312.89 = 0
    
    const result = IRRFCalculator.calculate(5000.00, 501.52, 0);
    
    expect(result.usedSimplified).toBe(true);
    expect(result.value).toBe(0);
  });

  it('deve calcular IRRF com redutor progressivo (entre 5000 e 7350)', () => {
    // Base Bruta: 6000
    // INSS: 641.52
    // Usa Simplificado (607.20) ou Legal (641.52)? Legal é maior (641.52).
    // Base IRRF = 6000 - 641.52 = 5358.48
    // Faixa 5 (Acima de 4664.68, alíquota 27.5%, dedução 908.73)
    // IRRF Bruto = (5358.48 * 27.5%) - 908.73 = 1473.58 - 908.73 = 564.85
    // Redutor = 978.62 - (0.133145 * 6000) = 978.62 - 798.87 = 179.75
    // IRRF Líquido = 564.85 - 179.75 = 385.10
    
    const result = IRRFCalculator.calculate(6000.00, 641.52, 0);
    
    expect(result.usedSimplified).toBe(false);
    expect(result.value).toBeCloseTo(385.10, 0); // Permite pequena variação de arredondamento
  });

  it('não deve aplicar redutor adicional para base > 7350', () => {
    // Base Bruta: 10000
    // INSS: 988.10 (Teto max)
    // Base IRRF = 10000 - 988.10 = 9011.90
    // Faixa 5 (27.5%, dedução 908.73)
    // IRRF Bruto = (9011.90 * 27.5%) - 908.73 = 2478.27 - 908.73 = 1569.54
    // Base > 7350, redutor = 0
    
    const result = IRRFCalculator.calculate(10000.00, 988.10, 0);
    
    expect(result.value).toBeCloseTo(1569.54, 1);
  });
});
