import {
  CommerceParseError,
  isJson,
  normalizeStatus,
  pickMoney,
  pickOccurredAt,
  pickString,
  pickUtm,
  type CommerceProvider,
  type SaleEvent,
} from "./types";

/**
 * Kirvano — parser tolerante (mesma estratégia de aliases da Kiwify,
 * com nomes alternativos comuns da plataforma).
 */
export const kirvanoProvider: CommerceProvider = {
  platform: "kirvano",

  parseSaleEvent(payload: unknown): SaleEvent {
    if (!isJson(payload)) {
      throw new CommerceParseError("Payload Kirvano inválido");
    }

    const externalOrderId = pickString(payload, [
      "order_id",
      "orderId",
      "transaction_id",
      "transactionId",
      "id",
    ]);
    if (!externalOrderId) {
      throw new CommerceParseError("Payload Kirvano sem order_id");
    }

    const event = pickString(payload, ["event", "type", "event_type"]);
    const statusRaw =
      pickString(payload, ["status", "order_status", "payment_status", "status_label"]) ?? event;

    const amount = pickMoney(payload, [
      "total",
      "amount",
      "order_total",
      "total_cents",
      "value",
    ]);
    const commissionAmount = pickMoney(payload, [
      "commission",
      "affiliate_commission",
      "net_amount",
      "producer_value",
    ]);

    const customerName =
      pickString(payload, ["customer_name", "customer_full_name", "full_name", "name"]) ?? null;

    return {
      externalOrderId,
      status: normalizeStatus(statusRaw, "paid"),
      amount,
      commissionAmount,
      currency: pickString(payload, ["currency", "currency_code"]) ?? "BRL",
      customerName,
      customerEmail: pickString(payload, ["customer_email", "email", "buyer_email"]),
      externalProductId: pickString(payload, ["product_id", "productId", "offer_id", "offerId"]),
      utm: pickUtm(payload),
      occurredAt: pickOccurredAt(payload, ["created_at", "createdAt", "date", "timestamp"]),
    };
  },
};
