import "server-only";

import { and, count, desc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "@/server/db/schema";
import {
  linkTokens,
  products,
  sales,
} from "@/server/db/schema";

type AnyDb = NodePgDatabase<typeof schema>;

// ---------- Products ----------

export async function listProducts(db: AnyDb, organizationId: string) {
  const rows = await db
    .select({
      product: products,
      salesCount: sql<number>`(
        select count(*) from ${sales}
        where ${sales.productId} = ${products.id} and ${sales.status} = 'paid'
      )`.mapWith(Number),
    })
    .from(products)
    .where(eq(products.organizationId, organizationId))
    .orderBy(desc(products.updatedAt));
  return rows;
}

export async function getProduct(db: AnyDb, organizationId: string, productId: string) {
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.organizationId, organizationId), eq(products.id, productId)))
    .limit(1);
  return product ?? null;
}

export async function insertProduct(
  db: AnyDb,
  values: typeof products.$inferInsert
): Promise<typeof products.$inferSelect> {
  const [product] = await db.insert(products).values(values).returning();
  return product;
}

export async function updateProduct(
  db: AnyDb,
  organizationId: string,
  productId: string,
  patch: Partial<typeof products.$inferInsert>
): Promise<void> {
  await db
    .update(products)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(and(eq(products.organizationId, organizationId), eq(products.id, productId)));
}

// ---------- Integrações ----------

export async function insertIntegration(
  db: AnyDb,
  values: typeof schema.commerceIntegrations.$inferInsert
) {
  const [integration] = await db.insert(schema.commerceIntegrations).values(values).returning();
  return integration;
}

export async function listIntegrations(db: AnyDb, organizationId: string) {
  return db
    .select()
    .from(schema.commerceIntegrations)
    .where(eq(schema.commerceIntegrations.organizationId, organizationId))
    .orderBy(desc(schema.commerceIntegrations.createdAt));
}

/** Roteamento de webhook: token único → integração. */
export async function getIntegrationByToken(db: AnyDb, platform: string, token: string) {
  const [integration] = await db
    .select()
    .from(schema.commerceIntegrations)
    .where(
      and(
        eq(schema.commerceIntegrations.webhookToken, token),
        eq(schema.commerceIntegrations.platform, platform as "kiwify")
      )
    )
    .limit(1);
  return integration ?? null;
}

// ---------- Link tokens ----------

export async function insertLinkToken(
  db: AnyDb,
  values: typeof linkTokens.$inferInsert
): Promise<typeof linkTokens.$inferSelect> {
  const [token] = await db.insert(linkTokens).values(values).returning();
  return token;
}

export async function getLinkTokenByToken(db: AnyDb, token: string) {
  const [row] = await db
    .select()
    .from(linkTokens)
    .where(eq(linkTokens.token, token))
    .limit(1);
  return row ?? null;
}

export async function listLinkTokens(db: AnyDb, organizationId: string, productId?: string) {
  const conditions = [eq(linkTokens.organizationId, organizationId)];
  if (productId) conditions.push(eq(linkTokens.productId, productId));
  return db
    .select()
    .from(linkTokens)
    .where(and(...conditions))
    .orderBy(desc(linkTokens.createdAt));
}

export async function setLinkTokenActive(
  db: AnyDb,
  organizationId: string,
  tokenId: string,
  active: boolean
): Promise<void> {
  await db
    .update(linkTokens)
    .set({ active })
    .where(and(eq(linkTokens.organizationId, organizationId), eq(linkTokens.id, tokenId)));
}

export async function recordLinkClick(
  db: AnyDb,
  values: typeof schema.linkClicks.$inferInsert
): Promise<void> {
  await db.insert(schema.linkClicks).values(values);
  await db
    .update(linkTokens)
    .set({ clickCount: sql`${linkTokens.clickCount} + 1` })
    .where(eq(linkTokens.id, values.linkTokenId));
}

// ---------- Sales ----------

export async function insertSale(
  db: AnyDb,
  values: typeof sales.$inferInsert
): Promise<typeof sales.$inferSelect> {
  const [sale] = await db.insert(sales).values(values).returning();
  return sale;
}

export async function updateSale(
  db: AnyDb,
  saleId: string,
  patch: Partial<typeof sales.$inferInsert>
): Promise<void> {
  await db
    .update(sales)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(sales.id, saleId));
}

export async function findSaleByExternalOrderId(
  db: AnyDb,
  organizationId: string,
  platform: string,
  externalOrderId: string
) {
  const [sale] = await db
    .select()
    .from(sales)
    .where(
      and(
        eq(sales.organizationId, organizationId),
        eq(sales.platform, platform as "kiwify"),
        eq(sales.externalOrderId, externalOrderId)
      )
    )
    .limit(1);
  return sale ?? null;
}

export async function listSales(
  db: AnyDb,
  organizationId: string,
  filters: { page: number; pageSize: number; productId?: string }
) {
  const conditions = [eq(sales.organizationId, organizationId)];
  if (filters.productId) conditions.push(eq(sales.productId, filters.productId));

  const rows = await db
    .select({
      sale: sales,
      productName: products.name,
      tokenLabel: linkTokens.label,
    })
    .from(sales)
    .leftJoin(products, eq(products.id, sales.productId))
    .leftJoin(linkTokens, eq(linkTokens.id, sales.linkTokenId))
    .where(and(...conditions))
    .orderBy(desc(sales.occurredAt))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);

  const [totals] = await db
    .select({ total: count() })
    .from(sales)
    .where(and(...conditions));

  return { items: rows, total: Number(totals?.total ?? 0) };
}

export async function salesTotals(db: AnyDb, organizationId: string) {
  const [row] = await db
    .select({
      paidCount: sql<number>`count(*) filter (where ${sales.status} = 'paid')`.mapWith(Number),
      paidCommission: sql<number>`coalesce(sum(${sales.commissionAmount}) filter (where ${sales.status} = 'paid'), 0)`.mapWith(
        Number
      ),
      paidRevenue: sql<number>`coalesce(sum(${sales.amount}) filter (where ${sales.status} = 'paid'), 0)`.mapWith(
        Number
      ),
      refundedCount: sql<number>`count(*) filter (where ${sales.status} = 'refunded')`.mapWith(
        Number
      ),
    })
    .from(sales)
    .where(eq(sales.organizationId, organizationId));
  return (
    row ?? { paidCount: 0, paidCommission: 0, paidRevenue: 0, refundedCount: 0 }
  );
}
