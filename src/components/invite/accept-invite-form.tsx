"use client";

import { useActionState } from "react";

import { acceptInviteAction } from "@/app/invite/[token]/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

type State = { error?: string } | null;

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<State, FormData>(acceptInviteAction, null);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <input type="hidden" name="token" value={token} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Aceitando..." : "Aceitar convite"}
      </Button>
    </form>
  );
}
