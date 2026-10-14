import type { Metadata } from "next";
import { Trash2, TrendingDown, TrendingUp, Wallet } from "lucide-react";

import { MonthlyProfitChart, ProductRevenueChart } from "@/components/charts/profit-charts";
import { TransactionForm } from "@/components/crm/transaction-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { requireOrgContext } from "@/server/auth/session";
import {
  financialTotals,
  listFinancialTransactions,
  revenueByProduct,
} from "@/server/db/repositories/crm";
import { withTenantDb } from "@/server/db/tenant";
import { monthlySeries } from "@/server/services/goals";
import { deleteTransactionAction } from "./actions";

export const metadata: Metadata = {
  title: "Lucro",
};

const CATEGORY_LABELS: Record<string, string> = {
  own_sale: "Venda autoral",
  affiliate_commission: "Comissão de afiliado",
  ad_spend: "Tráfego pago",
  tools: "Ferramentas",
  fees: "Taxas",
  other: "Outros",
};

export default async function ProfitPage() {
  const ctx = await requireOrgContext();

  const { transactions, totals, productRevenue } = await withTenantDb(ctx.accessToken, async (db) => {
    const [transactions, totals, productRevenue] = await Promise.all([
      listFinancialTransactions(db, ctx.organization.id, 60),
      financialTotals(db, ctx.organization.id),
      revenueByProduct(db, ctx.organization.id),
    ]);
    return { transactions, totals, productRevenue };
  });

  const chartSeries = monthlySeries(
    transactions.map((t) => ({
      type: t.type as "revenue" | "expense",
      amount: t.amount,
      occurredAt: t.occurredAt,
    })),
    6
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">💰 Dashboard de Lucro</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vendas dos checkouts entram sozinhas. Lance custos (tráfego, ferramentas) e veja o
          lucro real.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="pt-6">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="size-3.5" aria-hidden="true" /> Receita
            </p>
            <p className="mt-1 text-3xl font-bold text-emerald-400">
              {formatCurrency(totals.revenue)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="pt-6">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingDown className="size-3.5" aria-hidden="true" /> Despesas
            </p>
            <p className="mt-1 text-3xl font-bold text-red-400">
              {formatCurrency(totals.expense)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-primary/30 bg-gradient-to-br from-blue-600/10 via-violet-500/10 to-cyan-400/10">
          <CardContent className="pt-6">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Wallet className="size-3.5" aria-hidden="true" /> Lucro líquido
            </p>
            <p className="text-gradient mt-1 text-3xl font-bold">
              {formatCurrency(totals.profit)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receita × Despesa (6 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          <MonthlyProfitChart data={chartSeries} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lançamento manual</CardTitle>
            <CardDescription>Despesas (anúncios, ferramentas) ou receitas avulsas.</CardDescription>
          </CardHeader>
          <CardContent>
            <TransactionForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receita por produto</CardTitle>
            <CardDescription>Quais produtos realmente geram dinheiro.</CardDescription>
          </CardHeader>
          <CardContent>
            {productRevenue.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Sem receitas atribuídas a produtos ainda.
              </p>
            ) : (
              <ProductRevenueChart
                data={productRevenue.map((row) => ({
                  productName: row.productName,
                  revenue: row.revenue,
                }))}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lançamentos recentes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhum lançamento — as vendas pagas dos webhooks aparecem aqui automaticamente.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{transaction.description}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant={transaction.type === "revenue" ? "success" : "destructive"}
                      >
                        {transaction.type === "revenue" ? "Receita" : "Despesa"}
                      </Badge>
                      <Badge variant="secondary">
                        {CATEGORY_LABELS[transaction.category] ?? transaction.category}
                      </Badge>
                      {transaction.source === "sale_webhook" && (
                        <Badge variant="outline">auto</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span
                      className={`text-sm font-semibold ${
                        transaction.type === "revenue" ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {transaction.type === "revenue" ? "+" : "−"}{" "}
                      {formatCurrency(transaction.amount)}
                    </span>
                    <form action={deleteTransactionAction}>
                      <input type="hidden" name="transactionId" value={transaction.id} />
                      <button
                        type="submit"
                        aria-label="Excluir lançamento"
                        className="rounded p-1 text-muted-foreground/50 hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
