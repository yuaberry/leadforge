import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Tokens de unsubscribe: stateless com HMAC (LINK_TOKEN_SECRET).
 * Formato: base64url(JSON{org,email}).hmac_sha256
 */

type UnsubscribePayload = { o: string; e: string };

function secret(): string {
  const value = process.env.LINK_TOKEN_SECRET || process.env.APP_ENCRYPTION_KEY;
  if (!value) {
    throw new Error("LINK_TOKEN_SECRET (ou APP_ENCRYPTION_KEY) não configurado.");
  }
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function generateUnsubscribeToken(organizationId: string, email: string): string {
  const payload = Buffer.from(
    JSON.stringify({ o: organizationId, e: email.trim().toLowerCase() } satisfies UnsubscribePayload)
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyUnsubscribeToken(
  token: string
): { organizationId: string; email: string } | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;

  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as UnsubscribePayload;
    if (typeof parsed.o !== "string" || typeof parsed.e !== "string") return null;
    return { organizationId: parsed.o, email: parsed.e };
  } catch {
    return null;
  }
}

/** Monta o link de cancelamento para o rodapé dos e-mails. */
export function unsubscribeLink(origin: string, organizationId: string, email: string): string {
  return `${origin}/u/${generateUnsubscribeToken(organizationId, email)}`;
}
