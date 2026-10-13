import { describe, it, expect } from "vitest";
import {
  resolveRubricIncidence,
  isRubricEligibleForCalculation,
  resolveCalculationBaseMembers,
  type RubricModelV2,
  type RubricIncidenceRecord,
  type CalculationBaseDefinition,
  type CalculationBaseMemberRecord,
} from "../../../supabase/functions/payroll-engine/engine/RubricModelV2";

describe("§6 Modelo v2: rubric_incidences por contexto, calculation_bases, versionamento e status", () => {
  describe("1. Resolução de Incidências por Contexto (rubric_incidences)", () => {
    const baseRubric: RubricModelV2 = {
      id: "rubric-150-he50",
      tenant_id: "tenant-1",
      code: "150",
      name: "Hora Extra 50%",
      type: "EARNING",
      rubric_kind: "OVERTIME",
      version: 1,
      status: "ACTIVE",
      is_system: true,
      generates_base_inss: true,
      generates_base_irrf: true,
      generates_base_fgts: true,
    };

    const incidences: RubricIncidenceRecord[] = [
      {
        rubric_id: "rubric-150-he50",
        context: "MONTHLY",
        inss: true,
        irrf: true,
        fgts: true,
        irrf_mode: "NORMAL",
        integra_dsr: true,
        media_ferias: true,
        media_13: true,
        inss_patronal: true,
        rat: true,
        terceiros: true,
      },
      {
        rubric_id: "rubric-150-he50",
        context: "TERMINATION",
        inss: true,
        irrf: true,
        fgts: true,
        irrf_mode: "NORMAL",
        integra_dsr: false, // Na rescisão direta, DSR sobre HE pode ter rubrica rescisória própria
        media_ferias: true,
        media_13: true,
        inss_patronal: true,
        rat: true,
        terceiros: true,
      },
    ];

    it("deve aplicar a incidência específica do contexto quando configurada", () => {
      const monthlyIncidence = resolveRubricIncidence(baseRubric, "MONTHLY", incidences);
      expect(monthlyIncidence.inss).toBe(true);
      expect(monthlyIncidence.integra_dsr).toBe(true);

      const termIncidence = resolveRubricIncidence(baseRubric, "TERMINATION", incidences);
      expect(termIncidence.inss).toBe(true);
      expect(termIncidence.integra_dsr).toBe(false);
    });

    it("deve realizar fallback para o contexto 'ALL' ou para as flags padrão da rubrica se não houver contexto específico", () => {
      // Pedindo contexto VACATION, que não está na lista explícita
      const vacationIncidence = resolveRubricIncidence(baseRubric, "VACATION", incidences);
      expect(vacationIncidence.inss).toBe(true);
      expect(vacationIncidence.irrf).toBe(true);
      expect(vacationIncidence.fgts).toBe(true);
    });
  });

  describe("2. Resolução de Bases Dinâmicas (calculation_bases e calculation_base_members)", () => {
    const bases: CalculationBaseDefinition[] = [
      { code: "BASE_HORA_EXTRA", name: "Base para Cálculo de Horas Extras", is_system: true },
      { code: "BASE_DSR", name: "Base para DSR Variáveis", is_system: true },
    ];

    const members: CalculationBaseMemberRecord[] = [
      { base_code: "BASE_HORA_EXTRA", kind: "SALARY_BASE", operation: "ADD" },
      { base_code: "BASE_HORA_EXTRA", kind: "INSALUBRIDADE", operation: "ADD" },
      { base_code: "BASE_HORA_EXTRA", kind: "PERICULOSIDADE", operation: "ADD" },
      { base_code: "BASE_HORA_EXTRA", kind: "ADIC_NOTURNO", operation: "ADD" },
      { base_code: "BASE_HORA_EXTRA", kind: "ABSENCE", operation: "SUBTRACT" },
    ];

    const sampleRubrics: RubricModelV2[] = [
      { id: "r1", tenant_id: "t1", code: "101", name: "Salário Base", type: "EARNING", rubric_kind: "SALARY_BASE", status: "ACTIVE" },
      { id: "r2", tenant_id: "t1", code: "302", name: "Insalubridade 20%", type: "EARNING", rubric_kind: "INSALUBRIDADE", status: "ACTIVE" },
      { id: "r3", tenant_id: "t1", code: "150", name: "HE 50%", type: "EARNING", rubric_kind: "OVERTIME", status: "ACTIVE" },
      { id: "r4", tenant_id: "t1", code: "801", name: "Faltas", type: "DEDUCTION", rubric_kind: "ABSENCE", status: "ACTIVE" },
    ];

    it("deve identificar corretamente quais rubricas adicionam ou subtraem em cada base dinâmica", () => {
      const heBases = resolveCalculationBaseMembers("BASE_HORA_EXTRA", members, sampleRubrics);

      expect(heBases.addRubricIds).toContain("r1"); // Salário Base
      expect(heBases.addRubricIds).toContain("r2"); // Insalubridade
      expect(heBases.addRubricIds).not.toContain("r3"); // HE não entra na própria base de HE
      expect(heBases.subtractRubricIds).toContain("r4"); // Faltas deduzem
    });
  });

  describe("3. Máquina de Estados e Ciclo de Vida da Rubrica", () => {
    it("deve permitir cálculo no motor apenas para rubricas com status ACTIVE", () => {
      expect(isRubricEligibleForCalculation("ACTIVE")).toBe(true);
      expect(isRubricEligibleForCalculation("DRAFT")).toBe(false);
      expect(isRubricEligibleForCalculation("APPROVED")).toBe(false);
      expect(isRubricEligibleForCalculation("RETIRED")).toBe(false);
    });

    it("deve validar datas de vigência (valid_from e valid_to)", () => {
      const activeRubric: RubricModelV2 = {
        id: "r-active",
        tenant_id: "t1",
        code: "401",
        name: "Comissão",
        type: "EARNING",
        rubric_kind: "COMMISSION",
        status: "ACTIVE",
        valid_from: "2026-01-01",
        valid_to: "2026-12-31",
      };

      // Competência vigente em 2026-05
      expect(isRubricEligibleForCalculation(activeRubric.status, "2026-05-01", activeRubric.valid_from, activeRubric.valid_to)).toBe(true);

      // Competência fora da vigência (2027)
      expect(isRubricEligibleForCalculation(activeRubric.status, "2027-01-01", activeRubric.valid_from, activeRubric.valid_to)).toBe(false);
    });
  });
});
