import { describe, it, expect } from 'vitest';
import { PayrollEngine } from '../../../supabase/functions/payroll-engine/engine/PayrollEngine';
import { PayrollContext } from '../../../supabase/functions/payroll-engine/engine/PayrollContext';
import { defaultTestContextData } from '../fixtures/legalParameters';

describe('PayrollEngine - Folha de Adiantamento com Lançamentos Variáveis (Consignado/Deduções)', () => {
  it('deve processar rubrica 250 (Adiantamento) e deduzir lançamento variável de empréstimo consignado (cód 805)', async () => {
    const rubricas = [
      {
        id: 'rub-250',
        code: '250',
        name: 'Adiantamento Quinzenal',
        type: 'EARNING',
        category: 'SALARY',
        calculation_form: 'PERCENTUAL',
        calculation_base: 'SALARIO_BASE',
        percentage: 40,
        calculation_order: 1,
        incidencias: { gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
      },
      {
        id: 'rub-805',
        code: '805',
        name: 'Empréstimo Consignado',
        type: 'DEDUCTION',
        category: 'DEDUCTION',
        calculation_form: 'VALOR_FIXO',
        calculation_order: 10,
        incidencias: { gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
      }
    ];

    // Colaborador com salário base R$ 4.000,00 e adiantamento de 40% (R$ 1.600,00)
    // Lançamento variável de empréstimo consignado: R$ 180,00
    const context = new PayrollContext({
      ...defaultTestContextData,
      tipo_folha: 'ADVANCE',
      salario_base: 4000.00,
      rubricas: rubricas,
      eventos: [
        {
          rubric_id: 'rub-250',
          manual_value: 1600.00,
          quantity: 1,
          origin: 'PERCENTUAL'
        },
        {
          rubric_id: 'rub-805',
          manual_value: 180.00,
          quantity: 30,
          origin: 'MANUAL'
        }
      ]
    });

    const engine = new PayrollEngine(context);
    const result = await engine.run();

    // Validação de Proventos e Descontos
    expect(result.total_proventos).toBe(1600.00);
    expect(result.total_descontos).toBe(180.00);

    // Validação da Memória de Cálculo das Rubricas
    const memAdv = result.memoria_calculo.find(m => m.rubric_id === 'rub-250');
    expect(memAdv).toBeDefined();
    expect(memAdv?.result_value).toBe(1600.00);

    const memConsignado = result.memoria_calculo.find(m => m.rubric_id === 'rub-805');
    expect(memConsignado).toBeDefined();
    expect(memConsignado?.result_value).toBe(180.00);

    // Validação do Líquido: 1600 - 180 = 1420
    const liquido = result.total_proventos - result.total_descontos;
    expect(liquido).toBe(1420.00);
  });
});
