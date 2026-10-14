"use client";

import { useActionState } from "react";

import { createInviteAction } from "@/app/(app)/settings/users/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

type State = { error?: string; success?: string } | null;

export function CreateInviteForm() {
  const [state, formAction, pending] = useActionState<State, FormData>(createInviteAction, null);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
      {state?.error && (
        <Alert variant="destructive" className="sm:col-span-4">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state?.success && (
        <Alert className="sm:col-span-4">
          <AlertDescription>{state.success}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="invite-role">Papel</Label>
        <select
          id="invite-role"
          name="role"
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          defaultValue="member"
        >
          <option value="admin">Admin</option>
          <option value="member">Membro</option>
          <option value="viewer">Leitor</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="invite-email">E-mail (opcional)</Label>
        <Input id="invite-email" name="email" type="email" placeholder="pessoa@exemplo.com" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="invite-expiry">Validade</Label>
        <select
          id="invite-expiry"
          name="expiresInDays"
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          defaultValue="7"
        >
          <option value="1">1 dia</option>
          <option value="7">7 dias</option>
          <option value="14">14 dias</option>
          <option value="30">30 dias</option>
        </select>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Criando..." : "Criar convite"}
      </Button>
    </form>
  );
}
