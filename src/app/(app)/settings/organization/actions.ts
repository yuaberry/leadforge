"use server";

import { revalidatePath } from "next/cache";

import { requireOrgContext } from "@/server/auth/session";
import { withTenantDb } from "@/server/db/tenant";
import { updateOrganizationName } from "@/server/db/repositories/organizations";
import { createOrganizationSchema } from "@/validators/org";

type OrgState = { error?: string; success?: string } | null;

export async function updateOrgNameAction(
  _prev: OrgState,
  formData: FormData
): Promise<OrgState> {
  const ctx = await requireOrgContext();

  if (!["owner", "admin"].includes(ctx.membership.role)) {
    return { error: "Apenas owners e admins podem renomear a organização." };
  }

  const parsed = createOrganizationSchema.safeParse({
    name: String(formData.get("name") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Nome inválido." };
  }

  await withTenantDb(ctx.accessToken, (db) =>
    updateOrganizationName(db, ctx.organization.id, parsed.data.name)
  );

  revalidatePath("/settings/organization");
  revalidatePath("/dashboard");
  return { success: "Nome atualizado." };
}
