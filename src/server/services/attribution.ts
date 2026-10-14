import "server-only";

/** Constrói o URL de checkout com UTMs de atribuição (função pura). */
export function buildCheckoutUrl(
  checkoutUrl: string,
  attribution: { token: string; leadId: string | null }
): string {
  try {
    const url = new URL(checkoutUrl);
    url.searchParams.set("utm_source", "leadforge");
    url.searchParams.set("utm_medium", "leadforge");
    url.searchParams.set("utm_campaign", `lf_${attribution.token}`);
    url.searchParams.set("utm_content", attribution.leadId ?? "direct");
    return url.toString();
  } catch {
    return checkoutUrl;
  }
}

/** Resolução de link público /go/[token] — usado pelo route handler. */
export async function resolvePublicLink(token: string) {
  const { getServiceDb } = await import("@/server/db/index");
  const { getLinkTokenByToken, recordLinkClick } = await import(
    "@/server/db/repositories/commerce"
  );
  const { getProduct } = await import("@/server/db/repositories/commerce");

  const db = getServiceDb();

  const linkToken = await getLinkTokenByToken(db, token);
  if (!linkToken || !linkToken.active) return null;

  const product = await getProduct(db, linkToken.organizationId, linkToken.productId);
  if (!product) return null;

  return {
    linkToken,
    product,
    async logClick(meta: { ip: string | null; userAgent: string | null; referrer: string | null }) {
      await recordLinkClick(db, {
        organizationId: linkToken.organizationId,
        linkTokenId: linkToken.id,
        productId: linkToken.productId,
        destinationUrl: product.checkoutUrl,
        ip: meta.ip,
        userAgent: meta.userAgent,
        referrer: meta.referrer,
      });
    },
  };
}
