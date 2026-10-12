import { describe, it, expect } from 'vitest';
import { PayrollEngine } from '../../../supabase/functions/payroll-engine/engine/PayrollEngine';
import { PayrollContext, Rubric } from '../../../supabase/functions/payroll-engine/engine/PayrollContext';
import { defaultTestContextData, standardSystemRubrics } from '../fixtures/legalParameters';

// Função auxiliar que replica a apuração de dias úteis e repousos de uma competência (sem normalização artificial)
export function calculateMonthDays(year: number, month: number, holidays: string[] = []): { dias_uteis: number; dias_inuteis: number } {
  const holidaysSet = new Set(holidays);
  let dias_uteis = 0;
  let dias_inuteis = 0;
  const daysInMonth = new Date(year, month, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    if (d.getDay() === 0 || holidaysSet.has(dateStr)) {
      dias_inuteis++;
    } else {
      dias_uteis++;
    }
  }

  return { dias_uteis, dias_inuteis };
}

describe('T4: DSR com Dias Reais e Remoção da Normalização para 30 Dias (Doc §4)', () => {
  const rubricas: Rubric[] = [
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
      calculation_order: 45,
      incidencias: {
        inss: true, irrf: true, fgts: true, inss_patronal: true,
        rat: true, terceiros: true, gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true
      }
    },
    ...(standardSystemRubrics as any)
  ];

  it('1. Fev/2026: deve apurar 24 dias úteis e 4 domingos reais (sem normalização para 26)', () => {
    const { dias_uteis, dias_inuteis } = calculateMonthDays(2026, 2);
    expect(dias_inuteis).toBe(4);
    expect(dias_uteis).toBe(24);
    // 24 + 4 = 28 dias reais de fevereiro (não 30)
    expect(dias_uteis + dias_inuteis).toBe(28);
  });

  it('2. Fev/2026: percentual de DSR deve ser 16,67% (4 / 24) e valor do DSR R$ 166,67 para base R$ 1.000', async () => {
    const { dias_uteis, dias_inuteis } = calculateMonthDays(2026, 2);
    
    const context = new PayrollContext({
      ...defaultTestContextData,
      competencia: '02/2026',
      salario_base: 3000.00,
      dias_trabalhados: 30, // Proporcionalidade salarial padrão DP mantida em base 30
      dias_uteis,
      dias_inuteis,
      rubricas,
      eventos: [
        { rubric_id: 'r_salario', quantity: 1, origin: 'AUTOMATICA' },
        { rubric_id: 'r_dsr', quantity: 1, origin: 'MANUAL' }
      ]
    });
    context.setVariable('BASE_DSR', 1000.00);

    const engine = new PayrollEngine(context);
    const result = await engine.run();

    const memDsr = result.memoria_calculo.find(m => m.rubric_id === 'r_dsr');
    expect(memDsr).toBeDefined();

    // Aceite oficial Doc §4: 4 domingos / 24 úteis = 16,67%
    expect(memDsr?.percentage_used).toBeCloseTo(16.6667, 2);
    expect(memDsr?.result_value).toBeCloseTo(166.67, 2);
  });

  it('3. Mar/2026: deve apurar 26 dias úteis e 5 domingos reais (sem normalização para 25)', () => {
    const { dias_uteis, dias_inuteis } = calculateMonthDays(2026, 3);
    expect(dias_inuteis).toBe(5);
    expect(dias_uteis).toBe(26);
    // 26 + 5 = 31 dias reais de março (não 30)
    expect(dias_uteis + dias_inuteis).toBe(31);
  });

  it('4. Mar/2026: percentual de DSR deve ser 19,23% (5 / 26) e valor do DSR R$ 192,31 para base R$ 1.000', async () => {
    const { dias_uteis, dias_inuteis } = calculateMonthDays(2026, 3);

    const context = new PayrollContext({
      ...defaultTestContextData,
      competencia: '03/2026',
      salario_base: 3000.00,
      dias_trabalhados: 30,
      dias_uteis,
      dias_inuteis,
      rubricas,
      eventos: [
        { rubric_id: 'r_salario', quantity: 1, origin: 'AUTOMATICA' },
        { rubric_id: 'r_dsr', quantity: 1, origin: 'MANUAL' }
      ]
    });
    context.setVariable('BASE_DSR', 1000.00);

    const engine = new PayrollEngine(context);
    const result = await engine.run();

    const memDsr = result.memoria_calculo.find(m => m.rubric_id === 'r_dsr');
    expect(memDsr).toBeDefined();

    // Aceite oficial Doc §4: 5 domingos / 26 úteis = 19,23%
    expect(memDsr?.percentage_used).toBeCloseTo(19.2308, 2);
    expect(memDsr?.result_value).toBeCloseTo(192.31, 2);
  });
});
