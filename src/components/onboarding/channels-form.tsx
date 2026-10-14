"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { saveChannelsAction } from "@/app/onboarding/actions";

type State = { error?: string } | null;

const CHANNELS = [
  {
    id: "email",
    title: "E-mail",
    hint: "Campanhas de e-mail com Resend/SES (Fase 6)",
  },
  {
    id: "whatsapp",
    title: "WhatsApp",
    hint: "WhatsApp Business Cloud API oficial (Fase 7)",
  },
] as const;

export function ChannelsForm({
  emailEnabled,
  whatsappEnabled,
}: {
  emailEnabled: boolean;
  whatsappEnabled: boolean;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(saveChannelsAction, null);

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {CHANNELS.map((channel) => (
          <label key={channel.id} className="cursor-pointer">
            <input
              type="checkbox"
              name={channel.id}
              defaultChecked={channel.id === "email" ? emailEnabled : whatsappEnabled}
              className="peer sr-only"
            />
            <span className="block rounded-xl border p-4 transition-colors peer-checked:border-primary peer-checked:bg-primary/10">
              <span className="block text-sm font-semibold">{channel.title}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{channel.hint}</span>
            </span>
          </label>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Você escolhe com quais canais quer trabalhar — a conexão das contas acontece em
        Configurações, e sempre via APIs oficiais.
      </p>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Salvando..." : "Continuar"}
      </Button>
    </form>
  );
}
