import { describe, it, expect } from 'vitest';
import { PayrollEngine } from '../../../supabase/functions/payroll-engine/engine/PayrollEngine';
import { PayrollContext } from '../../../supabase/functions/payroll-engine/engine/PayrollContext';

describe('PayrollEngine - Rescisão', () => {
  it('Cenário 1: Saldo de Salário e 13º Proporcional', async () => {
    const rubricas = [
      {
        id: 'r1', code: '101', name: 'Saldo de Salário',
        type: 'EARNING', category: 'SALARY', calculation_form: 'FIXO',
        calculation_base: 'SALARIO_BASE', divisor: 30, calculation_order: 1,
        incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
      },
      {
        id: 'r2', code: '801', name: '13º Salário Proporcional',
        type: 'EARNING', category: 'THIRTEENTH', calculation_form: 'AVOS',
        calculation_base: 'SALARIO_BASE', divisor: 12, calculation_order: 2,
        incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true } // Na rescisão incide
      }
    ];

    const context = new PayrollContext({
      salario_base: 3600.00,
      dias_trabalhados: 10, // 10 dias trabalhados no mês da rescisão
      tipo_folha: 'TERMINATION',
      rubricas,
      eventos: [
        { rubric_id: 'r1', quantity: 1, origin: 'AUTOMATICA' },
        { rubric_id: 'r2', quantity: 6, origin: 'AUTOMATICA' } // 6 avos de 13º
      ]
    });

    const engine = new PayrollEngine(context);
    const result = await engine.run();

    // Saldo Salário = 3600 / 30 * 10 = 1200
    // 13º Proporcional = 3600 / 12 * 6 = 1800
    // Total = 3000
    expect(result.total_proventos).toBe(3000.00);

    const saldoMem = result.memoria_calculo.find(m => m.rubric_id === 'r1');
    expect(saldoMem?.result_value).toBe(1200.00);

    const decimoMem = result.memoria_calculo.find(m => m.rubric_id === 'r2');
    expect(decimoMem?.result_value).toBe(1800.00);
  });

  it('Cenário 2: Férias Proporcionais + 1/3 na Rescisão sem incidência', async () => {
    const rubricas = [
      {
        id: 'r1', code: '505', name: 'Férias Proporcionais Rescisão',
        type: 'EARNING', category: 'VACATION', calculation_form: 'AVOS',
        calculation_base: 'SALARIO_BASE', divisor: 12, calculation_order: 3,
        incidencias: { gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false } // Férias indenizadas na rescisão
      },
      {
        id: 'r2', code: '506', name: '1/3 Férias Proporcionais',
        type: 'EARNING', category: 'VACATION', calculation_form: 'PERCENTUAL',
        calculation_base: 'R505', percentage: 33.3333, calculation_order: 4,
        incidencias: { gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
      }
    ];

    const context = new PayrollContext({
      salario_base: 3600.00,
      dias_trabalhados: 0,
      tipo_folha: 'TERMINATION',
      rubricas,
      eventos: [
        { rubric_id: 'r1', quantity: 4, origin: 'AUTOMATICA' }, // 4 avos
        { rubric_id: 'r2', quantity: 1, origin: 'AUTOMATICA' }
      ]
    });

    const engine = new PayrollEngine(context);
    const result = await engine.run();

    // Férias Prop = 3600 / 12 * 4 = 1200
    // 1/3 = 1200 * 33.3333% = 400
    // Total = 1600
    expect(result.total_proventos).toBeCloseTo(1600.00, 2);

    expect(result.bases.inss).toBe(0);
    expect(result.bases.irrf).toBe(0);
    expect(result.bases.fgts).toBe(0);
    
    const feriasProp = result.memoria_calculo.find(m => m.rubric_id === 'r1');
    expect(feriasProp?.result_value).toBe(1200.00);
    
    const tercoProp = result.memoria_calculo.find(m => m.rubric_id === 'r2');
    expect(tercoProp?.result_value).toBeCloseTo(400.00, 2);
  });
});
