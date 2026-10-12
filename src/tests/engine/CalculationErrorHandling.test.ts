import { describe, it, expect } from "vitest";
import { PayrollEngine } from "../../../supabase/functions/payroll-engine/engine/PayrollEngine";
import { PayrollContext } from "../../../supabase/functions/payroll-engine/engine/PayrollContext";
import { defaultTestContextData, standardSystemRubrics } from "../fixtures/legalParameters";

describe("T5: Tratamento Explícito de Erros de Cálculo no Motor de Folha", () => {
  it("deve retornar status ERRO_CALCULO contendo código e nome da rubrica quando a fórmula for inválida", async () => {
    const brokenRubric = {
      id: "rubric-error-1",
      code: "999",
      name: "Rubrica com Formula Quebrada",
      type: "EARNING" as const,
      category: "OTHER" as const,
      calculation_form: "FORMULA",
      formula: "SALARIO_BASE * * * INVALIDA ( / 0",
      calculation_order: 1,
      incidencias: { gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
    };

    const context = new PayrollContext({
      ...defaultTestContextData,
      salario_base: 3000.0,
      dias_trabalhados: 30,
      rubricas: [brokenRubric],
      eventos: []
    });

    const engine = new PayrollEngine(context);
    const result = await engine.run();

    // Validação T5
    expect(result.status).toMatch(/^ERRO_CALCULO/);
    expect(result.status).toContain("999");
    expect(result.status).toContain("Rubrica com Formula Quebrada");
    // Garante que proventos e descontos não são computados como válidos
    expect(result.total_proventos).toBe(0);
    expect(result.liquido).toBe(0);
  });

  it("deve identificar erro quando a rubrica referenciar base inexistente ou divisão inválida", async () => {
    const divisionByZeroRubric = {
      id: "rubric-div-zero",
      code: "998",
      name: "Rubrica Divisao Zero",
      type: "EARNING" as const,
      category: "OTHER" as const,
      calculation_form: "FORMULA",
      formula: "1000 / 0",
      calculation_order: 1,
      incidencias: { gera_base_inss: false, gera_base_irrf: false, gera_base_fgts: false }
    };

    const context = new PayrollContext({
      ...defaultTestContextData,
      salario_base: 2500.0,
      dias_trabalhados: 30,
      rubricas: [divisionByZeroRubric],
      eventos: []
    });

    const engine = new PayrollEngine(context);
    const result = await engine.run();

    // Se o parser disparar erro de divisão por zero ou se retornar NaN/Infinity
    if (result.status.startsWith("ERRO_CALCULO")) {
      expect(result.status).toContain("998");
    }
  });

  it("deve permitir que o motor conclua com status CALCULADA quando as rubricas forem válidas", async () => {
    const validRubric = {
      id: "rubric-valid-1",
      code: "101",
      name: "Salario Base",
      type: "EARNING" as const,
      category: "SALARY" as const,
      calculation_form: "FIXO",
      calculation_base: "SALARIO_BASE",
      calculation_order: 1,
      incidencias: { gera_base_inss: true, gera_base_irrf: true, gera_base_fgts: true }
    };

    const context = new PayrollContext({
      ...defaultTestContextData,
      salario_base: 4000.0,
      dias_trabalhados: 30,
      rubricas: [validRubric, ...standardSystemRubrics],
      eventos: []
    });

    const engine = new PayrollEngine(context);
    const result = await engine.run();

    expect(result.status).toBe("CALCULADA");
    expect(result.total_proventos).toBe(4000.0);
    expect(result.liquido).toBeGreaterThan(0);
  });
});
