"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { requireOrgContext } from "@/server/auth/session";
import { withTenantDb } from "@/server/db/tenant";
import { insertFinancialTransaction } from "@/server/db/repositories/crm";

type FinanceState = { error?: string; success?: string } | null;

const moneyTransform = (v: string) => {
  if (!v) return null;
  const num = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(num) && num > 0 ? num : null;
};

const createTransactionSchema = z.object({
  type: z.enum(["revenue", "expense"]),
  category: z.enum([
    "own_sale",
    "affiliate_commission",
    "ad_spend",
    "tools",
    "fees",
    "other",
  ]),
  description: z.string().trim().min(2, "Descreva o lançamento").max(200),
  amount: z
    .string()
    .trim()
    .min(1, "Informe o valor")
    .transform(moneyTransform)
    .refine((v) => v !== null && v > 0, "Valor inválido"),
  occurredAt: z.string().trim().max(30).optional().or(z.literal("")),
});

export async function createTransactionAction(
  _prev: FinanceState,
  formData: FormData
): Promise<FinanceState> {
  const ctx = await requireOrgContext();

  const parsed = createTransactionSchema.safeParse({
    type: String(formData.get("type") ?? ""),
    category: String(formData.get("category") ?? ""),
    description: String(formData.get("description") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    occurredAt: String(formData.get("occurredAt") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await withTenantDb(ctx.accessToken, (db) =>
    insertFinancialTransaction(db, {
      organizationId: ctx.organization.id,
      type: parsed.data.type,
      category: parsed.data.category,
      description: parsed.data.description,
      amount: parsed.data.amount!,
      occurredAt: parsed.data.occurredAt
        ? new Date(parsed.data.occurredAt).toISOString()
        : new Date().toISOString(),
      source: "manual",
    })
  );

  revalidatePath("/profit");
  revalidatePath("/dashboard");
  return { success: "Lançamento registrado." };
}

export async function deleteTransactionAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext();
  const transactionId = String(formData.get("transactionId") ?? "");
  if (!transactionId) return;

  const { and, eq } = await import("drizzle-orm");
  const { financialTransactions } = await import("@/server/db/schema");

  await withTenantDb(ctx.accessToken, (db) =>
    db
      .delete(financialTransactions)
      .where(
        and(
          eq(financialTransactions.organizationId, ctx.organization.id),
          eq(financialTransactions.id, transactionId)
        )
      )
  );

  revalidatePath("/profit");
  revalidatePath("/dashboard");
}
