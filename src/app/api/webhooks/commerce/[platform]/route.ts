import { NextResponse, type NextRequest } from "next/server";

import { getServiceDb } from "@/server/db/index";
import { getIntegrationByToken } from "@/server/db/repositories/commerce";
import { CommerceParseError, getCommerceProvider } from "@/server/providers/commerce";
import { ingestSaleEvent } from "@/server/services/commerce-ingest";
import { clientIpFromHeaders, rateLimit } from "@/server/security/rate-limit";

/**
 * Webhook de checkouts digitais:
 *   POST /api/webhooks/commerce/[platform]?token=<webhook_token>
 *
 * Autenticação: webhook_token único por integração (roteia a org).
 * Idempotente por (org, platform, external_order_id) — reentregas atualizam
 * o status, nunca duplicam.
 */
export const runtime = "nodejs";

const SUPPORTED = new Set(["kiwify", "kirvano"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;

  if (!SUPPORTED.has(platform)) {
    return NextResponse.json({ error: "Plataforma não suportada" }, { status: 404 });
  }

  const token = request.nextUrl.searchParams.get("token");
  if (!token || token.length < 16) {
    return NextResponse.json({ error: "Token ausente" }, { status: 401 });
  }

  const ip = clientIpFromHeaders(request.headers);
  const limit = rateLimit(`webhook:${token}:${ip}`, { limit: 120, windowMs: 60_000 });
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
    const integration = await getIntegrationByToken(db, platform, token);
    if (!integration) {
      return NextResponse.json({ error: "Integração não encontrada" }, { status: 401 });
    }

    const provider = getCommerceProvider(platform);
    const event = provider.parseSaleEvent(payload);

    await ingestSaleEvent({
      organizationId: integration.organizationId,
      integrationId: integration.id,
      platform,
      event,
      rawPayload: payload,
    });

    return NextResponse.json({ received: true });
  } catch (erro) {
    if (erro instanceof CommerceParseError) {
      return NextResponse.json({ error: erro.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function GET() {
  // Webhooks esperam apenas POST; GET informativo para verificação manual.
  return NextResponse.json({ ok: true, hint: "POST os eventos de venda aqui" });
}
