"use client";

import { useActionState } from "react";

import { saveScoreWeightsAction } from "@/app/(app)/settings/ai/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SCORE_WEIGHT_KEYS, SCORE_WEIGHT_LABELS } from "@/validators/scoring";

type State = { error?: string; success?: string } | null;

export function ScoreWeightsForm({ weights }: { weights: Record<string, number> }) {
  const [state, formAction, pending] = useActionState<State, FormData>(saveScoreWeightsAction, null);

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
        {SCORE_WEIGHT_KEYS.map((key) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={`weight-${key}`} className="text-xs">
              {SCORE_WEIGHT_LABELS[key]}
            </Label>
            <Input
              id={`weight-${key}`}
              name={key}
              type="number"
              min={0}
              max={100}
              step={1}
              defaultValue={weights[key]}
              className="h-9"
            />
          </div>
        ))}
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar pesos"}
      </Button>
    </form>
  );
}
