import { NextResponse, type NextRequest } from "next/server";

import { buildCheckoutUrl, resolvePublicLink } from "@/server/services/attribution";

/**
 * Redirect público de link rastreado: /go/[token]
 * Registra o clique e redireciona ao checkout com UTMs de atribuição.
 * Nunca expõe dados — apenas 302.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  let destination: string | null = null;
  let leadId: string | null = null;
  let tokenValue: string | null = null;

  try {
    const resolved = await resolvePublicLink(token);
    if (resolved) {
      tokenValue = resolved.linkToken.token;
      leadId = resolved.linkToken.leadId;
      destination = buildCheckoutUrl(resolved.product.checkoutUrl, {
        token: resolved.linkToken.token,
        leadId,
      });
      await resolved.logClick({
        ip:
          request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
          request.headers.get("x-real-ip"),
        userAgent: request.headers.get("user-agent"),
        referrer: request.headers.get("referer"),
      });
    }
  } catch {
    // banco indisponível — segue sem log, sem quebrar o redirect
  }

  if (!destination || !tokenValue) {
    // link inválido/inativo — volta para a home
    return NextResponse.redirect(new URL("/", request.url), 302);
  }

  return NextResponse.redirect(destination, 302);
}
