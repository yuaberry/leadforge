import "server-only";

import { and, eq } from "drizzle-orm";

import { getServiceDb } from "@/server/db/index";
import { organizations, products } from "@/server/db/schema";
import {
  findSaleByExternalOrderId,
  getLinkTokenByToken,
  insertSale,
  updateSale,
} from "@/server/db/repositories/commerce";
import { recordActivity } from "@/server/db/repositories/leads";
import {
  addGoalContribution,
  markGoalReachedIfDue,
  reconcileSaleFinance,
} from "@/server/db/repositories/crm";
import { computeAutoContribution } from "@/server/services/goals";
import { parseOrgSettings } from "@/validators/org";
import { normalizeEmail } from "@/lib/format";
import type { SaleEvent } from "@/server/providers/commerce/types";

export type IngestResult = {
  saleId: string;
  created: boolean;
  attributed: boolean;
};

/** Padrão do utm_campaign gerado pelos links /go/[token]. */
export const LINK_UTM_PREFIX = "lf_";

/**
 * Pós-processamento financeiro de uma venda (idempotente):
 *  1. Reconcilia o lançamento de receita (paga) ou remove (refund/cancelada).
 *  2. Alimenta a meta ativa com o % configurado (goal_contribution única por venda).
 *  3. Marca a meta como atingida quando completa (celebração).
 */
async function postProcessSale(
  db: ReturnType<typeof getServiceDb>,
  input: {
    organizationId: string;
    saleId: string;
    status: string;
    amount: number | null;
    commissionAmount: number | null;
    productId: string | null;
    platform: string;
    externalOrderId: string;
    occurredAt: string;
  }
): Promise<void> {
  // tipo do produto define a categoria da receita
  let productType: "own" | "affiliate" | null = null;
  if (input.productId) {
    const [product] = await db
      .select({ type: products.type })
      .from(products)
      .where(eq(products.id, input.productId))
      .limit(1);
    productType = product?.type ?? null;
  }

  const isPaid = input.status === "paid";

  await reconcileSaleFinance(db, {
    saleId: input.saleId,
    organizationId: input.organizationId,
    isPaid,
    amount: input.amount,
    commissionAmount: input.commissionAmount,
    productType,
    platform: input.platform,
    externalOrderId: input.externalOrderId,
    occurredAt: input.occurredAt,
  });

  if (!isPaid) return;

  // alocação automática para a meta configurada
  const [orgRow] = await db
    .select({ settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.id, input.organizationId))
    .limit(1);
  const settings = parseOrgSettings(orgRow?.settings);
  const { autoAllocatePercent, targetGoalId } = settings.goalSettings;

  if (autoAllocatePercent > 0 && targetGoalId) {
    const contribution = computeAutoContribution(
      autoAllocatePercent,
      input.amount,
      input.commissionAmount
    );
    if (contribution > 0) {
      const result = await addGoalContribution(db, {
        organizationId: input.organizationId,
        goalId: targetGoalId,
        amount: contribution,
        source: "auto_sale",
        saleId: input.saleId,
      });
      if (result.inserted) {
        await markGoalReachedIfDue(db, input.organizationId, targetGoalId);
      }
    }
  }
}

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

    await postProcessSale(db, {
      organizationId: input.organizationId,
      saleId: existing.id,
      status: event.status,
      amount: event.amount ?? existing.amount,
      commissionAmount: event.commissionAmount ?? existing.commissionAmount,
      productId: productId ?? existing.productId,
      platform: input.platform,
      externalOrderId: event.externalOrderId,
      occurredAt: event.occurredAt ?? existing.occurredAt,
    });

    return { saleId: existing.id, created: false, attributed: Boolean(validToken) };
  }

  const sale = await insertSale(db, saleValues);

  await postProcessSale(db, {
    organizationId: input.organizationId,
    saleId: sale.id,
    status: event.status,
    amount: event.amount,
    commissionAmount: event.commissionAmount,
    productId,
    platform: input.platform,
    externalOrderId: event.externalOrderId,
    occurredAt: event.occurredAt ?? sale.occurredAt,
  });

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
