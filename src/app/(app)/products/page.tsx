import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { requireOrgContext } from "@/server/auth/session";
import { listProducts } from "@/server/db/repositories/commerce";
import { withTenantDb } from "@/server/db/tenant";
import { COMMERCE_PLATFORMS } from "@/validators/commerce";

export const metadata: Metadata = {
  title: "Produtos",
};

export default async function ProductsPage() {
  const ctx = await requireOrgContext();

  const rows = await withTenantDb(ctx.accessToken, (db) =>
    listProducts(db, ctx.organization.id)
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Produtos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Catálogo do seu negócio — autorais e de afiliado. A IA usa isto para recomendar
            ofertas (Fase 4).
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/products/new">
            <Plus className="size-4" aria-hidden="true" />
            Novo produto
          </Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum produto ainda. Cadastre o primeiro — o link de checkout permite gerar
              links rastreados e registrar vendas.
            </p>
            <Button size="sm" asChild>
              <Link href="/products/new">Cadastrar produto</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map(({ product, salesCount }) => {
            const platformLabel =
              COMMERCE_PLATFORMS.find((p) => p.value === product.platform)?.label ?? product.platform;
            return (
              <Card key={product.id}>
                <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/products/${product.id}`}
                        className="truncate text-sm font-medium hover:text-primary"
                      >
                        {product.name}
                      </Link>
                      <Badge variant={product.type === "own" ? "default" : "secondary"}>
                        {product.type === "own" ? "Autoral" : "Afiliado"}
                      </Badge>
                      <Badge variant="outline">{platformLabel}</Badge>
                      {product.status === "archived" && <Badge variant="destructive">Arquivado</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {product.category ?? "sem categoria"} ·{" "}
                      {product.price ? formatCurrency(product.price) : "preço não informado"}
                      {product.commissionPercent ? ` · ${product.commissionPercent}% comissão` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge variant={salesCount > 0 ? "success" : "secondary"}>
                      {salesCount} venda{salesCount === 1 ? "" : "s"}
                    </Badge>
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={`/products/${product.id}`}>Gerenciar</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
