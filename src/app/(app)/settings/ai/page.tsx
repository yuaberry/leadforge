import type { Metadata } from "next";

import { ScoreWeightsForm } from "@/components/settings/scoring-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrgContext } from "@/server/auth/session";
import { activeAIProviderKind } from "@/server/providers/ai";
import { parseOrgSettings } from "@/validators/org";
import { CLASSIFICATION_LABELS, type ScoreClassification } from "@/validators/scoring";

export const metadata: Metadata = {
  title: "IA & Scoring",
};

export default async function AISettingsPage() {
  const ctx = await requireOrgContext();
  const settings = parseOrgSettings(ctx.organization.settings);
  const providerKind = activeAIProviderKind();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">IA & Scoring</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O provedor de IA e os pesos da pontuação dos seus leads.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Provedor de IA</CardTitle>
          <CardDescription>
            A chave é configurada pelo administrador em variáveis de ambiente
            (OPENROUTER_API_KEY) — nunca fica no navegador.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant={providerKind === "openrouter" ? "success" : "warning"}>
              {providerKind === "openrouter" ? "OpenRouter conectado" : "Modo demonstração"}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {providerKind === "openrouter"
              ? "Análises e mensagens usam o modelo configurado (AI_MODEL)."
              : "Sem chave configurada, a IA gera análises determinísticas a partir dos dados reais do lead — úteis para testar o fluxo completo. Configure OPENROUTER_API_KEY no .env.local para respostas reais."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pesos do Lead Score</CardTitle>
          <CardDescription>
            Cada sinal detectado soma pontos até o máximo de 100. Você decide o peso de cada
            um — zeros desativam o sinal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScoreWeightsForm weights={settings.scoreWeights} />
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["cold", "0–30"],
                ["warm", "31–60"],
                ["hot", "61–80"],
                ["priority", "81–100"],
              ] as [ScoreClassification, string][]
            ).map(([key, range]) => (
              <div key={key} className="rounded-lg border p-3 text-center">
                <p className="text-sm font-semibold">{CLASSIFICATION_LABELS[key]}</p>
                <p className="text-xs text-muted-foreground">{range}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
