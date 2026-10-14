import type { Metadata } from "next";
import Link from "next/link";

import { CreateCampaignForm } from "@/components/campaigns/campaign-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireOrgContext } from "@/server/auth/session";
import { listCampaigns } from "@/server/db/repositories/campaigns";
import { listProducts } from "@/server/db/repositories/commerce";
import { withTenantDb } from "@/server/db/tenant";

export const metadata: Metadata = {
  title: "Campanhas",
};

const STATUS_BADGE: Record<string, "secondary" | "success" | "destructive" | "warning" | "default"> = {
  draft: "secondary",
  active: "success",
  paused: "warning",
  completed: "default",
  cancelled: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativa",
  paused: "Pausada",
  completed: "Concluída",
  cancelled: "Cancelada",
};

export default async function CampaignsPage() {
  const ctx = await requireOrgContext();

  const { campaigns, products } = await withTenantDb(ctx.accessToken, async (db) => ({
    campaigns: await listCampaigns(db, ctx.organization.id),
    products: (await listProducts(db, ctx.organization.id))
      .filter(({ product }) => product.status === "active")
      .map(({ product }) => ({ id: product.id, name: product.name })),
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Campanhas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sequências de e-mail com follow-up, caps de frequência e — no modo manual —
          aprovação de cada mensagem antes do envio.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <CreateCampaignForm products={products} />
        </CardContent>
      </Card>

      {campaigns.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">
          Nenhuma campanha ainda — crie a primeira acima.
        </p>
      ) : (
        <div className="grid gap-3">
          {campaigns.map(({ campaign, leadsCount, messagesSent }) => (
            <Card key={campaign.id}>
              <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/campaigns/${campaign.id}`}
                      className="truncate text-sm font-medium hover:text-primary"
                    >
                      {campaign.name}
                    </Link>
                    <Badge variant={STATUS_BADGE[campaign.status] ?? "secondary"}>
                      {STATUS_LABEL[campaign.status] ?? campaign.status}
                    </Badge>
                    <Badge variant={campaign.mode === "manual" ? "secondary" : "warning"}>
                      {campaign.mode === "manual" ? "com aprovação" : "automatizada"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {leadsCount} lead{leadsCount === 1 ? "" : "s"} · {messagesSent} enviada
                    {messagesSent === 1 ? "" : "s"} · cap {campaign.dailyCap}/dia
                  </p>
                </div>
                <Button asChild size="sm" variant="secondary" className="shrink-0">
                  <Link href={`/campaigns/${campaign.id}`}>Abrir</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
