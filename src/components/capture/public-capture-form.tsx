"use client";

import { useActionState } from "react";
import { CheckCircle2, Gift } from "lucide-react";

import { submitCaptureFormAction, type CaptureSubmitResult } from "@/app/p/[slug]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PublicCaptureForm({
  slug,
  consentText,
  utm,
}: {
  slug: string;
  consentText: string;
  utm: { source?: string; campaign?: string; content?: string };
}) {
  const [state, formAction, pending] = useActionState<CaptureSubmitResult | null, FormData>(
    submitCaptureFormAction,
    null
  );

  if (state?.ok) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-emerald-400" aria-hidden="true" />
        <p className="mt-3 font-semibold">
          {state.thankYouMessage || "Inscrição confirmada — obrigado!"}
        </p>
        {state.leadMagnetUrl && (
          <a
            href={state.leadMagnetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Gift className="size-4" aria-hidden="true" />
            Acessar o material
          </a>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      {state && !state.ok && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400" role="alert">
          {state.error}
        </p>
      )}

      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="utm_source" value={utm.source ?? ""} />
      <input type="hidden" name="utm_campaign" value={utm.campaign ?? ""} />
      <input type="hidden" name="utm_content" value={utm.content ?? ""} />

      {/* Honeypot — invisível para humanos */}
      <input
        type="text"
        name="hp_website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] size-0 opacity-0"
      />

      <Input
        name="name"
        placeholder="Seu nome"
        required
        minLength={2}
        maxLength={120}
        aria-label="Seu nome"
      />
      <Input
        name="email"
        type="email"
        placeholder="Seu melhor e-mail"
        required
        maxLength={200}
        aria-label="Seu e-mail"
      />
      <Input name="phone" placeholder="WhatsApp (opcional)" maxLength={40} aria-label="Telefone" />

      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          name="consent"
          required
          className="mt-0.5 size-4 rounded border-input"
        />
        {consentText}
      </label>

      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "Enviando..." : "Quero receber"}
      </Button>
    </form>
  );
}
