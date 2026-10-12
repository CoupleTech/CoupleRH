import { describe, it, expect } from 'vitest';
import { PayrollEngine } from '../../../supabase/functions/payroll-engine/engine/PayrollEngine';
import { PayrollContext } from '../../../supabase/functions/payroll-engine/engine/PayrollContext';
import { defaultTestContextData, standardSystemRubrics } from '../fixtures/legalParameters';

describe('T6: Rubricas 901/902/903 por Código e Invariante de Holerite (Doc §4)', () => {
  const salarioRubric = {
    id: 'rubric-salario-101',
    code: '101',
    name: 'Salário Base',
    type: 'EARNING' as const,
    category: 'SALARY',
    calculation_form: 'FIXO',
    calculation_base: 'SALARIO_BASE',
    calculation_order: 10,
    incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
  };

  it('1. Deve lançar erro explícito se a rubrica INSS 901 estiver ausente quando INSS for devido', async () => {
    // Apenas rubrica de salário, sem a 901
    const context = new PayrollContext({
      ...defaultTestContextData,
      salario_base: 3000.00,
      dias_trabalhados: 30,
      rubricas: [salarioRubric],
      eventos: [
        { rubric_id: 'rubric-salario-101', quantity: 1, origin: 'AUTOMATICA' }
      ]
    });

    const engine = new PayrollEngine(context);
    const result = await engine.run();

    // Deve falhar com erro identificando a rubrica 901 ausente
    expect(result.status).toMatch(/^ERRO_CALCULO/);
    expect(result.status).toContain('901');
  });

  it('2. Não deve aceitar rubrica com código diferente de 901 mesmo que contenha "INSS" no nome', async () => {
    const fakeInssRubric = {
      id: 'rubric-fake-inss',
      code: '999', // Código NÃO é 901
      name: 'INSS Qualquer',
      type: 'DEDUCTION' as const,
      category: 'TAX',
      calculation_form: 'AUTOMATICA',
      calculation_order: 90,
      incidencias: { gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
    };

    const context = new PayrollContext({
      ...defaultTestContextData,
      salario_base: 3000.00,
      dias_trabalhados: 30,
      rubricas: [salarioRubric, fakeInssRubric],
      eventos: [
        { rubric_id: 'rubric-salario-101', quantity: 1, origin: 'AUTOMATICA' }
      ]
    });

    const engine = new PayrollEngine(context);
    const result = await engine.run();

    // Deve rejeitar a busca por nome e exigir o código 901
    expect(result.status).toMatch(/^ERRO_CALCULO/);
    expect(result.status).toContain('901');
  });

  it('3. Deve lançar erro explícito se a rubrica IRRF 902 estiver ausente quando IRRF for devido', async () => {
    // Salário de R$ 6.000 (gera IRRF devido) com rubrica 901 e 903, mas SEM a 902
    const inssRubric = standardSystemRubrics.find(r => r.code === '901')!;
    const fgtsRubric = standardSystemRubrics.find(r => r.code === '903')!;

    const context = new PayrollContext({
      ...defaultTestContextData,
      salario_base: 6000.00,
      dias_trabalhados: 30,
      rubricas: [salarioRubric, inssRubric, fgtsRubric],
      eventos: [
        { rubric_id: 'rubric-salario-101', quantity: 1, origin: 'AUTOMATICA' }
      ]
    });

    const engine = new PayrollEngine(context);
    const result = await engine.run();

    expect(result.status).toMatch(/^ERRO_CALCULO/);
    expect(result.status).toContain('902');
  });

  it('4. Deve lançar erro explícito se a rubrica FGTS 903 estiver ausente quando FGTS for devido', async () => {
    // Salário com 901 e 902, mas SEM a 903
    const inssRubric = standardSystemRubrics.find(r => r.code === '901')!;
    const irrfRubric = standardSystemRubrics.find(r => r.code === '902')!;

    const context = new PayrollContext({
      ...defaultTestContextData,
      salario_base: 3000.00,
      dias_trabalhados: 30,
      rubricas: [salarioRubric, inssRubric, irrfRubric],
      eventos: [
        { rubric_id: 'rubric-salario-101', quantity: 1, origin: 'AUTOMATICA' }
      ]
    });

    const engine = new PayrollEngine(context);
    const result = await engine.run();

    expect(result.status).toMatch(/^ERRO_CALCULO/);
    expect(result.status).toContain('903');
  });

  it('5. Quando 901, 902 e 903 existem por código, o motor calcula e a invariante de itens fecha com os totais', async () => {
    const context = new PayrollContext({
      ...defaultTestContextData,
      salario_base: 6000.00,
      dias_trabalhados: 30,
      rubricas: [salarioRubric, ...standardSystemRubrics],
      eventos: [
        { rubric_id: 'rubric-salario-101', quantity: 1, origin: 'AUTOMATICA' }
      ]
    });

    const engine = new PayrollEngine(context);
    const result = await engine.run();

    expect(result.status).toBe('CALCULADA');
    expect(result.total_proventos).toBe(6000.00);
    // INSS ~641.51 + IRRF ~385.10 = ~1026.61
    expect(result.total_descontos).toBeGreaterThan(0);
    expect(result.liquido).toBeCloseTo(result.total_proventos - result.total_descontos, 2);

    // Validação da invariante contábil dos itens na memória de cálculo:
    const earningItems = result.memoria_calculo.filter(m => m.rubric_id === 'rubric-salario-101');
    const sumEarnings = earningItems.reduce((acc, m) => acc + m.result_value, 0);
    expect(sumEarnings).toBeCloseTo(result.total_proventos, 2);

    const deductionItems = result.memoria_calculo.filter(m => m.rubric_id === 'rubric-inss-901' || m.rubric_id === 'rubric-irrf-902');
    const sumDeductions = deductionItems.reduce((acc, m) => acc + m.result_value, 0);
    expect(sumDeductions).toBeCloseTo(result.total_descontos, 2);

    // FGTS (903) é do tipo BASE e deve ficar estritamente fora da soma de proventos e descontos
    const fgtsItem = result.memoria_calculo.find(m => m.rubric_id === 'rubric-fgts-903');
    expect(fgtsItem).toBeDefined();
    expect(fgtsItem?.result_value).toBe(result.total_fgts);
  });
});
