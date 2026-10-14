"use server";

import { revalidatePath } from "next/cache";

import { requireOrgContext } from "@/server/auth/session";
import { withTenantDb } from "@/server/db/tenant";
import { updateOrganizationSettings } from "@/server/db/repositories/organizations";
import { parseOrgSettings } from "@/validators/org";
import { scoreWeightsSchema } from "@/validators/scoring";

type ScoringState = { error?: string; success?: string } | null;

export async function saveScoreWeightsAction(
  _prev: ScoringState,
  formData: FormData
): Promise<ScoringState> {
  const ctx = await requireOrgContext();

  const parsed = scoreWeightsSchema.safeParse({
    no_website: formData.get("no_website"),
    old_website: formData.get("old_website"),
    social_active: formData.get("social_active"),
    established: formData.get("established"),
    many_reviews: formData.get("many_reviews"),
    contact_available: formData.get("contact_available"),
    segment_match: formData.get("segment_match"),
    ai_need: formData.get("ai_need"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Valores inválidos (0 a 100)." };
  }

  const settings = parseOrgSettings(ctx.organization.settings);
  await withTenantDb(ctx.accessToken, (db) =>
    updateOrganizationSettings(db, ctx.organization.id, {
      ...settings,
      scoreWeights: parsed.data,
    })
  );

  revalidatePath("/settings/ai");
  return { success: "Pesos salvos — novos leads já usam a nova configuração." };
}
