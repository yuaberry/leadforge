"use client";

import { useActionState, useState } from "react";
import { Check, Copy } from "lucide-react";

import {
  createCapturePageAction,
  setCapturePageStatusAction,
  updateCapturePageAction,
} from "@/app/(app)/capture/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type State = { error?: string; success?: string } | null;

const DEFAULT_CONSENT =
  "Concordo em receber conteúdos e comunicações e sei que posso cancelar quando quiser.";

function PageFields({
  defaults,
}: {
  defaults?: {
    title: string;
    slug: string;
    headline: string;
    subheadline: string | null;
    leadMagnetUrl: string | null;
    thankYouMessage: string | null;
    consentText: string;
  };
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="title">Título interno *</Label>
          <Input
            id="title"
            name="title"
            defaultValue={defaults?.title}
            placeholder="Ex.: Isca — Guia de tráfego pago"
            required
            minLength={2}
            maxLength={120}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Endereço público *</Label>
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">/p/</span>
            <Input
              id="slug"
              name="slug"
              defaultValue={defaults?.slug}
              placeholder="guia-trafego"
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              title="Letras minúsculas, números e hífens"
              className="font-mono text-sm"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="headline">Título da página (o que o visitante vê) *</Label>
        <Input
          id="headline"
          name="headline"
          defaultValue={defaults?.headline}
          placeholder="Ex.: O guia gratuito que dobrou as vendas de 300 lojas"
          required
          minLength={2}
          maxLength={200}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="subheadline">Subtítulo</Label>
        <Input
          id="subheadline"
          name="subheadline"
          defaultValue={defaults?.subheadline ?? ""}
          placeholder="Uma linha que reforça a promessa"
          maxLength={400}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="leadMagnetUrl">Link da isca (e-book, planilha...)</Label>
          <Input
            id="leadMagnetUrl"
            name="leadMagnetUrl"
            type="url"
            defaultValue={defaults?.leadMagnetUrl ?? ""}
            placeholder="https://drive.google.com/..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="thankYouMessage">Mensagem de obrigado</Label>
          <Input
            id="thankYouMessage"
            name="thankYouMessage"
            defaultValue={defaults?.thankYouMessage ?? ""}
            placeholder="Confira seu e-mail — o material está a caminho!"
            maxLength={400}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="consentText">Texto de consentimento (LGPD) *</Label>
        <Input
          id="consentText"
          name="consentText"
          defaultValue={defaults?.consentText ?? DEFAULT_CONSENT}
          required
          minLength={10}
          maxLength={1000}
        />
        <p className="text-xs text-muted-foreground">
          O visitante marca este texto ao enviar o formulário — o aceite fica registrado com data
          e hora.
        </p>
      </div>
    </>
  );
}

export function CreatePageForm() {
  const [state, formAction, pending] = useActionState<State, FormData>(createCapturePageAction, null);

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
      <PageFields />
      <Button type="submit" disabled={pending}>
        {pending ? "Criando..." : "Criar página"}
      </Button>
    </form>
  );
}

export function EditPageForm({
  page,
}: {
  page: {
    id: string;
    title: string;
    slug: string;
    headline: string;
    subheadline: string | null;
    leadMagnetUrl: string | null;
    thankYouMessage: string | null;
    consentText: string;
  };
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(updateCapturePageAction, null);

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
      <input type="hidden" name="pageId" value={page.id} />
      <PageFields
        defaults={{
          title: page.title,
          slug: page.slug,
          headline: page.headline,
          subheadline: page.subheadline,
          leadMagnetUrl: page.leadMagnetUrl,
          thankYouMessage: page.thankYouMessage,
          consentText: page.consentText,
        }}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : "Salvar alterações"}
      </Button>
    </form>
  );
}

export function PageStatusForm({ pageId, status }: { pageId: string; status: string }) {
  const [, formAction, pending] = useActionState<State, FormData>(setCapturePageStatusAction, null);

  const options =
    status === "published"
      ? [
          { value: "draft", label: "Despublicar" },
          { value: "archived", label: "Arquivar" },
        ]
      : [
          { value: "published", label: "Publicar" },
          ...(status === "archived" ? [] : [{ value: "archived", label: "Arquivar" }]),
        ];

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="pageId" value={pageId} />
      {options.map((option) => (
        <button
          key={option.value}
          type="submit"
          name="status"
          value={option.value}
          disabled={pending}
          className={cn(
            "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
            option.value === "published"
              ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
              : "border-input text-muted-foreground hover:bg-secondary"
          )}
        >
          {option.label}
        </button>
      ))}
    </form>
  );
}

export function CaptureLink({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/p/${slug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponível
    }
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <code className="truncate rounded bg-muted px-2 py-1 text-xs">/p/{slug}</code>
      <Button type="button" variant="outline" size="sm" onClick={copy} className="gap-1.5">
        {copied ? (
          <Check className="size-3.5 text-emerald-400" aria-hidden="true" />
        ) : (
          <Copy className="size-3.5" aria-hidden="true" />
        )}
        {copied ? "Copiado" : "Copiar link"}
      </Button>
    </div>
  );
}
