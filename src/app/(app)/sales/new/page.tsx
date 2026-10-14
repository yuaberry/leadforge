import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ManualSaleForm } from "@/components/commerce/sale-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrgContext } from "@/server/auth/session";
import { listProducts } from "@/server/db/repositories/commerce";
import { withTenantDb } from "@/server/db/tenant";

export const metadata: Metadata = {
  title: "Registrar venda",
};

export default async function NewSalePage() {
  const ctx = await requireOrgContext();

  const rows = await withTenantDb(ctx.accessToken, (db) =>
    listProducts(db, ctx.organization.id)
  );
  const products = rows
    .filter(({ product }) => product.status === "active")
    .map(({ product }) => ({ id: product.id, name: product.name, platform: product.platform }));

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href="/sales"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Voltar para vendas
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Registrar venda manual</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lançamento manual</CardTitle>
          <CardDescription>
            Para vendas fora do webhook (ex.: no balcão, PIX direto) ou para testar o fluxo sem
            integração conectada. O ID do pedido evita duplicatas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ManualSaleForm products={products} />
        </CardContent>
      </Card>
    </div>
  );
}
