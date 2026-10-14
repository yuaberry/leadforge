"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireAuth } from "@/server/auth/session";
import { setActiveOrgCookie } from "@/server/auth/org-cookie";
import { withTenantDb } from "@/server/db/tenant";
import {
  getPrimaryOrg,
  insertOrganizationWithSlug,
  updateOrganizationSettings,
} from "@/server/db/repositories/organizations";
import {
  createOrganizationSchema,
  onboardingBusinessSchema,
  onboardingChannelsSchema,
  onboardingDreamSchema,
  parseOrgSettings,
} from "@/validators/org";
import type { OrgSettings } from "@/types/org";

type OnboardingState = { error?: string } | null;

export async function createOrgAction(
  _prev: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const session = await requireAuth();

  const parsed = createOrganizationSchema.safeParse({
    name: String(formData.get("name") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const org = await withTenantDb(session.accessToken, (db) =>
      insertOrganizationWithSlug(db, parsed.data.name)
    );
    await setActiveOrgCookie(org.id);
  } catch (erro) {
    return { error: erro instanceof Error ? erro.message : "Erro ao criar organização." };
  }

  revalidatePath("/onboarding");
  redirect("/onboarding");
}

/** Mescla campos nas settings da org primária do usuário. */
async function mergeSettings(
  accessToken: string,
  userId: string,
  patch: Partial<OrgSettings>
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await withTenantDb(accessToken, async (db) => {
      const primary = await getPrimaryOrg(db, userId);
      if (!primary) {
        throw new Error("Organização não encontrada.");
      }
      const settings = parseOrgSettings(primary.organization.settings);
      await updateOrganizationSettings(db, primary.organization.id, {
        ...settings,
        ...patch,
      });
    });
    return { ok: true };
  } catch (erro) {
    return { ok: false, error: erro instanceof Error ? erro.message : "Erro ao salvar." };
  }
}

export async function saveBusinessAction(
  _prev: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const session = await requireAuth();

  const parsed = onboardingBusinessSchema.safeParse({
    businessMode: String(formData.get("businessMode") ?? ""),
    categories: formData.getAll("categories").map(String),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Escolha como você vende e uma categoria." };
  }

  const result = await mergeSettings(session.accessToken, session.user.id, {
    businessMode: parsed.data.businessMode,
    categories: parsed.data.categories,
  });
  if (!result.ok) return { error: result.error };

  revalidatePath("/onboarding");
  redirect("/onboarding");
}

export async function saveChannelsAction(
  _prev: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const session = await requireAuth();

  const parsed = onboardingChannelsSchema.safeParse({
    email: formData.get("email") === "on",
    whatsapp: formData.get("whatsapp") === "on",
  });
  if (!parsed.success) {
    return { error: "Selecione pelo menos um canal." };
  }
  if (!parsed.data.email && !parsed.data.whatsapp) {
    return { error: "Selecione pelo menos um canal." };
  }

  const result = await mergeSettings(session.accessToken, session.user.id, {
    channels: parsed.data,
  });
  if (!result.ok) return { error: result.error };

  revalidatePath("/onboarding");
  redirect("/onboarding");
}

export async function saveDreamAction(
  _prev: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const session = await requireAuth();

  const parsed = onboardingDreamSchema.safeParse({
    dreamName: String(formData.get("dreamName") ?? ""),
    dreamAmount: String(formData.get("dreamAmount") ?? ""),
    dreamImageUrl: String(formData.get("dreamImageUrl") ?? ""),
    dreamProductUrl: String(formData.get("dreamProductUrl") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados da meta." };
  }

  const result = await mergeSettings(session.accessToken, session.user.id, {
    dream: {
      name: parsed.data.dreamName,
      amount: parsed.data.dreamAmount,
      imageUrl: parsed.data.dreamImageUrl,
      productUrl: parsed.data.dreamProductUrl,
    },
    dreamSkipped: false,
  });
  if (!result.ok) return { error: result.error };

  revalidatePath("/onboarding");
  redirect("/onboarding");
}

export async function skipDreamAction(_formData: FormData): Promise<void> {
  const session = await requireAuth();
  await mergeSettings(session.accessToken, session.user.id, { dreamSkipped: true });
  revalidatePath("/onboarding");
  redirect("/onboarding");
}

export async function finishOnboardingAction(_formData: FormData): Promise<void> {
  const session = await requireAuth();
  await mergeSettings(session.accessToken, session.user.id, {
    onboardedAt: new Date().toISOString(),
  });
  redirect("/dashboard");
}
