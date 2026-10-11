import { describe, it, expect } from "vitest";
import {
  isAllowedOrigin,
  getCorsHeaders,
  isRoleAuthorizedForPayroll,
  sanitizeEngineResponse,
  ALLOWED_PAYROLL_ROLES,
} from "../../utils/engineSecurity";

describe("T8: Payroll Engine Security - Autenticação, Autorização e Restrição CORS", () => {
  it("deve autorizar apenas perfis administrativos e analistas de DP para processar a folha", () => {
    expect(ALLOWED_PAYROLL_ROLES).toContain("system_admin");
    expect(ALLOWED_PAYROLL_ROLES).toContain("tenant_admin");
    expect(ALLOWED_PAYROLL_ROLES).toContain("dp_analyst");

    expect(isRoleAuthorizedForPayroll("system_admin")).toBe(true);
    expect(isRoleAuthorizedForPayroll("tenant_admin")).toBe(true);
    expect(isRoleAuthorizedForPayroll("dp_analyst")).toBe(true);

    // Perfis que NÃO podem disparar processamento da folha
    expect(isRoleAuthorizedForPayroll("employee")).toBe(false);
    expect(isRoleAuthorizedForPayroll("manager")).toBe(false);
    expect(isRoleAuthorizedForPayroll("sst_specialist")).toBe(false);
    expect(isRoleAuthorizedForPayroll("auditor")).toBe(false);
    expect(isRoleAuthorizedForPayroll("")).toBe(false);
    expect(isRoleAuthorizedForPayroll(null)).toBe(false);
    expect(isRoleAuthorizedForPayroll(undefined)).toBe(false);
  });

  it("deve restringir CORS aos domínios confiáveis do aplicativo e subdomínios Vercel", () => {
    expect(isAllowedOrigin("https://couplerh.com.br")).toBe(true);
    expect(isAllowedOrigin("https://app.couplerh.com.br")).toBe(true);
    expect(isAllowedOrigin("https://couplerh-preview-123.vercel.app")).toBe(true);
    expect(isAllowedOrigin("http://localhost:5173")).toBe(true);

    // Domínios maliciosos ou arbitrários
    expect(isAllowedOrigin("https://attacker-site.com")).toBe(false);
    expect(isAllowedOrigin("https://fakecouplerh.com")).toBe(false);
    expect(isAllowedOrigin(null)).toBe(false);
  });

  it("não deve usar wildcard '*' no cabeçalho Access-Control-Allow-Origin", () => {
    const trustedHeaders = getCorsHeaders("https://couplerh.com.br");
    expect(trustedHeaders["Access-Control-Allow-Origin"]).toBe("https://couplerh.com.br");
    expect(trustedHeaders["Access-Control-Allow-Origin"]).not.toBe("*");

    const unknownHeaders = getCorsHeaders("https://untrusted.com");
    expect(unknownHeaders["Access-Control-Allow-Origin"]).toBe("https://couplerh.com.br");
    expect(unknownHeaders["Access-Control-Allow-Origin"]).not.toBe("*");
  });

  it("deve remover estritamente a propriedade 'debug' do payload de resposta", () => {
    const rawPayload = {
      success: true,
      processed: 12,
      results: [{ contract_id: "c-1", net: 3500 }],
      debug: ["Log interno 1", "Variáveis internas", { memory: "dump" }],
    };

    const sanitized = sanitizeEngineResponse(rawPayload);
    expect(sanitized).toHaveProperty("success", true);
    expect(sanitized).toHaveProperty("processed", 12);
    expect(sanitized).toHaveProperty("results");
    expect(sanitized).not.toHaveProperty("debug");
    expect("debug" in sanitized).toBe(false);
  });
});
