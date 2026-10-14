"use client";

import { useActionState } from "react";

import { updateOrgNameAction } from "@/app/(app)/settings/organization/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type State = { error?: string; success?: string } | null;

export function OrgNameForm({ currentName, canEdit }: { currentName: string; canEdit: boolean }) {
  const [state, formAction, pending] = useActionState<State, FormData>(updateOrgNameAction, null);

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

      <div className="space-y-2">
        <Label htmlFor="org-name">Nome da organização</Label>
        <Input
          id="org-name"
          name="name"
          defaultValue={currentName}
          disabled={!canEdit || pending}
          required
          minLength={2}
          maxLength={80}
        />
      </div>

      {canEdit && (
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar"}
        </Button>
      )}
    </form>
  );
}
