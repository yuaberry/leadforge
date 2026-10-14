import "server-only";

import { and, asc, count, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "@/server/db/schema";
import {
  campaignLeads,
  campaignSteps,
  campaigns,
  emailAccounts,
  messages,
  suppressionList,
} from "@/server/db/schema";
import type { TenantDb } from "@/server/db/tenant";

type AnyDb = NodePgDatabase<typeof schema>;

// ---------- Campaigns ----------

export async function listCampaigns(db: AnyDb, organizationId: string) {
  return db
    .select({
      campaign: campaigns,
      leadsCount: sql<number>`(
        select count(*) from ${campaignLeads}
        where ${campaignLeads.campaignId} = ${campaigns.id}
      )`.mapWith(Number),
      messagesSent: sql<number>`(
        select count(*) from ${messages}
        where ${messages.campaignId} = ${campaigns.id} and ${messages.status} in ('sent','delivered')
      )`.mapWith(Number),
    })
    .from(campaigns)
    .where(eq(campaigns.organizationId, organizationId))
    .orderBy(desc(campaigns.createdAt));
}

export async function getCampaign(db: AnyDb, organizationId: string, campaignId: string) {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.organizationId, organizationId), eq(campaigns.id, campaignId)))
    .limit(1);
  return campaign ?? null;
}

export async function insertCampaign(
  db: TenantDb,
  values: typeof campaigns.$inferInsert
): Promise<typeof campaigns.$inferSelect> {
  const [campaign] = await db.insert(campaigns).values(values).returning();
  return campaign;
}

export async function updateCampaign(
  db: TenantDb,
  organizationId: string,
  campaignId: string,
  patch: Partial<typeof campaigns.$inferInsert>
): Promise<void> {
  await db
    .update(campaigns)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(and(eq(campaigns.organizationId, organizationId), eq(campaigns.id, campaignId)));
}

export async function listSteps(db: AnyDb, organizationId: string, campaignId: string) {
  return db
    .select()
    .from(campaignSteps)
    .where(
      and(eq(campaignSteps.organizationId, organizationId), eq(campaignSteps.campaignId, campaignId))
    )
    .orderBy(asc(campaignSteps.position));
}

export async function insertStep(
  db: TenantDb,
  values: typeof campaignSteps.$inferInsert
): Promise<typeof campaignSteps.$inferSelect> {
  const [step] = await db.insert(campaignSteps).values(values).returning();
  return step;
}

export async function deleteStep(
  db: TenantDb,
  organizationId: string,
  stepId: string
): Promise<void> {
  await db
    .delete(campaignSteps)
    .where(
      and(eq(campaignSteps.organizationId, organizationId), eq(campaignSteps.id, stepId))
    );
}

// ---------- Campaign leads ----------

export async function addLeadsToCampaign(
  db: TenantDb,
  input: {
    organizationId: string;
    campaignId: string;
    leadIds: string[];
  }
): Promise<number> {
  if (input.leadIds.length === 0) return 0;
  const inserted = await db
    .insert(campaignLeads)
    .values(
      input.leadIds.map((leadId) => ({
        organizationId: input.organizationId,
        campaignId: input.campaignId,
        leadId,
        status: "active" as const,
        currentStep: 1,
        nextStepAt: new Date().toISOString(),
      }))
    )
    .onConflictDoNothing()
    .returning({ id: campaignLeads.id });
  return inserted.length;
}

export async function listCampaignLeads(db: AnyDb, organizationId: string, campaignId: string) {
  return db
    .select({
      entry: campaignLeads,
      contactName: schema.contacts.fullName,
      contactEmail: schema.contacts.email,
      leadStage: schema.leads.stage,
      leadScore: schema.leads.score,
    })
    .from(campaignLeads)
    .leftJoin(schema.leads, eq(schema.leads.id, campaignLeads.leadId))
    .leftJoin(schema.contacts, eq(schema.contacts.id, schema.leads.contactId))
    .where(
      and(
        eq(campaignLeads.organizationId, organizationId),
        eq(campaignLeads.campaignId, campaignId)
      )
    )
    .orderBy(asc(campaignLeads.addedAt))
    .limit(200);
}

export async function campaignLeadsByStatus(db: AnyDb, organizationId: string, campaignId: string) {
  return db
    .select({ status: campaignLeads.status, total: count() })
    .from(campaignLeads)
    .where(
      and(
        eq(campaignLeads.organizationId, organizationId),
        eq(campaignLeads.campaignId, campaignId)
      )
    )
    .groupBy(campaignLeads.status);
}

// ---------- Messages ----------

export async function insertMessage(
  db: AnyDb,
  values: typeof messages.$inferInsert
): Promise<typeof messages.$inferSelect> {
  const [message] = await db.insert(messages).values(values).returning();
  return message;
}

export async function updateMessage(
  db: AnyDb,
  organizationId: string,
  messageId: string,
  patch: Partial<typeof messages.$inferInsert>
): Promise<void> {
  await db
    .update(messages)
    .set(patch)
    .where(and(eq(messages.organizationId, organizationId), eq(messages.id, messageId)));
}

export async function getMessage(db: AnyDb, organizationId: string, messageId: string) {
  const [message] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.organizationId, organizationId), eq(messages.id, messageId)))
    .limit(1);
  return message ?? null;
}

export async function listCampaignMessages(
  db: AnyDb,
  organizationId: string,
  campaignId: string,
  status?: string
) {
  const conditions = [
    eq(messages.organizationId, organizationId),
    eq(messages.campaignId, campaignId),
  ];
  if (status) {
    conditions.push(eq(messages.status, status as "sent"));
  }
  return db
    .select()
    .from(messages)
    .where(and(...conditions))
    .orderBy(desc(messages.createdAt))
    .limit(100);
}

export async function messagesSentToday(db: AnyDb, organizationId: string, campaignId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [row] = await db
    .select({ total: count() })
    .from(messages)
    .where(
      and(
        eq(messages.organizationId, organizationId),
        eq(messages.campaignId, campaignId),
        gte(messages.sentAt, startOfDay.toISOString())
      )
    );
  return Number(row?.total ?? 0);
}

export async function findMessageByProviderId(db: AnyDb, providerMessageId: string) {
  const [message] = await db
    .select()
    .from(messages)
    .where(eq(messages.providerMessageId, providerMessageId))
    .limit(1);
  return message ?? null;
}

// ---------- Email accounts ----------

export async function getEmailAccount(db: AnyDb, organizationId: string) {
  const [account] = await db
    .select()
    .from(emailAccounts)
    .where(eq(emailAccounts.organizationId, organizationId))
    .limit(1);
  return account ?? null;
}

export async function upsertEmailAccount(
  db: TenantDb,
  input: { organizationId: string; fromEmail: string; fromName: string }
): Promise<typeof emailAccounts.$inferSelect> {
  const existing = await getEmailAccount(db, input.organizationId);
  if (existing) {
    const [updated] = await db
      .update(emailAccounts)
      .set({ fromEmail: input.fromEmail, fromName: input.fromName })
      .where(eq(emailAccounts.id, existing.id))
      .returning();
    return updated;
  }
  const { randomBytes } = await import("node:crypto");
  const [created] = await db
    .insert(emailAccounts)
    .values({
      organizationId: input.organizationId,
      fromEmail: input.fromEmail,
      fromName: input.fromName,
      webhookToken: randomBytes(24).toString("base64url"),
    })
    .returning();
  return created;
}

export async function getEmailAccountByWebhookToken(db: AnyDb, token: string) {
  const [account] = await db
    .select()
    .from(emailAccounts)
    .where(eq(emailAccounts.webhookToken, token))
    .limit(1);
  return account ?? null;
}

// ---------- Suppression ----------

export async function addSuppression(
  db: AnyDb,
  input: {
    organizationId: string;
    emailNormalized?: string | null;
    phoneNormalized?: string | null;
    channel: "email" | "whatsapp" | "all";
    reason: "unsubscribe" | "bounce" | "complaint" | "manual" | "optout_keyword";
    note?: string | null;
  }
): Promise<void> {
  await db
    .insert(suppressionList)
    .values({
      organizationId: input.organizationId,
      emailNormalized: input.emailNormalized ?? null,
      phoneNormalized: input.phoneNormalized ?? null,
      channel: input.channel,
      reason: input.reason,
      note: input.note ?? null,
    })
    .onConflictDoNothing();
}

export async function listSuppression(db: AnyDb, organizationId: string) {
  return db
    .select()
    .from(suppressionList)
    .where(eq(suppressionList.organizationId, organizationId))
    .orderBy(desc(suppressionList.createdAt))
    .limit(200);
}

export async function removeSuppression(
  db: TenantDb,
  organizationId: string,
  suppressionId: string
): Promise<void> {
  await db
    .delete(suppressionList)
    .where(
      and(
        eq(suppressionList.organizationId, organizationId),
        eq(suppressionList.id, suppressionId)
      )
    );
}

/** Busca as linhas de suppression relevantes para um contato (usada pelo gate). */
export async function suppressionRowsForContact(
  db: AnyDb,
  organizationId: string,
  email: string | null,
  phone: string | null
) {
  const conditions = [eq(suppressionList.organizationId, organizationId)];
  const keys = [];
  if (email) keys.push(eq(suppressionList.emailNormalized, email.trim().toLowerCase()));
  if (phone) keys.push(eq(suppressionList.phoneNormalized, phone));
  if (keys.length === 0) return [];
  return db
    .select({
      emailNormalized: suppressionList.emailNormalized,
      phoneNormalized: suppressionList.phoneNormalized,
      channel: suppressionList.channel,
    })
    .from(suppressionList)
    .where(and(...conditions, or(...keys)));
}

/** Marca opt-out em todos os leads da org com este e-mail (bloqueia campanhas futuras). */
export async function markLeadsOptedOutByEmail(
  db: AnyDb,
  organizationId: string,
  email: string
): Promise<number> {
  const now = new Date().toISOString();
  const rows = await db
    .select({ leadId: schema.leads.id })
    .from(schema.leads)
    .leftJoin(schema.contacts, eq(schema.contacts.id, schema.leads.contactId))
    .where(
      and(
        eq(schema.leads.organizationId, organizationId),
        eq(schema.contacts.emailNormalized, email.trim().toLowerCase())
      )
    );
  if (rows.length === 0) return 0;
  await db
    .update(schema.leads)
    .set({ optedOutAt: now, updatedAt: now })
    .where(
      and(
        eq(schema.leads.organizationId, organizationId),
        inArray(
          schema.leads.id,
          rows.map((row) => row.leadId)
        )
      )
    );
  return rows.length;
}
