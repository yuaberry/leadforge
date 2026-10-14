import "server-only";

import { and, eq } from "drizzle-orm";

import { getServiceDb } from "@/server/db/index";
import { products } from "@/server/db/schema";
import {
  findSaleByExternalOrderId,
  getLinkTokenByToken,
  insertSale,
  updateSale,
} from "@/server/db/repositories/commerce";
import { recordActivity } from "@/server/db/repositories/leads";
import { normalizeEmail } from "@/lib/format";
import type { SaleEvent } from "@/server/providers/commerce/types";

export type IngestResult = {
  saleId: string;
  created: boolean;
  attributed: boolean;
};

/** Padrão do utm_campaign gerado pelos links /go/[token]. */
export const LINK_UTM_PREFIX = "lf_";

function extractLinkToken(utmCampaign: string | null): string | null {
  if (!utmCampaign || !utmCampaign.startsWith(LINK_UTM_PREFIX)) return null;
  const token = utmCampaign.slice(LINK_UTM_PREFIX.length);
  return token.length >= 8 ? token : null;
}

/**
 * Processa um SaleEvent de webhook (serviceDb — sem claims de usuário):
 *
 *  1. Idempotência: (org, platform, external_order_id) único.
 *     Pedido repetido → atualiza status (ex.: paid → refunded).
 *  2. Atribuição: utm_campaign lf_<token> → link_token + lead.
 *  3. Casa produto por external_product_id quando disponível.
 *  4. Registra activity para a timeline do lead (quando atribuído).
 */
export async function ingestSaleEvent(input: {
  organizationId: string;
  integrationId: string | null;
  platform: string;
  event: SaleEvent;
  rawPayload: unknown;
}): Promise<IngestResult> {
  const db = getServiceDb();
  const { event } = input;

  // 1. Atribuição por link rastreado
  const tokenValue = extractLinkToken(event.utm.campaign);
  const linkToken = tokenValue
    ? await getLinkTokenByToken(db, tokenValue)
    : null;
  const validToken =
    linkToken && linkToken.organizationId === input.organizationId ? linkToken : null;

  // 2. Casa produto (external id DENTRO da org — serviceDb bypassa RLS,
  //    então o escopo por organization_id é obrigatório aqui) ou pelo
  //    produto do link rastreado.
  let productId: string | null = null;
  if (event.externalProductId) {
    const [product] = await db
      .select({ id: products.id })
      .from(products)
      .where(
        and(
          eq(products.organizationId, input.organizationId),
          eq(products.externalProductId, event.externalProductId)
        )
      )
      .limit(1);
    productId = product?.id ?? validToken?.productId ?? null;
  } else {
    productId = validToken?.productId ?? null;
  }

  // 3. Idempotência: existe venda com este pedido?
  const existing = await findSaleByExternalOrderId(
    db,
    input.organizationId,
    input.platform,
    event.externalOrderId
  );

  const saleValues = {
    organizationId: input.organizationId,
    integrationId: input.integrationId,
    productId,
    platform: input.platform as "kiwify",
    externalOrderId: event.externalOrderId,
    customerName: event.customerName,
    customerEmail: event.customerEmail,
    customerEmailNormalized: event.customerEmail ? normalizeEmail(event.customerEmail) : null,
    amount: event.amount,
    commissionAmount: event.commissionAmount,
    currency: event.currency,
    status: event.status,
    source: "webhook" as const,
    utm: event.utm,
    linkTokenId: validToken?.id ?? null,
    leadId: validToken?.leadId ?? null,
    occurredAt: event.occurredAt ?? new Date().toISOString(),
    raw: input.rawPayload as Record<string, unknown>,
  };

  if (existing) {
    await updateSale(db, existing.id, {
      status: event.status,
      amount: event.amount ?? existing.amount,
      commissionAmount: event.commissionAmount ?? existing.commissionAmount,
      productId: productId ?? existing.productId,
      linkTokenId: validToken?.id ?? existing.linkTokenId,
      leadId: validToken?.leadId ?? existing.leadId,
      utm: event.utm,
      raw: input.rawPayload as Record<string, unknown>,
    });
    return { saleId: existing.id, created: false, attributed: Boolean(validToken) };
  }

  const sale = await insertSale(db, saleValues);

  await recordActivity(db, {
    organizationId: input.organizationId,
    type: event.status === "paid" ? "sale_recorded" : "sale_status_changed",
    entityType: "sale",
    entityId: sale.id,
    metadata: {
      platform: input.platform,
      externalOrderId: event.externalOrderId,
      amount: event.amount,
      commission: event.commissionAmount,
      status: event.status,
      attributed: Boolean(validToken),
      leadId: validToken?.leadId ?? null,
    },
  });

  return { saleId: sale.id, created: true, attributed: Boolean(validToken) };
}
