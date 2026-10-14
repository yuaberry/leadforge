import "server-only";

import { and, asc, eq, lte, or } from "drizzle-orm";

import * as schema from "@/server/db/schema";
import { campaigns, campaignLeads, campaignSteps, contacts, leads } from "@/server/db/schema";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { getEmailProvider } from "@/server/providers/email";
import { appendEmailFooter, renderTemplate } from "@/server/services/template";
import { decideEligibility } from "@/server/services/eligibility";
import { unsubscribeLink } from "@/server/services/unsubscribe";
import { suppressionRowsForContact, addSuppression } from "@/server/db/repositories/campaigns";
import { findOrCreateLeadLinkToken } from "@/server/db/repositories/commerce";
import { recordActivity } from "@/server/db/repositories/leads";
import { products } from "@/server/db/schema";

type AnyDb = NodePgDatabase<typeof schema>;

export type CampaignRunReport = {
  processed: number;
  sent: number;
  awaitingApproval: number;
  excluded: number;
  failed: number;
  skippedCap: boolean;
};

type RunContext = {
  organizationId: string;
  origin: string; // app origin (http://host) para links
  fromAddress: string | null; // "Nome <email>"
};

/**
 * O CORAÇÃO DA FASE 6 — processa uma leva de mensagens da campanha.
 *
 * Invariáveis (todos enforçados aqui, independente do chamador):
 *   1. Gate de elegibilidade: suppression + opt-out + base legal (decideEligibility).
 *   2. Daily cap da campanha + teto do lote.
 *   3. Modo MANUAL gera 'pending_approval' — NUNCA envia sozinho.
 *   4. Rodapé com link de unsubscribe obrigatório em todo e-mail.
 *   5. Steps com limite natural (sem loops infinitos — status 'completed').
 */
export async function processCampaignBatch(
  db: AnyDb,
  ctx: RunContext,
  campaignId: string,
  batchLimit = 20
): Promise<CampaignRunReport> {
  const report: CampaignRunReport = {
    processed: 0,
    sent: 0,
    awaitingApproval: 0,
    excluded: 0,
    failed: 0,
    skippedCap: false,
  };

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.organizationId, ctx.organizationId)))
    .limit(1);

  if (!campaign || campaign.status !== "active" || campaign.channel !== "email") {
    return report;
  }

  // Janela de horário (respeita o sono do destinatário)
  const hour = new Date().getHours();
  if (hour < campaign.activeHourStart || hour >= campaign.activeHourEnd) {
    return report;
  }

  // Steps ordenados — a campanha precisa de pelo menos 1
  const steps = await db
    .select()
    .from(campaignSteps)
    .where(eq(campaignSteps.campaignId, campaignId))
    .orderBy(asc(campaignSteps.position));
  if (steps.length === 0) return report;

  // Daily cap
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todaysCount = await countSentToday(db, campaignId, startOfDay.toISOString());
  const budget = Math.max(0, Math.min(batchLimit, campaign.dailyCap - todaysCount));
  if (budget === 0) {
    report.skippedCap = true;
    return report;
  }

  // Due: leads ativos com next_step_at <= agora
  const dueRows = await db
    .select({
      entry: campaignLeads,
      lead: leads,
      contact: contacts,
    })
    .from(campaignLeads)
    .innerJoin(leads, eq(leads.id, campaignLeads.leadId))
    .leftJoin(contacts, eq(contacts.id, leads.contactId))
    .where(
      and(
        eq(campaignLeads.campaignId, campaignId),
        eq(campaignLeads.status, "active"),
        lte(campaignLeads.nextStepAt, new Date().toISOString())
      )
    )
    .limit(budget);

  const provider = getEmailProvider();
  const product = campaign.productId
    ? ((
        await db.select().from(products).where(eq(products.id, campaign.productId)).limit(1)
      )[0] ?? null)
    : null;

  for (const { entry, lead, contact } of dueRows) {
    report.processed++;

    // ===== GATE DE ELEGIBILIDADE (invariável) =====
    const suppression = await suppressionRowsForContact(
      db,
      ctx.organizationId,
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
      channel: "email",
    });

    if (!decision.eligible) {
      await db
        .update(campaignLeads)
        .set({ status: "excluded", excludedReason: decision.reason })
        .where(eq(campaignLeads.id, entry.id));
      report.excluded++;
      continue;
    }

    // Step atual
    const step = steps.find((s) => s.position === entry.currentStep) ?? null;
    if (!step) {
      await db
        .update(campaignLeads)
        .set({ status: "completed" })
        .where(eq(campaignLeads.id, entry.id));
      continue;
    }

    // Renderização
    const linkToken = product
      ? await findOrCreateLeadLinkToken(db, ctx.organizationId, lead.id, product.id)
      : null;
    const vars = {
      nome: contact?.fullName?.split(" ")[0] ?? "",
      nome_completo: contact?.fullName ?? "",
      empresa: "",
      cidade: "",
      link: linkToken ? `${ctx.origin}/go/${linkToken}` : product?.checkoutUrl ?? "",
      unsubscribe_link: unsubscribeLink(ctx.origin, ctx.organizationId, contact?.email ?? ""),
    };

    // empresa/cidade quando existirem
    if (lead.companyId) {
      const [company] = await db
        .select({ name: schema.companies.name, city: schema.companies.city })
        .from(schema.companies)
        .where(eq(schema.companies.id, lead.companyId))
        .limit(1);
      vars.empresa = company?.name ?? "";
      vars.cidade = company?.city ?? "";
    }

    const subject = renderTemplate(step.subject, vars);
    const bodyWithFooter = appendEmailFooter(
      renderTemplate(step.body, vars),
      vars.unsubscribe_link
    );

    // ===== Modo MANUAL: nunca envia sozinho =====
    if (campaign.mode === "manual") {
      await db.insert(schema.messages).values({
        organizationId: ctx.organizationId,
        leadId: lead.id,
        campaignId: campaign.id,
        stepId: step.id,
        channel: "email",
        direction: "outbound",
        toAddress: contact?.email ?? "",
        subject,
        body: bodyWithFooter,
        status: "pending_approval",
        provider: provider.kind,
      });
      await db
        .update(campaignLeads)
        .set({ status: "awaiting_approval" })
        .where(eq(campaignLeads.id, entry.id));
      report.awaitingApproval++;
      continue;
    }

    // ===== Modo AUTOMATED (com todos os gates acima já passando) =====
    const result = await provider.send({
      to: contact?.email ?? "",
      from: ctx.fromAddress ?? "LeadForge <onboarding@resend.dev>",
      subject,
      text: bodyWithFooter,
      headers: {
        "List-Unsubscribe": `<${vars.unsubscribe_link}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });

    if (result.ok) {
      await db.insert(schema.messages).values({
        organizationId: ctx.organizationId,
        leadId: lead.id,
        campaignId: campaign.id,
        stepId: step.id,
        channel: "email",
        direction: "outbound",
        toAddress: contact?.email ?? "",
        subject,
        body: bodyWithFooter,
        status: "sent",
        provider: provider.kind,
        providerMessageId: result.providerMessageId,
        sentAt: new Date().toISOString(),
      });

      const nextStep = steps.find((s) => s.position === entry.currentStep + 1);
      if (nextStep) {
        const nextAt = new Date(
          Date.now() + nextStep.waitDays * 24 * 60 * 60 * 1000
        ).toISOString();
        await db
          .update(campaignLeads)
          .set({ currentStep: entry.currentStep + 1, nextStepAt: nextAt, status: "active" })
          .where(eq(campaignLeads.id, entry.id));
      } else {
        await db
          .update(campaignLeads)
          .set({ status: "completed" })
          .where(eq(campaignLeads.id, entry.id));
      }
      report.sent++;
    } else {
      await db.insert(schema.messages).values({
        organizationId: ctx.organizationId,
        leadId: lead.id,
        campaignId: campaign.id,
        stepId: step.id,
        channel: "email",
        direction: "outbound",
        toAddress: contact?.email ?? "",
        subject,
        body: bodyWithFooter,
        status: "failed",
        provider: provider.kind,
        error: result.error.slice(0, 400),
      });
      report.failed++;
    }
  }

  return report;
}

async function countSentToday(db: AnyDb, campaignId: string, startOfDayIso: string) {
  const rows = await db
    .select({ sentAt: schema.messages.sentAt })
    .from(schema.messages)
    .where(and(eq(schema.messages.campaignId, campaignId), or(eq(schema.messages.status, "sent"), eq(schema.messages.status, "delivered"))));
  return rows.filter((row) => row.sentAt !== null && row.sentAt >= startOfDayIso).length;
}

/** Aprova e envia uma mensagem do modo manual (revalida o gate antes!). */
export async function approveAndSendMessage(
  db: AnyDb,
  ctx: RunContext,
  messageId: string
): Promise<{ ok: boolean; error?: string }> {
  const [message] = await db
    .select()
    .from(schema.messages)
    .where(and(eq(schema.messages.id, messageId), eq(schema.messages.organizationId, ctx.organizationId)))
    .limit(1);

  if (!message || message.status !== "pending_approval") {
    return { ok: false, error: "Mensagem não está pendente de aprovação." };
  }

  const [lead] = await db.select().from(leads).where(eq(leads.id, message.leadId)).limit(1);
  const [contact] = lead?.contactId
    ? await db.select().from(contacts).where(eq(contacts.id, lead.contactId)).limit(1)
    : [null];

  // REVALIDA o gate — a suppression pode ter mudado desde a geração
  const suppression = await suppressionRowsForContact(
    db,
    ctx.organizationId,
    contact?.email ?? null,
    contact?.phone ?? null
  );
  const decision = decideEligibility({
    email: contact?.email ?? null,
    phone: contact?.phone ?? null,
    suppression,
    optedOutAt: lead?.optedOutAt ?? null,
    consentStatus: lead?.consentStatus ?? "unknown",
    legalBasis: lead?.legalBasis ?? null,
    channel: "email",
  });

  if (!decision.eligible) {
    await db
      .update(schema.messages)
      .set({ status: "discarded", error: `Bloqueado: ${decision.reason}` })
      .where(eq(schema.messages.id, messageId));
    return { ok: false, error: `Bloqueado pelo gate de elegibilidade (${decision.reason}).` };
  }

  const provider = getEmailProvider();
  const result = await provider.send({
    to: message.toAddress,
    from: ctx.fromAddress ?? "LeadForge <onboarding@resend.dev>",
    subject: message.subject ?? "(sem assunto)",
    text: message.body,
    headers: {
      "List-Unsubscribe": `<${unsubscribeLink(ctx.origin, ctx.organizationId, message.toAddress)}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });

  if (!result.ok) {
    await db
      .update(schema.messages)
      .set({ status: "failed", error: result.error.slice(0, 400) })
      .where(eq(schema.messages.id, messageId));
    return { ok: false, error: result.error };
  }

  await db
    .update(schema.messages)
    .set({
      status: "sent",
      providerMessageId: result.providerMessageId,
      sentAt: new Date().toISOString(),
    })
    .where(eq(schema.messages.id, messageId));

  // avança o lead na campanha
  if (!message.campaignId) return { ok: true };

  const [entry] = await db
    .select()
    .from(campaignLeads)
    .where(and(eq(campaignLeads.campaignId, message.campaignId), eq(campaignLeads.leadId, message.leadId)))
    .limit(1);

  if (entry) {
    const steps = await db
      .select()
      .from(campaignSteps)
      .where(eq(campaignSteps.campaignId, message.campaignId))
      .orderBy(asc(campaignSteps.position));
    const nextStep = steps.find((s) => s.position === entry.currentStep + 1);
    if (nextStep) {
      await db
        .update(campaignLeads)
        .set({
          status: "active",
          currentStep: entry.currentStep + 1,
          nextStepAt: new Date(Date.now() + nextStep.waitDays * 24 * 60 * 60 * 1000).toISOString(),
        })
        .where(eq(campaignLeads.id, entry.id));
    } else {
      await db
        .update(campaignLeads)
        .set({ status: "completed" })
        .where(eq(campaignLeads.id, entry.id));
    }
  }

  await recordActivity(db, {
    organizationId: ctx.organizationId,
    type: "message_sent",
    entityType: "lead",
    entityId: message.leadId,
    metadata: { channel: "email", campaignId: message.campaignId, provider: provider.kind },
  });

  return { ok: true };
}

/** Registra bounce/complaint do webhook (invariável: suprime e nunca envia de novo). */
export async function handleEmailEvent(
  db: AnyDb,
  input: {
    organizationId: string;
    type: string; // 'email.bounced' | 'email.complained' | 'email.delivered'
    email: string | null;
    providerMessageId: string | null;
  }
): Promise<void> {
  if (input.type === "email.delivered" && input.providerMessageId) {
    await db
      .update(schema.messages)
      .set({ status: "delivered" })
      .where(eq(schema.messages.providerMessageId, input.providerMessageId));
    return;
  }

  if (input.type === "email.bounced" || input.type === "email.complained") {
    if (input.providerMessageId) {
      await db
        .update(schema.messages)
        .set({ status: input.type === "email.bounced" ? "bounced" : "unsubscribed" })
        .where(eq(schema.messages.providerMessageId, input.providerMessageId));
    }
    if (input.email) {
      await addSuppression(db, {
        organizationId: input.organizationId,
        emailNormalized: input.email.trim().toLowerCase(),
        channel: "all",
        reason: input.type === "email.bounced" ? "bounce" : "complaint",
        note: `Evento ${input.type} do provedor`,
      });
    }
  }
}
