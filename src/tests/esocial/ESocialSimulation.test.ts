import { describe, it, expect } from "vitest";
import {
  ESOCIAL_CONFIG,
  isFictitiousReceipt,
  validateTransmissionAttempt,
  sanitizeFictitiousRecord,
} from "../../utils/esocialSimulation";

describe("T26: eSocial em Produção - Contenção de Simulação e Recibos Fictícios", () => {
  it("deve estar explicitamente configurado como Modo Simulação e com Transmissão Desativada", () => {
    expect(ESOCIAL_CONFIG.IS_SIMULATION_MODE).toBe(true);
    expect(ESOCIAL_CONFIG.IS_PRODUCTION_TRANSMISSION_ENABLED).toBe(false);
    expect(ESOCIAL_CONFIG.TRANSMISSION_NOTICE).toContain("Simulação: não transmite");
  });

  it("deve bloquear qualquer tentativa de transmissão em lote no ambiente produtivo", () => {
    const check = validateTransmissionAttempt();
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain("Transmissão desativada em produção");
  });

  it("deve identificar corretamente recibos fictícios no padrão '1.2.000%'", () => {
    expect(isFictitiousReceipt("1.2.000123456")).toBe(true);
    expect(isFictitiousReceipt("1.2.000999999")).toBe(true);
    expect(isFictitiousReceipt("1.2.000000001")).toBe(true);
    // Recibos governamentais reais não possuem esse prefixo sintético
    expect(isFictitiousReceipt("1.1.20260401.123456")).toBe(false);
    expect(isFictitiousReceipt(null)).toBe(false);
    expect(isFictitiousReceipt(undefined)).toBe(false);
  });

  it("deve gerar payload de anulação preservando trilha de auditoria para registros fictícios", () => {
    const mockFictitiousRecord = {
      receipt_number: "1.2.000847291",
      error_message: null,
    };

    const sanitized = sanitizeFictitiousRecord(mockFictitiousRecord);
    expect(sanitized).not.toBeNull();
    expect(sanitized?.status).toBe("DRAFT");
    expect(sanitized?.receipt_number).toBeNull();
    expect(sanitized?.transmitted_at).toBeNull();
    expect(sanitized?.error_message).toContain("Simulação anulada em produção (T26)");
    expect(sanitized?.error_message).toContain("1.2.000847291");
  });

  it("não deve alterar registros que não possuem recibo fictício", () => {
    const realRecord = {
      receipt_number: "1.1.999888777",
      error_message: null,
    };

    const sanitized = sanitizeFictitiousRecord(realRecord);
    expect(sanitized).toBeNull();
  });
});
