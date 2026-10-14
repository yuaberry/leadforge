import type { Metadata } from "next";

import { WhatsAppAccountForm } from "@/components/inbox/whatsapp-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrgContext } from "@/server/auth/session";
import { getWhatsAppAccount } from "@/server/db/repositories/inbox";
import { withTenantDb } from "@/server/db/tenant";

export const metadata: Metadata = {
  title: "WhatsApp",
};

export default async function WhatsAppSettingsPage() {
  const ctx = await requireOrgContext();

  const account = await withTenantDb(ctx.accessToken, (db) =>
    getWhatsAppAccount(db, ctx.organization.id)
  );

  const hasCloud = Boolean(
    process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID
  );
  const verifyTokenConfigured = Boolean(process.env.WHATSAPP_VERIFY_TOKEN);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">WhatsApp</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          WhatsApp Business Platform (Cloud API oficial da Meta) — o único canal suportado.
          Sem WhatsApp Web automatizado, sem riscos de banimento por automação irregular.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            Provedor
            <Badge variant={hasCloud ? "success" : "warning"}>
              {hasCloud ? "Cloud API conectada" : "Modo simulado"}
            </Badge>
          </CardTitle>
          <CardDescription>
            {hasCloud
              ? "Envios e respostas usam a Cloud API (WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID configurados pelo administrador)."
              : "Sem credenciais da Meta, os envios por WhatsApp são SIMULADOS — úteis para testar a inbox completa. Configure WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID e WHATSAPP_VERIFY_TOKEN no .env.local para envios reais."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WhatsAppAccountForm
            phoneNumberId={account?.phoneNumberId ?? ""}
            displayPhone={account?.displayPhone ?? ""}
            displayName={account?.displayName ?? ctx.organization.name}
          />
        </CardContent>
      </Card>

      {account && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Webhook (Meta)</CardTitle>
            <CardDescription>
              No painel da Meta for Business: WhatsApp → Configuration → Webhook. O *Callback
              URL* e o *Verify token* estão abaixo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Callback URL (POST e GET):</p>
              <code className="mt-1 block overflow-x-auto whitespace-nowrap rounded bg-muted px-2 py-1.5 text-xs">
                /api/webhooks/whatsapp?token={account.webhookToken}
              </code>
              <p className="mt-1 text-xs text-muted-foreground/70">
                (acrescente a origem completa, ex.: https://seu-dominio.com)
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Verify token:</p>
              <Badge variant={verifyTokenConfigured ? "success" : "destructive"}>
                {verifyTokenConfigured
                  ? "WHATSAPP_VERIFY_TOKEN configurado — cole o mesmo valor na Meta"
                  : "WHATSAPP_VERIFY_TOKEN ausente no .env.local"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Ao receber a mensagem SAIR, PARAR, STOP (e
              variações), o LeadForge suprime o contato em todos os canais, marca opt-out no
              lead e envia confirmação automática — teste com o modo simulado sem conectar
              nada.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Boas práticas da plataforma</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Respostas manuais funcionam na janela de atendimento de 24h aberta pelo contato.</p>
          <p>• Envios em massa exigem templates aprovados pela Meta — chegam em fase futura.</p>
          <p>• Quality rating e limites da Meta são respeitados: caps, opt-out, zero spam.</p>
        </CardContent>
      </Card>
    </div>
  );
}
