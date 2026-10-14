"use client";

import { useActionState } from "react";

import { createLeadAction } from "@/app/(app)/leads/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type State = { error?: string; success?: string } | null;

export function CreateLeadForm() {
  const [state, formAction, pending] = useActionState<State, FormData>(createLeadAction, null);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contactName">Nome do contato *</Label>
          <Input id="contactName" name="contactName" required minLength={2} maxLength={120} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="companyName">Empresa</Label>
          <Input id="companyName" name="companyName" maxLength={160} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" maxLength={200} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input id="phone" name="phone" maxLength={40} placeholder="(11) 98765-4321" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="website">Website</Label>
          <Input id="website" name="website" maxLength={300} placeholder="empresa.com.br" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Categoria</Label>
          <Input id="category" name="category" maxLength={120} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">Cidade</Label>
          <Input id="city" name="city" maxLength={120} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">Estado</Label>
          <Input id="state" name="state" maxLength={120} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="jobTitle">Cargo</Label>
          <Input id="jobTitle" name="jobTitle" maxLength={120} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Observações</Label>
        <Input id="notes" name="notes" maxLength={2000} />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Criar lead"}
      </Button>
    </form>
  );
}
