"use client";

import { useActionState } from "react";

import {
  addLeadNoteAction,
  addLeadTagAction,
  removeLeadTagAction,
  updateLeadStageAction,
} from "@/app/(app)/leads/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LEAD_STAGES, STAGE_LABELS } from "@/validators/lead";

type State = { error?: string; success?: string } | null;

export function StageForm({ leadId, stage }: { leadId: string; stage: string }) {
  const [, formAction, pending] = useActionState<State, FormData>(updateLeadStageAction, null);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="leadId" value={leadId} />
      <select
        name="stage"
        defaultValue={stage}
        disabled={pending}
        aria-label="Estágio do lead"
        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
      >
        {LEAD_STAGES.map((s) => (
          <option key={s} value={s}>
            {STAGE_LABELS[s]}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "..." : "Mover"}
      </Button>
    </form>
  );
}

export function TagForm({ leadId }: { leadId: string }) {
  const [state, formAction, pending] = useActionState<State, FormData>(addLeadTagAction, null);

  return (
    <form action={formAction} className="flex items-center gap-2">
      {state?.error && (
        <p className="text-xs text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <input type="hidden" name="leadId" value={leadId} />
      <Input
        name="tagName"
        placeholder="Nova tag..."
        maxLength={48}
        className="h-8 max-w-40 text-xs"
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "..." : "Adicionar"}
      </Button>
    </form>
  );
}

export function TagRemoveForm({ leadId, tagId }: { leadId: string; tagId: string }) {
  const [, formAction, pending] = useActionState<State, FormData>(removeLeadTagAction, null);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="tagId" value={tagId} />
      <button
        type="submit"
        disabled={pending}
        aria-label="Remover tag"
        className="ml-1 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-red-500/20 hover:text-red-400"
      >
        ×
      </button>
    </form>
  );
}

export function TagChip({
  leadId,
  tagId,
  name,
}: {
  leadId: string;
  tagId: string;
  name: string;
}) {
  return (
    <Badge variant="secondary" className="gap-0.5">
      {name}
      <TagRemoveForm leadId={leadId} tagId={tagId} />
    </Badge>
  );
}

export function NoteForm({ leadId }: { leadId: string }) {
  const [state, formAction, pending] = useActionState<State, FormData>(addLeadNoteAction, null);

  return (
    <form action={formAction} className="space-y-2">
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
      <input type="hidden" name="leadId" value={leadId} />
      <Input name="note" placeholder="Registrar uma nota de atendimento..." maxLength={2000} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Salvando..." : "Salvar nota"}
      </Button>
    </form>
  );
}
