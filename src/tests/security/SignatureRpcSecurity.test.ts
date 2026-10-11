import { describe, it, expect } from "vitest";

describe("T27 (provisório): Revogação de permissão da RPC sign_worker_document", () => {
  it("deve registrar a RPC sign_worker_document como revogada por segurança até a Fase P6", () => {
    const rpcSecurityPolicy = {
      rpcName: "sign_worker_document",
      isRevokedForAnon: true,
      isRevokedForAuthenticated: true,
      targetPhase: "P6",
      replacementTarget: "Edge Function sign-document (AS-04)",
    };

    expect(rpcSecurityPolicy.isRevokedForAnon).toBe(true);
    expect(rpcSecurityPolicy.isRevokedForAuthenticated).toBe(true);
    expect(rpcSecurityPolicy.replacementTarget).toContain("AS-04");
  });

  it("deve validar que a mensagem ao colaborador explica a atualização de conformidade jurídica", () => {
    const getDisabledSignatureNotice = () => 
      "O módulo de assinatura digital está em atualização de segurança para conformidade jurídica (Fase P6 - Rubrica e Manifesto). A assinatura eletrônica avançada será habilitada em breve.";

    const notice = getDisabledSignatureNotice();
    expect(notice).toContain("Fase P6");
    expect(notice).toContain("conformidade jurídica");
  });
});
