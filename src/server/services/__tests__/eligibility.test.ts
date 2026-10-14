import { beforeAll, describe, expect, it } from "vitest";

import { decideEligibility } from "@/server/services/eligibility";
import {
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
} from "@/server/services/unsubscribe";
import {
  appendEmailFooter,
  renderTemplate,
} from "@/server/services/template";

const suppression = [
  { emailNormalized: "sup@x.com", phoneNormalized: null, channel: "all" },
  { emailNormalized: "sozap@x.com", phoneNormalized: null, channel: "whatsapp" },
  { emailNormalized: null, phoneNormalized: "5511999999999", channel: "all" },
];

describe("decideEligibility — o invariável da Phase 6", () => {
  it("contato suprimido NUNCA é elegível (email)", () => {
    const result = decideEligibility({
      email: "sup@x.com",
      phone: null,
      suppression,
      optedOutAt: null,
      consentStatus: "granted",
      legalBasis: "consent",
      channel: "email",
    });
    expect(result).toEqual({ eligible: false, reason: "suppressed" });
  });

  it("suppression de whatsapp não bloqueia e-mail", () => {
    const result = decideEligibility({
      email: "sozap@x.com",
      phone: null,
      suppression,
      optedOutAt: null,
      consentStatus: "granted",
      legalBasis: "consent",
      channel: "email",
    });
    expect(result.eligible).toBe(true);
  });

  it("opted_out é bloqueado mesmo com consentimento", () => {
    const result = decideEligibility({
      email: "ok@x.com",
      phone: null,
      suppression: [],
      optedOutAt: "2026-10-01T00:00:00Z",
      consentStatus: "granted",
      legalBasis: "consent",
      channel: "email",
    });
    expect(result).toEqual({ eligible: false, reason: "opted_out" });
  });

  it("telefone suprimido bloqueia whatsapp", () => {
    const result = decideEligibility({
      email: null,
      phone: "5511999999999",
      suppression,
      optedOutAt: null,
      consentStatus: "granted",
      legalBasis: "consent",
      channel: "whatsapp",
    });
    expect(result).toEqual({ eligible: false, reason: "suppressed" });
  });

  it("sem e-mail não envia por e-mail", () => {
    const result = decideEligibility({
      email: null,
      phone: null,
      suppression: [],
      optedOutAt: null,
      consentStatus: "granted",
      legalBasis: "consent",
      channel: "email",
    });
    expect(result).toEqual({ eligible: false, reason: "no_contact" });
  });

  it("sem base legal não envia (LGPD)", () => {
    const result = decideEligibility({
      email: "sem@x.com",
      phone: null,
      suppression: [],
      optedOutAt: null,
      consentStatus: "unknown",
      legalBasis: null,
      channel: "email",
    });
    expect(result).toEqual({ eligible: false, reason: "no_legal_basis" });
  });

  it("legítimo interesse declarado é aceitável", () => {
    const result = decideEligibility({
      email: "b2b@x.com",
      phone: null,
      suppression: [],
      optedOutAt: null,
      consentStatus: "unknown",
      legalBasis: "legitimate_interest",
      channel: "email",
    });
    expect(result.eligible).toBe(true);
  });

  it("consent recusado é bloqueado mesmo com base legal", () => {
    const result = decideEligibility({
      email: "x@x.com",
      phone: null,
      suppression: [],
      optedOutAt: null,
      consentStatus: "refused",
      legalBasis: "legitimate_interest",
      channel: "email",
    });
    expect(result).toEqual({ eligible: false, reason: "no_legal_basis" });
  });
});

describe("unsubscribe token (HMAC)", () => {
  beforeAll(() => {
    process.env.LINK_TOKEN_SECRET = "test-secret-leadforge";
  });

  it("roundtrip: gera e verifica", () => {
    const token = generateUnsubscribeToken("org-123", "User@Example.com ");
    const verified = verifyUnsubscribeToken(token);
    expect(verified).toEqual({ organizationId: "org-123", email: "user@example.com" });
  });

  it("token adulterado é rejeitado", () => {
    const token = generateUnsubscribeToken("org-123", "a@b.com");
    const tampered = `${token.slice(0, -2)}xx`;
    expect(verifyUnsubscribeToken(tampered)).toBeNull();
    expect(verifyUnsubscribeToken("lixo.total")).toBeNull();
  });
});

describe("renderTemplate + footer", () => {
  it("substitui placeholders conhecidos", () => {
    const result = renderTemplate("Olá {{nome}}, a {{empresa}} em {{cidade}} precisa disto. {{link}}", {
      nome: "Maria",
      empresa: "Loja",
      cidade: "Recife",
      link: "https://go/abc",
    });
    expect(result).toBe("Olá Maria, a Loja em Recife precisa disto. https://go/abc");
  });

  it("placeholders desconhecidos viram vazio (nunca quebram)", () => {
    expect(renderTemplate("Oi {{nome}} {{inexistente}}", { nome: "Jo" })).toBe("Oi Jo ");
  });

  it("footer de unsubscribe é anexado", () => {
    const result = appendEmailFooter("Corpo do e-mail.", "https://app/u/token123");
    expect(result).toContain("Corpo do e-mail.");
    expect(result).toContain("https://app/u/token123");
  });
});
