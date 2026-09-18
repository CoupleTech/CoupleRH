import { describe, it, expect } from 'vitest';
import { INSSCalculator } from '../../../supabase/functions/payroll-engine/legal/INSSCalculator';

describe('INSSCalculator', () => {
  it('deve calcular INSS para o teto mínimo (Faixa 1)', () => {
    // 1412.00 is below the first tier limit (1621.00) in 2026
    const base = 1412.00;
    const result = INSSCalculator.calculate(base);
    
    // 1412 * 7.5% = 105.90
    expect(result.value).toBe(105.90);
    expect(result.breakdown.length).toBe(1);
    expect(result.breakdown[0].bracket).toBe(1);
    expect(result.breakdown[0].amount).toBe(1412.00);
  });

  it('deve calcular INSS progressivo para a Faixa 2', () => {
    // 2000.00 is in the second tier
    const base = 2000.00;
    const result = INSSCalculator.calculate(base);
    
    // Faixa 1: 1621 * 7.5% = 121.575
    // Faixa 2: (2000 - 1621) = 379 * 9% = 34.11
    // Total: 121.575 + 34.11 = 155.685 -> 155.69
    expect(result.value).toBe(155.69);
    expect(result.breakdown.length).toBe(2);
    expect(result.breakdown[0].amount).toBe(1621.00);
    expect(result.breakdown[1].amount).toBe(379.00);
  });

  it('deve calcular INSS progressivo para a Faixa 3', () => {
    const base = 3000.00;
    const result = INSSCalculator.calculate(base);
    
    // Faixa 1: 1621 * 7.5% = 121.575
    // Faixa 2: (2902.84 - 1621) = 1281.84 * 9% = 115.3656
    // Faixa 3: (3000 - 2902.84) = 97.16 * 12% = 11.6592
    // Total: 248.60
    expect(result.value).toBe(248.60);
    expect(result.breakdown.length).toBe(3);
  });

  it('deve calcular INSS progressivo para a Faixa 4', () => {
    const base = 5000.00;
    const result = INSSCalculator.calculate(base);
    
    // Conforme especificado na Fase 18:
    // Faixa 1: 1.621,00 * 7,5% = 121,58 (aprox)
    // Faixa 2: (2.902,84 - 1.621,00) = 1.281,84 * 9% = 115,37 (aprox)
    // Faixa 3: (4.354,27 - 2.902,84) = 1.451,43 * 12% = 174,17 (aprox)
    // Faixa 4: (5.000,00 - 4.354,27) = 645,73 * 14% = 90,40 (aprox)
    // Total = 501.52
    expect(result.value).toBeCloseTo(501.51, 1);
  });

  it('deve respeitar o TETO Máximo (Faixa 4 completa)', () => {
    const base = 10000.00;
    const result = INSSCalculator.calculate(base);
    
    // TETO é 8475.55
    // Faixa 4: (8475.55 - 4354.27) = 4121.28 * 14% = 576.9792
    // Maximo INSS deve ser approx 988.10
    const tetoResult = INSSCalculator.calculate(8475.55);
    
    expect(result.value).toBe(tetoResult.value);
    expect(result.breakdown.length).toBe(4);
    expect(result.breakdown[3].amount).toBeCloseTo(4121.28, 2);
  });
});
