import { describe, it, expect } from 'vitest';
import { PayrollEngine } from '../../../supabase/functions/payroll-engine/engine/PayrollEngine';
import { PayrollContext } from '../../../supabase/functions/payroll-engine/engine/PayrollContext';

describe('PayrollEngine - Horas Extras e DSR', () => {
  it('Cenário 1: Cálculo padrão de HE 50% e HE 100% com divisor de 220h', async () => {
    const rubricas = [
      {
        id: 'r1', code: '101', name: 'Salário Base',
        type: 'EARNING', category: 'SALARY', calculation_form: 'DIAS',
        calculation_base: 'SALARIO_BASE', divisor: 30, calculation_order: 1,
        incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
      },
      {
        id: 'r2', code: '201', name: 'Horas Extras 50%',
        type: 'EARNING', category: 'HORA_EXTRA', calculation_form: 'HORAS',
        calculation_base: 'SALARIO_BASE', divisor: 220, factor: 1.5, calculation_order: 2,
        incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
      },
      {
        id: 'r3', code: '202', name: 'Horas Extras 100%',
        type: 'EARNING', category: 'HORA_EXTRA', calculation_form: 'HORAS',
        calculation_base: 'SALARIO_BASE', divisor: 220, factor: 2.0, calculation_order: 3,
        incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
      }
    ];

    const context = new PayrollContext({
      salario_base: 2200.00, // Valor hora = 2200/220 = 10.00
      dias_trabalhados: 30,
      rubricas,
      eventos: [
        { rubric_id: 'r1', quantity: 30, origin: 'AUTOMATICA' },
        { rubric_id: 'r2', quantity: 10, origin: 'MANUAL' }, // 10h * 10 * 1.5 = 150.00
        { rubric_id: 'r3', quantity: 5, origin: 'MANUAL' }   // 5h * 10 * 2.0 = 100.00
      ]
    });

    const engine = new PayrollEngine(context);
    const result = await engine.run();

    // Base = 2200, HE50 = 150, HE100 = 100 -> Total Proventos = 2450.00
    expect(result.total_proventos).toBe(2450.00);

    const he50 = result.memoria_calculo.find(m => m.rubric_id === 'r2');
    expect(he50?.result_value).toBe(150.00);

    const he100 = result.memoria_calculo.find(m => m.rubric_id === 'r3');
    expect(he100?.result_value).toBe(100.00);
  });

  it('Cenário 2: Cálculo do DSR sobre Horas Extras', async () => {
    const rubricas = [
      {
        id: 'r1', code: '101', name: 'Salário Base',
        type: 'EARNING', category: 'SALARY', calculation_form: 'DIAS',
        calculation_base: 'SALARIO_BASE', divisor: 30, calculation_order: 1,
        incidencias: {}
      },
      {
        id: 'r2', code: '201', name: 'Horas Extras 50%',
        type: 'EARNING', category: 'HORA_EXTRA', calculation_form: 'HORAS',
        calculation_base: 'SALARIO_BASE', divisor: 220, factor: 1.5, calculation_order: 2,
        incidencias: {}
      },
      {
        id: 'r3', code: '301', name: 'DSR sobre HE',
        type: 'EARNING', category: 'DSR', calculation_form: 'PERCENTUAL',
        calculation_base: 'BASE_DSR', divisor: 1, factor: 1.0, calculation_order: 4,
        incidencias: {}
      }
    ];

    // Simular mês com 25 dias úteis e 5 domingos/feriados
    // Formula DSR: (Total HE / Dias Úteis) * Domingos
    const diasUteis = 25;
    const domingos = 5;
    const heValue = 150.00;
    const dsrValue = (heValue / diasUteis) * domingos; // 30.00

    const context = new PayrollContext({
      salario_base: 2200.00,
      dias_trabalhados: 30,
      dias_uteis: diasUteis,
      dias_inuteis: domingos,
      rubricas,
      eventos: [
        { rubric_id: 'r1', quantity: 30, origin: 'AUTOMATICA' },
        { rubric_id: 'r2', quantity: 10, origin: 'MANUAL' } // Gera 150.00 de HE
      ]
    });

    const engine = new PayrollEngine(context);
    const result = await engine.run();

    // HE = 150.00
    // DSR = 150.00 * (5/25) = 150 * 20% = 30.00
    // Base = 2200.00

    const dsrMemory = result.memoria_calculo.find(m => m.rubric_id === 'r3');

    expect(result.total_proventos).toBe(2380.00);
    expect(dsrMemory?.result_value).toBe(30.00);
    expect(dsrMemory?.percentage_used).toBe(20.00); // (5/25) * 100
  });
});
