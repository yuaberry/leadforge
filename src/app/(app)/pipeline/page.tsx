import type { Metadata } from "next";

import { KanbanBoard } from "@/components/crm/kanban-board";
import { CreateDealForm } from "@/components/crm/deal-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrgContext } from "@/server/auth/session";
import { listDeals } from "@/server/db/repositories/crm";
import { recentLeads } from "@/server/db/repositories/leads";
import { withTenantDb } from "@/server/db/tenant";

export const metadata: Metadata = {
  title: "Pipeline",
};

export default async function PipelinePage() {
  const ctx = await requireOrgContext();

  const { deals, leads } = await withTenantDb(ctx.accessToken, async (db) => ({
    deals: await listDeals(db, ctx.organization.id),
    leads: await recentLeads(db, ctx.organization.id, 50),
  }));

  const kanbanDeals = deals.map(({ deal, leadName, companyName }) => ({
    id: deal.id,
    title: deal.title,
    value: deal.value,
    stage: deal.stage,
    expectedCloseDate: deal.expectedCloseDate,
    leadName,
    companyName,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Arraste os deals entre os estágios (ou use as setas). A receita real vem das vendas —
          aqui é previsão.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo deal</CardTitle>
          <CardDescription>
            Vincule a um lead existente ou crie uma oportunidade livre.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateDealForm
            leads={leads.map((lead) => ({
              id: lead.id,
              label: lead.contactName ?? lead.companyName ?? lead.id,
            }))}
          />
        </CardContent>
      </Card>

      <div className="overflow-x-auto">
        <KanbanBoard deals={kanbanDeals} />
      </div>
    </div>
  );
}
