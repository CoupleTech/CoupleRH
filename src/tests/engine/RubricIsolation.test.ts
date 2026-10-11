import { describe, it, expect } from 'vitest';
import { PayrollEngine } from '../../../supabase/functions/payroll-engine/engine/PayrollEngine';
import { PayrollContext, Rubric } from '../../../supabase/functions/payroll-engine/engine/PayrollContext';

describe('T2: Isolar Rubricas por Colaborador e Eliminar Vazamento entre Contratos (Doc §4)', () => {
  it('dois contratos seguidos com a mesma lista de rubricas: o DSR do segundo não herda o percentual do primeiro', async () => {
    // Array compartilhado de rubricas exatamente como retornado pelo banco
    const sharedRubrics: Rubric[] = [
      {
        id: 'r_salario',
        code: '101',
        name: 'Salário Base',
        type: 'EARNING',
        category: 'SALARY',
        calculation_form: 'FIXO',
        calculation_base: 'SALARIO_BASE',
        calculation_order: 10,
        incidencias: {
          inss: true, irrf: true, fgts: true, inss_patronal: true,
          rat: true, terceiros: true, gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true
        }
      },
      {
        id: 'r_dsr',
        code: '103',
        name: 'DSR sobre Horas Extras',
        type: 'EARNING',
        category: 'DSR',
        calculation_form: 'PERCENTUAL',
        calculation_base: 'BASE_DSR',
        percentage: undefined, // Não possui percentual fixo; deve ser derivado dos dias da competência
        calculation_order: 45,
        incidencias: {
          inss: true, irrf: true, fgts: true, inss_patronal: true,
          rat: true, terceiros: true, gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true
        }
      }
    ];

    // CONTRATO 1:
    // 20 dias úteis, 5 dias de repouso => percentual DSR = (5 / 20) * 100 = 25%
    const context1 = new PayrollContext({
      salario_base: 3000.00,
      dias_trabalhados: 30,
      dias_uteis: 20,
      dias_inuteis: 5,
      rubricas: sharedRubrics,
      eventos: [
        { rubric_id: 'r_salario', quantity: 1, origin: 'AUTOMATICA' },
        { rubric_id: 'r_dsr', quantity: 1, origin: 'MANUAL' }
      ]
    });
    context1.setVariable('BASE_DSR', 1000.00);

    const engine1 = new PayrollEngine(context1);
    const result1 = await engine1.run();

    const mem1 = result1.memoria_calculo.find(m => m.rubric_id === 'r_dsr');
    expect(mem1).toBeDefined();
    // 1000 * 25% = 250
    expect(mem1?.result_value).toBe(250.00);

    // CONTRATO 2 (mesmo período ou contrato subsequente):
    // 25 dias úteis, 4 dias de repouso => percentual DSR = (4 / 25) * 100 = 16%
    const context2 = new PayrollContext({
      salario_base: 4000.00,
      dias_trabalhados: 30,
      dias_uteis: 25,
      dias_inuteis: 4,
      rubricas: sharedRubrics,
      eventos: [
        { rubric_id: 'r_salario', quantity: 1, origin: 'AUTOMATICA' },
        { rubric_id: 'r_dsr', quantity: 1, origin: 'MANUAL' }
      ]
    });
    context2.setVariable('BASE_DSR', 1000.00);

    const engine2 = new PayrollEngine(context2);
    const result2 = await engine2.run();

    const mem2 = result2.memoria_calculo.find(m => m.rubric_id === 'r_dsr');
    expect(mem2).toBeDefined();
    // 1000 * 16% = 160 (Se herdasse o Contrato 1, daria 250!)
    expect(mem2?.result_value).toBe(160.00);

    // Assegurar que o array compartilhado original não foi mutado
    const originalDsr = sharedRubrics.find(r => r.code === '103');
    expect(originalDsr?.percentage).toBeUndefined();
  });
});
