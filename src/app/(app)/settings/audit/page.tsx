import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrgContext } from "@/server/auth/session";
import { activities, users } from "@/server/db/schema";
import { withTenantDb } from "@/server/db/tenant";

export const metadata: Metadata = {
  title: "Auditoria",
};

const TYPE_LABELS: Record<string, string> = {
  lead_created: "Lead criado",
  lead_captured: "Lead capturado",
  lead_score_updated: "Score atualizado",
  stage_changed: "Estágio alterado",
  deal_stage_changed: "Deal movido",
  tag_added: "Tag adicionada",
  note: "Nota",
  ai_analysis: "Análise de IA",
  import_completed: "Importação concluída",
  message_sent: "Mensagem enviada",
  sale_recorded: "Venda registrada",
  sale_status_changed: "Status de venda alterado",
  campaign_active: "Campanha ativada",
  campaign_paused: "Campanha pausada",
  campaign_cancelled: "Campanha cancelada",
  unsubscribed: "Inscrição cancelada (opt-out)",
  optout_whatsapp: "Opt-out via WhatsApp",
  suppression_added: "Contato suprimido",
  suppression_removed: "Contato reativado",
};

export default async function AuditPage() {
  const ctx = await requireOrgContext();

  const rows = await withTenantDb(ctx.accessToken, async (db) =>
    db
      .select({
        activity: activities,
        actorName: users.fullName,
        actorEmail: users.email,
      })
      .from(activities)
      .leftJoin(users, eq(users.id, activities.actorId))
      .where(eq(activities.organizationId, ctx.organization.id))
      .orderBy(desc(activities.createdAt))
      .limit(100)
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Auditoria</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Trilha de eventos da organização — criações, envios, opt-outs, alterações de
          configuração e vendas. Nada importante acontece invisível.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eventos recentes ({rows.length})</CardTitle>
          <CardDescription>Últimos 100 eventos</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhum evento registrado ainda.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {rows.map(({ activity, actorName, actorEmail }) => (
                <div key={activity.id} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {TYPE_LABELS[activity.type] ?? activity.type}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {actorName ?? actorEmail ?? "sistema"} ·{" "}
                      {new Date(activity.createdAt).toLocaleString("pt-BR")}
                    </p>
                    {Object.keys(activity.metadata as Record<string, unknown>).length > 0 && (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground/60">
                        {JSON.stringify(activity.metadata).slice(0, 120)}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {activity.entityType}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
