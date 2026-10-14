"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { runDiscoveryAction } from "@/app/(app)/discovery/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DiscoveryReport } from "@/server/services/discovery";

type State = { error?: string; success?: string; report?: DiscoveryReport } | null;

export function DiscoveryForm({ providerKind }: { providerKind: "google_places" | "mock" }) {
  const [state, formAction, pending] = useActionState<State, FormData>(runDiscoveryAction, null);

  return (
    <div className="space-y-4">
      <form action={formAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_120px_auto] sm:items-end">
        {state?.error && (
          <Alert variant="destructive" className="sm:col-span-4">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="disc-keyword" className="text-xs">Segmento / palavra-chave *</Label>
          <Input id="disc-keyword" name="keyword" required minLength={2} maxLength={120} className="h-9" placeholder="clínica odontológica" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="disc-location" className="text-xs">Localização *</Label>
          <Input id="disc-location" name="location" required minLength={2} maxLength={120} className="h-9" placeholder="São Paulo" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="disc-max" className="text-xs">Resultados</Label>
          <select id="disc-max" name="maxResults" defaultValue="20" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
            <option value="20">20</option>
            <option value="40">40</option>
            <option value="60">60</option>
          </select>
        </div>

        <Button type="submit" disabled={pending} className="gap-2">
          <Search className="size-4" aria-hidden="true" />
          {pending ? "Buscando..." : "Buscar empresas"}
        </Button>
      </form>

      {state?.report && (
        <div className="space-y-3 rounded-xl border bg-card/70 p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary">{state.report.found} encontradas</Badge>
            <Badge variant="success">{state.report.leadsCreated} leads novos</Badge>
            {state.report.companiesUpdated > 0 && (
              <Badge variant="secondary">{state.report.companiesUpdated} atualizadas</Badge>
            )}
            <Badge variant="warning">
              {state.report.opportunitiesWithoutWebsite} sem website
            </Badge>
          </div>

          {state.report.sampleCompanies.length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {state.report.sampleCompanies.map((company, index) => (
                <li key={index}>
                  • {company.name}
                  {company.hasWebsite ? " (tem site)" : " (sem site — oportunidade)"}
                  {company.rating ? ` · ${company.rating.toFixed(1)}★` : ""}
                </li>
              ))}
            </ul>
          )}

          <p className="text-xs text-muted-foreground">
            Tudo já passou por normalização e deduplicação — veja em{" "}
            <Link href="/companies" className="text-primary hover:underline">Empresas</Link> e{" "}
            <Link href="/leads" className="text-primary hover:underline">Leads</Link>.
          </p>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground/70">
        {providerKind === "google_places"
          ? "Fonte oficial: Google Places API (New). Dados armazenados conforme os termos do Google; o place_id permite refresh."
          : "Modo demonstração: sem GOOGLE_PLACES_API_KEY, geramos empresas fictícias determinísticas para você testar todo o pipeline. Configure a chave no .env.local para dados reais."}
      </p>
    </div>
  );
}
