import "server-only";

import { and, desc, eq } from "drizzle-orm";

import * as schema from "@/server/db/schema";
import { leadAnalyses, leadScores, messageDrafts, leads } from "@/server/db/schema";
import type { TenantDb } from "@/server/db/tenant";

// ---------- Scores ----------

export async function insertLeadScore(
  db: TenantDb,
  values: typeof leadScores.$inferInsert
): Promise<void> {
  await db.insert(leadScores).values(values);
}

export async function getLatestScore(db: TenantDb, organizationId: string, leadId: string) {
  const [score] = await db
    .select()
    .from(leadScores)
    .where(
      and(
        eq(leadScores.organizationId, organizationId),
        eq(leadScores.leadId, leadId)
      )
    )
    .orderBy(desc(leadScores.createdAt))
    .limit(1);
  return score ?? null;
}

/** Grava o histórico + atualiza o score denormalizado do lead. */
export async function saveLeadScore(
  db: TenantDb,
  input: {
    organizationId: string;
    leadId: string;
    total: number;
    classification: string;
    breakdown: unknown;
    weightsSnapshot: unknown;
  }
): Promise<void> {
  await insertLeadScore(db, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    total: input.total,
    classification: input.classification,
    breakdown: input.breakdown as Record<string, unknown>[],
    weightsSnapshot: input.weightsSnapshot as Record<string, unknown>,
  });

  await db
    .update(leads)
    .set({ score: input.total, scoredAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(and(eq(leads.organizationId, input.organizationId), eq(leads.id, input.leadId)));
}

// ---------- Análises ----------

export async function insertLeadAnalysis(
  db: TenantDb,
  values: typeof leadAnalyses.$inferInsert
): Promise<typeof leadAnalyses.$inferSelect> {
  const [analysis] = await db.insert(leadAnalyses).values(values).returning();
  return analysis;
}

export async function getLatestAnalysis(db: TenantDb, organizationId: string, leadId: string) {
  const [analysis] = await db
    .select()
    .from(leadAnalyses)
    .where(
      and(
        eq(leadAnalyses.organizationId, organizationId),
        eq(leadAnalyses.leadId, leadId),
        eq(leadAnalyses.status, "completed")
      )
    )
    .orderBy(desc(leadAnalyses.createdAt))
    .limit(1);
  return analysis ?? null;
}

// ---------- Rascunhos ----------

export async function insertMessageDraft(
  db: TenantDb,
  values: typeof messageDrafts.$inferInsert
): Promise<typeof messageDrafts.$inferSelect> {
  const [draft] = await db.insert(messageDrafts).values(values).returning();
  return draft;
}

export async function listMessageDrafts(db: TenantDb, organizationId: string, leadId: string) {
  return db
    .select({
      draft: messageDrafts,
      productName: schema.products.name,
    })
    .from(messageDrafts)
    .leftJoin(schema.products, eq(schema.products.id, messageDrafts.productId))
    .where(
      and(
        eq(messageDrafts.organizationId, organizationId),
        eq(messageDrafts.leadId, leadId),
        eq(messageDrafts.status, "draft")
      )
    )
    .orderBy(desc(messageDrafts.createdAt))
    .limit(10);
}

export async function getMessageDraft(
  db: TenantDb,
  organizationId: string,
  draftId: string
) {
  const [draft] = await db
    .select()
    .from(messageDrafts)
    .where(
      and(
        eq(messageDrafts.organizationId, organizationId),
        eq(messageDrafts.id, draftId)
      )
    )
    .limit(1);
  return draft ?? null;
}

export async function updateMessageDraft(
  db: TenantDb,
  organizationId: string,
  draftId: string,
  patch: Partial<typeof messageDrafts.$inferInsert>
): Promise<void> {
  await db
    .update(messageDrafts)
    .set(patch)
    .where(and(eq(messageDrafts.organizationId, organizationId), eq(messageDrafts.id, draftId)));
}

export async function discardMessageDraft(
  db: TenantDb,
  organizationId: string,
  draftId: string
): Promise<void> {
  await db
    .update(messageDrafts)
    .set({ status: "archived" })
    .where(and(eq(messageDrafts.organizationId, organizationId), eq(messageDrafts.id, draftId)));
}
