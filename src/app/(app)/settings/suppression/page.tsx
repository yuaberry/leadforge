import type { Metadata } from "next";
import { Trash2 } from "lucide-react";

import { SuppressionAddForm } from "@/components/campaigns/suppression-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrgContext } from "@/server/auth/session";
import { listSuppression } from "@/server/db/repositories/campaigns";
import { withTenantDb } from "@/server/db/tenant";
import { removeSuppressionAction } from "../email/actions";

export const metadata: Metadata = {
  title: "Suppression list",
};

const REASON_LABELS: Record<string, string> = {
  unsubscribe: "Cancelou inscrição",
  bounce: "Bounce",
  complaint: "Reclamação (complaint)",
  manual: "Adicionado manualmente",
  optout_keyword: "Palavra-chave de opt-out",
};

export default async function SuppressionPage() {
  const ctx = await requireOrgContext();

  const rows = await withTenantDb(ctx.accessToken, (db) =>
    listSuppression(db, ctx.organization.id)
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Suppression list</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O invariável do LeadForge: <span className="text-foreground">ninguém desta lista
          recebe qualquer mensagem</span> — e-mails, WhatsApp ou campanhas. Adições por
          cancelamento, bounce e reclamação são automáticas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adicionar manualmente</CardTitle>
          <CardDescription>
            Use para respeitar pedidos de cancelamento recebidos fora da plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SuppressionAddForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contatos suprimidos ({rows.length})</CardTitle>
          <CardDescription>
            Reativar é uma ação consciente do administrador — fica registrada na auditoria.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhum contato suprimido — a lista cresce automaticamente com cancelamentos,
              bounces e reclamações.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {rows.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{row.emailNormalized ?? row.phoneNormalized}</p>
                    <p className="text-xs text-muted-foreground">
                      {REASON_LABELS[row.reason] ?? row.reason} ·{" "}
                      {new Date(row.createdAt).toLocaleDateString("pt-BR")}
                      {row.note ? ` · ${row.note}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary" className="capitalize">{row.channel}</Badge>
                    <form action={removeSuppressionAction}>
                      <input type="hidden" name="suppressionId" value={row.id} />
                      <button
                        type="submit"
                        aria-label="Reativar contato (remover da suppression)"
                        className="rounded p-1.5 text-muted-foreground/50 hover:bg-emerald-500/10 hover:text-emerald-400"
                        title="Reativar (registrado em auditoria)"
                      >
                        <Trash2 className="size-3.5 rotate-45" aria-hidden="true" />
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
