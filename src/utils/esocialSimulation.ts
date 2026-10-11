/**
 * Utilitários e regras de conformidade para o eSocial em Produção (T26)
 */

export const ESOCIAL_CONFIG = {
  IS_SIMULATION_MODE: true,
  IS_PRODUCTION_TRANSMISSION_ENABLED: false,
  TRANSMISSION_NOTICE: "Simulação: não transmite ao governo (Fase P10)",
};

/**
 * Identifica se um número de recibo tem o padrão fictício gerado anteriormente
 * pela simulação Math.random (padrão '1.2.000XXXXXX').
 */
export function isFictitiousReceipt(receiptNumber: string | null | undefined): boolean {
  if (!receiptNumber) return false;
  return receiptNumber.startsWith("1.2.000");
}

/**
 * Validador para envio de eventos eSocial.
 * Em produção, qualquer tentativa de forçar transmissão simulada deve ser bloqueada.
 */
export function validateTransmissionAttempt(): { allowed: boolean; reason?: string } {
  if (!ESOCIAL_CONFIG.IS_PRODUCTION_TRANSMISSION_ENABLED) {
    return {
      allowed: false,
      reason: "Transmissão desativada em produção. A integração oficial com envio de XML assinado (A1) será habilitada na Fase P10.",
    };
  }
  return { allowed: true };
}

/**
 * Prepara o payload de anulação segura de um recibo fictício, preservando histórico.
 */
export function sanitizeFictitiousRecord(currentRecord: {
  receipt_number: string | null;
  error_message: string | null;
}) {
  if (!isFictitiousReceipt(currentRecord.receipt_number)) {
    return null;
  }

  const previousReceipt = currentRecord.receipt_number;
  return {
    status: "DRAFT" as const,
    receipt_number: null,
    transmitted_at: null,
    error_message: currentRecord.error_message
      ? `${currentRecord.error_message} | Simulação anulada em produção (T26). Recibo fictício removido: ${previousReceipt}`
      : `Simulação anulada em produção (T26). Recibo fictício removido: ${previousReceipt}`,
  };
}
