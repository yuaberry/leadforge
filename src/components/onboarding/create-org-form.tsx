"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOrgAction } from "@/app/onboarding/actions";

type State = { error?: string } | null;

export function CreateOrgForm() {
  const [state, formAction, pending] = useActionState<State, FormData>(createOrgAction, null);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Nome da sua operação</Label>
        <Input
          id="name"
          name="name"
          placeholder="Ex.: Minha Marca Digital"
          required
          minLength={2}
          maxLength={80}
        />
        <p className="text-xs text-muted-foreground">
          Você pode convidar sócios e a equipe depois. Tudo é isolado por organização.
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Criando..." : "Criar organização"}
      </Button>
    </form>
  );
}
