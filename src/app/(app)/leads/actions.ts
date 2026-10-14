"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOrgContext } from "@/server/auth/session";
import { withTenantDb } from "@/server/db/tenant";
import {
  attachLeadTag,
  detachLeadTag,
  getOrCreateTag,
  getLeadById,
  getOrCreateSource,
  recordActivity,
  updateLeadStage,
  upsertLead,
} from "@/server/db/repositories/leads";
import {
  addLeadNoteSchema,
  addLeadTagSchema,
  createLeadSchema,
  removeLeadTagSchema,
  updateLeadStageSchema,
} from "@/validators/lead";

type LeadActionState = { error?: string; success?: string } | null;

export async function createLeadAction(
  _prev: LeadActionState,
  formData: FormData
): Promise<LeadActionState> {
  const ctx = await requireOrgContext();

  const parsed = createLeadSchema.safeParse({
    contactName: String(formData.get("contactName") ?? ""),
    companyName: String(formData.get("companyName") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    website: String(formData.get("website") ?? ""),
    category: String(formData.get("category") ?? ""),
    city: String(formData.get("city") ?? ""),
    state: String(formData.get("state") ?? ""),
    jobTitle: String(formData.get("jobTitle") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const { contactName, notes, ...rest } = parsed.data;
  const nonEmptyNotes = notes || null;

  let leadId: string | null = null;

  try {
    const result = await withTenantDb(ctx.accessToken, async (db) => {
      const source = await getOrCreateSource(
        db,
        ctx.organization.id,
        "Cadastro manual",
        "manual"
      );
      const { lead, created } = await upsertLead(
        db,
        ctx.organization.id,
        { contactName, ...rest, notes: nonEmptyNotes },
        {
          sourceId: source.id,
          sourceName: "Cadastro manual",
          sourceType: "manual",
          actorId: ctx.user.id,
        }
      );
      return { leadId: lead.id, created };
    });

    leadId = result.leadId;
    if (!result.created) {
      return { error: "Este lead já existe (deduplicado) — abrindo o existente." };
    }
  } catch (erro) {
    return {
      error: erro instanceof Error && erro.message.includes("row-level security")
        ? "Bloqueado pela política de segurança."
        : "Erro ao criar o lead.",
    };
  }

  revalidatePath("/leads");
  redirect(`/leads/${leadId}`);
}

export async function updateLeadStageAction(
  _prev: LeadActionState,
  formData: FormData
): Promise<LeadActionState> {
  const ctx = await requireOrgContext();

  const parsed = updateLeadStageSchema.safeParse({
    leadId: String(formData.get("leadId") ?? ""),
    stage: String(formData.get("stage") ?? ""),
  });
  if (!parsed.success) return { error: "Dados inválidos." };

  try {
    await withTenantDb(ctx.accessToken, async (db) => {
      const exists = await getLeadById(db, ctx.organization.id, parsed.data.leadId);
      if (!exists) throw new Error("Lead não encontrado.");
      await updateLeadStage(
        db,
        ctx.organization.id,
        parsed.data.leadId,
        parsed.data.stage,
        ctx.user.id
      );
    });
  } catch (erro) {
    return { error: erro instanceof Error ? erro.message : "Erro ao atualizar estágio." };
  }

  revalidatePath(`/leads/${parsed.data.leadId}`);
  revalidatePath("/leads");
  return { success: "Estágio atualizado." };
}

export async function addLeadTagAction(
  _prev: LeadActionState,
  formData: FormData
): Promise<LeadActionState> {
  const ctx = await requireOrgContext();

  const parsed = addLeadTagSchema.safeParse({
    leadId: String(formData.get("leadId") ?? ""),
    tagName: String(formData.get("tagName") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    await withTenantDb(ctx.accessToken, async (db) => {
      const lead = await getLeadById(db, ctx.organization.id, parsed.data.leadId);
      if (!lead) throw new Error("Lead não encontrado.");
      const tag = await getOrCreateTag(db, ctx.organization.id, parsed.data.tagName);
      await attachLeadTag(db, parsed.data.leadId, tag.id);
      await recordActivity(db, {
        organizationId: ctx.organization.id,
        type: "tag_added",
        entityType: "lead",
        entityId: parsed.data.leadId,
        actorId: ctx.user.id,
        metadata: { tag: tag.name },
      });
    });
  } catch (erro) {
    return { error: erro instanceof Error ? erro.message : "Erro ao adicionar tag." };
  }

  revalidatePath(`/leads/${parsed.data.leadId}`);
  return { success: "Tag adicionada." };
}

export async function removeLeadTagAction(
  _prev: LeadActionState,
  formData: FormData
): Promise<LeadActionState> {
  const ctx = await requireOrgContext();

  const parsed = removeLeadTagSchema.safeParse({
    leadId: String(formData.get("leadId") ?? ""),
    tagId: String(formData.get("tagId") ?? ""),
  });
  if (!parsed.success) return { error: "Dados inválidos." };

  try {
    await withTenantDb(ctx.accessToken, async (db) =>
      detachLeadTag(db, parsed.data.leadId, parsed.data.tagId)
    );
  } catch {
    return { error: "Erro ao remover tag." };
  }

  revalidatePath(`/leads/${parsed.data.leadId}`);
  return { success: "Tag removida." };
}

export async function addLeadNoteAction(
  _prev: LeadActionState,
  formData: FormData
): Promise<LeadActionState> {
  const ctx = await requireOrgContext();

  const parsed = addLeadNoteSchema.safeParse({
    leadId: String(formData.get("leadId") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  try {
    await withTenantDb(ctx.accessToken, async (db) => {
      const lead = await getLeadById(db, ctx.organization.id, parsed.data.leadId);
      if (!lead) throw new Error("Lead não encontrado.");
      await recordActivity(db, {
        organizationId: ctx.organization.id,
        type: "note",
        entityType: "lead",
        entityId: parsed.data.leadId,
        actorId: ctx.user.id,
        metadata: { text: parsed.data.note },
      });
    });
  } catch (erro) {
    return { error: erro instanceof Error ? erro.message : "Erro ao salvar nota." };
  }

  revalidatePath(`/leads/${parsed.data.leadId}`);
  return { success: "Nota salva." };
}
