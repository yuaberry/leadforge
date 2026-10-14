"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { requireOrgContext } from "@/server/auth/session";
import { withTenantDb } from "@/server/db/tenant";
import {
  addGoalContribution,
  deleteGoal,
  insertGoal,
  markGoalReachedIfDue,
  updateGoal,
} from "@/server/db/repositories/crm";
import { updateOrganizationSettings } from "@/server/db/repositories/organizations";
import { parseOrgSettings } from "@/validators/org";

type GoalState = { error?: string; success?: string } | null;

const moneyTransform = (v: string) => {
  if (!v) return null;
  const num = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(num) && num > 0 ? num : null;
};

const createGoalSchema = z.object({
  name: z.string().trim().min(2, "Dê um nome para a meta").max(120),
  targetAmount: z
    .string()
    .trim()
    .min(1, "Informe o valor alvo")
    .transform(moneyTransform)
    .refine((v) => v !== null && v > 0, "Valor inválido"),
  imageUrl: z.string().trim().url("Link da imagem inválido").optional().or(z.literal("")),
  productUrl: z.string().trim().url("Link inválido").optional().or(z.literal("")),
  description: z.string().trim().max(400).optional().or(z.literal("")),
  targetDate: z.string().trim().max(30).optional().or(z.literal("")),
});

export async function createGoalAction(_prev: GoalState, formData: FormData): Promise<GoalState> {
  const ctx = await requireOrgContext();

  const parsed = createGoalSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    targetAmount: String(formData.get("targetAmount") ?? ""),
    imageUrl: String(formData.get("imageUrl") ?? ""),
    productUrl: String(formData.get("productUrl") ?? ""),
    description: String(formData.get("description") ?? ""),
    targetDate: String(formData.get("targetDate") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await withTenantDb(ctx.accessToken, (db) =>
    insertGoal(db, {
      organizationId: ctx.organization.id,
      name: parsed.data.name,
      targetAmount: parsed.data.targetAmount!,
      imageUrl: parsed.data.imageUrl || null,
      productUrl: parsed.data.productUrl || null,
      description: parsed.data.description || null,
      targetDate: parsed.data.targetDate
        ? new Date(parsed.data.targetDate).toISOString()
        : null,
    })
  );

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  return { success: "Meta criada — cada venda vai aproximando você dela." };
}

/** Migra a meta dos sonhos do onboarding para o sistema de metas. */
export async function migrateDreamAction(_formData: FormData): Promise<GoalState> {
  return migrateDreamImpl();
}

async function migrateDreamImpl(): Promise<GoalState> {
  const ctx = await requireOrgContext();
  const settings = parseOrgSettings(ctx.organization.settings);
  if (!settings.dream) {
    return { error: "Não há meta no onboarding para migrar." };
  }

  await withTenantDb(ctx.accessToken, (db) =>
    insertGoal(db, {
      organizationId: ctx.organization.id,
      name: settings.dream!.name,
      targetAmount: settings.dream!.amount ?? 1,
      imageUrl: settings.dream!.imageUrl ?? null,
      productUrl: settings.dream!.productUrl ?? null,
      description: "Migrada do onboarding",
    })
  );

  revalidatePath("/goals");
  return { success: "Meta migrada do onboarding." };
}

const contributeSchema = z.object({
  goalId: z.string().uuid(),
  amount: z
    .string()
    .trim()
    .min(1, "Informe o valor")
    .transform(moneyTransform)
    .refine((v) => v !== null && v > 0, "Valor inválido"),
  note: z.string().trim().max(200).optional().or(z.literal("")),
});

export async function contributeGoalAction(_prev: GoalState, formData: FormData): Promise<GoalState> {
  const ctx = await requireOrgContext();

  const parsed = contributeSchema.safeParse({
    goalId: String(formData.get("goalId") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await withTenantDb(ctx.accessToken, async (db) => {
    await addGoalContribution(db, {
      organizationId: ctx.organization.id,
      goalId: parsed.data.goalId,
      amount: parsed.data.amount!,
      source: "manual",
      note: parsed.data.note || null,
    });
    await markGoalReachedIfDue(db, ctx.organization.id, parsed.data.goalId);
  });

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  return { success: "Contribuição registrada. 🎉" };
}

const goalSettingsSchema = z.object({
  autoAllocatePercent: z.coerce.number().int().min(0).max(100),
  targetGoalId: z.string().uuid().optional().or(z.literal("")),
});

export async function saveGoalSettingsAction(_prev: GoalState, formData: FormData): Promise<GoalState> {
  const ctx = await requireOrgContext();

  const parsed = goalSettingsSchema.safeParse({
    autoAllocatePercent: String(formData.get("autoAllocatePercent") ?? "0"),
    targetGoalId: String(formData.get("targetGoalId") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const settings = parseOrgSettings(ctx.organization.settings);
  await withTenantDb(ctx.accessToken, (db) =>
    updateOrganizationSettings(db, ctx.organization.id, {
      ...settings,
      goalSettings: {
        autoAllocatePercent: parsed.data.autoAllocatePercent,
        targetGoalId: parsed.data.targetGoalId || null,
      },
    })
  );

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  return {
    success:
      parsed.data.autoAllocatePercent > 0 && parsed.data.targetGoalId
        ? `Pronto: ${parsed.data.autoAllocatePercent}% de cada venda paga vai para a meta.`
        : "Alocação automática desativada.",
  };
}

export async function deleteGoalAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext();
  const goalId = String(formData.get("goalId") ?? "");
  if (!goalId) return;
  await withTenantDb(ctx.accessToken, (db) => deleteGoal(db, ctx.organization.id, goalId));
  revalidatePath("/goals");
  revalidatePath("/dashboard");
}

export async function pauseGoalAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext();
  const goalId = String(formData.get("goalId") ?? "");
  const pause = String(formData.get("pause") ?? "") === "true";
  if (!goalId) return;
  await withTenantDb(ctx.accessToken, (db) =>
    updateGoal(db, ctx.organization.id, goalId, {
      status: pause ? "paused" : "saving",
    })
  );
  revalidatePath("/goals");
}
