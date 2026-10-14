"use client";

import { useActionState, useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

import { createIntegrationAction } from "@/app/(app)/commerce/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COMMERCE_PLATFORMS } from "@/validators/commerce";

type State = { error?: string; success?: string } | null;

const WEBHOOK_PLATFORMS = COMMERCE_PLATFORMS.filter(
  (p) => p.value !== "custom"
);

export function IntegrationForm() {
  const [state, formAction, pending] = useActionState<State, FormData>(createIntegrationAction, null);

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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="integration-platform">Plataforma *</Label>
          <select
            id="integration-platform"
            name="platform"
            required
            defaultValue=""
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="" disabled>
              Selecione...
            </option>
            {WEBHOOK_PLATFORMS.map((platform) => (
              <option key={platform.value} value={platform.value}>
                {platform.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="integration-name">Nome da conta *</Label>
          <Input
            id="integration-name"
            name="name"
            required
            minLength={2}
            maxLength={80}
            placeholder="Ex.: Minha Kiwify principal"
          />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Criando..." : "Criar integração"}
      </Button>
    </form>
  );
}

export function WebhookUrl({ platform, token }: { platform: string; token: string }) {
  const [copied, setCopied] = useState(false);
  // Evita hydration mismatch: no primeiro render (server + client) mostra o
  // path; após hidratar, completa com a origem real.
  const [url, setUrl] = useState(`/api/webhooks/commerce/${platform}?token=${token}`);

  useEffect(() => {
    setUrl(`${window.location.origin}/api/webhooks/commerce/${platform}?token=${token}`);
  }, [platform, token]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponível
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">URL do webhook:</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 overflow-x-auto whitespace-nowrap rounded bg-muted px-2 py-2 text-xs">
          {url}
        </code>
        <Button type="button" variant="outline" size="sm" onClick={copy} className="gap-1.5">
          {copied ? (
            <Check className="size-3.5 text-emerald-400" aria-hidden="true" />
          ) : (
            <Copy className="size-3.5" aria-hidden="true" />
          )}
          {copied ? "Copiado" : "Copiar"}
        </Button>
      </div>
    </div>
  );
}
