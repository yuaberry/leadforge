import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrgContext } from "@/server/auth/session";
import { withTenantDb } from "@/server/db/tenant";
import { getUsage } from "@/server/services/usage";
import { PLANS, getPlan, limitLabel, type UsageMetric } from "@/server/services/billing";

export const metadata: Metadata = {
  title: "Billing",
};

const METRIC_LABELS: Record<UsageMetric, string> = {
  leads: "Leads",
  users: "Usuários",
  messagesPerMonth: "Mensagens/mês",
  aiAnalysesPerMonth: "Análises IA/mês",
  activeCampaigns: "Campanhas ativas",
  integrations: "Integrações",
};

export default async function BillingPage() {
  const ctx = await requireOrgContext();

  const usage = await withTenantDb(ctx.accessToken, (db) =>
    getUsage(db, ctx.organization.id)
  );

  const plan = getPlan(ctx.organization.plan);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Uso da sua organização e limites do plano. O Stripe entra em breve — por ora os
          limites já são aplicados automaticamente.
        </p>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Plano {plan.label}
            <Badge variant="secondary">{plan.priceHint}</Badge>
          </CardTitle>
          <CardDescription>{plan.description}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(METRIC_LABELS) as UsageMetric[]).map((metric) => {
            const limit = plan.limits[metric];
            const current = usage[metric];
            const percent = limit === null ? 0 : Math.min(100, Math.round((current / limit) * 100));
            return (
              <div key={metric} className="space-y-1.5">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">{METRIC_LABELS[metric]}</span>
                  <span className="font-medium">
                    {current.toLocaleString("pt-BR")} / {limitLabel(limit)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full rounded-full ${
                      percent >= 100
                        ? "bg-red-500"
                        : percent >= 80
                          ? "bg-amber-500"
                          : "bg-gradient-to-r from-blue-500 to-cyan-400"
                    }`}
                    style={{ width: `${limit === null ? 4 : percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Planos</CardTitle>
          <CardDescription>Upgrade via Stripe em preparo — os limites já rodam.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-left text-xs">
                <tr>
                  <th className="px-4 py-2 font-medium">Plano</th>
                  <th className="px-4 py-2 font-medium">Leads</th>
                  <th className="px-4 py-2 font-medium">Usuários</th>
                  <th className="px-4 py-2 font-medium">Msgs/mês</th>
                  <th className="px-4 py-2 font-medium">IA/mês</th>
                  <th className="px-4 py-2 font-medium">Campanhas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Object.values(PLANS).map((p) => (
                  <tr key={p.key} className={p.key === plan.key ? "bg-primary/5" : ""}>
                    <td className="px-4 py-2.5 font-medium">
                      {p.label}
                      {p.key === plan.key && (
                        <Badge variant="secondary" className="ml-2">atual</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{limitLabel(p.limits.leads)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{limitLabel(p.limits.users)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{limitLabel(p.limits.messagesPerMonth)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{limitLabel(p.limits.aiAnalysesPerMonth)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{limitLabel(p.limits.activeCampaigns)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
