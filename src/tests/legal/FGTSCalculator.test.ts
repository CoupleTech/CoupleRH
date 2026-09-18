import { describe, it, expect } from 'vitest';
import { FGTSCalculator } from '../../../supabase/functions/payroll-engine/legal/FGTSCalculator';

describe('FGTSCalculator', () => {
  it('deve calcular FGTS padrão (8%)', () => {
    // Base: 2000
    // FGTS: 2000 * 8% = 160.00
    
    const result = FGTSCalculator.calculate(2000.00, false);
    
    expect(result.rate).toBe(8.0);
    expect(result.value).toBe(160.00);
  });

  it('deve calcular FGTS para Jovem Aprendiz (2%)', () => {
    // Base: 1412.00
    // FGTS: 1412 * 2% = 28.24
    
    const result = FGTSCalculator.calculate(1412.00, true);
    
    expect(result.rate).toBe(2.0);
    expect(result.value).toBe(28.24);
  });
});
