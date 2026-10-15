"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq, gte } from "drizzle-orm";

import { requireOrgContext } from "@/server/auth/session";
import { withTenantDb } from "@/server/db/tenant";
import { leads as leadsTable, contacts as contactsTable } from "@/server/db/schema";
import {
  addLeadsToCampaign,
  getEmailAccount,
  insertCampaign,
  insertStep,
  listSteps,
  updateCampaign,
  deleteStep,
  updateMessage,
} from "@/server/db/repositories/campaigns";
import {
  approveAndSendMessage,
  processCampaignBatch,
} from "@/server/services/campaign-runner";
import { recordActivity } from "@/server/db/repositories/leads";
import { assertWithinPlanLimit, planLimitMessage } from "@/server/services/usage";
import { PlanLimitError } from "@/server/services/billing";
import {
  addLeadsByFilterSchema,
  campaignControlSchema,
  createCampaignSchema,
  createStepSchema,
} from "@/validators/campaign";

type CampaignState = { error?: string; success?: string } | null;

async function appOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto =
    headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function createCampaignAction(
  _prev: CampaignState,
  formData: FormData
): Promise<CampaignState> {
  const ctx = await requireOrgContext();

  const parsed = createCampaignSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    mode: String(formData.get("mode") ?? "manual"),
    productId: String(formData.get("productId") ?? ""),
    dailyCap: String(formData.get("dailyCap") ?? "50"),
    activeHourStart: String(formData.get("activeHourStart") ?? "8"),
    activeHourEnd: String(formData.get("activeHourEnd") ?? "20"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  let campaignId = "";
  try {
    const campaign = await withTenantDb(ctx.accessToken, (db) =>
      insertCampaign(db, {
        organizationId: ctx.organization.id,
        name: parsed.data.name,
        description: parsed.data.description || null,
        mode: parsed.data.mode,
        productId: parsed.data.productId || null,
        dailyCap: parsed.data.dailyCap,
        activeHourStart: parsed.data.activeHourStart,
        activeHourEnd: parsed.data.activeHourEnd,
        status: "draft",
      })
    );
    campaignId = campaign.id;
  } catch (erro) {
    return { error: erro instanceof Error ? erro.message : "Erro ao criar campanha." };
  }

  revalidatePath("/campaigns");
  return { success: `Campanha criada (${campaignId.slice(0, 8)}). Adicione etapas e leads.` };
}

export async function addStepAction(
  _prev: CampaignState,
  formData: FormData
): Promise<CampaignState> {
  const ctx = await requireOrgContext();

  const parsed = createStepSchema.safeParse({
    campaignId: String(formData.get("campaignId") ?? ""),
    waitDays: String(formData.get("waitDays") ?? "0"),
    subject: String(formData.get("subject") ?? ""),
    body: String(formData.get("body") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await withTenantDb(ctx.accessToken, async (db) => {
      const steps = await listSteps(db, ctx.organization.id, parsed.data.campaignId);
      // loops impossíveis: position = steps.length + 1
      await insertStep(db, {
        organizationId: ctx.organization.id,
        campaignId: parsed.data.campaignId,
        position: steps.length + 1,
        waitDays: parsed.data.waitDays,
        subject: parsed.data.subject ?? "",
        body: parsed.data.body,
      });
    });
  } catch (erro) {
    return { error: erro instanceof Error ? erro.message : "Erro ao adicionar etapa." };
  }

  revalidatePath(`/campaigns/${parsed.data.campaignId}`);
  return { success: "Etapa adicionada." };
}

export async function removeStepAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext();
  const stepId = String(formData.get("stepId") ?? "");
  const campaignId = String(formData.get("campaignId") ?? "");
  if (!stepId) return;
  await withTenantDb(ctx.accessToken, (db) => deleteStep(db, ctx.organization.id, stepId));
  revalidatePath(`/campaigns/${campaignId}`);
}

export async function setCampaignStatusAction(
  _prev: CampaignState,
  formData: FormData
): Promise<CampaignState> {
  const ctx = await requireOrgContext();

  const parsed = campaignControlSchema.safeParse({
    campaignId: String(formData.get("campaignId") ?? ""),
    status: String(formData.get("status") ?? ""),
  });
  if (!parsed.success) return { error: "Dados inválidos." };

  const stepsCount = await withTenantDb(ctx.accessToken, async (db) =>
    (await listSteps(db, ctx.organization.id, parsed.data.campaignId)).length
  );

  if (parsed.data.status === "active" && stepsCount === 0) {
    return { error: "Adicione pelo menos uma etapa antes de ativar." };
  }

  if (parsed.data.status === "active") {
    const fits = await withTenantDb(ctx.accessToken, async (db) => {
      await assertWithinPlanLimit(
        db,
        ctx.organization.id,
        ctx.organization.plan,
        "activeCampaigns"
      );
      return true;
    }).catch((erro: unknown) => {
      if (erro instanceof PlanLimitError) return planLimitMessage(erro.metric, erro.limit);
      throw erro;
    });
    if (fits !== true) return { error: String(fits) };
  }

  await withTenantDb(ctx.accessToken, (db) =>
    updateCampaign(db, ctx.organization.id, parsed.data.campaignId, {
      status: parsed.data.status,
    })
  );

  await withTenantDb(ctx.accessToken, (db) =>
    recordActivity(db, {
      organizationId: ctx.organization.id,
      type: `campaign_${parsed.data.status}`,
      entityType: "campaign",
      entityId: parsed.data.campaignId,
      actorId: ctx.user.id,
      metadata: {},
    })
  );

  revalidatePath(`/campaigns/${parsed.data.campaignId}`);
  revalidatePath("/campaigns");
  return {
    success:
      parsed.data.status === "active"
        ? "Campanha ativa — o processamento respeita janela de horário e cap diário."
        : "Status atualizado.",
  };
}

/** Adiciona leads por filtro (stage/score) — o gate de elegibilidade atua no envio. */
export async function addLeadsByFilterAction(
  _prev: CampaignState,
  formData: FormData
): Promise<CampaignState> {
  const ctx = await requireOrgContext();

  const parsed = addLeadsByFilterSchema.safeParse({
    campaignId: String(formData.get("campaignId") ?? ""),
    stage: String(formData.get("stage") ?? ""),
    minScore: String(formData.get("minScore") ?? ""),
  });
  if (!parsed.success) return { error: "Dados inválidos." };

  const added = await withTenantDb(ctx.accessToken, async (db) => {
    const conditions = [eq(leadsTable.organizationId, ctx.organization.id)];
    if (parsed.data.stage) {
      conditions.push(eq(leadsTable.stage, parsed.data.stage as "new"));
    }
    if (parsed.data.minScore !== undefined) {
      conditions.push(gte(leadsTable.score, parsed.data.minScore));
    }

    const rows = await db
      .select({ leadId: leadsTable.id })
      .from(leadsTable)
      .leftJoin(contactsTable, eq(contactsTable.id, leadsTable.contactId))
      .where(and(...conditions))
      .limit(500);

    if (rows.length === 0) return 0;
    return addLeadsToCampaign(db, {
      organizationId: ctx.organization.id,
      campaignId: parsed.data.campaignId,
      leadIds: rows.map((row) => row.leadId),
    });
  });

  revalidatePath(`/campaigns/${parsed.data.campaignId}`);
  return {
    success:
      added > 0
        ? `${added} lead${added === 1 ? "" : "s"} adicionado${added === 1 ? "" : "s"}. A elegibilidade é verificada no momento do envio.`
        : "Nenhum lead novo com esse filtro (duplicados ignorados).",
  };
}

export async function removeCampaignLeadAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext();
  const campaignId = String(formData.get("campaignId") ?? "");
  const leadId = String(formData.get("leadId") ?? "");
  if (!campaignId || !leadId) return;

  await withTenantDb(ctx.accessToken, async (db) => {
    const { campaignLeads } = await import("@/server/db/schema");
    await db
      .delete(campaignLeads)
      .where(
        and(
          eq(campaignLeads.organizationId, ctx.organization.id),
          eq(campaignLeads.campaignId, campaignId),
          eq(campaignLeads.leadId, leadId)
        )
      );
  });

  revalidatePath(`/campaigns/${campaignId}`);
}

/** Processa uma leva agora (mesma lógica do cron — chamada manual pelo usuário). */
export async function processCampaignNowAction(
  _prev: CampaignState,
  formData: FormData
): Promise<CampaignState> {
  const ctx = await requireOrgContext();
  const campaignId = String(formData.get("campaignId") ?? "");
  if (!campaignId) return { error: "Campanha inválida." };

  const account = await withTenantDb(ctx.accessToken, (db) =>
    getEmailAccount(db, ctx.organization.id)
  );
  const fromAddress = account ? `${account.fromName} <${account.fromEmail}>` : null;

  let report;
  try {
    const origin = await appOrigin();
    report = await withTenantDb(ctx.accessToken, async (db) => {
      // limite de plano: mensagens deste mês (budget da leva)
      await assertWithinPlanLimit(
        db,
        ctx.organization.id,
        ctx.organization.plan,
        "messagesPerMonth",
        20
      );
      return processCampaignBatch(
        db,
        {
          organizationId: ctx.organization.id,
          origin,
          fromAddress,
        },
        campaignId
      );
    });
  } catch (erro) {
    if (erro instanceof PlanLimitError) {
      return { error: planLimitMessage(erro.metric, erro.limit) };
    }
    return { error: erro instanceof Error ? erro.message : "Erro ao processar." };
  }

  revalidatePath(`/campaigns/${campaignId}`);

  if (report.skippedCap) {
    return { error: "Cap diário atingido — retome amanhã (proteção contra spam)." };
  }
  return {
    success: `Processados: ${report.processed} · enviados: ${report.sent} · aguardando aprovação: ${report.awaitingApproval} · inelegíveis (bloqueados): ${report.excluded} · falhas: ${report.failed}`,
  };
}

export async function approveMessageAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext();
  const messageId = String(formData.get("messageId") ?? "");
  const campaignId = String(formData.get("campaignId") ?? "");
  if (!messageId) return;

  const account = await withTenantDb(ctx.accessToken, (db) =>
    getEmailAccount(db, ctx.organization.id)
  );

  const origin = await appOrigin();
  await withTenantDb(ctx.accessToken, (db) =>
    approveAndSendMessage(
      db,
      {
        organizationId: ctx.organization.id,
        origin,
        fromAddress: account ? `${account.fromName} <${account.fromEmail}>` : null,
      },
      messageId
    )
  );

  revalidatePath(`/campaigns/${campaignId}`);
}

export async function discardMessageAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext();
  const messageId = String(formData.get("messageId") ?? "");
  const campaignId = String(formData.get("campaignId") ?? "");
  if (!messageId) return;

  await withTenantDb(ctx.accessToken, (db) =>
    updateMessage(db, ctx.organization.id, messageId, { status: "discarded" })
  );

  revalidatePath(`/campaigns/${campaignId}`);
}
