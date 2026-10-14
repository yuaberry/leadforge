import "server-only";

import type { WhatsAppProvider, WhatsAppSendInput, WhatsAppSendResult } from "./types";

const GRAPH_VERSION = "v20.0";

async function sendViaCloud(input: WhatsAppSendInput): Promise<WhatsAppSendResult> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    return { ok: false, error: "WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID não configurados." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: input.to,
          type: "text",
          text: { body: input.body },
        }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        ok: false,
        error: `WhatsApp Cloud ${response.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
      };
    }

    const data = (await response.json()) as { messages?: Array<{ id?: string }> };
    const id = data.messages?.[0]?.id;
    if (!id) return { ok: false, error: "Cloud API não retornou id da mensagem." };
    return { ok: true, providerMessageId: id };
  } catch {
    if (controller.signal.aborted) return { ok: false, error: "Envio demorou demais (timeout)." };
    return { ok: false, error: "Falha de rede ao contactar a Cloud API." };
  } finally {
    clearTimeout(timeout);
  }
}

export const whatsappCloudProvider: WhatsAppProvider = {
  kind: "cloud",
  async sendText(input) {
    return sendViaCloud(input);
  },
};

export const whatsappMockProvider: WhatsAppProvider = {
  kind: "mock",
  async sendText(input) {
    if (!/^\d{10,15}$/.test(input.to)) {
      return { ok: false, error: "Número inválido." };
    }
    return { ok: true, providerMessageId: `wamid_mock_${Date.now().toString(36)}` };
  },
};

export function getWhatsAppProvider(): WhatsAppProvider {
  return process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID
    ? whatsappCloudProvider
    : whatsappMockProvider;
}
