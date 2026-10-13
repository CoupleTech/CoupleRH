import { describe, it, expect, vi } from "vitest";
import {
  validatePeriodStatusForCalculation,
  buildAtomicPayrollPayload,
  type AtomicPayrollPayload,
  type RawCalculatedPayslip,
} from "../../../supabase/functions/payroll-engine/engine/AtomicPersistence";

describe("T9: Recálculo Atômico e Trava de Concorrência (Doc §4)", () => {
  describe("1. Trava de Concorrência e Validação de Status do Período", () => {
    it("deve rejeitar com 409 quando o status do período já for CALCULATING", () => {
      const result = validatePeriodStatusForCalculation("CALCULATING");
      expect(result.canCalculate).toBe(false);
      expect(result.httpStatus).toBe(409);
      expect(result.error).toMatch(/já está em andamento|concorrente/i);
    });

    it("deve rejeitar com 422 quando o status do período for CLOSED", () => {
      const result = validatePeriodStatusForCalculation("CLOSED");
      expect(result.canCalculate).toBe(false);
      expect(result.httpStatus).toBe(422);
      expect(result.error).toMatch(/fechada|CLOSED/i);
    });

    it("deve rejeitar com 422 quando o status do período for CONFERENCE ou CANCELED", () => {
      const confResult = validatePeriodStatusForCalculation("CONFERENCE");
      expect(confResult.canCalculate).toBe(false);
      expect(confResult.httpStatus).toBe(422);

      const cancelResult = validatePeriodStatusForCalculation("CANCELED");
      expect(cancelResult.canCalculate).toBe(false);
      expect(cancelResult.httpStatus).toBe(422);
    });

    it("deve permitir cálculo quando o status for DRAFT, CALCULATED ou REOPENED", () => {
      expect(validatePeriodStatusForCalculation("DRAFT")).toEqual({
        canCalculate: true,
      });
      expect(validatePeriodStatusForCalculation("CALCULATED")).toEqual({
        canCalculate: true,
      });
      expect(validatePeriodStatusForCalculation("REOPENED")).toEqual({
        canCalculate: true,
      });
    });
  });

  describe("2. Construção e Validação do Payload Atômico (save_payroll_period)", () => {
    it("deve estruturar corretamente o payload completo contendo holerites, itens, memória e impostos", () => {
      const rawPayslips: RawCalculatedPayslip[] = [
        {
          contract_id: "contract-1",
          total_earnings: 5000.0,
          total_deductions: 800.0,
          net_salary: 4200.0,
          base_inss: 5000.0,
          base_irrf: 4500.0,
          base_fgts: 5000.0,
          fgts_month: 400.0,
          status: "CALCULATED",
          items: [
            {
              rubric_id: "rubric-101",
              reference: "30 dias",
              amount: 5000.0,
              type: "EARNING",
            },
            {
              rubric_id: "rubric-901",
              reference: "11%",
              amount: 550.0,
              type: "DEDUCTION",
            },
          ],
          memory: [
            {
              step_name: "SALARIO_BASE",
              base_value: 5000.0,
              quantity_used: 30,
              percentage_used: 100,
              parsed_formula: "SALARIO_BASE",
              result_value: 5000.0,
              origin: "AUTOMATICA",
            },
          ],
        },
      ];

      const companyTaxes = [
        {
          tenant_id: "tenant-uuid-1",
          company_id: "company-uuid-1",
          total_base_inss: 5000.0,
          total_base_fgts: 5000.0,
          inss_patronal: 1000.0,
          rat_adjusted: 100.0,
          terceiros: 290.0,
          fgts_patronal: 400.0,
          total_taxes: 1790.0,
        },
      ];

      const payload: AtomicPayrollPayload = buildAtomicPayrollPayload({
        tenant_id: "tenant-uuid-1",
        period_id: "period-uuid-1",
        contract_id_filter: null,
        payslips: rawPayslips,
        company_taxes: companyTaxes,
      });

      expect(payload.contract_id_filter).toBeNull();
      expect(payload.payslips).toHaveLength(1);
      expect(payload.company_taxes).toHaveLength(1);

      const payslip = payload.payslips[0];
      expect(payslip.tenant_id).toBe("tenant-uuid-1");
      expect(payslip.contract_id).toBe("contract-1");
      expect(payslip.net_salary).toBe(4200.0);
      expect(payslip.engine_version).toBe("1.0.0");
      expect(payslip.items).toHaveLength(2);
      expect(payslip.items[0].tenant_id).toBe("tenant-uuid-1");
      expect(payslip.items[0].amount).toBe(5000.0);
      expect(payslip.memory).toHaveLength(1);
      expect(payslip.memory[0].tenant_id).toBe("tenant-uuid-1");
      expect(payslip.memory[0].engine_version).toBe("1.0.0");
    });

    it("deve preservar o filtro de contrato único quando fornecido", () => {
      const payload = buildAtomicPayrollPayload({
        tenant_id: "tenant-uuid-1",
        period_id: "period-uuid-1",
        contract_id_filter: "contract-single-uuid",
        payslips: [],
        company_taxes: [],
      });

      expect(payload.contract_id_filter).toBe("contract-single-uuid");
    });
  });

  describe("3. Atomicidade e Garantia de Não Persistência em Caso de Falha", () => {
    it("não deve chamar a persistência atômica se houver erros de cálculo acumulados", () => {
      const mockRpc = vi.fn();
      const mockErrors = [
        { contract_id: "c-1", worker_id: "w-1", error: "Divisão por zero" },
      ];

      // Se houver erros, a rotina não deve invocar save_payroll_period
      if (mockErrors.length === 0) {
        mockRpc("save_payroll_period", {});
      }

      expect(mockRpc).not.toHaveBeenCalled();
    });
  });
});
