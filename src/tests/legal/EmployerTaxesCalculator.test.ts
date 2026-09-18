import { describe, it, expect } from 'vitest';
import { EmployerTaxesCalculator } from '../../../supabase/functions/payroll-engine/legal/EmployerTaxesCalculator';

describe('EmployerTaxesCalculator', () => {
  it('deve calcular os encargos patronais padrão (INSS 20%, RAT 2%, FAP 1, Terceiros 5.8%, FGTS 8%)', () => {
    // Base INSS: 10000
    // Base FGTS: 10000
    // INSS Patronal: 2000
    // RAT Ajustado: 10000 * 2% * 1 = 200
    // Terceiros: 10000 * 5.8% = 580
    // FGTS: 10000 * 8% = 800
    // Total = 3580
    
    const result = EmployerTaxesCalculator.calculate(10000.00, 10000.00);
    
    expect(result.inss_patronal).toBe(2000.00);
    expect(result.rat_adjusted).toBe(200.00);
    expect(result.terceiros).toBe(580.00);
    expect(result.fgts_patronal).toBe(800.00);
    expect(result.total).toBe(3580.00);
  });

  it('deve simular RAT com FAP ajustado', () => {
    // Base INSS: 10000
    // RAT 3%, FAP 0.5 (Risco alto, mas bom desempenho)
    // RAT Ajustado: 10000 * 3% * 0.5 = 150
    
    const config = {
      rat_percentage: 3.0,
      fap_multiplier: 0.5
    };
    
    const result = EmployerTaxesCalculator.calculate(10000.00, 0, config);
    
    expect(result.rat_adjusted).toBe(150.00);
  });
});
