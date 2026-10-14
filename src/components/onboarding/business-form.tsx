"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { saveBusinessAction } from "@/app/onboarding/actions";
import { cn } from "@/lib/utils";
import { BUSINESS_CATEGORIES } from "@/types/org";

type State = { error?: string } | null;

const MODES = [
  {
    value: "affiliate",
    title: "Produtos de afiliado",
    hint: "Comisionando produtos de outros produtores",
  },
  {
    value: "own",
    title: "Produtos autorais",
    hint: "Vendendo o que eu mesmo produzo",
  },
  {
    value: "both",
    title: "Os dois",
    hint: "Afiliado + autorais, cada venda conta",
  },
] as const;

export function BusinessForm({ selectedMode, selectedCategories }: { selectedMode: string | null; selectedCategories: string[] }) {
  const [state, formAction, pending] = useActionState<State, FormData>(saveBusinessAction, null);

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Como você vende?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {MODES.map((mode) => (
            <label key={mode.value} className="cursor-pointer">
              <input
                type="radio"
                name="businessMode"
                value={mode.value}
                defaultChecked={selectedMode === mode.value}
                required
                className="peer sr-only"
              />
              <span className="block rounded-xl border p-4 transition-colors peer-checked:border-primary peer-checked:bg-primary/10">
                <span className="block text-sm font-semibold">{mode.title}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{mode.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">O que você vende (ou quer vender)?</legend>
        <div className="flex flex-wrap gap-2">
          {BUSINESS_CATEGORIES.map((category) => (
            <label key={category} className="cursor-pointer">
              <input
                type="checkbox"
                name="categories"
                value={category}
                defaultChecked={selectedCategories.includes(category)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "inline-block rounded-full border px-4 py-1.5 text-sm transition-colors",
                  "peer-checked:border-primary peer-checked:bg-primary/15 peer-checked:text-primary"
                )}
              >
                {category}
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Escolha uma ou mais categorias.</p>
      </fieldset>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Salvando..." : "Continuar"}
      </Button>
    </form>
  );
}
