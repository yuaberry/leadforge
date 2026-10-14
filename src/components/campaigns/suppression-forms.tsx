"use client";

import { useActionState } from "react";

import { addSuppressionAction } from "@/app/(app)/settings/email/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type State = { error?: string; success?: string } | null;

export function SuppressionAddForm() {
  const [state, formAction, pending] = useActionState<State, FormData>(addSuppressionAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      {state?.error && (
        <Alert variant="destructive" className="sm:order-first sm:basis-full">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state?.success && (
        <Alert className="sm:order-first sm:basis-full">
          <AlertDescription>{state.success}</AlertDescription>
        </Alert>
      )}

      <div className="flex-1 space-y-1.5">
        <Label htmlFor="sup-email" className="text-xs">E-mail *</Label>
        <Input id="sup-email" name="email" type="email" required className="h-9" placeholder="contato@exemplo.com" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sup-reason" className="text-xs">Motivo</Label>
        <select id="sup-reason" name="reason" defaultValue="manual" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
          <option value="manual">Manual</option>
          <option value="unsubscribe">Pedido de cancelamento</option>
          <option value="bounce">Bounce</option>
          <option value="complaint">Reclamação</option>
        </select>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "..." : "Suprimir"}
      </Button>
    </form>
  );
}
