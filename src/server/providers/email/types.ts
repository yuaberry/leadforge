/**
 * LEADFORGE — EmailProvider
 *
 * Abstração de envio de e-mail. Resend inicial; SES/SMTP depois.
 * A chave vive APENAS em env (server-only). Sem chave, o mock envia em
 * modo SIMULADO — claramente marcado nas mensagens.
 */

export type EmailSendInput = {
  to: string;
  from: string; // "Nome <email@dominio>"
  subject: string;
  text: string;
  replyTo?: string | null;
  headers?: Record<string, string>;
};

export type EmailSendResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; error: string };

export interface EmailProvider {
  readonly kind: "resend" | "mock";
  send(input: EmailSendInput): Promise<EmailSendResult>;
}

export class EmailProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailProviderError";
  }
}
