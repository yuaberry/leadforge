"use server";

import { revalidatePath } from "next/cache";

import { requireOrgContext } from "@/server/auth/session";
import { withTenantDb } from "@/server/db/tenant";
import {
  insertCapturePage,
  updateCapturePage,
} from "@/server/db/repositories/capture";
import {
  createCapturePageSchema,
  setCapturePageStatusSchema,
  updateCapturePageSchema,
} from "@/validators/capture";

type CaptureState = { error?: string; success?: string } | null;

function isUniqueViolation(erro: unknown): boolean {
  return (erro as { code?: string }).code === "23505";
}

export async function createCapturePageAction(
  _prev: CaptureState,
  formData: FormData
): Promise<CaptureState> {
  const ctx = await requireOrgContext();

  const parsed = createCapturePageSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    headline: String(formData.get("headline") ?? ""),
    subheadline: String(formData.get("subheadline") ?? ""),
    leadMagnetUrl: String(formData.get("leadMagnetUrl") ?? ""),
    thankYouMessage: String(formData.get("thankYouMessage") ?? ""),
    consentText: String(formData.get("consentText") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await withTenantDb(ctx.accessToken, (db) =>
      insertCapturePage(db, {
        organizationId: ctx.organization.id,
        slug: parsed.data.slug,
        title: parsed.data.title,
        headline: parsed.data.headline,
        subheadline: parsed.data.subheadline || null,
        leadMagnetUrl: parsed.data.leadMagnetUrl || null,
        thankYouMessage: parsed.data.thankYouMessage || null,
        consentText: parsed.data.consentText,
        status: "draft",
      })
    );
  } catch (erro) {
    if (isUniqueViolation(erro)) {
      return { error: "Este slug já está em uso — escolha outro endereço." };
    }
    return { error: erro instanceof Error ? erro.message : "Erro ao criar página." };
  }

  revalidatePath("/capture");
  return { success: "Página criada como rascunho. Publique quando estiver pronta." };
}

export async function updateCapturePageAction(
  _prev: CaptureState,
  formData: FormData
): Promise<CaptureState> {
  const ctx = await requireOrgContext();

  const parsed = updateCapturePageSchema.safeParse({
    pageId: String(formData.get("pageId") ?? ""),
    title: String(formData.get("title") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    headline: String(formData.get("headline") ?? ""),
    subheadline: String(formData.get("subheadline") ?? ""),
    leadMagnetUrl: String(formData.get("leadMagnetUrl") ?? ""),
    thankYouMessage: String(formData.get("thankYouMessage") ?? ""),
    consentText: String(formData.get("consentText") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { pageId, ...patch } = parsed.data;

  try {
    await withTenantDb(ctx.accessToken, async (db) => {
      await updateCapturePage(db, ctx.organization.id, pageId, {
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.slug !== undefined ? { slug: patch.slug } : {}),
        ...(patch.headline !== undefined ? { headline: patch.headline } : {}),
        ...(patch.subheadline !== undefined ? { subheadline: patch.subheadline || null } : {}),
        ...(patch.leadMagnetUrl !== undefined ? { leadMagnetUrl: patch.leadMagnetUrl || null } : {}),
        ...(patch.thankYouMessage !== undefined
          ? { thankYouMessage: patch.thankYouMessage || null }
          : {}),
        ...(patch.consentText !== undefined ? { consentText: patch.consentText } : {}),
      });
    });
  } catch (erro) {
    if (isUniqueViolation(erro)) {
      return { error: "Este slug já está em uso — escolha outro endereço." };
    }
    return { error: erro instanceof Error ? erro.message : "Erro ao salvar página." };
  }

  revalidatePath(`/capture/${pageId}`);
  revalidatePath("/capture");
  return { success: "Página atualizada." };
}

export async function setCapturePageStatusAction(
  _prev: CaptureState,
  formData: FormData
): Promise<CaptureState> {
  const ctx = await requireOrgContext();

  const parsed = setCapturePageStatusSchema.safeParse({
    pageId: String(formData.get("pageId") ?? ""),
    status: String(formData.get("status") ?? ""),
  });
  if (!parsed.success) return { error: "Dados inválidos." };

  try {
    await withTenantDb(ctx.accessToken, async (db) =>
      updateCapturePage(db, ctx.organization.id, parsed.data.pageId, {
        status: parsed.data.status,
      })
    );
  } catch (erro) {
    return { error: erro instanceof Error ? erro.message : "Erro ao atualizar status." };
  }

  revalidatePath(`/capture/${parsed.data.pageId}`);
  revalidatePath("/capture");
  return {
    success:
      parsed.data.status === "published"
        ? "Página publicada — o link público está ativo."
        : parsed.data.status === "archived"
          ? "Página arquivada — o link público foi desativado."
          : "Página despublicada.",
  };
}
