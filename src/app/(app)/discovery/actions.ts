"use server";

import { revalidatePath } from "next/cache";

import { requireOrgContext } from "@/server/auth/session";
import { withTenantDb } from "@/server/db/tenant";
import { runDiscovery } from "@/server/services/discovery";
import { SourceProviderError } from "@/server/providers/sources/types";
import { discoverySearchSchema } from "@/validators/discovery";
import { parseOrgSettings } from "@/validators/org";

type DiscoveryState =
  | { error?: string; success?: string; report?: Awaited<ReturnType<typeof runDiscovery>> }
  | null;

export async function runDiscoveryAction(
  _prev: DiscoveryState,
  formData: FormData
): Promise<DiscoveryState> {
  const ctx = await requireOrgContext();

  const parsed = discoverySearchSchema.safeParse({
    keyword: String(formData.get("keyword") ?? ""),
    location: String(formData.get("location") ?? ""),
    maxResults: String(formData.get("maxResults") ?? "20"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const settings = parseOrgSettings(ctx.organization.settings);

  try {
    const report = await withTenantDb(ctx.accessToken, (db) =>
      runDiscovery(db, {
        organizationId: ctx.organization.id,
        query: {
          keyword: parsed.data.keyword,
          location: parsed.data.location,
          maxResults: parsed.data.maxResults,
        },
        orgCategories: settings.categories,
        scoreWeights: settings.scoreWeights,
      })
    );

    revalidatePath("/companies");
    revalidatePath("/leads");
    revalidatePath("/dashboard");

    return {
      success: `Busca concluída: ${report.found} empresas, ${report.leadsCreated} leads novos, ${report.opportunitiesWithoutWebsite} sem website.`,
      report,
    };
  } catch (erro) {
    if (erro instanceof SourceProviderError) {
      return { error: erro.message };
    }
    return { error: erro instanceof Error ? erro.message : "Erro na descoberta." };
  }
}
