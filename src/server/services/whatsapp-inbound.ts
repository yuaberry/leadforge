import "server-only";

import { and, eq } from "drizzle-orm";

import * as schema from "@/server/db/schema";
import { contacts, leads } from "@/server/db/schema";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { normalizePhoneBR } from "@/lib/format";
import { addSuppression } from "@/server/db/repositories/campaigns";
import { recordConversationMessage } from "@/server/db/repositories/inbox";
import { recordActivity } from "@/server/db/repositories/leads";
import { getWhatsAppProvider } from "@/server/providers/whatsapp";
import { isOptOutMessage, optOutConfirmationMessage } from "@/server/services/optout";
import type { ParsedWhatsAppWebhook } from "@/server/services/whatsapp-webhook";

type AnyDb = NodePgDatabase<typeof schema>;

export type WhatsAppWebhookReport = {
  inboundMessages: number;
  optOuts: number;
  statusUpdates: number;
  newLeads: number;
};

/**
 * Processa o webhook da Cloud API (serviceDb — sem claims):
 *  1. Mensagem recebida → conversa + mensagem inbound.
 *  2. OPT-OUT por palavra-chave → suppression (all) + opted_out_at
 *     em TODOS os leads com o telefone + confirmação automática.
 *  3. Status → atualiza mensagens outbound (delivered/read).
 */
export async function handleWhatsAppWebhook(
  db: AnyDb,
  organizationId: string,
  parsed: ParsedWhatsAppWebhook
): Promise<WhatsAppWebhookReport> {
  const report: WhatsAppWebhookReport = {
    inboundMessages: 0,
    optOuts: 0,
    statusUpdates: 0,
    newLeads: 0,
  };

  // 1. Mensagens de entrada
  for (const message of parsed.messages) {
    const phone = normalizePhoneBR(message.fromPhone) ?? message.fromPhone;

    // idempotência: a Meta reenvia eventos — nunca duplica mensagem
    const { conversationMessages } = await import("@/server/db/schema");
    const [existing] = await db
      .select({ id: conversationMessages.id })
      .from(conversationMessages)
      .where(eq(conversationMessages.providerMessageId, message.providerMessageId))
      .limit(1);
    if (existing) continue;

    // resolve/cria contato+lead pelo telefone (dentro da org — serviceDb)
    const [contact] = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.organizationId, organizationId),
          eq(contacts.phoneNormalized, phone)
        )
      )
      .limit(1);

    let contactId = contact?.id ?? null;

    if (!contactId) {
      const [created] = await db
        .insert(contacts)
        .values({
          organizationId,
          fullName: message.contactName ?? `WhatsApp ${message.fromPhone.slice(-4)}`,
          phone: message.fromPhone,
          phoneNormalized: phone,
          consentStatus: "granted", // o contato iniciou a conversa
          legalBasis: "consent",
        })
        .returning();
      contactId = created.id;
    }

    const [lead] = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.organizationId, organizationId),
          eq(leads.contactId, contactId)
        )
      )
      .limit(1);

    let leadId = lead?.id ?? null;
    if (!leadId) {
      const [createdLead] = await db
        .insert(leads)
        .values({
          organizationId,
          contactId,
          stage: "replied", // contato iniciou conversa
          legalBasis: "consent",
          consentStatus: "granted",
        })
        .returning();
      leadId = createdLead.id;
      report.newLeads++;
    }

    await recordConversationMessage(db, {
      organizationId,
      leadId,
      channel: "whatsapp",
      direction: "inbound",
      body: message.text,
      status: "received",
      providerMessageId: message.providerMessageId,
      occurredAt: message.timestamp ?? undefined,
    });
    report.inboundMessages++;

    // ===== OPT-OUT POR PALAVRA-CHAVE (invariável) =====
    if (isOptOutMessage(message.text)) {
      await addSuppression(db, {
        organizationId,
        phoneNormalized: phone,
        channel: "all",
        reason: "optout_keyword",
        note: `Palavra-chave: "${message.text.slice(0, 60)}"`,
      });

      // marca opted_out em todos os leads com este contato
      const leadRows = await db
        .select({ id: leads.id })
        .from(leads)
        .where(
          and(
            eq(leads.organizationId, organizationId),
            eq(leads.contactId, contactId)
          )
        );
      const now = new Date().toISOString();
      for (const row of leadRows) {
        await db
          .update(leads)
          .set({ optedOutAt: now, updatedAt: now })
          .where(eq(leads.id, row.id));
      }

      await recordActivity(db, {
        organizationId,
        type: "optout_whatsapp",
        entityType: "lead",
        entityId: leadId,
        metadata: { phone, keyword: message.text.slice(0, 60) },
      });
      report.optOuts++;

      // confirmação automática (boa prática da Meta)
      const provider = getWhatsAppProvider();
      const sendResult = await provider.sendText({
        to: phone,
        body: optOutConfirmationMessage(),
      });
      if (sendResult.ok) {
        await recordConversationMessage(db, {
          organizationId,
          leadId,
          channel: "whatsapp",
          direction: "outbound",
          body: optOutConfirmationMessage(),
          status: "sent",
          providerMessageId: sendResult.providerMessageId,
        });
      }
    }
  }

  // 2. Status de mensagens outbound
  const { updateConversationMessageStatus } = await import(
    "@/server/db/repositories/inbox"
  );
  for (const statusUpdate of parsed.statuses) {
    await updateConversationMessageStatus(db, statusUpdate.providerMessageId, statusUpdate.status);
    report.statusUpdates++;
  }

  return report;
}
