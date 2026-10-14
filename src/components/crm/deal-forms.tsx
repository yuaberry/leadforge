"use client";

import { useActionState } from "react";

import { createDealAction } from "@/app/(app)/pipeline/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LEAD_STAGES, STAGE_LABELS } from "@/validators/lead";

type State = { error?: string; success?: string } | null;

export function CreateDealForm({ leads }: { leads: { id: string; label: string }[] }) {
  const [state, formAction, pending] = useActionState<State, FormData>(createDealAction, null);

  return (
    <form action={formAction} className="grid gap-3 lg:grid-cols-5 lg:items-end">
      {state?.error && (
        <Alert variant="destructive" className="lg:col-span-5">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state?.success && (
        <Alert className="lg:col-span-5">
          <AlertDescription>{state.success}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="deal-title" className="text-xs">Título *</Label>
        <Input id="deal-title" name="title" required minLength={2} maxLength={160} className="h-9" placeholder="Ex.: Website para clínica" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="deal-value" className="text-xs">Valor (R$)</Label>
        <Input id="deal-value" name="value" inputMode="decimal" className="h-9" placeholder="3500" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="deal-stage" className="text-xs">Estágio</Label>
        <select
          id="deal-stage"
          name="stage"
          defaultValue="new"
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          {LEAD_STAGES.map((stage) => (
            <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="deal-lead" className="text-xs">Lead</Label>
        <select
          id="deal-lead"
          name="leadId"
          defaultValue=""
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">— sem lead —</option>
          {leads.map((lead) => (
            <option key={lead.id} value={lead.id}>{lead.label}</option>
          ))}
        </select>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "..." : "Criar deal"}
      </Button>
    </form>
  );
}
