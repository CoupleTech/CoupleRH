import { describe, it, expect } from 'vitest';
import { PayrollEngine } from '../../../supabase/functions/payroll-engine/engine/PayrollEngine';
import { PayrollContext } from '../../../supabase/functions/payroll-engine/engine/PayrollContext';
import { defaultTestContextData } from '../fixtures/legalParameters';

describe('PayrollEngine - Fluxo Completo de Empréstimo Consignado (Provisão Vale e Fechamento Mensal)', () => {
  const rubricasCatalogo = [
    {
      id: 'rub-101',
      code: '101',
      name: 'Salário Base',
      type: 'EARNING',
      category: 'SALARY',
      rubric_kind: 'SALARY_BASE',
      calculation_form: 'FIXO',
      calculation_base: 'SALARIO_BASE',
      calculation_order: 10,
      incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
    },
    {
      id: 'rub-250',
      code: '250',
      name: 'Adiantamento Quinzenal',
      type: 'EARNING',
      category: 'ADVANCE',
      rubric_kind: 'ADVANCE',
      calculation_form: 'PERCENTUAL',
      calculation_base: 'SALARIO_BASE',
      percentage: 40,
      calculation_order: 15,
      incidencias: { gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
    },
    {
      id: 'rub-807',
      code: '807',
      name: 'Provisão Consignado Adiantamento',
      type: 'DEDUCTION',
      category: 'OTHER',
      rubric_kind: 'LOAN',
      calculation_form: 'FIXO',
      calculation_order: 85,
      incidencias: { gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
    },
    {
      id: 'rub-850',
      code: '850',
      name: 'Desconto de Adiantamento',
      type: 'DEDUCTION',
      category: 'ADVANCE',
      rubric_kind: 'ADVANCE',
      calculation_form: 'MANUAL',
      calculation_order: 85,
      incidencias: { gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
    },
    {
      id: 'rub-407',
      code: '407',
      name: 'Estorno Provisão Consignado',
      type: 'EARNING',
      category: 'OTHER',
      rubric_kind: 'LOAN',
      calculation_form: 'FIXO',
      calculation_order: 40,
      incidencias: { gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
    },
    {
      id: 'rub-805',
      code: '805',
      name: 'Empréstimo Consignado',
      type: 'DEDUCTION',
      category: 'OTHER',
      rubric_kind: 'LOAN',
      calculation_form: 'FIXO',
      calculation_order: 80,
      incidencias: { gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
    },
    {
      id: 'rub-901',
      code: '901',
      name: 'Contribuição INSS',
      type: 'DEDUCTION',
      category: 'TAX',
      rubric_kind: 'INSS',
      calculation_form: 'AUTOMATICA',
      calculation_order: 90,
      incidencias: { gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
    },
    {
      id: 'rub-902',
      code: '902',
      name: 'IRRF Mensal',
      type: 'DEDUCTION',
      category: 'TAX',
      rubric_kind: 'IRRF',
      calculation_form: 'AUTOMATICA',
      calculation_order: 95,
      incidencias: { gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
    },
    {
      id: 'rub-903',
      code: '903',
      name: 'FGTS Mensal',
      type: 'BASE',
      category: 'TAX',
      rubric_kind: 'FGTS',
      calculation_form: 'AUTOMATICA',
      calculation_order: 50,
      incidencias: { gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
    }
  ];

  it('Etapa 1: Deve calcular o Adiantamento retendo a provisão de 40% da parcela do consignado (rubrica 807)', async () => {
    // Salário R$ 4.000,00 | Vale 40% = R$ 1.600,00 | Parcela Total = R$ 450,00 | Provisão 40% = R$ 180,00
    const context = new PayrollContext({
      ...defaultTestContextData,
      tipo_folha: 'ADVANCE',
      salario_base: 4000.00,
      rubricas: rubricasCatalogo.filter(r => ['250', '807'].includes(r.code)),
      eventos: [
        {
          rubric_id: 'rub-250',
          manual_value: 1600.00,
          quantity: 1,
          origin: 'PERCENTUAL'
        },
        {
          rubric_id: 'rub-807',
          manual_value: 180.00,
          quantity: 1,
          origin: 'PROVISION'
        }
      ]
    });

    const engine = new PayrollEngine(context);
    const result = await engine.run();

    expect(result.total_proventos).toBe(1600.00);
    expect(result.total_descontos).toBe(180.00);
    const liquidoVale = result.total_proventos - result.total_descontos;
    expect(liquidoVale).toBe(1420.00);

    const mem807 = result.memoria_calculo.find(m => m.rubric_id === 'rub-807');
    expect(mem807).toBeDefined();
    expect(mem807?.result_value).toBe(180.00);
  });

  it('Etapa 2: No fechamento Mensal, deve estornar a provisão (rubrica 407) e aplicar o desconto integral (rubrica 805)', async () => {
    // Salário R$ 4.000,00
    // + Estorno Provisão Consignado: R$ 180,00 (rubrica 407)
    // - Desconto Adiantamento: R$ 1.600,00 (rubrica 850)
    // - Desconto Integral Consignado: R$ 450,00 (rubrica 805)
    const context = new PayrollContext({
      ...defaultTestContextData,
      tipo_folha: 'MONTHLY',
      salario_base: 4000.00,
      rubricas: rubricasCatalogo.filter(r => ['101', '407', '850', '805', '901', '902', '903'].includes(r.code)),
      eventos: [
        {
          rubric_id: 'rub-101',
          manual_value: 0,
          quantity: 30,
          origin: 'BASE'
        },
        {
          rubric_id: 'rub-407',
          manual_value: 180.00,
          quantity: 1,
          origin: 'ESTORNO_PROVISAO'
        },
        {
          rubric_id: 'rub-850',
          manual_value: 1600.00,
          quantity: 1,
          origin: 'DESCONTO_VALE'
        },
        {
          rubric_id: 'rub-805',
          manual_value: 450.00,
          quantity: 1,
          origin: 'CONSIGNADO'
        }
      ]
    });

    const engine = new PayrollEngine(context);
    const result = await engine.run();

    // Proventos: 4000 (Salário) + 180 (Estorno da Provisão) = 4180
    expect(result.total_proventos).toBe(4180.00);

    // Descontos sem impostos: 1600 (Adiantamento) + 450 (Consignado Cheio) = 2050
    // Descontos com impostos: 2050 + INSS + IRRF
    const item850 = result.memoria_calculo.find(i => i.rubric_id === 'rub-850');
    expect(item850?.result_value).toBe(1600.00);

    const item805 = result.memoria_calculo.find(i => i.rubric_id === 'rub-805');
    expect(item805?.result_value).toBe(450.00);

    const item407 = result.memoria_calculo.find(i => i.rubric_id === 'rub-407');
    expect(item407?.result_value).toBe(180.00);

    // Balanço financeiro do colaborador somando Vale + Mensal (antes dos impostos de INSS/IRRF):
    // Recebido no vale: 1420
    // Salário bruto gerado no mês: 4000
    // Desconto total de consignado sofrido no mês: 450 (180 no vale + (450 - 180) no mensal)
    // Líquido antes de impostos: 4000 - 450 = 3550
    const saldoMensalAntesImpostos = result.total_proventos - 1600.00 - 450.00;
    expect(1420.00 + saldoMensalAntesImpostos).toBe(3550.00);
  });
});
