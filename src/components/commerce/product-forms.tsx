"use client";

import { useActionState } from "react";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

import {
  createLinkTokenAction,
  createProductAction,
  toggleLinkTokenAction,
  updateProductAction,
} from "@/app/(app)/commerce/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COMMERCE_PLATFORMS } from "@/validators/commerce";

type State = { error?: string; success?: string } | null;

type ProductDefaults = {
  name: string;
  type: string;
  platform: string;
  checkoutUrl: string;
  price: string;
  commissionPercent: string;
  category: string | null;
  niche: string | null;
  imageUrl: string | null;
  targetAudience: string | null;
  sellingArguments: string;
  externalProductId: string | null;
};

export function ProductForm({
  defaults,
  productId,
}: {
  defaults?: ProductDefaults;
  productId?: string;
}) {
  const action = productId ? updateProductAction : createProductAction;
  const [state, formAction, pending] = useActionState<State, FormData>(action, null);

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
      {productId && <input type="hidden" name="productId" value={productId} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Nome do produto *</Label>
          <Input
            id="name"
            name="name"
            defaultValue={defaults?.name}
            placeholder="Ex.: Método Venda Digital"
            required
            minLength={2}
            maxLength={160}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Tipo *</Label>
          <select
            id="type"
            name="type"
            defaultValue={defaults?.type ?? ""}
            required
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="" disabled>
              Selecione...
            </option>
            <option value="own">Autoral</option>
            <option value="affiliate">Afiliado</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="platform">Plataforma *</Label>
          <select
            id="platform"
            name="platform"
            defaultValue={defaults?.platform ?? ""}
            required
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
          <Label htmlFor="checkoutUrl">Link de checkout *</Label>
          <Input
            id="checkoutUrl"
            name="checkoutUrl"
            type="url"
            defaultValue={defaults?.checkoutUrl}
            placeholder="https://pay.kiwify.com.br/..."
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="price">Preço (R$)</Label>
          <Input
            id="price"
            name="price"
            inputMode="decimal"
            defaultValue={defaults?.price}
            placeholder="297,00"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="commissionPercent">Comissão (%)</Label>
          <Input
            id="commissionPercent"
            name="commissionPercent"
            inputMode="decimal"
            defaultValue={defaults?.commissionPercent}
            placeholder="50"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Categoria</Label>
          <Input id="category" name="category" defaultValue={defaults?.category ?? ""} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="niche">Nicho</Label>
          <Input id="niche" name="niche" defaultValue={defaults?.niche ?? ""} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="imageUrl">Imagem (link)</Label>
          <Input
            id="imageUrl"
            name="imageUrl"
            type="url"
            defaultValue={defaults?.imageUrl ?? ""}
            placeholder="https://..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="externalProductId">ID do produto na plataforma</Label>
          <Input
            id="externalProductId"
            name="externalProductId"
            defaultValue={defaults?.externalProductId ?? ""}
            placeholder="Para casar vendas do webhook automaticamente"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="targetAudience">Público-alvo</Label>
        <Input
          id="targetAudience"
          name="targetAudience"
          defaultValue={defaults?.targetAudience ?? ""}
          placeholder="Quem deve comprar isto (a IA usa na Fase 4)"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sellingArguments">Argumentos de venda (um por linha)</Label>
        <textarea
          id="sellingArguments"
          name="sellingArguments"
          defaultValue={defaults?.sellingArguments}
          rows={4}
          maxLength={4000}
          className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder={"Sem website? Este produto resolve\nEntrega em 7 dias\nGarantia de 30 dias"}
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : productId ? "Salvar alterações" : "Criar produto"}
      </Button>
    </form>
  );
}

export function LinkTokenForm({ productId }: { productId: string }) {
  const [state, formAction, pending] = useActionState<State, FormData>(createLinkTokenAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      {state?.error && (
        <p className="text-xs text-destructive sm:hidden" role="alert">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="text-xs text-emerald-400 sm:hidden" role="status">
          {state.success}
        </p>
      )}
      <input type="hidden" name="productId" value={productId} />
      <div className="flex-1 space-y-1.5">
        <Label htmlFor={`label-${productId}`} className="text-xs">
          Onde você vai usar o link?
        </Label>
        <Input
          id={`label-${productId}`}
          name="label"
          placeholder="Ex.: bio do Instagram, vídeo 3, story..."
          required
          minLength={2}
          maxLength={80}
          className="h-9"
        />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "..." : "Gerar link"}
      </Button>
    </form>
  );
}

export function TrackedLinkCopy({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/go/${token}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponível
    }
  }

  return (
    <div className="flex items-center gap-2">
      <code className="truncate rounded bg-muted px-2 py-1 text-xs">/go/{token}</code>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={copy}
        className="gap-1.5"
        aria-label="Copiar link rastreado"
      >
        {copied ? (
          <Check className="size-3.5 text-emerald-400" aria-hidden="true" />
        ) : (
          <Copy className="size-3.5" aria-hidden="true" />
        )}
        {copied ? "Copiado" : "Copiar"}
      </Button>
    </div>
  );
}

export function TokenToggleForm({
  tokenId,
  productId,
  active,
}: {
  tokenId: string;
  productId: string;
  active: boolean;
}) {
  const [, formAction, pending] = useActionState<State, FormData>(toggleLinkTokenAction, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="tokenId" value={tokenId} />
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "..." : active ? "Desativar" : "Reativar"}
      </Button>
    </form>
  );
}
