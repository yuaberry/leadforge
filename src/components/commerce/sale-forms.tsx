"use client";

import { useActionState } from "react";

import { createManualSaleAction } from "@/app/(app)/commerce/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COMMERCE_PLATFORMS } from "@/validators/commerce";

type State = { error?: string; success?: string } | null;

export function ManualSaleForm({
  products,
}: {
  products: { id: string; name: string; platform: string }[];
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(createManualSaleAction, null);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state?.success && (
        <Alert>
          <AlertDescription>{state.success}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="productId">Produto</Label>
        <select
          id="productId"
          name="productId"
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          defaultValue=""
        >
          <option value="">— sem produto vinculado —</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} ({product.platform})
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="platform">Plataforma *</Label>
          <select
            id="platform"
            name="platform"
            required
            defaultValue=""
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="" disabled>
              Selecione...
            </option>
            {COMMERCE_PLATFORMS.map((platform) => (
              <option key={platform.value} value={platform.value}>
                {platform.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="externalOrderId">ID do pedido *</Label>
          <Input
            id="externalOrderId"
            name="externalOrderId"
            required
            minLength={3}
            placeholder="Ex.: ord_abc123 (único por plataforma)"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="customerName">Cliente</Label>
          <Input id="customerName" name="customerName" maxLength={160} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="customerEmail">E-mail do cliente</Label>
          <Input id="customerEmail" name="customerEmail" type="email" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="amount">Valor da venda (R$)</Label>
          <Input id="amount" name="amount" inputMode="decimal" placeholder="297,00" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="commissionAmount">Sua comissão (R$)</Label>
          <Input
            id="commissionAmount"
            name="commissionAmount"
            inputMode="decimal"
            placeholder="148,50"
          />
        </div>
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Registrando..." : "Registrar venda"}
      </Button>
    </form>
  );
}
