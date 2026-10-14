import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search } from "lucide-react";

import { Pagination } from "@/components/shared/pagination";
import { StageBadge } from "@/components/leads/stage-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireOrgContext } from "@/server/auth/session";
import { listLeads } from "@/server/db/repositories/leads";
import { withTenantDb } from "@/server/db/tenant";
import { LEAD_STAGES, PAGE_SIZE, STAGE_LABELS, leadListQuerySchema } from "@/validators/lead";

export const metadata: Metadata = {
  title: "Leads",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LeadsPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireOrgContext();
  const sp = await searchParams;

  const parsed = leadListQuerySchema.safeParse({
    q: typeof sp.q === "string" ? sp.q : undefined,
    stage: typeof sp.stage === "string" ? sp.stage : undefined,
    page: typeof sp.page === "string" ? sp.page : 1,
  });
  const filters = parsed.success ? parsed.data : { page: 1 };

  const { items, total } = await withTenantDb(ctx.accessToken, (db) =>
    listLeads(db, ctx.organization.id, {
      q: filters.q,
      stage: parsed.success ? filters.stage : undefined,
      page: filters.page,
      pageSize: PAGE_SIZE,
    })
  );

  const buildHref = (page: number) => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (parsed.success && filters.stage) params.set("stage", filters.stage);
    params.set("page", String(page));
    return `/leads?${params.toString()}`;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Todo lead da sua operação — captura, importação e cadastro manual.
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/leads/new">
            <Plus className="size-4" aria-hidden="true" />
            Novo lead
          </Link>
        </Button>
      </div>

      <form method="GET" className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Buscar por nome, empresa ou e-mail..."
            className="pl-9"
          />
        </div>
        <select
          name="stage"
          defaultValue={parsed.success ? filters.stage ?? "" : ""}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          aria-label="Filtrar por estágio"
        >
          <option value="">Todos os estágios</option>
          {LEAD_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {STAGE_LABELS[stage]}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <p className="text-sm text-muted-foreground">
                {filters.q || (parsed.success && filters.stage)
                  ? "Nenhum lead encontrado com esses filtros."
                  : "Nenhum lead ainda. Importe uma lista, crie uma página de captura ou cadastre manualmente."}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button size="sm" variant="secondary" asChild>
                  <Link href="/import">Importar CSV</Link>
                </Button>
                <Button size="sm" variant="secondary" asChild>
                  <Link href="/capture">Criar captura</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-secondary/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {lead.contactName ?? lead.companyName ?? "Lead"}
                      {lead.companyName && lead.contactName && (
                        <span className="text-muted-foreground"> · {lead.companyName}</span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[lead.email, lead.phone, [lead.cityName, lead.stateName].filter(Boolean).join("/")]
                        .filter(Boolean)
                        .join(" · ") || "sem dados de contato"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {lead.consentStatus === "granted" && (
                      <Badge variant="success" className="hidden sm:inline-flex">
                        Consentido
                      </Badge>
                    )}
                    {lead.sourceType && (
                      <Badge variant="secondary" className="hidden md:inline-flex capitalize">
                        {lead.sourceType === "capture" ? "captura" : lead.sourceType}
                      </Badge>
                    )}
                    <StageBadge stage={lead.stage} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Pagination page={filters.page} total={total} pageSize={PAGE_SIZE} buildHref={buildHref} />
    </div>
  );
}
