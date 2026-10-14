import type { Metadata } from "next";

import { IntegrationForm, WebhookUrl } from "@/components/commerce/integration-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrgContext } from "@/server/auth/session";
import { listIntegrations } from "@/server/db/repositories/commerce";
import { withTenantDb } from "@/server/db/tenant";
import { COMMERCE_PLATFORMS } from "@/validators/commerce";

export const metadata: Metadata = {
  title: "Integrações",
};

const SETUP_HINTS: Record<string, string> = {
  kiwify:
    "No painel Kiwify: Configurações → Webhooks (ou Integrações) → adicione a URL abaixo para os eventos de pedido (order.paid, order.refunded...).",
  kirvano:
    "No painel Kirvano: Configurações → Webhooks/Notificações → cole a URL abaixo para os eventos de venda e reembolso.",
};

export default async function IntegrationsPage() {
  const ctx = await requireOrgContext();

  const integrations = await withTenantDb(ctx.accessToken, (db) =>
    listIntegrations(db, ctx.organization.id)
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecte seus checkouts — as vendas caem aqui automaticamente.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nova integração de checkout</CardTitle>
          <CardDescription>
            Cada integração tem um token de webhook próprio (isolamento por organização).
            Hotmart/Eduzz/Braip/Monetizze chegam em fases seguintes; Kiwify e Kirvano já
            processam vendas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IntegrationForm />
        </CardContent>
      </Card>

      {integrations.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">
          Nenhuma integração ainda — crie a primeira acima.
        </p>
      ) : (
        <div className="space-y-3">
          {integrations.map((integration) => {
            const label =
              COMMERCE_PLATFORMS.find((p) => p.value === integration.platform)?.label ??
              integration.platform;
            const supported = ["kiwify", "kirvano"].includes(integration.platform);
            return (
              <Card key={integration.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    {integration.name}
                    <Badge variant="secondary">{label}</Badge>
                    <Badge variant={supported ? "success" : "warning"}>
                      {supported ? "Processando vendas" : "Webhook em breve"}
                    </Badge>
                  </CardTitle>
                  {supported && (
                    <CardDescription>
                      {SETUP_HINTS[integration.platform] ??
                        "Configure a URL abaixo no painel da plataforma."}
                    </CardDescription>
                  )}
                </CardHeader>
                {supported && (
                  <CardContent>
                    <WebhookUrl platform={integration.platform} token={integration.webhookToken} />
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
