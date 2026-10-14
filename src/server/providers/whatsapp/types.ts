/**
 * LEADFORGE — WhatsAppProvider
 *
 * WhatsApp Business Platform (Cloud API) — o ÚNICO caminho permitido.
 * Sem WhatsApp Web automatizado, sem bypass. Envio livre apenas na janela
 * de atendimento de 24h (iniciada pelo contato); templates fora da janela
 * ficam registrados como evolução futura honesta.
 */

export type WhatsAppSendInput = {
  to: string; // E.164 sem "+" (5511...)
  body: string;
};

export type WhatsAppSendResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; error: string };

export interface WhatsAppProvider {
  readonly kind: "cloud" | "mock";
  sendText(input: WhatsAppSendInput): Promise<WhatsAppSendResult>;
}

export class WhatsAppProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WhatsAppProviderError";
  }
}
