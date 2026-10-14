import type { Metadata } from "next";
import { Search } from "lucide-react";

import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireOrgContext } from "@/server/auth/session";
import { listCompanies } from "@/server/db/repositories/leads";
import { withTenantDb } from "@/server/db/tenant";
import { PAGE_SIZE, companyListQuerySchema } from "@/validators/lead";

export const metadata: Metadata = {
  title: "Empresas",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CompaniesPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireOrgContext();
  const sp = await searchParams;

  const parsed = companyListQuerySchema.safeParse({
    q: typeof sp.q === "string" ? sp.q : undefined,
    page: typeof sp.page === "string" ? sp.page : 1,
  });
  const filters = parsed.success ? parsed.data : { page: 1 };

  const { items, total } = await withTenantDb(ctx.accessToken, (db) =>
    listCompanies(db, ctx.organization.id, {
      q: filters.q,
      page: filters.page,
      pageSize: PAGE_SIZE,
    })
  );

  const buildHref = (page: number) =>
    `/companies?${new URLSearchParams({ ...(filters.q ? { q: filters.q } : {}), page: String(page) })}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Empresas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Base normalizada e deduplicada por domínio, telefone, e-mail e nome+cidade.
        </p>
      </div>

      <form method="GET" className="flex gap-2">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Buscar por nome, cidade ou categoria..."
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <p className="px-6 py-16 text-center text-sm text-muted-foreground">
              Nenhuma empresa ainda — elas nascem de importações, cadastro de leads e descoberta (Fase 8).
            </p>
          ) : (
            <div className="divide-y divide-border">
              {items.map((company) => (
                <div
                  key={company.id}
                  className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{company.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[company.category, [company.city, company.state].filter(Boolean).join("/")]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                    {company.website ? (
                      <a
                        href={company.website}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="text-primary hover:underline"
                      >
                        site
                      </a>
                    ) : (
                      <span className="text-amber-400/80">sem site</span>
                    )}
                    <span>{company.leadCount} lead{Number(company.leadCount) === 1 ? "" : "s"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Pagination page={filters.page} total={total} pageSize={PAGE_SIZE} buildHref={buildHref} />
    </div>
  );
}
