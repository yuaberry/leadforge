"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveDreamAction, skipDreamAction } from "@/app/onboarding/actions";

type State = { error?: string } | null;

export function DreamForm() {
  const [state, formAction, pending] = useActionState<State, FormData>(saveDreamAction, null);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="dreamName">O que você quer conquistar?</Label>
        <Input
          id="dreamName"
          name="dreamName"
          placeholder="Ex.: Notebook gamer, carro, viagem..."
          required
          minLength={2}
          maxLength={120}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="dreamAmount">Valor alvo (opcional)</Label>
          <Input
            id="dreamAmount"
            name="dreamAmount"
            inputMode="decimal"
            placeholder="Ex.: 8500"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dreamImageUrl">Imagem do produto (link — opcional)</Label>
          <Input
            id="dreamImageUrl"
            name="dreamImageUrl"
            type="url"
            placeholder="https://..."
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dreamProductUrl">Link do anúncio/loja (opcional)</Label>
        <Input id="dreamProductUrl" name="dreamProductUrl" type="url" placeholder="https://..." />
      </div>

      <p className="text-xs text-muted-foreground">
        Na Fase 5, cada venda registrada alimenta automaticamente o progresso desta meta.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? "Salvando..." : "Salvar minha meta"}
        </Button>
        <Button type="submit" variant="ghost" formAction={skipDreamAction} disabled={pending}>
          Pular por agora
        </Button>
      </div>
    </form>
  );
}
