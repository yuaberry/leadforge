"use server";

import { revalidatePath } from "next/cache";

import { requireOrgContext } from "@/server/auth/session";
import { withTenantDb } from "@/server/db/tenant";
import {
  countOwners,
  findMembershipInDb,
  generateInviteToken,
  insertInvite,
  removeMember,
  revokeInvite,
  updateMemberRole,
} from "@/server/db/repositories/organizations";
import {
  createInviteSchema,
  removeMemberSchema,
  revokeInviteSchema,
  updateMemberRoleSchema,
  type MemberRole,
} from "@/validators/org";
import { assertWithinPlanLimit, planLimitMessage } from "@/server/services/usage";
import { PlanLimitError } from "@/server/services/billing";

type MembersState = { error?: string; success?: string } | null;

function canManage(role: string): boolean {
  return ["owner", "admin"].includes(role);
}

export async function updateMemberRoleAction(
  _prev: MembersState,
  formData: FormData
): Promise<MembersState> {
  const ctx = await requireOrgContext();
  if (!canManage(ctx.membership.role)) {
    return { error: "Você não tem permissão para gerenciar membros." };
  }

  const parsed = updateMemberRoleSchema.safeParse({
    organizationId: String(formData.get("organizationId") ?? ""),
    userId: String(formData.get("userId") ?? ""),
    role: String(formData.get("role") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  if (parsed.data.organizationId !== ctx.organization.id) {
    return { error: "Organização inválida." };
  }

  const { userId, role } = parsed.data;
  if (userId === ctx.user.id) {
    return { error: "Use o seletor de organização para gerenciar seu próprio papel." };
  }

  try {
    const resultado = await withTenantDb(ctx.accessToken, async (db) => {
      const target = await findMembershipInDb(db, ctx.organization.id, userId);
      if (!target) return { error: "Membro não encontrado." };

      const owners = await countOwners(db, ctx.organization.id);

      // Tocar papel de owner OU promover a owner exige ser owner.
      if (
        (target.role === "owner" || role === "owner") &&
        ctx.membership.role !== "owner"
      ) {
        return { error: "Apenas um owner pode gerenciar papéis de owner." };
      }
      // Org sempre precisa de pelo menos um owner.
      if (target.role === "owner" && role !== "owner" && owners <= 1) {
        return { error: "A organização precisa de pelo menos um owner." };
      }

      await updateMemberRole(db, ctx.organization.id, userId, role as MemberRole);
      return null;
    });

    if (resultado) return resultado;
  } catch (erro) {
    return {
      error: erro instanceof Error && erro.message.includes("row-level security")
        ? "Bloqueado pela política de segurança."
        : "Erro ao atualizar papel.",
    };
  }

  revalidatePath("/settings/users");
  return { success: "Papel atualizado." };
}

export async function removeMemberAction(
  _prev: MembersState,
  formData: FormData
): Promise<MembersState> {
  const ctx = await requireOrgContext();
  if (!canManage(ctx.membership.role)) {
    return { error: "Você não tem permissão para gerenciar membros." };
  }

  const parsed = removeMemberSchema.safeParse({
    organizationId: String(formData.get("organizationId") ?? ""),
    userId: String(formData.get("userId") ?? ""),
  });
  if (!parsed.success) {
    return { error: "Dados inválidos." };
  }
  if (parsed.data.organizationId !== ctx.organization.id) {
    return { error: "Organização inválida." };
  }

  const { userId } = parsed.data;

  try {
    const resultado = await withTenantDb(ctx.accessToken, async (db) => {
      const target = await findMembershipInDb(db, ctx.organization.id, userId);
      if (!target) return { error: "Membro não encontrado." };

      if (target.role === "owner") {
        if (ctx.membership.role !== "owner") {
          return { error: "Apenas um owner pode remover outro owner." };
        }
        const owners = await countOwners(db, ctx.organization.id);
        if (owners <= 1) {
          return { error: "A organização precisa de pelo menos um owner." };
        }
      }

      await removeMember(db, ctx.organization.id, userId);
      return null;
    });

    if (resultado) return resultado;
  } catch (erro) {
    return {
      error: erro instanceof Error && erro.message.includes("row-level security")
        ? "Bloqueado pela política de segurança."
        : "Erro ao remover membro.",
    };
  }

  revalidatePath("/settings/users");
  return { success: "Membro removido." };
}

export async function createInviteAction(
  _prev: MembersState,
  formData: FormData
): Promise<MembersState> {
  const ctx = await requireOrgContext();
  if (!canManage(ctx.membership.role)) {
    return { error: "Você não tem permissão para criar convites." };
  }

  const parsed = createInviteSchema.safeParse({
    role: String(formData.get("role") ?? ""),
    email: String(formData.get("email") ?? ""),
    expiresInDays: String(formData.get("expiresInDays") ?? "7"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    await withTenantDb(ctx.accessToken, async (db) => {
      // limite de plano: usuários (o convite vira membro ao ser aceito)
      await assertWithinPlanLimit(db, ctx.organization.id, ctx.organization.plan, "users");

      await insertInvite(db, {
        organizationId: ctx.organization.id,
        role: parsed.data.role,
        email: parsed.data.email,
        token: generateInviteToken(),
        createdBy: ctx.user.id,
        expiresAt: new Date(
          Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000
        ).toISOString(),
      });
    });
  } catch (erro) {
    if (erro instanceof PlanLimitError) {
      return { error: planLimitMessage(erro.metric, erro.limit) };
    }
    return {
      error: erro instanceof Error && erro.message.includes("row-level security")
        ? "Bloqueado pela política de segurança."
        : "Erro ao criar convite.",
    };
  }

  revalidatePath("/settings/users");
  return { success: "Convite criado. Copie o link e envie para a pessoa." };
}

export async function revokeInviteAction(
  _prev: MembersState,
  formData: FormData
): Promise<MembersState> {
  const ctx = await requireOrgContext();
  if (!canManage(ctx.membership.role)) {
    return { error: "Você não tem permissão para revogar convites." };
  }

  const parsed = revokeInviteSchema.safeParse({
    inviteId: String(formData.get("inviteId") ?? ""),
  });
  if (!parsed.success) {
    return { error: "Dados inválidos." };
  }

  try {
    await withTenantDb(ctx.accessToken, (db) =>
      revokeInvite(db, ctx.organization.id, parsed.data.inviteId)
    );
  } catch {
    return { error: "Erro ao revogar convite." };
  }

  revalidatePath("/settings/users");
  return { success: "Convite revogado." };
}
