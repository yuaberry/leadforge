import { describe, expect, it } from "vitest";

import { kiwifyProvider } from "@/server/providers/commerce/kiwify";
import { kirvanoProvider } from "@/server/providers/commerce/kirvano";
import { CommerceParseError } from "@/server/providers/commerce/types";

/**
 * Fixtures REPRESENTATIVOS. ⚠️ Devem ser validados contra payloads reais
 * quando a conta real for conectada (ver docs/PROGRESS.md — Phase 3).
 */

describe("kiwifyProvider.parseSaleEvent", () => {
  it("normaliza payload típico de order.paid com UTMs", () => {
    const event = kiwifyProvider.parseSaleEvent({
      event: "order.paid",
      order_id: "ord_123",
      order: {
        order_id: "ord_123",
        order_status: "paid",
        customer_first_name: "Maria",
        customer_last_name: "Silva",
        customer_email: "Maria@Exemplo.com",
        order_total: "297.00",
        tracking: {
          utm_source: "instagram",
          utm_campaign: "lf_abc123",
          utm_content: "bio",
        },
        product_id: "prod_9",
      },
    });

    expect(event.externalOrderId).toBe("ord_123");
    expect(event.status).toBe("paid");
    expect(event.amount).toBe(297);
    expect(event.customerName).toBe("Maria Silva");
    expect(event.customerEmail).toBe("Maria@Exemplo.com");
    expect(event.externalProductId).toBe("prod_9");
    expect(event.utm.campaign).toBe("lf_abc123");
    expect(event.utm.source).toBe("instagram");
  });

  it("aceita total em centavos", () => {
    const event = kiwifyProvider.parseSaleEvent({
      order_id: "ord_c",
      order: { total_cents: 9750 },
    });
    expect(event.amount).toBe(97.5);
  });

  it("reconhece reembolso", () => {
    const event = kiwifyProvider.parseSaleEvent({
      event: "order.refunded",
      order_id: "ord_r",
    });
    expect(event.status).toBe("refunded");
  });

  it("rejeita payload sem order_id", () => {
    expect(() => kiwifyProvider.parseSaleEvent({ event: "order.paid" })).toThrow(
      CommerceParseError
    );
    expect(() => kiwifyProvider.parseSaleEvent("texto")).toThrow(CommerceParseError);
  });
});

describe("kirvanoProvider.parseSaleEvent", () => {
  it("normaliza payload típico", () => {
    const event = kirvanoProvider.parseSaleEvent({
      event: "PURCHASE_APPROVED",
      transaction_id: "tr_77",
      status: "approved",
      customer: { name: "João", email: "joao@x.com" },
      total: "47,90",
      utm_campaign: "lf_xyz",
    });

    expect(event.externalOrderId).toBe("tr_77");
    expect(event.status).toBe("paid");
    expect(event.amount).toBe(47.9);
    expect(event.customerName).toBe("João");
    expect(event.utm.campaign).toBe("lf_xyz");
  });

  it("rejeita payload sem id", () => {
    expect(() => kirvanoProvider.parseSaleEvent({ event: "test" })).toThrow(CommerceParseError);
  });
});
