"use client";

import { useActionState } from "react";

import { sendInboxReplyAction } from "@/app/(app)/inbox/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type State = { error?: string; success?: string } | null;

export function ReplyForm({ conversationId }: { conversationId: string }) {
  const [state, formAction, pending] = useActionState<State, FormData>(sendInboxReplyAction, null);

  return (
    <form action={formAction} className="space-y-2">
      {state?.error && (
        <p className="text-xs text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="text-xs text-emerald-400" role="status">
          {state.success}
        </p>
      )}
      <input type="hidden" name="conversationId" value={conversationId} />
      <div className="flex gap-2">
        <Input
          name="body"
          placeholder="Escreva sua resposta..."
          required
          maxLength={4000}
          disabled={pending}
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Enviando..." : "Enviar"}
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground/70">
        Contatos suprimidos ou opted-out são bloqueados automaticamente — mesmo na resposta
        manual.
      </p>
    </form>
  );
}
