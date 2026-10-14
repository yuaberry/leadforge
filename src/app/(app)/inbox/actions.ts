"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";

import { z } from "zod";

import { requireOrgContext } from "@/server/auth/session";
import { withTenantDb } from "@/server/db/tenant";
import { leads as leadsTable, contacts as contactsTable } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import {
  getConversation,
  markConversationRead,
  recordConversationMessage,
  upsertWhatsAppAccount,
} from "@/server/db/repositories/inbox";
import { getEmailProvider } from "@/server/providers/email";
import { getWhatsAppProvider } from "@/server/providers/whatsapp";
import { decideEligibility } from "@/server/services/eligibility";
import { suppressionRowsForContact } from "@/server/db/repositories/campaigns";
import { getEmailAccount } from "@/server/db/repositories/campaigns";
import { recordActivity } from "@/server/db/repositories/leads";

type InboxState = { error?: string; success?: string } | null;

const replySchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().trim().min(1, "Escreva a resposta").max(4000),
});

const whatsappAccountSchema = z.object({
  phoneNumberId: z.string().trim().min(4, "Informe o phone_number_id").max(60),
  displayPhone: z.string().trim().min(4, "Informe o número").max(30),
  displayName: z.string().trim().min(2, "Informe o nome exibido").max(80),
});

/**
 * Responder uma conversa pela inbox (e-mail via Resend; WhatsApp na janela
 * de 24h). O GATE DE ELEGIBILIDADE se aplica: contato suprimido/opted-out
 * NUNCA recebe resposta.
 */
export async function sendInboxReplyAction(
  _prev: InboxState,
  formData: FormData
): Promise<InboxState> {
  const ctx = await requireOrgContext();

  const parsed = replySchema.safeParse({
    conversationId: String(formData.get("conversationId") ?? ""),
    body: String(formData.get("body") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const result = await withTenantDb(ctx.accessToken, async (db) => {
    const conversation = await getConversation(db, ctx.organization.id, parsed.data.conversationId);
    if (!conversation) return { error: "Conversa não encontrada." } as const;

    const [lead] = await db
      .select()
      .from(leadsTable)
      .where(
        and(
          eq(leadsTable.organizationId, ctx.organization.id),
          eq(leadsTable.id, conversation.leadId)
        )
      )
      .limit(1);
    if (!lead) return { error: "Lead não encontrado." } as const;

    const [contact] = lead.contactId
      ? await db.select().from(contactsTable).where(eq(contactsTable.id, lead.contactId)).limit(1)
      : [null];

    // ===== GATE (invariável) =====
    const suppression = await suppressionRowsForContact(
      db,
      ctx.organization.id,
      contact?.email ?? null,
      contact?.phone ?? null
    );
    const decision = decideEligibility({
      email: contact?.email ?? null,
      phone: contact?.phone ?? null,
      suppression,
      optedOutAt: lead.optedOutAt,
      consentStatus: lead.consentStatus,
      legalBasis: lead.legalBasis,
      channel: conversation.channel,
    });
    if (!decision.eligible) {
      return { error: `Contato bloqueado (${decision.reason}).` } as const;
    }

    if (conversation.channel === "email") {
      const account = await getEmailAccount(db, ctx.organization.id);
      const provider = getEmailProvider();
      const send = await provider.send({
        to: contact?.email ?? "",
        from: account ? `${account.fromName} <${account.fromEmail}>` : "LeadForge <onboarding@resend.dev>",
        subject: `Re: ${conversation.lastMessagePreview?.slice(0, 100) ?? "sua mensagem"}`,
        text: parsed.data.body,
      });
      if (!send.ok) return { error: send.error } as const;

      await recordConversationMessage(db, {
        organizationId: ctx.organization.id,
        leadId: conversation.leadId,
        channel: "email",
        direction: "outbound",
        body: parsed.data.body,
        status: "sent",
        providerMessageId: send.providerMessageId,
      });
      return { ok: true } as const;
    }

    // WhatsApp — janela de 24h (o contato iniciou; senão a Meta exige template)
    const provider = getWhatsAppProvider();
    const phone = contact?.phoneNormalized ?? contact?.phone ?? "";
    const digits = phone.replace(/\D+/g, "");
    if (!digits) return { error: "Lead sem telefone válido." } as const;

    const send = await provider.sendText({ to: digits, body: parsed.data.body });
    if (!send.ok) return { error: send.error } as const;

    await recordConversationMessage(db, {
      organizationId: ctx.organization.id,
      leadId: conversation.leadId,
      channel: "whatsapp",
      direction: "outbound",
      body: parsed.data.body,
      status: "sent",
      providerMessageId: send.providerMessageId,
    });

    await recordActivity(db, {
      organizationId: ctx.organization.id,
      type: "message_sent",
      entityType: "lead",
      entityId: conversation.leadId,
      actorId: ctx.user.id,
      metadata: { channel: "whatsapp", inbox: true, provider: provider.kind },
    });

    return { ok: true } as const;
  });

  if ("error" in result && result.error) {
    return { error: result.error };
  }

  revalidatePath(`/inbox?c=${parsed.data.conversationId}`);
  revalidatePath("/inbox");
  return { success: "Resposta enviada." };
}

export async function markConversationReadAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext();
  const conversationId = String(formData.get("conversationId") ?? "");
  if (!conversationId) return;
  await withTenantDb(ctx.accessToken, (db) =>
    markConversationRead(db, ctx.organization.id, conversationId)
  );
  revalidatePath("/inbox");
}

export async function saveWhatsAppAccountAction(
  _prev: InboxState,
  formData: FormData
): Promise<InboxState> {
  const ctx = await requireOrgContext();

  const parsed = whatsappAccountSchema.safeParse({
    phoneNumberId: String(formData.get("phoneNumberId") ?? ""),
    displayPhone: String(formData.get("displayPhone") ?? ""),
    displayName: String(formData.get("displayName") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await withTenantDb(ctx.accessToken, (db) =>
    upsertWhatsAppAccount(db, {
      organizationId: ctx.organization.id,
      phoneNumberId: parsed.data.phoneNumberId,
      displayPhone: parsed.data.displayPhone,
      displayName: parsed.data.displayName,
      webhookToken: randomBytes(24).toString("base64url"),
    })
  );

  revalidatePath("/settings/whatsapp");
  return { success: "Conta WhatsApp salva — configure o webhook abaixo." };
}
