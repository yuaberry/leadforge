import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent } from "@/lib/format";
import { requireOrgContext } from "@/server/auth/session";
import { withTenantDb } from "@/server/db/tenant";
import { leadsOverviewCounts } from "@/server/db/repositories/leads";
import { salesTotals } from "@/server/db/repositories/commerce";
import { financialTotals } from "@/server/db/repositories/crm";
import { computeFunnelMetrics, computeRoi, type StageCount } from "@/server/services/analytics";
import { STAGE_LABELS } from "@/validators/lead";
import { count, eq } from "drizzle-orm";
import { campaigns, messages } from "@/server/db/schema";

export const metadata: Metadata = {
  title: "Analytics",
};

export default async function AnalyticsPage() {
  const ctx = await requireOrgContext();

  const data = await withTenantDb(ctx.accessToken, async (db) => {
    const [stageCounts, totals, finance, campaignRows] = await Promise.all([
      leadsOverviewCounts(db, ctx.organization.id),
      salesTotals(db, ctx.organization.id),
      financialTotals(db, ctx.organization.id),
      db
        .select({
          campaignId: campaigns.id,
          name: campaigns.name,
          mode: campaigns.mode,
          status: campaigns.status,
        })
        .from(campaigns)
        .where(eq(campaigns.organizationId, ctx.organization.id)),
    ]);

    // status de mensagens por campanha
    const messageRows = await db
      .select({ campaignId: messages.campaignId, status: messages.status, total: count() })
      .from(messages)
      .where(eq(messages.organizationId, ctx.organization.id))
      .groupBy(messages.campaignId, messages.status);

    return { stageCounts, totals, finance, campaignRows, messageRows };
  });

  const funnel = computeFunnelMetrics(data.stageCounts as StageCount);
  const roi = computeRoi(data.finance.revenue, data.finance.expense);

  const byCampaign = data.campaignRows.map((campaign) => {
    const stats = data.messageRows
      .filter((row) => row.campaignId === campaign.campaignId)
      .reduce<Record<string, number>>((acc, row) => {
        acc[row.status] = (acc[row.status] ?? 0) + Number(row.total);
        return acc;
      }, {});
    return { ...campaign, stats };
  });

  const maxStage = Math.max(...funnel.stages.map((s) => s.count), 1);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Os números que dizem o que realmente vende — sem vanity metrics.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Taxa de resposta</CardDescription>
            <CardTitle className="text-3xl">
              {funnel.responseRate !== null ? formatPercent(funnel.responseRate / 100) : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">respondidos ÷ contatados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Taxa de reunião</CardDescription>
            <CardTitle className="text-3xl">
              {funnel.meetingRate !== null ? formatPercent(funnel.meetingRate / 100) : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">reuniões+ ÷ respondidos+</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Conversão</CardDescription>
            <CardTitle className="text-3xl">
              {funnel.conversionRate !== null ? formatPercent(funnel.conversionRate / 100) : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {funnel.totalLeads} leads · {funnel.lostCount} perdidos
            </p>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardDescription>ROI sobre custos</CardDescription>
            <CardTitle className="text-3xl text-emerald-400">
              {roi !== null ? formatPercent(roi) : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              receita {formatCurrency(data.finance.revenue)} · custos{" "}
              {formatCurrency(data.finance.expense)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Funil de leads</CardTitle>
          <CardDescription>Distribuição por estágio (todos os tempos)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {funnel.stages.map((stage) => (
            <div key={stage.stage} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-xs text-muted-foreground">
                {STAGE_LABELS[stage.stage as keyof typeof STAGE_LABELS]}
              </span>
              <div className="h-5 flex-1 overflow-hidden rounded bg-secondary">
                <div
                  className="h-full rounded bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-400"
                  style={{ width: `${(stage.count / maxStage) * 100}%` }}
                />
              </div>
              <span className="w-16 text-right text-xs font-medium">
                {stage.count} ({stage.percentOfTotal}%)
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campanhas</CardTitle>
          <CardDescription>Entregabilidade por campanha de e-mail</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {byCampaign.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma campanha ainda — <Link href="/campaigns" className="text-primary hover:underline">crie a primeira</Link>.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {byCampaign.map((campaign) => (
                <div key={campaign.campaignId} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <Link href={`/campaigns/${campaign.campaignId}`} className="truncate text-sm font-medium hover:text-primary">
                      {campaign.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {campaign.mode === "manual" ? "com aprovação" : "automatizada"} ·{" "}
                      {campaign.status}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary">enviadas {campaign.stats.sent ?? 0}</Badge>
                    <Badge variant="success">entregues {campaign.stats.delivered ?? 0}</Badge>
                    <Badge variant="destructive">bounces {campaign.stats.bounced ?? 0}</Badge>
                    <Badge variant="warning">falhas {campaign.stats.failed ?? 0}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground/70">
        Respostas de e-mail (inbound) e atribuição direta campanha→venda chegam com o
        inbound parsing (futuras releases). WhatsApp inbound já marca replied em tempo real.
      </p>
    </div>
  );
}
