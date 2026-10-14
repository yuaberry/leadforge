import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Trash2, X } from "lucide-react";

import {
  AddLeadsByFilterForm,
  AddStepForm,
  CampaignControls,
} from "@/components/campaigns/campaign-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrgContext } from "@/server/auth/session";
import {
  campaignLeadsByStatus,
  getCampaign,
  listCampaignLeads,
  listCampaignMessages,
  listSteps,
} from "@/server/db/repositories/campaigns";
import { withTenantDb } from "@/server/db/tenant";
import { ELIGIBILITY_REASON_LABELS } from "@/server/services/eligibility";
import {
  approveMessageAction,
  discardMessageAction,
  removeCampaignLeadAction,
  removeStepAction,
} from "../actions";

export const metadata: Metadata = {
  title: "Campanha",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativa",
  paused: "Pausada",
  completed: "Concluída",
  cancelled: "Cancelada",
};

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireOrgContext();

  const data = await withTenantDb(ctx.accessToken, async (db) => {
    const campaign = await getCampaign(db, ctx.organization.id, id);
    if (!campaign) return null;
    const [steps, leads, byStatus, messages] = await Promise.all([
      listSteps(db, ctx.organization.id, id),
      listCampaignLeads(db, ctx.organization.id, id),
      campaignLeadsByStatus(db, ctx.organization.id, id),
      listCampaignMessages(db, ctx.organization.id, id),
    ]);
    return { campaign, steps, leads, byStatus, messages };
  });

  if (!data) notFound();
  const { campaign, steps, leads, byStatus, messages } = data;

  const pendingApproval = messages.filter((m) => m.status === "pending_approval");
  const statusCount = Object.fromEntries(byStatus.map((r) => [r.status, Number(r.total)]));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{campaign.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={campaign.status === "active" ? "success" : "secondary"}>
              {STATUS_LABEL[campaign.status] ?? campaign.status}
            </Badge>
            <Badge variant={campaign.mode === "manual" ? "secondary" : "warning"}>
              {campaign.mode === "manual" ? "com aprovação humana" : "automatizada"}
            </Badge>
            <Badge variant="outline">e-mail</Badge>
            <Badge variant="outline">cap {campaign.dailyCap}/dia</Badge>
            <Badge variant="outline">
              janela {campaign.activeHourStart}h–{campaign.activeHourEnd}h
            </Badge>
          </div>
        </div>
        <CampaignControls campaignId={campaign.id} status={campaign.status} />
      </div>

      {/* Aprovações pendentes (modo manual) */}
      {pendingApproval.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-base text-amber-400">
              Aprovação pendente ({pendingApproval.length})
            </CardTitle>
            <CardDescription>
              O modo manual nunca envia sozinho — revise e aprove.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingApproval.map((message) => (
              <div key={message.id} className="rounded-xl border bg-card p-4">
                <p className="text-xs text-muted-foreground">
                  Para: {message.toAddress}
                </p>
                {message.subject && <p className="mt-1 text-sm font-semibold">{message.subject}</p>}
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                  {message.body.slice(0, 400)}
                  {message.body.length > 400 ? "..." : ""}
                </p>
                <div className="mt-3 flex gap-2">
                  <form action={approveMessageAction}>
                    <input type="hidden" name="messageId" value={message.id} />
                    <input type="hidden" name="campaignId" value={campaign.id} />
                    <Button type="submit" size="sm">
                      Aprovar e enviar
                    </Button>
                  </form>
                  <form action={discardMessageAction}>
                    <input type="hidden" name="messageId" value={message.id} />
                    <input type="hidden" name="campaignId" value={campaign.id} />
                    <Button type="submit" size="sm" variant="outline" className="gap-1.5">
                      <X className="size-3.5" aria-hidden="true" />
                      Descartar
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Etapas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Etapas ({steps.length})</CardTitle>
          <CardDescription>
            Sequência linear com esperas — sem loops infinitos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {steps.map((step) => (
            <div key={step.id} className="rounded-xl border p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Etapa {step.position} ·{" "}
                  {step.waitDays > 0 ? `espera de ${step.waitDays} dia(s)` : "primeiro contato"}
                </p>
                <form action={removeStepAction}>
                  <input type="hidden" name="stepId" value={step.id} />
                  <input type="hidden" name="campaignId" value={campaign.id} />
                  <button
                    type="submit"
                    aria-label="Remover etapa"
                    className="rounded p-1 text-muted-foreground/50 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </form>
              </div>
              {step.subject && <p className="mt-1 text-sm font-semibold">{step.subject}</p>}
              <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                {step.body.slice(0, 300)}
                {step.body.length > 300 ? "..." : ""}
              </p>
            </div>
          ))}
          <AddStepForm campaignId={campaign.id} nextPosition={steps.length + 1} />
        </CardContent>
      </Card>

      {/* Leads */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leads ({leads.length})</CardTitle>
          <CardDescription>
            {Object.entries(statusCount).map(([s, n]) => `${n} ${s}`).join(" · ")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AddLeadsByFilterForm campaignId={campaign.id} />
          <div className="divide-y divide-border">
            {leads.map(({ entry, contactName, contactEmail, leadScore }) => (
              <div key={entry.id} className="flex items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm">{contactName ?? entry.leadId}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {contactEmail ?? "—"} {leadScore !== null ? `· score ${leadScore}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge
                    variant={
                      entry.status === "active"
                        ? "success"
                        : entry.status === "excluded"
                          ? "destructive"
                          : entry.status === "awaiting_approval"
                            ? "warning"
                            : "secondary"
                    }
                  >
                    {entry.status === "excluded" && entry.excludedReason
                      ? ELIGIBILITY_REASON_LABELS[entry.excludedReason] ?? "excluído"
                      : entry.status === "awaiting_approval"
                        ? "aguardando aprovação"
                        : entry.status === "completed"
                          ? "concluído"
                          : entry.status === "active"
                            ? "ativo"
                            : entry.status}
                  </Badge>
                  <form action={removeCampaignLeadAction}>
                    <input type="hidden" name="campaignId" value={campaign.id} />
                    <input type="hidden" name="leadId" value={entry.leadId} />
                    <button
                      type="submit"
                      aria-label="Remover lead da campanha"
                      className="rounded p-1 text-muted-foreground/50 hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Mensagens */}
      {messages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mensagens ({messages.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {messages
                .filter((m) => m.status !== "pending_approval")
                .slice(0, 30)
                .map((message) => (
                  <div key={message.id} className="flex items-center justify-between gap-2 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{message.toAddress}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {message.subject || "(sem assunto)"} ·{" "}
                        {message.sentAt
                          ? new Date(message.sentAt).toLocaleString("pt-BR")
                          : "não enviada"}
                        {message.provider === "mock" && " · simulada"}
                      </p>
                    </div>
                    <Badge
                      variant={
                        message.status === "sent" || message.status === "delivered"
                          ? "success"
                          : message.status === "bounced" || message.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                      className="shrink-0"
                    >
                      {message.status}
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
