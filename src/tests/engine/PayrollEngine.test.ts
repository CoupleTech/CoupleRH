import { describe, it, expect } from 'vitest';
import { PayrollEngine } from '../../../supabase/functions/payroll-engine/engine/PayrollEngine';
import { PayrollContext } from '../../../supabase/functions/payroll-engine/engine/PayrollContext';

describe('PayrollEngine', () => {
  it('deve calcular Salário Proporcional e gerar Memória de Cálculo', async () => {
    const rubricas = [
      {
        id: 'r1',
        code: '101',
        name: 'Salário Base',
        type: 'EARNING',
        category: 'SALARY',
        calculation_form: 'DIAS',
        calculation_base: 'SALARIO_BASE',
        divisor: 30,
        calculation_order: 1,
        incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
      }
    ];

    // Proporcional de 15 dias de um salário de 3000
    const context = new PayrollContext({
      salario_base: 3000.00,
      dias_trabalhados: 15,
      rubricas: rubricas,
      eventos: [
        { rubric_id: 'r1', quantity: 15, origin: 'AUTOMATICA' }
      ]
    });

    const engine = new PayrollEngine(context);
    const result = await engine.run();

    // 3000 / 30 * 15 = 1500
    expect(result.total_proventos).toBe(1500.00);
    expect(result.bases.inss).toBe(1500.00);
    
    // Verifica Memória de Cálculo
    const mem = result.memoria_calculo.find(m => m.rubric_id === 'r1');
    expect(mem).toBeDefined();
    expect(mem?.result_value).toBe(1500.00);
  });

  it('deve deduzir Faltas Injustificadas e afetar Bases corretamente', async () => {
    const rubricas = [
      {
        id: 'r1',
        code: '101',
        name: 'Salário Base',
        type: 'EARNING',
        category: 'SALARY',
        calculation_form: 'DIAS',
        calculation_base: 'SALARIO_BASE',
        divisor: 30,
        calculation_order: 1,
        incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
      },
      {
        id: 'r2',
        code: '900',
        name: 'Faltas Injustificadas',
        type: 'DEDUCTION',
        category: 'OTHER',
        calculation_form: 'DIAS',
        calculation_base: 'SALARIO_BASE',
        divisor: 30,
        calculation_order: 10,
        // IMPORTANTE: Falta deve reduzir as bases do funcionário
        incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
      }
    ];

    const context = new PayrollContext({
      salario_base: 3000.00,
      dias_trabalhados: 30,
      rubricas: rubricas,
      eventos: [
        { rubric_id: 'r1', quantity: 30, origin: 'AUTOMATICA' },
        { rubric_id: 'r2', quantity: 2, origin: 'MANUAL' } // 2 dias de falta
      ]
    });

    const engine = new PayrollEngine(context);
    const result = await engine.run();

    expect(result.total_proventos).toBe(3000.00);
    expect(result.total_descontos).toBeGreaterThanOrEqual(200.00); // Faltas + INSS + IRRF
    
    const falta = result.memoria_calculo.find(m => m.rubric_id === 'r2');
    expect(falta?.result_value).toBe(200.00); // (3000 / 30) * 2 = 200

    // A Base INSS deve ser reduzida pela falta
    // Base Bruta = 3000 - 200 = 2800
    expect(result.bases.inss).toBe(2800.00);
  });
});
