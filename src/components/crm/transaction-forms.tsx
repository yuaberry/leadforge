"use client";

import { useActionState } from "react";

import { createTransactionAction } from "@/app/(app)/profit/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type State = { error?: string; success?: string } | null;

const CATEGORIES = {
  revenue: [
    { value: "own_sale", label: "Venda autoral" },
    { value: "affiliate_commission", label: "Comissão de afiliado" },
    { value: "other", label: "Outra receita" },
  ],
  expense: [
    { value: "ad_spend", label: "Tráfego pago" },
    { value: "tools", label: "Ferramentas" },
    { value: "fees", label: "Taxas" },
    { value: "other", label: "Outro custo" },
  ],
} as const;

export function TransactionForm() {
  const [state, formAction, pending] = useActionState<State, FormData>(createTransactionAction, null);

  return (
    <form action={formAction} className="space-y-3">
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

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="trans-type" className="text-xs">Tipo</Label>
          <select id="trans-type" name="type" defaultValue="expense" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
            <option value="expense">Despesa</option>
            <option value="revenue">Receita</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="trans-category" className="text-xs">Categoria</Label>
          <select id="trans-category" name="category" defaultValue="ad_spend" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
            {[...CATEGORIES.revenue, ...CATEGORIES.expense].map((category) => (
              <option key={category.value} value={category.value}>{category.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="trans-description" className="text-xs">Descrição *</Label>
        <Input id="trans-description" name="description" required minLength={2} maxLength={200} className="h-9" placeholder="Ex.: Meta Ads — outubro" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="trans-amount" className="text-xs">Valor (R$) *</Label>
          <Input id="trans-amount" name="amount" required inputMode="decimal" className="h-9" placeholder="500,00" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="trans-date" className="text-xs">Data</Label>
          <Input id="trans-date" name="occurredAt" type="date" className="h-9" />
        </div>
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Registrando..." : "Registrar lançamento"}
      </Button>
    </form>
  );
}
