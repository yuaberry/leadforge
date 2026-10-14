import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MousePointerClick } from "lucide-react";

import {
  LinkTokenForm,
  ProductForm,
  TokenToggleForm,
  TrackedLinkCopy,
} from "@/components/commerce/product-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrgContext } from "@/server/auth/session";
import { getProduct, listLinkTokens } from "@/server/db/repositories/commerce";
import { withTenantDb } from "@/server/db/tenant";

export const metadata: Metadata = {
  title: "Produto",
};

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireOrgContext();

  const data = await withTenantDb(ctx.accessToken, async (db) => {
    const product = await getProduct(db, ctx.organization.id, id);
    if (!product) return null;
    const tokens = await listLinkTokens(db, ctx.organization.id, id);
    return { product, tokens };
  });

  if (!data) notFound();
  const { product, tokens } = data;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/products"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Voltar para produtos
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{product.name}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant={product.type === "own" ? "default" : "secondary"}>
            {product.type === "own" ? "Autoral" : "Afiliado"}
          </Badge>
          <Badge variant="outline" className="capitalize">{product.platform}</Badge>
          <Badge variant={product.status === "active" ? "success" : "destructive"}>
            {product.status === "active" ? "Ativo" : "Arquivado"}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Links rastreados</CardTitle>
          <CardDescription>
            Compartilhe links <code className="rounded bg-muted px-1">/go/...</code> — cada
            clique é registrado e a venda volta com UTM para você saber o que converte.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <LinkTokenForm productId={product.id} />

          {tokens.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum link ainda — gere o primeiro acima.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {tokens.map((token) => (
                <li
                  key={token.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{token.label}</span>
                      <Badge variant={token.active ? "success" : "secondary"}>
                        {token.active ? "ativo" : "inativo"}
                      </Badge>
                    </div>
                    <TrackedLinkCopy token={token.token} />
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MousePointerClick className="size-3" aria-hidden="true" />
                      {token.clickCount} clique{token.clickCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <TokenToggleForm
                    tokenId={token.id}
                    productId={product.id}
                    active={token.active}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Editar produto</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductForm
            productId={product.id}
            defaults={{
              name: product.name,
              type: product.type,
              platform: product.platform,
              checkoutUrl: product.checkoutUrl,
              price: product.price?.toString() ?? "",
              commissionPercent: product.commissionPercent?.toString() ?? "",
              category: product.category,
              niche: product.niche,
              imageUrl: product.imageUrl,
              targetAudience: product.targetAudience,
              sellingArguments: (product.sellingArguments as string[]).join("\n"),
              externalProductId: product.externalProductId,
            }}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button asChild variant="secondary" size="sm">
          <Link href="/sales/new">Registrar venda manual deste produto</Link>
        </Button>
      </div>
    </div>
  );
}
