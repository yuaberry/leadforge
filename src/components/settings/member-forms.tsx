"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";

import {
  removeMemberAction,
  revokeInviteAction,
  updateMemberRoleAction,
} from "@/app/(app)/settings/users/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { MemberRole } from "@/validators/org";

type State = { error?: string; success?: string } | null;

const ROLES: { value: MemberRole; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "member", label: "Membro" },
  { value: "viewer", label: "Leitor" },
];

export function MemberRoleForm({
  organizationId,
  userId,
  role,
}: {
  organizationId: string;
  userId: string;
  role: string;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(updateMemberRoleAction, null);

  return (
    <form action={formAction} className="flex items-center gap-1.5">
      {state?.error && (
        <Alert variant="destructive" className="hidden">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="userId" value={userId} />

      <select
        name="role"
        defaultValue={role}
        disabled={pending}
        aria-label="Papel do membro"
        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
      >
        {ROLES.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "..." : "Aplicar"}
      </Button>
    </form>
  );
}

export function RemoveMemberForm({
  organizationId,
  userId,
}: {
  organizationId: string;
  userId: string;
}) {
  const [, formAction, pending] = useActionState<State, FormData>(removeMemberAction, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="organizationId" value={organizationId} />
      <input type="hidden" name="userId" value={userId} />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={pending}
        aria-label="Remover membro"
        className="text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
      </Button>
    </form>
  );
}

export function RevokeInviteForm({ inviteId }: { inviteId: string }) {
  const [, formAction, pending] = useActionState<State, FormData>(revokeInviteAction, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="inviteId" value={inviteId} />
      <Button type="submit" size="sm" variant="outline" disabled={pending} className="text-destructive hover:bg-destructive/10">
        {pending ? "..." : "Revogar"}
      </Button>
    </form>
  );
}
