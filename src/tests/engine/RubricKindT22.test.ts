import { describe, it, expect, vi } from 'vitest';
import { PayrollEngine } from '../../../supabase/functions/payroll-engine/engine/PayrollEngine';
import { PayrollContext, Rubric } from '../../../supabase/functions/payroll-engine/engine/PayrollContext';

describe('T22 - rubric_kind e Motor Orientado a Dados', () => {

  const baseLegalParams = {
    minimum_wage: 1518.00,
    dependent_deduction: 189.59,
    simplified_discount: 607.20,
    irrf_reduction_a: 5000.00,
    irrf_reduction_b: 7350.00
  };

  const baseInss = [
    { step_order: 1, base_limit: 1518.00, aliquot: 7.5 },
    { step_order: 2, base_limit: 8157.41, aliquot: 14.0 }
  ];

  const baseIrrf = [
    { step_order: 1, base_limit: 2259.20, aliquot: 0, deduction_amount: 0 },
    { step_order: 2, base_limit: null, aliquot: 27.5, deduction_amount: 896.00 }
  ];

  it('deve processar Salário Base orientado por rubric_kind === SALARY_BASE (sem depender de category)', async () => {
    const rubricas: Rubric[] = [
      {
        id: 'r1',
        code: '101',
        name: 'Vencimento Base Personalizado',
        type: 'EARNING',
        category: 'CUSTOM_CATEGORY', // Não é 'SALARY'
        rubric_kind: 'SALARY_BASE',
        calculation_form: 'FIXO',
        calculation_order: 10,
        is_active: true,
        incidencias: {
          inss: true, irrf: true, fgts: true,
          inss_patronal: true, rat: true, terceiros: true,
          gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true
        }
      },
      {
        id: 'r_inss', code: '901', name: 'INSS', type: 'DEDUCTION', category: 'TAX',
        rubric_kind: 'INSS', calculation_form: 'AUTOMATICA', calculation_order: 90, is_active: true,
        incidencias: { inss: false, irrf: false, fgts: false, inss_patronal: false, rat: false, terceiros: false, gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
      },
      {
        id: 'r_irrf', code: '902', name: 'IRRF', type: 'DEDUCTION', category: 'TAX',
        rubric_kind: 'IRRF', calculation_form: 'AUTOMATICA', calculation_order: 91, is_active: true,
        incidencias: { inss: false, irrf: false, fgts: false, inss_patronal: false, rat: false, terceiros: false, gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
      },
      {
        id: 'r_fgts', code: '903', name: 'FGTS', type: 'BASE', category: 'TAX',
        rubric_kind: 'FGTS', calculation_form: 'AUTOMATICA', calculation_order: 92, is_active: true,
        incidencias: { inss: false, irrf: false, fgts: false, inss_patronal: false, rat: false, terceiros: false, gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
      }
    ];

    // Contrato proporcional de 15 dias trabalhados
    const context = new PayrollContext({
      salario_base: 3000.00,
      tipo_folha: 'MONTHLY',
      dias_trabalhados: 15,
      rubricas,
      inss_parameters: baseInss,
      irrf_parameters: baseIrrf,
      general_legal_parameters: baseLegalParams
    });

    const engine = new PayrollEngine(context);
    const result = await engine.run();

    expect(result.status).toBe('CALCULADA');
    // Salário base proporcional de 15 dias: (3000 / 30) * 15 = 1500
    expect(result.total_proventos).toBe(1500.00);
  });

  it('deve distinguir com precedência estrita ADIC_NOTURNO de DSR_NOTURNO', async () => {
    const rubricas: Rubric[] = [
      {
        id: 'r1', code: '101', name: 'Salário Base', type: 'EARNING', category: 'SALARY',
        rubric_kind: 'SALARY_BASE', calculation_form: 'FIXO', calculation_order: 10, is_active: true,
        incidencias: { inss: true, irrf: true, fgts: true, inss_patronal: true, rat: true, terceiros: true, gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
      },
      {
        id: 'r2', code: '301', name: 'Adicional Noturno 20%', type: 'EARNING', category: 'ALLOWANCE',
        rubric_kind: 'ADIC_NOTURNO', calculation_form: 'HORAS', factor: 0.20, divisor: 220, calculation_order: 20, is_active: true,
        incidencias: { inss: true, irrf: true, fgts: true, inss_patronal: true, rat: true, terceiros: true, gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
      },
      {
        id: 'r3', code: '171', name: 'DSR sobre Adicional Noturno', type: 'EARNING', category: 'SALARY',
        rubric_kind: 'DSR_NOTURNO', calculation_form: 'PERCENTUAL', percentage: 25, calculation_order: 30, is_active: true,
        incidencias: { inss: true, irrf: true, fgts: true, inss_patronal: true, rat: true, terceiros: true, gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
      },
      {
        id: 'r_inss', code: '901', name: 'INSS', type: 'DEDUCTION', category: 'TAX',
        rubric_kind: 'INSS', calculation_form: 'AUTOMATICA', calculation_order: 90, is_active: true,
        incidencias: { inss: false, irrf: false, fgts: false, inss_patronal: false, rat: false, terceiros: false, gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
      },
      {
        id: 'r_irrf', code: '902', name: 'IRRF', type: 'DEDUCTION', category: 'TAX',
        rubric_kind: 'IRRF', calculation_form: 'AUTOMATICA', calculation_order: 91, is_active: true,
        incidencias: { inss: false, irrf: false, fgts: false, inss_patronal: false, rat: false, terceiros: false, gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
      },
      {
        id: 'r_fgts', code: '903', name: 'FGTS', type: 'BASE', category: 'TAX',
        rubric_kind: 'FGTS', calculation_form: 'AUTOMATICA', calculation_order: 92, is_active: true,
        incidencias: { inss: false, irrf: false, fgts: false, inss_patronal: false, rat: false, terceiros: false, gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
      }
    ];

    const context = new PayrollContext({
      salario_base: 2200.00,
      tipo_folha: 'MONTHLY',
      dias_trabalhados: 30,
      dias_uteis: 24,
      dias_inuteis: 6, // 6/24 = 25%
      rubricas,
      eventos: [
        { id: 'ev2', rubric_id: 'r2', quantity: 20, origin: 'VARIABLE' } // 20 horas noturnas
      ],
      inss_parameters: baseInss,
      irrf_parameters: baseIrrf,
      general_legal_parameters: baseLegalParams
    });

    const engine = new PayrollEngine(context);
    const result = await engine.run();

    expect(result.status).toBe('CALCULADA');

    // Valor hora = 2200 / 220 = 10,00
    // Adicional noturno = 10 * 0.20 * 20 = 40,00
    const memNoturno = result.memoria_calculo.find(m => m.rubric_id === 'r2');
    expect(memNoturno?.result_value).toBe(40.00);

    // DSR sobre Noturno (25% de 40,00) = 10,00
    const memDsr = result.memoria_calculo.find(m => m.rubric_id === 'r3');
    expect(memDsr?.result_value).toBe(10.00);
  });

  it('NÃO deve tratar rubrica do tipo DEDUCTION como hora extra mesmo se tiver nome ou categoria de hora extra', async () => {
    const rubricas: Rubric[] = [
      {
        id: 'r1', code: '101', name: 'Salário Base', type: 'EARNING', category: 'SALARY',
        rubric_kind: 'SALARY_BASE', calculation_form: 'FIXO', calculation_order: 10, is_active: true,
        incidencias: { inss: true, irrf: true, fgts: true, inss_patronal: true, rat: true, terceiros: true, gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
      },
      {
        id: 'r_desc_he', code: '899', name: 'Estorno Hora Extra Pago a Maior', type: 'DEDUCTION',
        category: 'OVERTIME', rubric_kind: 'OTHER', calculation_form: 'FIXO', calculation_order: 25, is_active: true,
        incidencias: { inss: true, irrf: true, fgts: true, inss_patronal: true, rat: true, terceiros: true, gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
      },
      {
        id: 'r_inss', code: '901', name: 'INSS', type: 'DEDUCTION', category: 'TAX',
        rubric_kind: 'INSS', calculation_form: 'AUTOMATICA', calculation_order: 90, is_active: true,
        incidencias: { inss: false, irrf: false, fgts: false, inss_patronal: false, rat: false, terceiros: false, gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
      },
      {
        id: 'r_irrf', code: '902', name: 'IRRF', type: 'DEDUCTION', category: 'TAX',
        rubric_kind: 'IRRF', calculation_form: 'AUTOMATICA', calculation_order: 91, is_active: true,
        incidencias: { inss: false, irrf: false, fgts: false, inss_patronal: false, rat: false, terceiros: false, gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
      },
      {
        id: 'r_fgts', code: '903', name: 'FGTS', type: 'BASE', category: 'TAX',
        rubric_kind: 'FGTS', calculation_form: 'AUTOMATICA', calculation_order: 92, is_active: true,
        incidencias: { inss: false, irrf: false, fgts: false, inss_patronal: false, rat: false, terceiros: false, gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
      }
    ];

    const context = new PayrollContext({
      salario_base: 3000.00,
      tipo_folha: 'MONTHLY',
      dias_trabalhados: 30,
      rubricas,
      eventos_fixos: [
        { id: 'ev1', rubric_id: 'r_desc_he', manual_value: 100.00, origin: 'FIXED' }
      ],
      inss_parameters: baseInss,
      irrf_parameters: baseIrrf,
      general_legal_parameters: baseLegalParams
    });

    const engine = new PayrollEngine(context);
    const result = await engine.run();

    expect(result.status).toBe('CALCULADA');
    // Não deve alimentar BASE_DSR com rubrica de desconto
    expect(context.getVariable('BASE_DSR') || 0).toBe(0);
    // Total de proventos permanece 3000 e desconto inclui os 100
    expect(result.total_proventos).toBe(3000.00);
    expect(result.total_descontos).toBeGreaterThanOrEqual(100.00);
  });

  it('deve emitir console.warn como fallback quando rubric_kind não estiver definido', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const rubricas: Rubric[] = [
      {
        id: 'r1', code: '101', name: 'Salário Base', type: 'EARNING', category: 'SALARY',
        // rubric_kind ausente (legado)
        calculation_form: 'FIXO', calculation_order: 10, is_active: true,
        incidencias: { inss: true, irrf: true, fgts: true, inss_patronal: true, rat: true, terceiros: true, gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
      },
      {
        id: 'r_inss', code: '901', name: 'INSS', type: 'DEDUCTION', category: 'TAX',
        rubric_kind: 'INSS', calculation_form: 'AUTOMATICA', calculation_order: 90, is_active: true,
        incidencias: { inss: false, irrf: false, fgts: false, inss_patronal: false, rat: false, terceiros: false, gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
      },
      {
        id: 'r_irrf', code: '902', name: 'IRRF', type: 'DEDUCTION', category: 'TAX',
        rubric_kind: 'IRRF', calculation_form: 'AUTOMATICA', calculation_order: 91, is_active: true,
        incidencias: { inss: false, irrf: false, fgts: false, inss_patronal: false, rat: false, terceiros: false, gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
      },
      {
        id: 'r_fgts', code: '903', name: 'FGTS', type: 'BASE', category: 'TAX',
        rubric_kind: 'FGTS', calculation_form: 'AUTOMATICA', calculation_order: 92, is_active: true,
        incidencias: { inss: false, irrf: false, fgts: false, inss_patronal: false, rat: false, terceiros: false, gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
      }
    ];

    const context = new PayrollContext({
      salario_base: 2000.00,
      tipo_folha: 'MONTHLY',
      dias_trabalhados: 30,
      rubricas,
      inss_parameters: baseInss,
      irrf_parameters: baseIrrf,
      general_legal_parameters: baseLegalParams
    });

    const engine = new PayrollEngine(context);
    await engine.run();

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('rubric_kind não definido'));
    warnSpy.mockRestore();
  });
});
