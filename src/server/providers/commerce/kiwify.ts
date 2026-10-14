import {
  CommerceParseError,
  isJson,
  normalizeStatus,
  pickMoney,
  pickOccurredAt,
  pickString,
  pickUtm,
  type CommerceProvider,
  type Json,
  type SaleEvent,
} from "./types";

/**
 * Kiwify — parser tolerante.
 * Payloads esperados (aliases): order_id / orderId / id; evento order.paid
 * etc.; totais em order_total / total / total_cents; cliente em
 * customer_email / Customer.email; UTMs em tracking / utm_*.
 */
export const kiwifyProvider: CommerceProvider = {
  platform: "kiwify",

  parseSaleEvent(payload: unknown): SaleEvent {
    if (!isJson(payload)) {
      throw new CommerceParseError("Payload Kiwify inválido");
    }

    const externalOrderId = pickString(payload, [
      "order_id",
      "orderId",
      "id",
      "external_id",
    ]);
    if (!externalOrderId) {
      throw new CommerceParseError("Payload Kiwify sem order_id");
    }

    const event = pickString(payload, ["event", "type", "event_type"]);
    const statusRaw =
      pickString(payload, ["order_status", "status", "status_label", "payment_status"]) ??
      event;
    const status = normalizeStatus(statusRaw, "paid");

    const amount = pickMoney(payload, ["order_total", "total", "total_cents", "amount", "value", "product_base_price"]);
    const commissionAmount = pickMoney(payload, [
      "commission",
      "affiliate_commission",
      "my_commission",
      "charge_amount",
      "settlement_amount",
    ]);

    const customerName =
      pickString(payload, [
        "customer_full_name",
        "customer_name",
        "full_name",
        "name",
      ]) ??
      ([
        pickString(payload, ["customer_first_name", "first_name"]),
        pickString(payload, ["customer_last_name", "last_name"]),
      ]
        .filter(Boolean)
        .join(" ") || null);

    const customerEmail = pickString(payload, [
      "customer_email",
      "email",
      "customer.mail",
      "Customer.email",
    ]);

    const externalProductId = pickString(payload, [
      "product_id",
      "productId",
      "offer_id",
      "offerId",
    ]);

    return {
      externalOrderId,
      status,
      amount,
      commissionAmount,
      currency: pickString(payload, ["currency", "currency_code"]) ?? "BRL",
      customerName: customerName || null,
      customerEmail,
      externalProductId,
      utm: pickUtm(payload),
      occurredAt: pickOccurredAt(payload, ["created_at", "createdAt", "order_date", "date", "timestamp"]),
    };
  },
};

export type { Json };
