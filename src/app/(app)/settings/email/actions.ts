"use server";

import { revalidatePath } from "next/cache";


import { requireOrgContext } from "@/server/auth/session";
import { withTenantDb } from "@/server/db/tenant";
import {
  addSuppression,
  removeSuppression,
  upsertEmailAccount,
} from "@/server/db/repositories/campaigns";
import { recordActivity } from "@/server/db/repositories/leads";
import {
  addSuppressionSchema,
  emailAccountSchema,
  removeSuppressionSchema,
} from "@/validators/campaign";
import { normalizeEmail } from "@/lib/format";

type SettingsState = { error?: string; success?: string } | null;

export async function saveEmailAccountAction(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const ctx = await requireOrgContext();

  const parsed = emailAccountSchema.safeParse({
    fromEmail: String(formData.get("fromEmail") ?? ""),
    fromName: String(formData.get("fromName") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await withTenantDb(ctx.accessToken, (db) =>
    upsertEmailAccount(db, {
      organizationId: ctx.organization.id,
      fromEmail: parsed.data.fromEmail,
      fromName: parsed.data.fromName,
    })
  );

  revalidatePath("/settings/email");
  return { success: "Identidade de envio salva." };
}

export async function addSuppressionAction(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const ctx = await requireOrgContext();

  const parsed = addSuppressionSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    reason: String(formData.get("reason") ?? "manual"),
    note: String(formData.get("note") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await withTenantDb(ctx.accessToken, async (db) => {
    await addSuppression(db, {
      organizationId: ctx.organization.id,
      emailNormalized: normalizeEmail(parsed.data.email),
      channel: "all",
      reason: parsed.data.reason,
      note: parsed.data.note || null,
    });
    await recordActivity(db, {
      organizationId: ctx.organization.id,
      type: "suppression_added",
      entityType: "organization",
      entityId: ctx.organization.id,
      actorId: ctx.user.id,
      metadata: { email: parsed.data.email, reason: parsed.data.reason },
    });
  });

  revalidatePath("/settings/suppression");
  return { success: "Contato adicionado à suppression list." };
}

export async function removeSuppressionAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext();
  const suppressionId = String(formData.get("suppressionId") ?? "");
  if (!suppressionId) return;

  const parsed = removeSuppressionSchema.safeParse({ suppressionId });
  if (!parsed.success) return;

  await withTenantDb(ctx.accessToken, async (db) => {
    await removeSuppression(db, ctx.organization.id, parsed.data.suppressionId);
    await recordActivity(db, {
      organizationId: ctx.organization.id,
      type: "suppression_removed",
      entityType: "organization",
      entityId: ctx.organization.id,
      actorId: ctx.user.id,
      metadata: { suppressionId: parsed.data.suppressionId },
    });
  });

  revalidatePath("/settings/suppression");
}
