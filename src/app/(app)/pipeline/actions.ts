"use server";

import { revalidatePath } from "next/cache";

import { requireOrgContext } from "@/server/auth/session";
import { withTenantDb } from "@/server/db/tenant";
import { deleteDeal, insertDeal, moveDealStage } from "@/server/db/repositories/crm";
import { recordActivity } from "@/server/db/repositories/leads";
import { z } from "zod";

type DealState = { error?: string; success?: string } | null;

const createDealSchema = z.object({
  title: z.string().trim().min(2, "Informe o título").max(160),
  value: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((v) => {
      if (!v) return null;
      const num = Number(v.replace(/\./g, "").replace(",", "."));
      return Number.isFinite(num) && num > 0 ? num : null;
    }),
  stage: z.enum([
    "new",
    "qualified",
    "contacted",
    "replied",
    "meeting",
    "proposal",
    "negotiation",
    "won",
    "lost",
  ]),
  leadId: z.string().uuid().optional().or(z.literal("")),
  expectedCloseDate: z.string().trim().max(30).optional().or(z.literal("")),
});

export async function createDealAction(
  _prev: DealState,
  formData: FormData
): Promise<DealState> {
  const ctx = await requireOrgContext();

  const parsed = createDealSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    value: String(formData.get("value") ?? ""),
    stage: String(formData.get("stage") ?? "new"),
    leadId: String(formData.get("leadId") ?? ""),
    expectedCloseDate: String(formData.get("expectedCloseDate") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await withTenantDb(ctx.accessToken, (db) =>
      insertDeal(db, {
        organizationId: ctx.organization.id,
        title: parsed.data.title,
        value: parsed.data.value,
        stage: parsed.data.stage,
        leadId: parsed.data.leadId || null,
        ownerId: ctx.user.id,
        expectedCloseDate: parsed.data.expectedCloseDate
          ? new Date(parsed.data.expectedCloseDate).toISOString()
          : null,
      })
    );
  } catch (erro) {
    return { error: erro instanceof Error ? erro.message : "Erro ao criar deal." };
  }

  revalidatePath("/pipeline");
  return { success: "Deal criado." };
}

/** Move um deal de estágio — usado pelo kanban (drag&drop e botões). */
export async function moveDealAction(dealId: string, stage: string): Promise<{ ok: boolean }> {
  const ctx = await requireOrgContext();

  const valid = [
    "new",
    "qualified",
    "contacted",
    "replied",
    "meeting",
    "proposal",
    "negotiation",
    "won",
    "lost",
  ].includes(stage);
  if (!valid) return { ok: false };

  const moved = await withTenantDb(ctx.accessToken, (db) =>
    moveDealStage(db, ctx.organization.id, dealId, stage)
  );

  if (moved) {
    await withTenantDb(ctx.accessToken, (db) =>
      recordActivity(db, {
        organizationId: ctx.organization.id,
        type: "deal_stage_changed",
        entityType: "deal",
        entityId: dealId,
        actorId: ctx.user.id,
        metadata: { stage, title: moved.title },
      })
    );
  }

  revalidatePath("/pipeline");
  return { ok: Boolean(moved) };
}

export async function deleteDealAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext();
  const dealId = String(formData.get("dealId") ?? "");
  if (!dealId) return;
  await withTenantDb(ctx.accessToken, (db) => deleteDeal(db, ctx.organization.id, dealId));
  revalidatePath("/pipeline");
}
