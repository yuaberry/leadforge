import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlert, CircleCheck } from "lucide-react";

import { ConfigPending } from "@/components/auth/config-pending";
import { AcceptInviteForm } from "@/components/invite/accept-invite-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ORG_ROLES, type MemberRoleKey } from "@/lib/constants";
import { isSupabaseConfigured } from "@/lib/env";
import { requireAuth } from "@/server/auth/session";
import { getInviteByToken } from "@/server/db/repositories/organizations";
import { withTenantDb } from "@/server/db/tenant";

export const metadata: Metadata = {
  title: "Convite",
};

// Rota autenticada — sempre renderizada por request.
export const dynamic = "force-dynamic";

type InviteView =
  | { state: "ok"; organizationName: string; role: string; token: string }
  | { state: "indisponivel"; motivo: string }
  | { state: "jaMembro" };

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const session = isSupabaseConfigured() ? await requireAuth() : null;
  if (!session) {
    return <ConfigPending />;
  }
  const { token } = await params;

  const view = await withTenantDb(session.accessToken, async (db): Promise<InviteView> => {
    const record = await getInviteByToken(db, token);
    if (!record) {
      return { state: "indisponivel", motivo: "Convite não encontrado." };
    }

    const { invite, organizationName } = record;

    if (invite.status === "accepted" && invite.acceptedBy === session.user.id) {
      return { state: "jaMembro" };
    }
    if (invite.status !== "pending") {
      return {
        state: "indisponivel",
        motivo:
          invite.status === "revoked"
            ? "Este convite foi revogado."
            : "Este convite não está mais disponível.",
      };
    }
    if (new Date(invite.expiresAt).getTime() < Date.now()) {
      return { state: "indisponivel", motivo: "Este convite expirou." };
    }
    if (invite.email && invite.email !== session.user.email?.toLowerCase()) {
      return {
        state: "indisponivel",
        motivo: `Este convite é para o e-mail ${invite.email}. Entre com essa conta para aceitar.`,
      };
    }

    return { state: "ok", organizationName, role: invite.role, token };
  });

  if (view.state === "jaMembro") {
    return (
      <InviteCard title="Você já faz parte desta organização">
        <Button asChild>
          <Link href="/dashboard">Ir para o dashboard</Link>
        </Button>
      </InviteCard>
    );
  }

  if (view.state === "indisponivel") {
    return (
      <InviteCard title={view.motivo}>
        <p className="text-sm text-muted-foreground">
          Peça para quem enviou o convite gerar um novo link.
        </p>
      </InviteCard>
    );
  }

  return (
    <Card className="border-white/10 bg-card/80 backdrop-blur">
      <CardHeader>
        <CardTitle>Você foi convidado!</CardTitle>
        <CardDescription>
          A organização <span className="text-foreground">{view.organizationName}</span> quer você
          como {ORG_ROLES[view.role as MemberRoleKey] ?? view.role}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleCheck className="size-4 text-emerald-400" aria-hidden="true" />
          Aceitando, você passa a acessar os dados desta organização — nada é compartilhado entre
          organizações.
        </div>
        <AcceptInviteForm token={view.token} />
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CircleAlert className="size-3.5" aria-hidden="true" />
          Convites são isolados por tenant (RLS) e registram auditoria de aceite.
        </p>
        <Badge variant="secondary" className="capitalize">
          {ORG_ROLES[view.role as MemberRoleKey] ?? view.role}
        </Badge>
      </CardContent>
    </Card>
  );
}

function InviteCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-white/10 bg-card/80 backdrop-blur">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
