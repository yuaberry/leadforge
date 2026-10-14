"use client";

import { useActionState } from "react";

import {
  addLeadsByFilterAction,
  addStepAction,
  createCampaignAction,
  processCampaignNowAction,
  setCampaignStatusAction,
} from "@/app/(app)/campaigns/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LEAD_STAGES, STAGE_LABELS } from "@/validators/lead";
import { TEMPLATE_HELP } from "@/server/services/template";

type State = { error?: string; success?: string } | null;

export function CreateCampaignForm({ products }: { products: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<State, FormData>(createCampaignAction, null);

  return (
    <form action={formAction} className="grid gap-3 lg:grid-cols-4 lg:items-end">
      {state?.error && (
        <Alert variant="destructive" className="lg:col-span-4">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state?.success && (
        <Alert className="lg:col-span-4">
          <AlertDescription>{state.success}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5 lg:col-span-2">
        <Label htmlFor="camp-name" className="text-xs">Nome da campanha *</Label>
        <Input id="camp-name" name="name" required minLength={2} maxLength={120} className="h-9" placeholder="Ex.: Follow-up clínicas sem website" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="camp-mode" className="text-xs">Modo *</Label>
        <select id="camp-mode" name="mode" defaultValue="manual" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
          <option value="manual">Manual (aprovo cada envio)</option>
          <option value="automated">Automatizado (todos os gates)</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="camp-product" className="text-xs">Produto promovido</Label>
        <select id="camp-product" name="productId" defaultValue="" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
          <option value="">— nenhum —</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>{product.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="camp-cap" className="text-xs">Cap diário</Label>
        <Input id="camp-cap" name="dailyCap" type="number" min={1} max={500} defaultValue={50} className="h-9" />
      </div>

      <div className="grid grid-cols-2 gap-2 lg:col-span-2">
        <div className="space-y-1.5">
          <Label htmlFor="camp-hstart" className="text-xs">Envia a partir das</Label>
          <Input id="camp-hstart" name="activeHourStart" type="number" min={0} max={23} defaultValue={8} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="camp-hend" className="text-xs">Até (hora)</Label>
          <Input id="camp-hend" name="activeHourEnd" type="number" min={1} max={24} defaultValue={20} className="h-9" />
        </div>
      </div>

      <Button type="submit" disabled={pending} className="gap-2">
        {pending ? "..." : "Criar campanha"}
      </Button>
    </form>
  );
}

export function AddStepForm({ campaignId, nextPosition }: { campaignId: string; nextPosition: number }) {
  const [state, formAction, pending] = useActionState<State, FormData>(addStepAction, null);

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
      <input type="hidden" name="campaignId" value={campaignId} />

      <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor={`wait-${campaignId}`} className="text-xs">
            Espera (dias) antes
          </Label>
          <Input
            id={`wait-${campaignId}`}
            name="waitDays"
            type="number"
            min={0}
            max={60}
            defaultValue={nextPosition === 1 ? 0 : 2}
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`subject-${campaignId}`} className="text-xs">Assunto</Label>
          <Input
            id={`subject-${campaignId}`}
            name="subject"
            maxLength={200}
            className="h-9"
            placeholder="{{nome}}, e se a {{empresa}} vendesse mais pelo digital?"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`body-${campaignId}`} className="text-xs">Mensagem *</Label>
        <textarea
          id={`body-${campaignId}`}
          name="body"
          required
          minLength={5}
          maxLength={6000}
          rows={5}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Escreva a mensagem desta etapa..."
        />
        <p className="text-[11px] text-muted-foreground">
          {TEMPLATE_HELP.map((item) => item.key).join(" · ")} — o link de cancelamento é
          anexado automaticamente.
        </p>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "..." : `Adicionar etapa ${nextPosition}`}
      </Button>
    </form>
  );
}

export function AddLeadsByFilterForm({ campaignId }: { campaignId: string }) {
  const [state, formAction, pending] = useActionState<State, FormData>(addLeadsByFilterAction, null);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-3 sm:items-end">
      {state?.error && (
        <p className="text-xs text-destructive sm:col-span-3">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-xs text-emerald-400 sm:col-span-3">{state.success}</p>
      )}
      <input type="hidden" name="campaignId" value={campaignId} />

      <div className="space-y-1.5">
        <Label htmlFor={`stage-${campaignId}`} className="text-xs">Estágio</Label>
        <select id={`stage-${campaignId}`} name="stage" defaultValue="" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Todos</option>
          {LEAD_STAGES.map((stage) => (
            <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`minscore-${campaignId}`} className="text-xs">Score mínimo</Label>
        <select id={`minscore-${campaignId}`} name="minScore" defaultValue="" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Qualquer</option>
          <option value="30">30+ (morno)</option>
          <option value="60">60+ (quente)</option>
          <option value="80">80+ (prioritário)</option>
        </select>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "..." : "Adicionar leads"}
      </Button>
    </form>
  );
}

export function CampaignControls({
  campaignId,
  status,
}: {
  campaignId: string;
  status: string;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(setCampaignStatusAction, null);
  const [runState, runAction, runPending] = useActionState<State, FormData>(processCampaignNowAction, null);

  const nextStatus =
    status === "active" ? "paused" : status === "paused" ? "active" : status === "draft" ? "active" : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {nextStatus && (
          <form action={formAction}>
            <input type="hidden" name="campaignId" value={campaignId} />
            <input type="hidden" name="status" value={nextStatus} />
            <Button type="submit" disabled={pending} variant={nextStatus === "active" ? "default" : "outline"}>
              {pending ? "..." : nextStatus === "active" ? "Ativar campanha" : "Pausar"}
            </Button>
          </form>
        )}
        {status !== "cancelled" && status !== "completed" && (
          <form action={formAction}>
            <input type="hidden" name="campaignId" value={campaignId} />
            <input type="hidden" name="status" value="cancelled" />
            <Button type="submit" disabled={pending} variant="ghost" className="text-destructive hover:bg-destructive/10">
              {pending ? "..." : "Cancelar"}
            </Button>
          </form>
        )}
        {status === "active" && (
          <form action={runAction}>
            <input type="hidden" name="campaignId" value={campaignId} />
            <Button type="submit" disabled={runPending} variant="secondary">
              {runPending ? "Processando..." : "Processar leva agora"}
            </Button>
          </form>
        )}
      </div>
      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
      {state?.success && <p className="text-xs text-emerald-400">{state.success}</p>}
      {runState?.error && <p className="text-xs text-destructive">{runState.error}</p>}
      {runState?.success && <p className="text-xs text-emerald-400">{runState.success}</p>}
    </div>
  );
}
