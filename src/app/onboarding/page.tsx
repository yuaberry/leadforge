import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BusinessForm } from "@/components/onboarding/business-form";
import { ChannelsForm } from "@/components/onboarding/channels-form";
import { CreateOrgForm } from "@/components/onboarding/create-org-form";
import { DreamForm } from "@/components/onboarding/dream-form";
import { OnboardingProgress } from "@/components/onboarding/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { requireAuth } from "@/server/auth/session";
import { getPrimaryOrg } from "@/server/db/repositories/organizations";
import { withTenantDb } from "@/server/db/tenant";
import { parseOrgSettings } from "@/validators/org";
import { finishOnboardingAction } from "./actions";

export const metadata: Metadata = {
  title: "Onboarding",
};

const MODE_LABELS: Record<string, string> = {
  affiliate: "Produtos de afiliado",
  own: "Produtos autorais",
  both: "Afiliado + autorais",
};

export default async function OnboardingPage() {
  const session = await requireAuth();

  const state = await withTenantDb(session.accessToken, async (db) => {
    const primary = await getPrimaryOrg(db, session.user.id);
    if (!primary) {
      return { step: 1 as const, orgName: null, settings: null };
    }
    const settings = parseOrgSettings(primary.organization.settings);
    if (settings.onboardedAt) {
      return null;
    }
    const step = !settings.businessMode
      ? (2 as const)
      : !settings.channels.email && !settings.channels.whatsapp
        ? (3 as const)
        : !settings.dream && !settings.dreamSkipped
          ? (4 as const)
          : (5 as const);
    return { step, orgName: primary.organization.name, settings };
  });

  if (!state) {
    redirect("/dashboard");
  }

  return (
    <Card className="border-white/10 bg-card/80 backdrop-blur">
      <CardHeader>
        <CardTitle>Monte sua operação de vendas digitais</CardTitle>
        <CardDescription>
          {state.step === 1
            ? "Primeiro, dê um nome à sua organização."
            : state.step === 2
              ? "Isso orienta a IA a recomendar os produtos certos."
              : state.step === 3
                ? "Por onde você quer conversar com seus leads?"
                : state.step === 4
                  ? "Todo ganho precisa de um porquê. Qual é o seu?"
                  : `Revise e confirme, ${state.orgName ?? "vamos lá"}!`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <OnboardingProgress current={state.step} />

        {state.step === 1 && <CreateOrgForm />}

        {state.step === 2 && (
          <BusinessForm
            selectedMode={state.settings?.businessMode ?? null}
            selectedCategories={state.settings?.categories ?? []}
          />
        )}

        {state.step === 3 && (
          <ChannelsForm
            emailEnabled={state.settings?.channels.email ?? false}
            whatsappEnabled={state.settings?.channels.whatsapp ?? false}
          />
        )}

        {state.step === 4 && <DreamForm />}

        {state.step === 5 && state.settings && (
          <div className="space-y-6">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Negócio</dt>
                <dd className="font-medium">
                  {MODE_LABELS[state.settings.businessMode ?? ""] ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Categorias</dt>
                <dd className="text-right font-medium">
                  {state.settings.categories.join(", ") || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Canais</dt>
                <dd className="font-medium">
                  {[
                    state.settings.channels.email && "E-mail",
                    state.settings.channels.whatsapp && "WhatsApp",
                  ]
                    .filter(Boolean)
                    .join(" + ") || "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Meta dos sonhos</dt>
                <dd className="text-right font-medium">
                  {state.settings.dream
                    ? `${state.settings.dream.name}${
                        state.settings.dream.amount
                          ? ` · ${formatCurrency(state.settings.dream.amount)}`
                          : ""
                      }`
                    : "Adicionada depois"}
                </dd>
              </div>
            </dl>

            <form action={finishOnboardingAction}>
              <Button type="submit" className="w-full">
                Concluir e abrir o dashboard
              </Button>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
