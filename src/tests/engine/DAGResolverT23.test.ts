import { describe, it, expect } from 'vitest';
import { DAGResolver, CircularDependencyException } from '../../../supabase/functions/payroll-engine/rubrics/DAGResolver';
import { Rubric, PayrollContext } from '../../../supabase/functions/payroll-engine/engine/PayrollContext';
import { PayrollEngine } from '../../../supabase/functions/payroll-engine/engine/PayrollEngine';

function createMockRubric(partial: Partial<Rubric> & { id: string; code: string; name: string }): Rubric {
  return {
    id: partial.id,
    code: partial.code,
    name: partial.name,
    type: partial.type ?? 'EARNING',
    rubric_kind: partial.rubric_kind ?? 'OTHER',
    category: partial.category ?? 'OTHER',
    calculation_base: partial.calculation_base ?? null,
    calculation_form: partial.calculation_form ?? 'VALOR_FIXO',
    factor: partial.factor ?? 1,
    percentage: partial.percentage ?? null,
    divisor: partial.divisor ?? 220,
    formula: partial.formula ?? null,
    calculation_order: partial.calculation_order,
    incidencias: partial.incidencias ?? {
      gera_base_inss: false,
      gera_base_irrf: false,
      gera_base_fgts: false,
    },
  };
}

describe('T23: DAGResolver — Resolução de Dependências e Ordenação Topológica', () => {
  it('Critério de Aceite Principal: DSR com calculation_order menor que o da HE é calculado depois dela', () => {
    const rubricasMap = new Map<string, Rubric>();

    const rSalario = createMockRubric({
      id: 'sal-1',
      code: '101',
      name: 'Salário Base',
      rubric_kind: 'SALARY_BASE',
      calculation_order: 1,
    });

    const rDSR = createMockRubric({
      id: 'dsr-1',
      code: '104',
      name: 'DSR sobre Horas Extras',
      rubric_kind: 'DSR',
      calculation_base: 'BASE_DSR',
      calculation_order: 10, // Menor que o da HE de propósito
    });

    const rHE = createMockRubric({
      id: 'he-1',
      code: '201',
      name: 'Horas Extras 50%',
      rubric_kind: 'OVERTIME',
      calculation_order: 50, // Maior que o do DSR de propósito
    });

    rubricasMap.set(rSalario.id, rSalario);
    rubricasMap.set(rDSR.id, rDSR);
    rubricasMap.set(rHE.id, rHE);

    const resolved = DAGResolver.resolve(rubricasMap);
    const codes = resolved.map(r => r.code);

    // HE deve vir obrigatoriamente ANTES do DSR
    const heIndex = codes.indexOf('201');
    const dsrIndex = codes.indexOf('104');

    expect(heIndex).toBeGreaterThanOrEqual(0);
    expect(dsrIndex).toBeGreaterThanOrEqual(0);
    expect(heIndex).toBeLessThan(dsrIndex);
  });

  it('deve resolver dependência de BASE_DSR_NOTURNO sobre ADIC_NOTURNO mesmo com ordem invertida', () => {
    const rubricasMap = new Map<string, Rubric>();

    const rDsrNoturno = createMockRubric({
      id: 'dsr-not-1',
      code: '105',
      name: 'DSR Noturno',
      rubric_kind: 'DSR_NOTURNO',
      calculation_base: 'BASE_DSR_NOTURNO',
      calculation_order: 5,
    });

    const rAdicNoturno = createMockRubric({
      id: 'adic-not-1',
      code: '301',
      name: 'Adicional Noturno 20%',
      rubric_kind: 'ADIC_NOTURNO',
      calculation_order: 40,
    });

    rubricasMap.set(rDsrNoturno.id, rDsrNoturno);
    rubricasMap.set(rAdicNoturno.id, rAdicNoturno);

    const resolved = DAGResolver.resolve(rubricasMap);
    const codes = resolved.map(r => r.code);

    expect(codes.indexOf('301')).toBeLessThan(codes.indexOf('105'));
  });

  it('deve resolver dependência de BASE_HORA_EXTRA sobre adicionais habituais (Insalubridade e Periculosidade)', () => {
    const rubricasMap = new Map<string, Rubric>();

    const rHE = createMockRubric({
      id: 'he-1',
      code: '201',
      name: 'Horas Extras 50%',
      rubric_kind: 'OVERTIME',
      calculation_base: 'BASE_HORA_EXTRA',
      calculation_order: 10,
    });

    const rPeric = createMockRubric({
      id: 'peric-1',
      code: '151',
      name: 'Adicional de Periculosidade',
      rubric_kind: 'PERICULOSIDADE',
      calculation_order: 30,
    });

    const rInsal = createMockRubric({
      id: 'insal-1',
      code: '150',
      name: 'Adicional de Insalubridade',
      rubric_kind: 'INSALUBRIDADE',
      calculation_order: 35,
    });

    rubricasMap.set(rHE.id, rHE);
    rubricasMap.set(rPeric.id, rPeric);
    rubricasMap.set(rInsal.id, rInsal);

    const resolved = DAGResolver.resolve(rubricasMap);
    const codes = resolved.map(r => r.code);

    expect(codes.indexOf('151')).toBeLessThan(codes.indexOf('201'));
    expect(codes.indexOf('150')).toBeLessThan(codes.indexOf('201'));
  });

  it('deve resolver dependências extraídas da fórmula com prefixo R e com código numérico', () => {
    const rubricasMap = new Map<string, Rubric>();

    const rGratificacao = createMockRubric({
      id: 'grat-1',
      code: '120',
      name: 'Gratificação Especial',
      calculation_order: 80,
    });

    const rPremio = createMockRubric({
      id: 'prem-1',
      code: '125',
      name: 'Prêmio por Desempenho',
      formula: 'R120 * 0.5', // Usa R120
      calculation_order: 20, // Menor que o da gratificação
    });

    const rComplemento = createMockRubric({
      id: 'comp-1',
      code: '130',
      name: 'Complemento Salarial',
      formula: '125 + 50', // Usa 125 diretamente como código de rubrica
      calculation_order: 10,
    });

    rubricasMap.set(rGratificacao.id, rGratificacao);
    rubricasMap.set(rPremio.id, rPremio);
    rubricasMap.set(rComplemento.id, rComplemento);

    const resolved = DAGResolver.resolve(rubricasMap);
    const codes = resolved.map(r => r.code);

    expect(codes.indexOf('120')).toBeLessThan(codes.indexOf('125'));
    expect(codes.indexOf('125')).toBeLessThan(codes.indexOf('130'));
  });

  it('deve ordenar deterministicamente por calculation_order e desempate por code para rubricas independentes', () => {
    const rubricasMap = new Map<string, Rubric>();

    const rB = createMockRubric({
      id: 'b-1',
      code: '200',
      name: 'Rubrica B',
      calculation_order: 50,
    });

    const rA = createMockRubric({
      id: 'a-1',
      code: '100',
      name: 'Rubrica A',
      calculation_order: 10,
    });

    const rC2 = createMockRubric({
      id: 'c2-1',
      code: '302',
      name: 'Rubrica C2',
      calculation_order: 50,
    });

    const rC1 = createMockRubric({
      id: 'c1-1',
      code: '301',
      name: 'Rubrica C1',
      calculation_order: 50,
    });

    const rSemOrdem = createMockRubric({
      id: 'z-1',
      code: '999',
      name: 'Rubrica Sem Ordem',
      calculation_order: undefined, // Deve usar fallback 100
    });

    rubricasMap.set(rB.id, rB);
    rubricasMap.set(rA.id, rA);
    rubricasMap.set(rC2.id, rC2);
    rubricasMap.set(rC1.id, rC1);
    rubricasMap.set(rSemOrdem.id, rSemOrdem);

    const resolved = DAGResolver.resolve(rubricasMap);
    const codes = resolved.map(r => r.code);

    // 100 vem primeiro (order 10)
    expect(codes[0]).toBe('100');
    // Entre as de ordem 50 (200, 301, 302), desempate por code
    expect(codes[1]).toBe('200');
    expect(codes[2]).toBe('301');
    expect(codes[3]).toBe('302');
    // Ordem undefined (100) fica por último
    expect(codes[4]).toBe('999');
  });

  it('deve lançar CircularDependencyException detalhando código e nome de todas as rubricas no ciclo', () => {
    const rubricasMap = new Map<string, Rubric>();

    const rA = createMockRubric({
      id: 'a-1',
      code: '110',
      name: 'Rubrica Alfa',
      formula: 'R120 * 2',
    });

    const rB = createMockRubric({
      id: 'b-1',
      code: '120',
      name: 'Rubrica Beta',
      formula: 'R130 + 10',
    });

    const rC = createMockRubric({
      id: 'c-1',
      code: '130',
      name: 'Rubrica Gama',
      formula: 'R110 - 5',
    });

    rubricasMap.set(rA.id, rA);
    rubricasMap.set(rB.id, rB);
    rubricasMap.set(rC.id, rC);

    expect(() => DAGResolver.resolve(rubricasMap)).toThrowError(CircularDependencyException);

    try {
      DAGResolver.resolve(rubricasMap);
    } catch (err: any) {
      expect(err.message).toContain('110');
      expect(err.message).toContain('Rubrica Alfa');
      expect(err.message).toContain('120');
      expect(err.message).toContain('Rubrica Beta');
      expect(err.message).toContain('130');
      expect(err.message).toContain('Rubrica Gama');
    }
  });

  it('deve integrar com PayrollEngine calculando HE antes de DSR quando DSR tem calculation_order menor', async () => {
    const rubricas: Rubric[] = [
      createMockRubric({
        id: 'sal-1',
        code: '101',
        name: 'Salário Base',
        rubric_kind: 'SALARY_BASE',
        calculation_order: 1,
      }),
      createMockRubric({
        id: 'dsr-1',
        code: '104',
        name: 'DSR s/ Horas Extras',
        rubric_kind: 'DSR',
        calculation_form: 'PERCENTUAL',
        calculation_base: 'BASE_DSR',
        percentage: 20, // 20%
        calculation_order: 5, // menor que a HE de propósito
      }),
      createMockRubric({
        id: 'he-1',
        code: '201',
        name: 'Horas Extras 50%',
        rubric_kind: 'OVERTIME',
        calculation_form: 'HORAS',
        calculation_base: 'SALARIO_BASE',
        factor: 1.5,
        calculation_order: 50,
      }),
      createMockRubric({
        id: 'inss-1',
        code: '901',
        name: 'INSS',
        rubric_kind: 'INSS',
        type: 'DEDUCTION',
        calculation_order: 901,
      }),
      createMockRubric({
        id: 'irrf-1',
        code: '902',
        name: 'IRRF',
        rubric_kind: 'IRRF',
        type: 'DEDUCTION',
        calculation_order: 902,
      }),
      createMockRubric({
        id: 'fgts-1',
        code: '903',
        name: 'FGTS',
        rubric_kind: 'FGTS',
        type: 'BASE',
        calculation_order: 903,
      }),
    ];

    const ctx = new PayrollContext({
      contrato_id: 'cont-1',
      salario_base: 2200,
      dias_trabalhados: 30,
      dias_uteis: 25,
      dias_inuteis: 5,
      divisor: 220,
      salario_minimo: 1621.00,
      rubricas,
      eventos: [
        { rubric_id: 'sal-1', quantity: 30 },
        { rubric_id: 'he-1', quantity: 10 }, // 10 horas extras a 50%: (2200 / 220) * 1.5 * 10 = 150.00
      ],
      inss_parameters: [
        { bracket_order: 1, limit_value: 1621.00, rate: 0.075, deduction: 0 },
        { bracket_order: 2, limit_value: 2902.84, rate: 0.09, deduction: 24.315 },
        { bracket_order: 3, limit_value: 4354.27, rate: 0.12, deduction: 111.4002 },
        { bracket_order: 4, limit_value: 8475.55, rate: 0.14, deduction: 198.4856 },
      ],
      irrf_parameters: [
        { bracket_order: 1, base_limit: 2428.80, rate: 0, deduction: 0 },
        { bracket_order: 2, base_limit: 2826.65, rate: 0.075, deduction: 182.16 },
        { bracket_order: 3, base_limit: 3751.05, rate: 0.15, deduction: 394.16 },
        { bracket_order: 4, base_limit: 4664.68, rate: 0.225, deduction: 675.49 },
        { bracket_order: 5, base_limit: null, rate: 0.275, deduction: 908.72 },
      ],
      general_legal_parameters: {
        minimum_wage: 1621.00,
        simplified_discount: 607.20,
        irrf_exemption_limit: 2428.80,
        irrf_base_reduction: 607.20,
        irrf_reduction_formula_limit: 7350.00,
        irrf_reduction_a: 978.62,
        irrf_reduction_b: 0.133145,
      },
    });

    const engine = new PayrollEngine(ctx);
    const result = await engine.run();

    expect(result.status).toBe('CALCULADA');

    const itemHE = result.memoria_calculo.find(m => m.rubric_id === 'he-1');
    const itemDSR = result.memoria_calculo.find(m => m.rubric_id === 'dsr-1');

    expect(itemHE).toBeDefined();
    expect(itemHE?.result_value).toBe(150.00);

    expect(itemDSR).toBeDefined();
    // 20% sobre 150 = 30.00
    expect(itemDSR?.result_value).toBe(30.00);
  });
});
