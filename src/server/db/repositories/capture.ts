import "server-only";

import { and, count, desc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import {
  capturePages,
  formSubmissions,
  leads,
} from "@/server/db/schema";
import * as schema from "@/server/db/schema";

type AnyDb = NodePgDatabase<typeof schema>;

// ---------- CRUD (org autenticada) ----------

export async function listCapturePages(db: AnyDb, organizationId: string) {
  return db
    .select()
    .from(capturePages)
    .where(eq(capturePages.organizationId, organizationId))
    .orderBy(desc(capturePages.createdAt));
}

export async function getCapturePage(db: AnyDb, organizationId: string, pageId: string) {
  const [page] = await db
    .select()
    .from(capturePages)
    .where(
      and(eq(capturePages.organizationId, organizationId), eq(capturePages.id, pageId))
    )
    .limit(1);
  return page ?? null;
}

export async function slugTaken(db: AnyDb, slug: string): Promise<boolean> {
  const [row] = await db
    .select({ id: capturePages.id })
    .from(capturePages)
    .where(eq(capturePages.slug, slug))
    .limit(1);
  return Boolean(row);
}

export async function insertCapturePage(
  db: AnyDb,
  values: typeof capturePages.$inferInsert
): Promise<typeof capturePages.$inferSelect> {
  const [page] = await db.insert(capturePages).values(values).returning();
  return page;
}

export async function updateCapturePage(
  db: AnyDb,
  organizationId: string,
  pageId: string,
  patch: Partial<typeof capturePages.$inferInsert>
): Promise<void> {
  await db
    .update(capturePages)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(and(eq(capturePages.organizationId, organizationId), eq(capturePages.id, pageId)));
}

// ---------- Leitura pública (serviceDb — /p/[slug]) ----------

export async function getPublishedPageBySlug(db: AnyDb, slug: string) {
  const [page] = await db
    .select()
    .from(capturePages)
    .where(and(eq(capturePages.slug, slug), eq(capturePages.status, "published")))
    .limit(1);
  return page ?? null;
}

// ---------- Submissão pública ----------

export async function recordCaptureSubmission(
  db: AnyDb,
  input: {
    organizationId: string;
    capturePageId: string;
    leadId: string | null;
    data: Record<string, unknown>;
    ip: string | null;
    userAgent: string | null;
    utm: Record<string, unknown>;
  }
): Promise<void> {
  await db.insert(formSubmissions).values({
    organizationId: input.organizationId,
    capturePageId: input.capturePageId,
    leadId: input.leadId,
    data: input.data,
    ip: input.ip,
    userAgent: input.userAgent,
    utm: input.utm,
    legalBasis: "consent",
  });

  await db
    .update(capturePages)
    .set({ submissionsCount: sql`${capturePages.submissionsCount} + 1` })
    .where(eq(capturePages.id, input.capturePageId));
}

// ---------- Estatísticas (org autenticada) ----------

export async function capturePageStats(db: AnyDb, organizationId: string, pageId: string) {
  const submissions = await db
    .select({
      id: formSubmissions.id,
      createdAt: formSubmissions.createdAt,
      utm: formSubmissions.utm,
      leadId: formSubmissions.leadId,
      leadName: leads.id,
    })
    .from(formSubmissions)
    .leftJoin(leads, eq(leads.id, formSubmissions.leadId))
    .where(
      and(
        eq(formSubmissions.organizationId, organizationId),
        eq(formSubmissions.capturePageId, pageId)
      )
    )
    .orderBy(desc(formSubmissions.createdAt))
    .limit(25);

  const [totals] = await db
    .select({ total: count() })
    .from(formSubmissions)
    .where(
      and(
        eq(formSubmissions.organizationId, organizationId),
        eq(formSubmissions.capturePageId, pageId)
      )
    );

  return { submissions, total: Number(totals?.total ?? 0) };
}
