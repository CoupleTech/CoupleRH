import { describe, it, expect } from 'vitest';
import { PayrollEngine } from '../../../supabase/functions/payroll-engine/engine/PayrollEngine';
import { PayrollContext } from '../../../supabase/functions/payroll-engine/engine/PayrollContext';

describe('PayrollEngine - Férias', () => {
  it('Cenário 1: Pagamento de Férias Gozadas (30 dias) + 1/3 Constitucional', async () => {
    const rubricas = [
      {
        id: 'r1', code: '101', name: 'Salário Base', // Caso tenha saldo de salário, aqui seria 0
        type: 'EARNING', category: 'SALARY', calculation_form: 'FIXO',
        calculation_base: 'SALARIO_BASE', divisor: 30, calculation_order: 1,
        incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
      },
      {
        id: 'r2', code: '501', name: 'Férias Gozadas',
        type: 'EARNING', category: 'VACATION', calculation_form: 'DIAS',
        calculation_base: 'SALARIO_BASE', divisor: 30, calculation_order: 5,
        incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
      },
      {
        id: 'r3', code: '502', name: '1/3 Férias',
        type: 'EARNING', category: 'VACATION', calculation_form: 'PERCENTUAL',
        calculation_base: 'R501', percentage: 33.3333, calculation_order: 6,
        incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
      }
    ];

    const context = new PayrollContext({
      salario_base: 3000.00,
      dias_trabalhados: 0, // Mês inteiro de férias
      tipo_folha: 'VACATION',
      rubricas,
      eventos: [
        { rubric_id: 'r1', quantity: 0, origin: 'AUTOMATICA' },
        { rubric_id: 'r2', quantity: 30, origin: 'AUTOMATICA' },
        { rubric_id: 'r3', quantity: 1, origin: 'AUTOMATICA' }
      ]
    });

    const engine = new PayrollEngine(context);
    const result = await engine.run();

    // Salário base = 0 (proporcional a 0 dias trabalhados)
    // Férias = 3000.00
    // 1/3 Férias = 1000.00
    // Total = 4000.00
    expect(result.total_proventos).toBeCloseTo(4000.00, 2);
    expect(result.bases.inss).toBeCloseTo(4000.00, 2);

    const feriasMem = result.memoria_calculo.find(m => m.rubric_id === 'r2');
    expect(feriasMem?.result_value).toBe(3000.00);

    const tercoMem = result.memoria_calculo.find(m => m.rubric_id === 'r3');
    expect(tercoMem?.result_value).toBeCloseTo(1000.00, 2);
  });

  it('Cenário 2: Abono Pecuniário sem incidência de tributos', async () => {
    const rubricas = [
      {
        id: 'r1', code: '503', name: 'Abono Pecuniário de Férias',
        type: 'EARNING', category: 'VACATION', calculation_form: 'DIAS',
        calculation_base: 'SALARIO_BASE', divisor: 30, calculation_order: 5,
        // Abono não incide INSS, nem IRRF, nem FGTS
        incidencias: { gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
      },
      {
        id: 'r2', code: '504', name: '1/3 Abono Pecuniário',
        type: 'EARNING', category: 'VACATION', calculation_form: 'PERCENTUAL',
        calculation_base: 'R503', percentage: 33.3333, calculation_order: 6,
        incidencias: { gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
      }
    ];

    const context = new PayrollContext({
      salario_base: 3000.00,
      dias_trabalhados: 20, // Trabalhou 20 dias (vendeu 10)
      tipo_folha: 'VACATION',
      rubricas,
      eventos: [
        { rubric_id: 'r1', quantity: 10, origin: 'AUTOMATICA' },
        { rubric_id: 'r2', quantity: 1, origin: 'AUTOMATICA' }
      ]
    });

    const engine = new PayrollEngine(context);
    const result = await engine.run();

    // Abono = 3000 / 30 * 10 = 1000
    // 1/3 Abono = 1000 * 33.3333% = 333.33
    // Total = 1333.33
    expect(result.total_proventos).toBeCloseTo(1333.33, 2);
    
    // Bases devem ser 0
    expect(result.bases.inss).toBe(0);
    expect(result.bases.irrf).toBe(0);
    expect(result.bases.fgts).toBe(0);
  });

  it('Cenário 3: Desconto do Adiantamento de Férias na Folha Mensal', async () => {
    const rubricas = [
      {
        id: 'r1', code: '101', name: 'Salário Base',
        type: 'EARNING', category: 'SALARY', calculation_form: 'FIXO',
        calculation_base: 'SALARIO_BASE', divisor: 30, calculation_order: 1,
        incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
      },
      {
        id: 'r2', code: '550', name: 'Líquido de Férias (Adiantamento)',
        type: 'DEDUCTION', category: 'DEDUCTION', calculation_form: 'VALOR_MANUAL',
        calculation_base: null, calculation_order: 20,
        // É apenas um abatimento financeiro do que já foi pago. As bases legais já foram recolhidas no recibo de férias.
        incidencias: { gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
      }
    ];

    const context = new PayrollContext({
      salario_base: 3000.00,
      dias_trabalhados: 10, // Voltou de 20 dias de férias
      tipo_folha: 'MONTHLY',
      rubricas,
      eventos: [
        { rubric_id: 'r1', quantity: 1, origin: 'AUTOMATICA' },
        { rubric_id: 'r2', manual_value: 2000.00, origin: 'INTEGRATION' } // Desconta o valor bruto adiantado
      ]
    });

    const engine = new PayrollEngine(context);
    const result = await engine.run();

    // Saldo salário = 3000 / 30 * 10 = 1000
    expect(result.total_proventos).toBe(1000.00);
    
    // Desconto de adiantamento = 2000
    // Lógico que o líquido será negativo neste cenário isolado ou abatido nas férias descontadas (eventos de ajuste),
    // mas o teste foca em ver se o desconto manual_value entra.
    const adiantamentoMem = result.memoria_calculo.find(m => m.rubric_id === 'r2');
    expect(adiantamentoMem?.result_value).toBe(2000.00);
    expect(result.total_descontos).toBeGreaterThanOrEqual(2000.00);
  });
});
