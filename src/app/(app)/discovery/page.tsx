import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

import { DiscoveryForm } from "@/components/discovery/discovery-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { sourceProviderKind } from "@/server/providers/sources";

export const metadata: Metadata = {
  title: "Discovery",
};

export default function DiscoveryPage() {
  const providerKind = sourceProviderKind();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Discovery</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Encontre empresas por segmento e local — via Google Places API oficial.
          Ex.: <span className="text-foreground">clínicas odontológicas em São Paulo sem
          website</span> (o filtro de site aparece na lista de empresas/leads).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            Buscar empresas
            <Badge variant={providerKind === "google_places" ? "success" : "warning"}>
              {providerKind === "google_places" ? "Google Places conectado" : "modo demonstração"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Cada resultado passa por normalização, dedup (place_id/domínio/telefone/hash)
            e ganha um lead pontuado com base legal de legítimo interesse (listagem
            pública de empresa, via API oficial).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DiscoveryForm providerKind={providerKind} />
        </CardContent>
      </Card>

      <Card className="border-emerald-500/20 bg-emerald-500/[0.03]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-emerald-400" aria-hidden="true" />
            Fontes autorizadas, sempre
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm text-muted-foreground">
          <p>• Nada de scraping do Google Maps — apenas Places API (New) oficial.</p>
          <p>• Campos armazenados limitados aos permitidos pelos termos do Google.</p>
          <p>• Rate limits respeitados — o sistema nunca tenta contorná-los.</p>
          <p>• Dedup por place_id: rodar a mesma busca de novo só atualiza, nunca duplica.</p>
        </CardContent>
      </Card>
    </div>
  );
}
