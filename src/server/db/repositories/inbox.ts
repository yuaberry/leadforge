import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "@/server/db/schema";
import { conversationMessages, conversations, whatsappAccounts } from "@/server/db/schema";
import type { TenantDb } from "@/server/db/tenant";

type AnyDb = NodePgDatabase<typeof schema>;

// ---------- Conversas ----------

export async function listConversations(db: AnyDb, organizationId: string) {
  return db
    .select({
      conversation: conversations,
      leadId: schema.leads.id,
      contactName: schema.contacts.fullName,
      contactEmail: schema.contacts.email,
      contactPhone: schema.contacts.phone,
      companyName: schema.companies.name,
    })
    .from(conversations)
    .leftJoin(schema.leads, eq(schema.leads.id, conversations.leadId))
    .leftJoin(schema.contacts, eq(schema.contacts.id, schema.leads.contactId))
    .leftJoin(schema.companies, eq(schema.companies.id, schema.leads.companyId))
    .where(eq(conversations.organizationId, organizationId))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(60);
}

export async function getConversation(db: AnyDb, organizationId: string, conversationId: string) {
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.organizationId, organizationId),
        eq(conversations.id, conversationId)
      )
    )
    .limit(1);
  return conversation ?? null;
}

export async function listConversationMessages(
  db: AnyDb,
  organizationId: string,
  conversationId: string,
  limit = 100
) {
  return db
    .select()
    .from(conversationMessages)
    .where(
      and(
        eq(conversationMessages.organizationId, organizationId),
        eq(conversationMessages.conversationId, conversationId)
      )
    )
    .orderBy(asc(conversationMessages.createdAt))
    .limit(limit);
}

/** Upsert da conversa (lead, canal) + registro da mensagem — usado por envios e webhook. */
export async function recordConversationMessage(
  db: AnyDb,
  input: {
    organizationId: string;
    leadId: string;
    channel: "email" | "whatsapp";
    direction: "inbound" | "outbound";
    body: string;
    status: "received" | "sent" | "delivered" | "read" | "failed";
    providerMessageId?: string | null;
    error?: string | null;
    occurredAt?: string;
  }
): Promise<{ conversationId: string; messageId: string }> {
  const [conversation] = await db
    .insert(conversations)
    .values({
      organizationId: input.organizationId,
      leadId: input.leadId,
      channel: input.channel,
      status: "open",
      lastMessageAt: input.occurredAt ?? new Date().toISOString(),
      lastMessagePreview: input.body.slice(0, 120),
      lastDirection: input.direction,
      unreadCount: input.direction === "inbound" ? 1 : 0,
    })
    .onConflictDoUpdate({
      target: [conversations.leadId, conversations.channel],
      set: {
        lastMessageAt: input.occurredAt ?? new Date().toISOString(),
        lastMessagePreview: input.body.slice(0, 120),
        lastDirection: input.direction,
        updatedAt: new Date().toISOString(),
        unreadCount:
          input.direction === "inbound"
            ? sql`${conversations.unreadCount} + 1`
            : sql`${conversations.unreadCount}`,
        status: "open",
      },
    })
    .returning();

  const [message] = await db
    .insert(conversationMessages)
    .values({
      organizationId: input.organizationId,
      conversationId: conversation.id,
      leadId: input.leadId,
      channel: input.channel,
      direction: input.direction,
      body: input.body,
      status: input.status,
      providerMessageId: input.providerMessageId ?? null,
      error: input.error ?? null,
    })
    .returning();

  return { conversationId: conversation.id, messageId: message.id };
}

export async function markConversationRead(
  db: AnyDb,
  organizationId: string,
  conversationId: string
): Promise<void> {
  await db
    .update(conversations)
    .set({ unreadCount: 0, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(conversations.organizationId, organizationId),
        eq(conversations.id, conversationId)
      )
    );
}

export async function updateConversationMessageStatus(
  db: AnyDb,
  providerMessageId: string,
  status: "sent" | "delivered" | "read" | "failed"
): Promise<void> {
  await db
    .update(conversationMessages)
    .set({ status })
    .where(eq(conversationMessages.providerMessageId, providerMessageId));
}

// ---------- Contas WhatsApp ----------

export async function getWhatsAppAccount(db: AnyDb, organizationId: string) {
  const [account] = await db
    .select()
    .from(whatsappAccounts)
    .where(eq(whatsappAccounts.organizationId, organizationId))
    .limit(1);
  return account ?? null;
}

export async function upsertWhatsAppAccount(
  db: TenantDb,
  input: {
    organizationId: string;
    phoneNumberId: string;
    displayPhone: string;
    displayName: string;
    webhookToken: string;
  }
): Promise<typeof whatsappAccounts.$inferSelect> {
  const existing = await getWhatsAppAccount(db, input.organizationId);
  if (existing) {
    const [updated] = await db
      .update(whatsappAccounts)
      .set({
        phoneNumberId: input.phoneNumberId,
        displayPhone: input.displayPhone,
        displayName: input.displayName,
      })
      .where(eq(whatsappAccounts.id, existing.id))
      .returning();
    return updated;
  }
  const [created] = await db.insert(whatsappAccounts).values(input).returning();
  return created;
}

export async function getWhatsAppAccountByWebhookToken(db: AnyDb, token: string) {
  const [account] = await db
    .select()
    .from(whatsappAccounts)
    .where(eq(whatsappAccounts.webhookToken, token))
    .limit(1);
  return account ?? null;
}

export async function getWhatsAppAccountByPhoneNumberId(db: AnyDb, phoneNumberId: string) {
  const [account] = await db
    .select()
    .from(whatsappAccounts)
    .where(eq(whatsappAccounts.phoneNumberId, phoneNumberId))
    .limit(1);
  return account ?? null;
}

export async function unreadConversationsCount(db: AnyDb, organizationId: string) {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${conversations.unreadCount}), 0)`.mapWith(Number) })
    .from(conversations)
    .where(eq(conversations.organizationId, organizationId));
  return row?.total ?? 0;
}
