import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Pagination } from "@/components/shared/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { requireOrgContext } from "@/server/auth/session";
import { listSales, salesTotals } from "@/server/db/repositories/commerce";
import { withTenantDb } from "@/server/db/tenant";

export const metadata: Metadata = {
  title: "Vendas",
};

const SALE_STATUS: Record<string, { label: string; variant: "success" | "secondary" | "destructive" | "warning" }> = {
  paid: { label: "Paga", variant: "success" },
  pending: { label: "Pendente", variant: "warning" },
  refunded: { label: "Reembolsada", variant: "destructive" },
  chargedback: { label: "Chargeback", variant: "destructive" },
  canceled: { label: "Cancelada", variant: "secondary" },
};

const PAGE_SIZE = 25;

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireOrgContext();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const { items, total, totals } = await withTenantDb(ctx.accessToken, async (db) => {
    const [sales, totals] = await Promise.all([
      listSales(db, ctx.organization.id, { page, pageSize: PAGE_SIZE }),
      salesTotals(db, ctx.organization.id),
    ]);
    return { items: sales.items, total: sales.total, totals };
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vendas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vendas da Kiwify/Kirvano entram sozinhas via webhook — ou registre manualmente.
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/sales/new">
            <Plus className="size-4" aria-hidden="true" />
            Registrar venda
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Vendas pagas</p>
            <p className="text-2xl font-bold">{totals.paidCount}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Comissões (pagas)</p>
            <p className="text-2xl font-bold text-emerald-400">
              {formatCurrency(totals.paidCommission)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Volume total (pagas)</p>
            <p className="text-2xl font-bold">{formatCurrency(totals.paidRevenue)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhuma venda ainda. Conecte o webhook do seu checkout em Integrações ou
                registre manualmente.
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" asChild>
                  <Link href="/integrations">Conectar checkout</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/sales/new">Venda manual</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map(({ sale, productName, tokenLabel }) => (
                <div
                  key={sale.id}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {productName ?? "Produto não vinculado"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {sale.customerName ?? "cliente não informado"} ·{" "}
                      {new Date(sale.occurredAt).toLocaleDateString("pt-BR")} ·{" "}
                      {sale.platform}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {tokenLabel && <Badge variant="default">{tokenLabel}</Badge>}
                    <Badge variant={sale.source === "webhook" ? "secondary" : "outline"}>
                      {sale.source === "webhook" ? "auto" : "manual"}
                    </Badge>
                    <Badge variant={SALE_STATUS[sale.status]?.variant ?? "secondary"}>
                      {SALE_STATUS[sale.status]?.label ?? sale.status}
                    </Badge>
                    <span className="text-sm font-semibold text-emerald-400">
                      {sale.commissionAmount !== null
                        ? formatCurrency(sale.commissionAmount)
                        : sale.amount !== null
                          ? formatCurrency(sale.amount)
                          : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Pagination
        page={page}
        total={total}
        pageSize={PAGE_SIZE}
        buildHref={(p) => `/sales?page=${p}`}
      />
    </div>
  );
}
