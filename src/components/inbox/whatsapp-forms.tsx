"use client";

import { useActionState } from "react";

import { saveWhatsAppAccountAction } from "@/app/(app)/inbox/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type State = { error?: string; success?: string } | null;

export function WhatsAppAccountForm({
  phoneNumberId,
  displayPhone,
  displayName,
}: {
  phoneNumberId: string;
  displayPhone: string;
  displayName: string;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(saveWhatsAppAccountAction, null);

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
          <Label htmlFor="wa-phone-id" className="text-xs">phone_number_id (Meta) *</Label>
          <Input id="wa-phone-id" name="phoneNumberId" defaultValue={phoneNumberId} required minLength={4} className="h-9 font-mono text-xs" placeholder="123456789012345" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wa-phone" className="text-xs">Número (com DDI/DDD) *</Label>
          <Input id="wa-phone" name="displayPhone" defaultValue={displayPhone} required minLength={4} className="h-9" placeholder="+55 11 98765-4321" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="wa-name" className="text-xs">Nome exibido *</Label>
        <Input id="wa-name" name="displayName" defaultValue={displayName} required minLength={2} className="h-9" />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : accountExists(phoneNumberId)}
      </Button>
    </form>
  );
}

function accountExists(phoneNumberId: string): string {
  return phoneNumberId ? "Salvar alterações" : "Conectar conta";
}
