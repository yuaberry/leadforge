import type { Metadata } from "next";

import { EmailAccountForm } from "@/components/campaigns/email-settings-forms";
import { WebhookEmailUrl } from "@/components/campaigns/webhook-email-url";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrgContext } from "@/server/auth/session";
import { getEmailAccount } from "@/server/db/repositories/campaigns";
import { withTenantDb } from "@/server/db/tenant";

export const metadata: Metadata = {
  title: "E-mail",
};

export default async function EmailSettingsPage() {
  const ctx = await requireOrgContext();

  const account = await withTenantDb(ctx.accessToken, (db) =>
    getEmailAccount(db, ctx.organization.id)
  );

  const hasResend = Boolean(process.env.RESEND_API_KEY);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">E-mail</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Identidade de envio e eventos (bounce/complaint) das suas campanhas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            Provedor
            <Badge variant={hasResend ? "success" : "warning"}>
              {hasResend ? "Resend conectado" : "Modo simulado"}
            </Badge>
          </CardTitle>
          <CardDescription>
            {hasResend
              ? "Envios reais via Resend (RESEND_API_KEY configurada pelo administrador)."
              : "Sem RESEND_API_KEY, os envios são SIMULADOS — ficam registrados como 'mock' e não saem para a internet. Configure a chave no .env.local para envios reais."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailAccountForm
            fromEmail={account?.fromEmail ?? ""}
            fromName={account?.fromName ?? ctx.organization.name}
          />
        </CardContent>
      </Card>

      {account && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Webhook de eventos</CardTitle>
            <CardDescription>
              Cole no painel da Resend (Webhooks): bounce e complaint viram suppression
              automática — nunca tentamos o endereço de novo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WebhookEmailUrl token={account.webhookToken} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
