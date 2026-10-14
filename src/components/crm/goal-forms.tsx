"use client";

import { useActionState, useTransition } from "react";

import {
  contributeGoalAction,
  createGoalAction,
  migrateDreamAction,
  saveGoalSettingsAction,
} from "@/app/(app)/goals/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type State = { error?: string; success?: string } | null;

export function CreateGoalForm() {
  const [state, formAction, pending] = useActionState<State, FormData>(createGoalAction, null);

  return (
    <form action={formAction} className="space-y-3">
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
          <Label htmlFor="goal-name" className="text-xs">O que você quer conquistar? *</Label>
          <Input id="goal-name" name="name" required minLength={2} maxLength={120} className="h-9" placeholder="Ex.: Notebook gamer" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="goal-target" className="text-xs">Valor alvo (R$) *</Label>
          <Input id="goal-target" name="targetAmount" required inputMode="decimal" className="h-9" placeholder="8500" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="goal-image" className="text-xs">Imagem (link do anúncio)</Label>
          <Input id="goal-image" name="imageUrl" type="url" className="h-9" placeholder="https://..." />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="goal-product" className="text-xs">Link do produto/anúncio</Label>
          <Input id="goal-product" name="productUrl" type="url" className="h-9" placeholder="https://..." />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="goal-description" className="text-xs">Por que esta meta? (opcional)</Label>
        <Input id="goal-description" name="description" maxLength={400} className="h-9" />
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Criando..." : "Criar meta"}
      </Button>
    </form>
  );
}

export function MigrateDreamForm() {
  const [pending, startTransition] = useTransition();
  return (
    <form
      action={(formData) => startTransition(async () => { await migrateDreamAction(formData); })}
    >
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Migrando..." : "Importar como meta"}
      </Button>
    </form>
  );
}

export function ContributeForm({ goalId }: { goalId: string }) {
  const [state, formAction, pending] = useActionState<State, FormData>(contributeGoalAction, null);

  return (
    <form action={formAction} className="flex items-center gap-1.5">
      {state?.error && <span className="text-[11px] text-destructive">{state.error}</span>}
      {state?.success && (
        <span className="text-[11px] text-emerald-400">{state.success}</span>
      )}
      <input type="hidden" name="goalId" value={goalId} />
      <Input
        name="amount"
        inputMode="decimal"
        placeholder="lançar R$"
        className="h-8 w-24 text-xs"
        aria-label="Lançar valor na meta"
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending} className="h-8 text-xs">
        {pending ? "..." : "Lançar"}
      </Button>
    </form>
  );
}

export function GoalSettingsForm({
  goals,
  autoAllocatePercent,
  targetGoalId,
}: {
  goals: { id: string; name: string }[];
  autoAllocatePercent: number;
  targetGoalId: string | null;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(saveGoalSettingsAction, null);

  return (
    <form action={formAction} className="space-y-3">
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

      {goals.length === 0 ? (
        <p className="text-sm text-muted-foreground">Crie uma meta primeiro.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="goal-percent" className="text-xs">% de cada venda</Label>
              <Input
                id="goal-percent"
                name="autoAllocatePercent"
                type="number"
                min={0}
                max={100}
                defaultValue={autoAllocatePercent}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal-target-goal" className="text-xs">Meta ativa</Label>
              <select
                id="goal-target-goal"
                name="targetGoalId"
                defaultValue={targetGoalId ?? ""}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">— nenhuma —</option>
                {goals.map((goal) => (
                  <option key={goal.id} value={goal.id}>{goal.name}</option>
                ))}
              </select>
            </div>
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Salvando..." : "Salvar configuração"}
          </Button>
        </>
      )}
    </form>
  );
}
