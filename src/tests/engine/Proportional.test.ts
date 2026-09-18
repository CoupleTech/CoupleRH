import { describe, it, expect } from 'vitest';
import { PayrollEngine } from '../../../supabase/functions/payroll-engine/engine/PayrollEngine';
import { PayrollContext } from '../../../supabase/functions/payroll-engine/engine/PayrollContext';

describe('PayrollEngine - Salário Proporcional', () => {
  it('Cenário 1: Salário proporcional de Admissão no meio do mês (15 dias trabalhados)', async () => {
    const rubricas = [
      {
        id: 'r1', code: '101', name: 'Salário Base',
        type: 'EARNING', category: 'SALARY', calculation_form: 'FIXO',
        calculation_base: 'SALARIO_BASE', divisor: 30, calculation_order: 1,
        incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
      }
    ];

    const context = new PayrollContext({
      salario_base: 3000.00,
      dias_trabalhados: 15,
      rubricas,
      eventos: [
        { rubric_id: 'r1', quantity: 1, origin: 'AUTOMATICA' }
      ]
    });

    const engine = new PayrollEngine(context);
    const result = await engine.run();

    // 3000 / 30 * 15 = 1500
    expect(result.total_proventos).toBe(1500.00);
    expect(result.bases.inss).toBe(1500.00);
    expect(result.bases.fgts).toBe(1500.00);
    
    const salarioMem = result.memoria_calculo.find(m => m.rubric_id === 'r1');
    expect(salarioMem?.result_value).toBe(1500.00);
    expect(salarioMem?.parsed_formula).toContain('FIXO(SALARIO_BASE)');
  });

  it('Cenário 2: Faltas Injustificadas reduzindo bases e salário', async () => {
    const rubricas = [
      {
        id: 'r1', code: '101', name: 'Salário Base',
        type: 'EARNING', category: 'SALARY', calculation_form: 'FIXO',
        calculation_base: 'SALARIO_BASE', divisor: 30, calculation_order: 1,
        incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
      },
      {
        id: 'r2', code: '900', name: 'Faltas Injustificadas',
        type: 'DEDUCTION', category: 'OTHER', calculation_form: 'DIAS',
        calculation_base: 'SALARIO_BASE', divisor: 30, calculation_order: 10,
        incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true } // Faltas reduzem as bases
      }
    ];

    const context = new PayrollContext({
      salario_base: 3000.00,
      dias_trabalhados: 30,
      rubricas,
      eventos: [
        { rubric_id: 'r1', quantity: 1, origin: 'AUTOMATICA' },
        { rubric_id: 'r2', quantity: 2, origin: 'MANUAL' } // 2 faltas
      ]
    });

    const engine = new PayrollEngine(context);
    const result = await engine.run();

    // Base = 3000
    // Falta = 3000 / 30 * 2 = 200
    expect(result.total_proventos).toBe(3000.00);
    
    const falta = result.memoria_calculo.find(m => m.rubric_id === 'r2');
    expect(falta?.result_value).toBe(200.00);
    
    // Base INSS/FGTS/IRRF = 3000 - 200 = 2800
    expect(result.bases.inss).toBe(2800.00);
    expect(result.bases.fgts).toBe(2800.00);
  });

  it('Cenário 3: Perda do DSR da semana por motivo de falta injustificada', async () => {
    const rubricas = [
      {
        id: 'r1', code: '101', name: 'Salário Base',
        type: 'EARNING', category: 'SALARY', calculation_form: 'FIXO',
        calculation_base: 'SALARIO_BASE', divisor: 30, calculation_order: 1,
        incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
      },
      {
        id: 'r2', code: '900', name: 'Faltas Injustificadas',
        type: 'DEDUCTION', category: 'OTHER', calculation_form: 'DIAS',
        calculation_base: 'SALARIO_BASE', divisor: 30, calculation_order: 10,
        incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
      },
      {
        id: 'r3', code: '901', name: 'DSR sobre Faltas',
        type: 'DEDUCTION', category: 'OTHER', calculation_form: 'DIAS',
        calculation_base: 'SALARIO_BASE', divisor: 30, calculation_order: 11,
        incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
      }
    ];

    const context = new PayrollContext({
      salario_base: 3000.00,
      dias_trabalhados: 30,
      rubricas,
      eventos: [
        { rubric_id: 'r1', quantity: 1, origin: 'AUTOMATICA' },
        { rubric_id: 'r2', quantity: 1, origin: 'MANUAL' }, // 1 falta
        { rubric_id: 'r3', quantity: 1, origin: 'AUTOMATICA' } // Perde 1 DSR
      ]
    });

    const engine = new PayrollEngine(context);
    const result = await engine.run();

    const falta = result.memoria_calculo.find(m => m.rubric_id === 'r2');
    const perdaDsr = result.memoria_calculo.find(m => m.rubric_id === 'r3');

    // 1 Falta = 100. 1 DSR = 100.
    expect(falta?.result_value).toBe(100.00);
    expect(perdaDsr?.result_value).toBe(100.00);

    // Base reduzida de 3000 - 100 - 100 = 2800
    expect(result.bases.inss).toBe(2800.00);
  });
});
