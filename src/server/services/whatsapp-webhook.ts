/**
 * Parser do webhook da WhatsApp Cloud API (Meta) — função pura e tolerante.
 *
 * Payload de referência:
 * {
 *   "object": "whatsapp_business_account",
 *   "entry": [{
 *     "changes": [{
 *       "value": {
 *         "metadata": { "phone_number_id": "..." },
 *         "contacts": [{ "wa_id": "551199...", "profile": { "name": "Maria" } }],
 *         "messages": [{ "id": "wamid...", "from": "551199...", "timestamp": "1699...",
 *                        "type": "text", "text": { "body": "oi" } }],
 *         "statuses": [{ "id": "wamid...", "status": "delivered", "timestamp": "..." }]
 *       }
 *     }]
 *   }]
 * }
 */

export type WhatsAppInboundMessage = {
  providerMessageId: string;
  fromPhone: string; // wa_id (só dígitos)
  text: string;
  timestamp: string | null;
  contactName: string | null;
};

export type WhatsAppStatusUpdate = {
  providerMessageId: string;
  status: "sent" | "delivered" | "read" | "failed";
};

export type ParsedWhatsAppWebhook = {
  phoneNumberId: string | null;
  messages: WhatsAppInboundMessage[];
  statuses: WhatsAppStatusUpdate[];
};

type Json = Record<string, unknown>;

function isJson(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseWhatsAppWebhook(payload: unknown): ParsedWhatsAppWebhook {
  const result: ParsedWhatsAppWebhook = {
    phoneNumberId: null,
    messages: [],
    statuses: [],
  };

  if (!isJson(payload) || !Array.isArray(payload.entry)) return result;

  for (const entry of payload.entry) {
    if (!isJson(entry) || !Array.isArray(entry.changes)) continue;

    for (const change of entry.changes) {
      if (!isJson(change) || !isJson(change.value)) continue;
      const value = change.value as Json;

      if (isJson(value.metadata) && typeof value.metadata.phone_number_id === "string") {
        result.phoneNumberId = value.metadata.phone_number_id;
      }

      const contactName = Array.isArray(value.contacts)
        ? ((value.contacts[0] as Json | undefined)?.profile as Json | undefined)?.name
        : null;

      if (Array.isArray(value.messages)) {
        for (const message of value.messages) {
          if (!isJson(message)) continue;
          const text =
            (isJson(message.text) && typeof message.text.body === "string" && message.text.body) ||
            (isJson(message.button) && typeof message.button.text === "string"
              ? message.button.text
              : null);
          if (
            typeof message.id === "string" &&
            typeof message.from === "string" &&
            text !== null
          ) {
            result.messages.push({
              providerMessageId: message.id,
              fromPhone: message.from.replace(/\D+/g, ""),
              text,
              timestamp:
                typeof message.timestamp === "string" || typeof message.timestamp === "number"
                  ? new Date(Number(message.timestamp) * 1000).toISOString()
                  : null,
              contactName: typeof contactName === "string" ? contactName : null,
            });
          }
        }
      }

      if (Array.isArray(value.statuses)) {
        for (const statusUpdate of value.statuses) {
          if (!isJson(statusUpdate)) continue;
          const raw = typeof statusUpdate.status === "string" ? statusUpdate.status : "";
          if (
            typeof statusUpdate.id === "string" &&
            ["sent", "delivered", "read", "failed"].includes(raw)
          ) {
            result.statuses.push({
              providerMessageId: statusUpdate.id,
              status: raw as WhatsAppStatusUpdate["status"],
            });
          }
        }
      }
    }
  }

  return result;
}

/** Mensagem de verificação do hub (GET) — Meta envia hub.challenge. */
export function isHubVerification(query: URLSearchParams): { verify: boolean; challenge: string } {
  const mode = query.get("hub.mode");
  const token = query.get("hub.verify_token");
  const challenge = query.get("hub.challenge") ?? "";
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode !== "subscribe" || !token || !expected) {
    return { verify: false, challenge: "" };
  }
  return { verify: token === expected, challenge };
}
