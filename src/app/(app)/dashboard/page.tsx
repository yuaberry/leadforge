import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Magnet, Package, Target, Upload, UserRound, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { parseOrgSettings } from "@/validators/org";
import { requireOrgContext } from "@/server/auth/session";
import { withTenantDb } from "@/server/db/tenant";
import { countPendingInvites, listMembers } from "@/server/db/repositories/organizations";
import { leadsOverviewCounts, recentLeads } from "@/server/db/repositories/leads";
import { salesTotals } from "@/server/db/repositories/commerce";
import {
  financialTotals,
  listGoals,
  urgentTasksCount,
} from "@/server/db/repositories/crm";
import { goalProgress } from "@/server/services/goals";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const ctx = await requireOrgContext();

  const { members, pendingInvites, stageCounts, recent, totals, finance, goals, urgentTasks } =
    await withTenantDb(ctx.accessToken, async (db) => ({
      members: await listMembers(db, ctx.organization.id),
      pendingInvites: await countPendingInvites(db, ctx.organization.id),
      stageCounts: await leadsOverviewCounts(db, ctx.organization.id),
      recent: await recentLeads(db, ctx.organization.id, 5),
      totals: await salesTotals(db, ctx.organization.id),
      finance: await financialTotals(db, ctx.organization.id),
      goals: await listGoals(db, ctx.organization.id),
      urgentTasks: await urgentTasksCount(db, ctx.organization.id),
    }));

  const settings = parseOrgSettings(ctx.organization.settings);
  const rolesCount = members.reduce<Record<string, number>>((acc, m) => {
    acc[m.role] = (acc[m.role] ?? 0) + 1;
    return acc;
  }, {});
  const onboardingDone = Boolean(settings.onboardedAt);
  const totalLeads = Object.values(stageCounts).reduce((sum, n) => sum + n, 0);

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

      {/* Meta ativa — "falta R$X" */}
      {(() => {
        const settings2 = parseOrgSettings(ctx.organization.settings);
        const target =
          goals.find(({ goal }) => goal.id === settings2.goalSettings.targetGoalId) ??
          goals.find(({ goal }) => goal.status === "saving" || goal.status === "dreaming");
        if (!target) return null;
        const progress = goalProgress(target.contributed, target.goal.targetAmount);
        return (
          <Card className="overflow-hidden border-white/10 bg-gradient-to-br from-blue-600/10 via-violet-500/10 to-cyan-400/10">
            <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center">
              {target.goal.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- imagem por URL arbitrária do usuário
                <img
                  src={target.goal.imageUrl}
                  alt={target.goal.name}
                  className="h-24 w-full rounded-xl border border-white/10 object-cover sm:w-24"
                />
              ) : (
                <div className="flex h-24 w-full items-center justify-center rounded-xl bg-white/5 text-3xl sm:w-24">
                  <Target className="size-8 text-cyan-300" aria-hidden="true" />
                </div>
              )}
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Sua meta agora</p>
                <p className="text-lg font-semibold">{target.goal.name}</p>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-400"
                    style={{ width: `${progress.percent}%` }}
                    role="progressbar"
                    aria-valuenow={Math.round(progress.percent)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                <p className="mt-1.5 text-sm">
                  <span className="text-emerald-400">{formatCurrency(progress.contributed)}</span>{" "}
                  <span className="text-muted-foreground">
                    de {formatCurrency(progress.target)} ·{" "}
                    {progress.reached ? "conquistada! 🎉" : `faltam ${formatCurrency(progress.remaining)}`}
                  </span>
                </p>
              </div>
              <Button asChild variant="secondary" size="sm" className="shrink-0">
                <Link href="/goals">Gerenciar metas</Link>
              </Button>
            </CardContent>
          </Card>
        );
      })()}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardDescription>Comissões (pagas)</CardDescription>
            <CardTitle className="text-3xl text-emerald-400">
              {formatCurrency(totals.paidCommission)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={totals.paidCount > 0 ? "success" : "secondary"}>
              {totals.paidCount} venda{totals.paidCount === 1 ? "" : "s"}
            </Badge>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardDescription>Lucro líquido</CardDescription>
            <CardTitle className={`text-3xl ${finance.profit >= 0 ? "text-primary" : "text-red-400"}`}>
              {formatCurrency(finance.profit)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="ghost" size="sm" asChild className="-ml-2 gap-1 text-muted-foreground">
              <Link href="/profit">
                Receita {formatCurrency(finance.revenue)} · custos {formatCurrency(finance.expense)}
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <UserRound className="size-3.5" aria-hidden="true" />
              Leads
            </CardDescription>
            <CardTitle className="text-3xl">{totalLeads}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            <Badge variant="secondary">{stageCounts.new ?? 0} novos</Badge>
            {(stageCounts.won ?? 0) > 0 && (
              <Badge variant="success">{stageCounts.won} ganhos</Badge>
            )}
          </CardContent>
        </Card>

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
                Gerenciar
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

      <div className="grid gap-3 sm:grid-cols-3">
        <Button asChild variant="secondary" className="h-auto justify-start gap-3 py-3">
          <Link href="/capture">
            <Magnet className="size-4 shrink-0" aria-hidden="true" />
            <span className="text-left">
              <span className="block text-sm font-semibold">Criar página de captura</span>
              <span className="block text-xs font-normal text-muted-foreground">
                Lista própria com consentimento LGPD
              </span>
            </span>
          </Link>
        </Button>
        <Button asChild variant="secondary" className="h-auto justify-start gap-3 py-3">
          <Link href="/import">
            <Upload className="size-4 shrink-0" aria-hidden="true" />
            <span className="text-left">
              <span className="block text-sm font-semibold">Importar CSV</span>
              <span className="block text-xs font-normal text-muted-foreground">
                Com proveniência declarada e dedup automático
              </span>
            </span>
          </Link>
        </Button>
        <Button asChild variant="secondary" className="h-auto justify-start gap-3 py-3">
          <Link href="/leads/new">
            <UserRound className="size-4 shrink-0" aria-hidden="true" />
            <span className="text-left">
              <span className="block text-sm font-semibold">Cadastrar lead</span>
              <span className="block text-xs font-normal text-muted-foreground">
                Manual, com normalização automática
              </span>
            </span>
          </Link>
        </Button>
      </div>

      {recent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads recentes</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {recent.map((lead) => (
              <Link
                key={lead.id}
                href={`/leads/${lead.id}`}
                className="flex items-center justify-between gap-2 py-2.5 transition-colors hover:text-primary"
              >
                <span className="truncate text-sm">
                  {lead.contactName ?? lead.companyName ?? "Lead"}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(lead.createdAt).toLocaleDateString("pt-BR")}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

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

      {urgentTasks > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex items-center justify-between gap-3 pt-6">
            <p className="text-sm">
              <span className="font-semibold text-amber-400">{urgentTasks}</span> tarefa
              {urgentTasks === 1 ? "" : "s"} para hoje ou atrasada{urgentTasks === 1 ? "" : "s"}
            </p>
            <Button asChild size="sm" variant="secondary">
              <Link href="/tasks">Ver tarefas</Link>
            </Button>
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
          <p>• Fase 6 — Campanhas de e-mail, templates e follow-up automático</p>
          <p>• Fase 7 — WhatsApp Business oficial e inbox unificada</p>
          <p>• Fase 8 — Discovery: buscar empresas via Google Places</p>
          <p>• Fase 9 — Analytics de conversão, billing e hardening final</p>
        </CardContent>
      </Card>
    </div>
  );
}
