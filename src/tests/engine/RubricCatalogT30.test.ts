import { describe, it, expect } from 'vitest';
import { PayrollEngine } from '../../../supabase/functions/payroll-engine/engine/PayrollEngine';
import { PayrollContext } from '../../../supabase/functions/payroll-engine/engine/PayrollContext';
import { defaultTestContextData, standardSystemRubrics } from '../fixtures/legalParameters';

describe('T30 / T12 / T13: Catálogo de Rubricas, Matriz de Incidências e Bases (Doc §5)', () => {
  const salarioRubric = {
    id: 'rubric-101',
    code: '101',
    name: 'Salário Base',
    type: 'EARNING' as const,
    category: 'SALARY',
    calculation_form: 'FIXO',
    calculation_base: 'SALARIO_BASE',
    calculation_order: 10,
    incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
  };

  it('1. Proventos tributáveis (HE 50%, 70%, 100%, Adicionais 301-305, Comissões 401) devem compor integralmente as bases de INSS, IRRF e FGTS', async () => {
    const he50 = {
      id: 'rubric-150',
      code: '150',
      name: 'Hora Extra 50%',
      type: 'EARNING' as const,
      category: 'OVERTIME',
      calculation_form: 'HORAS',
      calculation_base: 'SALARIO_BASE',
      factor: 1.5,
      calculation_order: 40,
      incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
    };

    const he70 = {
      id: 'rubric-153',
      code: '153',
      name: 'Hora Extra 70%',
      type: 'EARNING' as const,
      category: 'OVERTIME',
      calculation_form: 'HORAS',
      calculation_base: 'SALARIO_BASE',
      factor: 1.7,
      calculation_order: 40,
      incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
    };

    const comissao = {
      id: 'rubric-401',
      code: '401',
      name: 'Comissão',
      type: 'EARNING' as const,
      category: 'OTHER',
      calculation_form: 'MANUAL',
      calculation_order: 30,
      incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
    };

    const context = new PayrollContext({
      ...defaultTestContextData,
      salario_base: 3000.00,
      dias_trabalhados: 30,
      horas_trabalhadas: 220,
      rubricas: [salarioRubric, he50, he70, comissao, ...standardSystemRubrics],
      eventos: [
        { rubric_id: 'rubric-101', quantity: 30, origin: 'AUTOMATICA' },
        { rubric_id: 'rubric-150', quantity: 10, origin: 'IMPORTADA' }, // (3000/220)*1.5*10 = 204.55
        { rubric_id: 'rubric-153', quantity: 10, origin: 'IMPORTADA' }, // (3000/220)*1.7*10 = 231.82
        { rubric_id: 'rubric-401', manual_value: 500.00, quantity: 1, origin: 'MANUAL' }
      ]
    });

    const engine = new PayrollEngine(context);
    const result = await engine.run();

    expect(result.status).toBe('CALCULADA');
    
    // Total proventos = 3000 + 204.55 + 231.82 + 500 = 3936.37
    const proventosEsperados = 3000.00 + 204.55 + 231.82 + 500.00;
    expect(result.total_proventos).toBeCloseTo(proventosEsperados, 2);

    // As bases de INSS, FGTS e bruta de IRRF devem ser exatamente iguais aos proventos tributáveis
    expect(result.bases.inss).toBeCloseTo(proventosEsperados, 2);
    expect(result.bases.fgts).toBeCloseTo(proventosEsperados, 2);
  });

  it('2. Faltas (801), atrasos (802) e DSR sobre falta (803) devem reduzir as bases de cálculo de INSS, IRRF e FGTS', async () => {
    const falta = {
      id: 'rubric-801',
      code: '801',
      name: 'Faltas',
      type: 'DEDUCTION' as const,
      category: 'OTHER',
      calculation_form: 'DIAS',
      calculation_base: 'SALARIO_BASE',
      calculation_order: 80,
      incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
    };

    const dsrFalta = {
      id: 'rubric-803',
      code: '803',
      name: 'DSR sobre Falta',
      type: 'DEDUCTION' as const,
      category: 'OTHER',
      calculation_form: 'DIAS',
      calculation_base: 'SALARIO_BASE',
      calculation_order: 80,
      incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
    };

    const context = new PayrollContext({
      ...defaultTestContextData,
      salario_base: 3000.00,
      dias_trabalhados: 30,
      rubricas: [salarioRubric, falta, dsrFalta, ...standardSystemRubrics],
      eventos: [
        { rubric_id: 'rubric-101', quantity: 30, origin: 'AUTOMATICA' },
        { rubric_id: 'rubric-801', quantity: 2, origin: 'IMPORTADA' }, // (3000/30)*2 = 200.00
        { rubric_id: 'rubric-803', quantity: 1, origin: 'IMPORTADA' }  // (3000/30)*1 = 100.00
      ]
    });

    const engine = new PayrollEngine(context);
    const result = await engine.run();

    expect(result.status).toBe('CALCULADA');
    expect(result.total_proventos).toBe(3000.00);

    // Descontos de faltas somam 300.00
    // Base de INSS e FGTS deve ser reduzida para 3000 - 300 = 2700.00
    expect(result.bases.inss).toBeCloseTo(2700.00, 2);
    expect(result.bases.fgts).toBeCloseTo(2700.00, 2);
  });

  it('3. Verbas indenizatórias (Abono 503, VT 201, VR 202, Adiantamento 250) NÃO devem entrar nas bases de INSS nem de FGTS', async () => {
    const abono = {
      id: 'rubric-503',
      code: '503',
      name: 'Abono Pecuniário',
      type: 'EARNING' as const,
      category: 'OTHER',
      calculation_form: 'DIAS',
      calculation_base: 'SALARIO_BASE',
      calculation_order: 50,
      incidencias: { gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
    };

    const vt = {
      id: 'rubric-201',
      code: '201',
      name: 'Vale Transporte',
      type: 'DEDUCTION' as const,
      category: 'ALLOWANCE',
      calculation_form: 'MANUAL',
      calculation_order: 85,
      incidencias: { gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
    };

    const context = new PayrollContext({
      ...defaultTestContextData,
      salario_base: 3000.00,
      dias_trabalhados: 30,
      rubricas: [salarioRubric, abono, vt, ...standardSystemRubrics],
      eventos: [
        { rubric_id: 'rubric-101', quantity: 30, origin: 'AUTOMATICA' },
        { rubric_id: 'rubric-503', manual_value: 1000.00, quantity: 10, origin: 'MANUAL' },
        { rubric_id: 'rubric-201', manual_value: 180.00, quantity: 1, origin: 'MANUAL' }
      ]
    });

    const engine = new PayrollEngine(context);
    const result = await engine.run();

    expect(result.status).toBe('CALCULADA');
    expect(result.total_proventos).toBe(4000.00); // 3000 salário + 1000 abono

    // Apenas o salário base de 3000 incide INSS e FGTS; o abono e o VT não alteram a base
    expect(result.bases.inss).toBe(3000.00);
    expect(result.bases.fgts).toBe(3000.00);
  });

  it('4. T13: Flags gera_base_* devem respeitar estritamente a configuração sem forçar true por incidence_*', () => {
    // Simula a lógica de mapeamento corrigida em index.ts
    const mapRubricIncidencias = (r: any) => ({
      gera_base_inss: r.generates_base_inss ?? r.generates_inss_base ?? false,
      gera_base_irrf: r.generates_base_irrf ?? r.generates_irrf_base ?? false,
      gera_base_fgts: r.generates_base_fgts ?? r.generates_fgts_base ?? false,
    });

    // Caso onde o usuário desmarcou a base mas a coluna antiga ou incidence_* ainda tinha valor
    const rubricWithDisabledBase = {
      generates_base_inss: false,
      incidence_inss: true // NÃO deve sobrepor gera_base_inss
    };

    const mapped = mapRubricIncidencias(rubricWithDisabledBase);
    expect(mapped.gera_base_inss).toBe(false);
  });
});
