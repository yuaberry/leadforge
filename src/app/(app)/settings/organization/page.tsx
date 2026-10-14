import type { Metadata } from "next";

import { OrgNameForm } from "@/components/settings/org-name-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { parseOrgSettings } from "@/validators/org";
import { requireOrgContext } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Organização",
};

export default async function OrganizationSettingsPage() {
  const ctx = await requireOrgContext();
  const settings = parseOrgSettings(ctx.organization.settings);
  const canEdit = ["owner", "admin"].includes(ctx.membership.role);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Organização</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Identidade e plano da sua operação.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Identificação</CardTitle>
          <CardDescription>
            {canEdit
              ? "O nome aparece para todos os membros da organização."
              : "Somente owners e admins podem editar."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrgNameForm currentName={ctx.organization.name} canEdit={canEdit} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plano</CardTitle>
          <CardDescription>Cobrança e limites chegam na Fase 9 (Stripe).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Badge variant="secondary" className="capitalize">{ctx.organization.plan}</Badge>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between rounded-lg border p-3">
              <dt className="text-muted-foreground">Slug</dt>
              <dd className="font-mono text-xs">{ctx.organization.slug}</dd>
            </div>
            <div className="flex justify-between rounded-lg border p-3">
              <dt className="text-muted-foreground">Criada em</dt>
              <dd>
                {new Date(ctx.organization.createdAt).toLocaleDateString("pt-BR")}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configurações do onboarding</CardTitle>
          <CardDescription>Editáveis novamente em breve (Fase 3+).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Onboarding: {settings.onboardedAt ? "concluído" : "pendente"}</p>
          <p>• Canais escolhidos: {[settings.channels.email && "e-mail", settings.channels.whatsapp && "WhatsApp"].filter(Boolean).join(" + ") || "—"}</p>
        </CardContent>
      </Card>
    </div>
  );
}
