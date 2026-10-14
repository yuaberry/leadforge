"use client";

import { useActionState } from "react";

import { saveEmailAccountAction } from "@/app/(app)/settings/email/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type State = { error?: string; success?: string } | null;

export function EmailAccountForm({
  fromEmail,
  fromName,
}: {
  fromEmail: string;
  fromName: string;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(saveEmailAccountAction, null);

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

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="from-name" className="text-xs">Nome do remetente *</Label>
          <Input id="from-name" name="fromName" defaultValue={fromName} required minLength={2} maxLength={120} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="from-email" className="text-xs">E-mail de envio *</Label>
          <Input
            id="from-email"
            name="fromEmail"
            type="email"
            defaultValue={fromEmail}
            required
            className="h-9"
            placeholder="voce@seudominio.com"
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        O domínio precisa estar verificado na Resend (para envios reais). O rodapé com link de
        cancelamento é adicionado automaticamente a toda campanha.
      </p>

      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar identidade"}
      </Button>
    </form>
  );
}
