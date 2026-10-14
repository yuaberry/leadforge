import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ORG_ROLES, type MemberRoleKey } from "@/lib/constants";
import { requireOrgContext } from "@/server/auth/session";
import { listInvites, listMembers } from "@/server/db/repositories/organizations";
import { withTenantDb } from "@/server/db/tenant";

import { CreateInviteForm } from "@/components/settings/create-invite-form";
import {
  InviteLink,
} from "@/components/settings/invite-link";
import {
  MemberRoleForm,
  RemoveMemberForm,
  RevokeInviteForm,
} from "@/components/settings/member-forms";

export const metadata: Metadata = {
  title: "Membros",
};

const INVITE_STATUS_BADGE: Record<string, "secondary" | "success" | "destructive" | "warning"> = {
  pending: "secondary",
  accepted: "success",
  revoked: "destructive",
  expired: "warning",
};

const INVITE_STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  accepted: "Aceito",
  revoked: "Revogado",
  expired: "Expirado",
};

export default async function UsersSettingsPage() {
  const ctx = await requireOrgContext();

  const { members, invites } = await withTenantDb(ctx.accessToken, async (db) => ({
    members: await listMembers(db, ctx.organization.id),
    invites: await listInvites(db, ctx.organization.id),
  }));

  const canManage = ["owner", "admin"].includes(ctx.membership.role);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Membros & Convites</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sua equipe, papéis e convites de acesso.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Membros ({members.length})</CardTitle>
          <CardDescription>
            {canManage
              ? "Owners gerenciam todos os papéis; admins gerenciam não-owners."
              : "Somente owners e admins podem gerenciar membros."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.map((member) => {
            const isSelf = member.userId === ctx.user.id;
            return (
              <div
                key={member.userId}
                className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {member.fullName ?? member.email ?? "Usuário"}
                    {isSelf && <span className="ml-2 text-xs text-muted-foreground">(você)</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {member.email ?? "—"} · desde{" "}
                    {new Date(member.memberSince).toLocaleDateString("pt-BR")}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={member.role === "owner" ? "default" : "secondary"}>
                    {ORG_ROLES[member.role as MemberRoleKey] ?? member.role}
                  </Badge>

                  {canManage && !isSelf && (
                    <div className="flex items-center gap-2">
                      <MemberRoleForm
                        organizationId={ctx.organization.id}
                        userId={member.userId}
                        role={member.role}
                      />
                      <RemoveMemberForm
                        organizationId={ctx.organization.id}
                        userId={member.userId}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Convites</CardTitle>
            <CardDescription>
              Crie um link de convite e envie por WhatsApp ou e-mail. Convites com e-mail só
              podem ser aceitos por essa pessoa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <CreateInviteForm />

            {invites.length > 0 ? (
              <div className="space-y-2">
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">
                        {ORG_ROLES[invite.role as MemberRoleKey] ?? invite.role} ·{" "}
                        {invite.email ?? "qualquer pessoa com o link"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Expira em{" "}
                        {new Date(invite.expiresAt).toLocaleDateString("pt-BR")}
                      </p>
                      {invite.status === "pending" && <InviteLink token={invite.token} />}
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={INVITE_STATUS_BADGE[invite.status] ?? "secondary"}>
                        {INVITE_STATUS_LABEL[invite.status] ?? invite.status}
                      </Badge>
                      {invite.status === "pending" && (
                        <RevokeInviteForm inviteId={invite.id} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum convite criado ainda.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
