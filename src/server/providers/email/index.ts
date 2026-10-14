import "server-only";

import type { EmailProvider, EmailSendInput, EmailSendResult } from "./types";
import { EmailProviderError } from "./types";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

async function sendViaResend(input: EmailSendInput): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY não configurada." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: input.from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        reply_to: input.replyTo ?? undefined,
        headers: input.headers,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        ok: false,
        error: `Resend ${response.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
      };
    }

    const data = (await response.json()) as { id?: string };
    if (!data.id) {
      return { ok: false, error: "Resend não retornou id da mensagem." };
    }
    return { ok: true, providerMessageId: data.id };
  } catch {
    if (controller.signal.aborted) {
      return { ok: false, error: "Envio demorou demais (timeout)." };
    }
    return { ok: false, error: "Falha de rede ao contactar a Resend." };
  } finally {
    clearTimeout(timeout);
  }
}

export const resendProvider: EmailProvider = {
  kind: "resend",
  async send(input) {
    return sendViaResend(input);
  },
};

export const mockEmailProvider: EmailProvider = {
  kind: "mock",
  async send(input) {
    if (!input.to.includes("@")) {
      return { ok: false, error: "Destinatário inválido." };
    }
    // simulação honesta — nunca joga rede fora
    return { ok: true, providerMessageId: `mock_${Date.now().toString(36)}` };
  },
};

export function getEmailProvider(): EmailProvider {
  return process.env.RESEND_API_KEY ? resendProvider : mockEmailProvider;
}

export { EmailProviderError };
