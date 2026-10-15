"use server";

import { redirect } from "next/navigation";

import { requireAuth } from "@/server/auth/session";
import { setActiveOrgCookie } from "@/server/auth/org-cookie";
import { withTenantDb } from "@/server/db/tenant";
import {
  getInviteByToken,
  insertMemberFromInvite,
  markInviteAccepted,
  memberExists,
} from "@/server/db/repositories/organizations";
import { acceptInviteSchema } from "@/validators/org";

type AcceptState = { error?: string } | null;

export async function acceptInviteAction(
  _prev: AcceptState,
  formData: FormData
): Promise<AcceptState> {
  const session = await requireAuth();

  const parsed = acceptInviteSchema.safeParse({
    token: String(formData.get("token") ?? ""),
  });
  if (!parsed.success) {
    return { error: "Convite inválido." };
  }

  try {
    const result = await withTenantDb(session.accessToken, async (db) => {
      const record = await getInviteByToken(db, parsed.data.token);
      if (!record) return { ok: false, error: "Convite não encontrado." };

      const { invite } = record;
      if (invite.status !== "pending") {
        return { ok: false, error: "Este convite não está mais disponível." };
      }
      if (new Date(invite.expiresAt).getTime() < Date.now()) {
        return { ok: false, error: "Este convite expirou." };
      }
      if (invite.email && invite.email !== session.user.email?.toLowerCase()) {
        return { ok: false, error: "Este convite é para outro e-mail." };
      }

      const alreadyMember = await memberExists(db, invite.organizationId, session.user.id);
      if (!alreadyMember) {
        // A policy members_insert (caminho do convite) valida tudo de novo.
        await insertMemberFromInvite(db, invite.organizationId, session.user.id, invite.role);
      }
      await markInviteAccepted(db, invite.id, session.user.id);

      return { ok: true as const, organizationId: invite.organizationId };
    });

    if (!result.ok) {
      return { error: result.error };
    }

    await setActiveOrgCookie(String(result.organizationId));
  } catch (erro) {
    return {
      error:
        erro instanceof Error && erro.message.includes("row-level security")
          ? "Convite bloqueado pela política de segurança. Solicite um novo."
          : "Erro ao aceitar convite. Tente novamente.",
    };
  }

  redirect("/dashboard");
}
