import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Package, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { parseOrgSettings } from "@/validators/org";
import { requireOrgContext } from "@/server/auth/session";
import { withTenantDb } from "@/server/db/tenant";
import { countPendingInvites, listMembers } from "@/server/db/repositories/organizations";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const ctx = await requireOrgContext();

  const { members, pendingInvites } = await withTenantDb(ctx.accessToken, async (db) => ({
    members: await listMembers(db, ctx.organization.id),
    pendingInvites: await countPendingInvites(db, ctx.organization.id),
  }));

  const settings = parseOrgSettings(ctx.organization.settings);
  const rolesCount = members.reduce<Record<string, number>>((acc, m) => {
    acc[m.role] = (acc[m.role] ?? 0) + 1;
    return acc;
  }, {});
  const onboardingDone = Boolean(settings.onboardedAt);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {ctx.organization.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bem-vindo de volta. Aqui está o estado da sua operação.
        </p>
      </div>

      {!onboardingDone && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col items-start gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Complete o onboarding</p>
              <p className="text-sm text-muted-foreground">
                Configure seu negócio digital, canais e a meta dos sonhos.
              </p>
            </div>
            <Button asChild>
              <Link href="/onboarding">
                Continuar
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Users className="size-3.5" aria-hidden="true" />
              Membros
            </CardDescription>
            <CardTitle className="text-3xl">{members.length}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {Object.entries(rolesCount).map(([role, total]) => (
              <Badge key={role} variant="secondary">
                {total} {role}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Package className="size-3.5" aria-hidden="true" />
              Convites pendentes
            </CardDescription>
            <CardTitle className="text-3xl">{pendingInvites}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="ghost" size="sm" asChild className="-ml-2 gap-1 text-muted-foreground">
              <Link href="/settings/users">
                Gerenciar membros
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Plano</CardDescription>
            <CardTitle className="text-3xl capitalize">{ctx.organization.plan}</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">Billing chega na Fase 9</Badge>
          </CardContent>
        </Card>
      </div>

      {settings.dream && (
        <Card className="overflow-hidden border-white/10 bg-gradient-to-br from-blue-600/10 via-violet-500/10 to-cyan-400/10">
          <CardContent className="flex flex-col gap-6 pt-6 sm:flex-row sm:items-center">
            {settings.dream.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- imagem informada pelo usuário via URL arbitrária (sem allowlist possível)
              <img
                src={settings.dream.imageUrl}
                alt={settings.dream.name}
                className="h-32 w-full rounded-xl border border-white/10 object-cover sm:w-32"
              />
            ) : null}
            <div className="flex-1">
              <CardDescription>Sua meta dos sonhos</CardDescription>
              <p className="mt-1 text-xl font-semibold">{settings.dream.name}</p>
              {settings.dream.amount !== null && (
                <p className="text-lg text-primary">
                  {formatCurrency(settings.dream.amount)}
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                O acompanhamento de progresso com cada venda chega na Fase 5 (Lucro & Metas).
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="size-4 text-emerald-400" aria-hidden="true" />
            Próximas entregas
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
          <p>• Fase 2 — Empresas, leads, importação e páginas de captura</p>
          <p>• Fase 3 — Produtos, vendas Kiwify/Kirvano e links rastreados</p>
          <p>• Fase 4 — Scoring, IA de vendas e mensagens personalizadas</p>
          <p>• Fase 5 — Pipeline, Lucro e Metas gamificadas</p>
        </CardContent>
      </Card>
    </div>
  );
}
