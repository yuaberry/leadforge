import { NextResponse, type NextRequest } from "next/server";

import { getServiceDb } from "@/server/db/index";
import { getEmailAccountByWebhookToken } from "@/server/db/repositories/campaigns";
import { handleEmailEvent } from "@/server/services/campaign-runner";
import { clientIpFromHeaders, rateLimit } from "@/server/security/rate-limit";

/**
 * Webhook de eventos do provedor de e-mail (bounce/complaint/delivery):
 *   POST /api/webhooks/email/resend?token=<email_accounts.webhook_token>
 *
 * Bounce e complaint geram suppression AUTOMÁTICA (invariável: nunca
 * tentaremos aquele endereço novamente).
 */
export const runtime = "nodejs";

type EventPayload = {
  type?: string;
  data?: { email?: string; message_id?: string; id?: string };
};

function extractEvents(payload: unknown): EventPayload[] {
  if (Array.isArray(payload)) return payload as EventPayload[];
  if (typeof payload === "object" && payload !== null) return [payload as EventPayload];
  return [];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  if (provider !== "resend") {
    return NextResponse.json({ error: "Provedor não suportado" }, { status: 404 });
  }

  const token = request.nextUrl.searchParams.get("token");
  if (!token || token.length < 16) {
    return NextResponse.json({ error: "Token ausente" }, { status: 401 });
  }

  const ip = clientIpFromHeaders(request.headers);
  const limit = rateLimit(`webhook-email:${token}:${ip}`, { limit: 120, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  try {
    const db = getServiceDb();
    const account = await getEmailAccountByWebhookToken(db, token);
    if (!account) {
      return NextResponse.json({ error: "Conta não encontrada" }, { status: 401 });
    }

    for (const event of extractEvents(payload)) {
      const type = event.type ?? "";
      if (!/^(email\.(bounced|complained|delivered))$/.test(type)) continue;

      await handleEmailEvent(db, {
        organizationId: account.organizationId,
        type,
        email: event.data?.email ?? null,
        providerMessageId: event.data?.message_id ?? event.data?.id ?? null,
      });
    }

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
