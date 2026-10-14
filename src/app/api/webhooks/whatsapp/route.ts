import { NextResponse, type NextRequest } from "next/server";

import { getServiceDb } from "@/server/db/index";
import { getWhatsAppAccountByWebhookToken } from "@/server/db/repositories/inbox";
import { handleWhatsAppWebhook } from "@/server/services/whatsapp-inbound";
import { isHubVerification, parseWhatsAppWebhook } from "@/server/services/whatsapp-webhook";
import { clientIpFromHeaders, rateLimit } from "@/server/security/rate-limit";

/**
 * Webhook da WhatsApp Cloud API:
 *   GET  /api/webhooks/whatsapp?token=...        → verificação do hub (Meta)
 *   POST /api/webhooks/whatsapp?token=...        → mensagens + statuses + opt-out
 *
 * Autenticação: token único por conta (whatsapp_accounts.webhook_token) +
 * phone_number_id do payload precisa casar com a conta.
 */
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { verify, challenge } = isHubVerification(request.nextUrl.searchParams);
  if (!verify) {
    return NextResponse.json({ error: "Verificação inválida" }, { status: 403 });
  }
  return new NextResponse(challenge, { status: 200 });
}

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token || token.length < 16) {
    return NextResponse.json({ error: "Token ausente" }, { status: 401 });
  }

  const ip = clientIpFromHeaders(request.headers);
  const limit = rateLimit(`webhook-wa:${token}:${ip}`, { limit: 120, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = parseWhatsAppWebhook(payload);
  if (parsed.messages.length === 0 && parsed.statuses.length === 0) {
    // payloads de outros eventos (sempre 200 para a Meta não reenviar)
    return NextResponse.json({ received: true });
  }

  try {
    const db = getServiceDb();
    const account = await getWhatsAppAccountByWebhookToken(db, token);
    if (!account) {
      return NextResponse.json({ error: "Conta não encontrada" }, { status: 401 });
    }

    // phone_number_id do payload precisa pertencer à conta roteada
    if (parsed.phoneNumberId && parsed.phoneNumberId !== account.phoneNumberId) {
      return NextResponse.json({ error: "phone_number_id não corresponde" }, { status: 403 });
    }

    await handleWhatsAppWebhook(db, account.organizationId, parsed);

    return NextResponse.json({ received: true });
  } catch {
    // 500 faz a Meta reenviar — seguro reprocessar (mensagens são idempotentes
    // por provider_message_id? Opt-out é idempotente por suppression única).
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
