"use client";

import { useActionState, useState } from "react";
import { Check, Copy, Sparkles } from "lucide-react";

import {
  analyzeLeadAction,
  discardDraftAction,
  editDraftAction,
  generateMessageAction,
} from "@/app/(app)/leads/[id]/ai-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MESSAGE_CHANNELS, MESSAGE_TONES } from "@/validators/scoring";

type State = { error?: string; success?: string } | null;

export function AnalyzeButton({ leadId, providerKind }: { leadId: string; providerKind: string }) {
  const [state, formAction, pending] = useActionState<State, FormData>(analyzeLeadAction, null);

  return (
    <div className="space-y-3">
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <form action={formAction}>
        <input type="hidden" name="leadId" value={leadId} />
        <Button type="submit" disabled={pending} className="gap-2">
          <Sparkles className="size-4" aria-hidden="true" />
          {pending ? "Analisando..." : "Analisar com IA"}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        Provedor ativo:{" "}
        <span className={providerKind === "openrouter" ? "text-emerald-400" : "text-amber-400"}>
          {providerKind === "openrouter" ? "OpenRouter" : "modo demonstração (sem chave)"}
        </span>
      </p>
    </div>
  );
}

export function GenerateMessageForm({
  leadId,
  products,
  defaultChannel,
  defaultProductId,
}: {
  leadId: string;
  products: { id: string; name: string }[];
  defaultChannel: string;
  defaultProductId: string | null;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(generateMessageAction, null);

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
      <input type="hidden" name="leadId" value={leadId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`tone-${leadId}`} className="text-xs">Tom</Label>
          <select
            id={`tone-${leadId}`}
            name="tone"
            defaultValue="profissional"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {MESSAGE_TONES.map((tone) => (
              <option key={tone.value} value={tone.value}>{tone.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`channel-${leadId}`} className="text-xs">Canal</Label>
          <select
            id={`channel-${leadId}`}
            name="channel"
            defaultValue={defaultChannel}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {MESSAGE_CHANNELS.map((channel) => (
              <option key={channel.value} value={channel.value}>{channel.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`product-${leadId}`} className="text-xs">Produto</Label>
        <select
          id={`product-${leadId}`}
          name="productId"
          defaultValue={defaultProductId ?? ""}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Recomendado pela análise (ou genérico)</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>{product.name}</option>
          ))}
        </select>
      </div>

      <Button type="submit" disabled={pending} variant="secondary" className="w-full">
        {pending ? "Escrevendo..." : "Gerar mensagem (rascunho para revisão)"}
      </Button>
    </form>
  );
}

export function DraftCard({
  draftId,
  leadId,
  channel,
  tone,
  subject,
  body,
  productName,
}: {
  draftId: string;
  leadId: string;
  channel: string;
  tone: string;
  subject: string | null;
  body: string;
  productName: string | null;
}) {
  const [editState, editAction, editPending] = useActionState<State, FormData>(editDraftAction, null);
  const [, discardAction, discardPending] = useActionState<State, FormData>(discardDraftAction, null);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = subject ? `Assunto: ${subject}\n\n${body}` : body;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponível
    }
  }

  return (
    <div className="rounded-xl border p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          {channel === "email" ? "E-mail" : "WhatsApp"} · tom {tone}
          {productName ? ` · ${productName}` : ""}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={copy} className="gap-1.5">
            {copied ? (
              <Check className="size-3.5 text-emerald-400" aria-hidden="true" />
            ) : (
              <Copy className="size-3.5" aria-hidden="true" />
            )}
            {copied ? "Copiado" : "Copiar"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
            {editing ? "Fechar" : "Editar"}
          </Button>
        </div>
      </div>

      {editing ? (
        <form action={editAction} className="space-y-2">
          {editState?.error && (
            <p className="text-xs text-destructive" role="alert">{editState.error}</p>
          )}
          {editState?.success && (
            <p className="text-xs text-emerald-400" role="status">{editState.success}</p>
          )}
          <input type="hidden" name="draftId" value={draftId} />
          <input type="hidden" name="leadId" value={leadId} />
          {channel === "email" && (
            <input
              name="subject"
              defaultValue={subject ?? ""}
              placeholder="Assunto"
              maxLength={300}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          )}
          <textarea
            name="body"
            defaultValue={body}
            rows={6}
            maxLength={6000}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={editPending}>
              {editPending ? "Salvando..." : "Salvar edição"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="text-sm">
          {subject && <p className="mb-1 font-semibold">{subject}</p>}
          <p className="whitespace-pre-wrap text-muted-foreground">{body}</p>
        </div>
      )}

      <form action={discardAction} className="mt-2">
        <input type="hidden" name="draftId" value={draftId} />
        <input type="hidden" name="leadId" value={leadId} />
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          disabled={discardPending}
          className="text-destructive hover:bg-destructive/10"
        >
          {discardPending ? "..." : "Descartar"}
        </Button>
      </form>

      <p className="mt-2 text-[11px] text-muted-foreground/70">
        Envio automatizado chega na Fase 6 (campanhas) — por ora, copie e envie pelo seu canal.
      </p>
    </div>
  );
}
