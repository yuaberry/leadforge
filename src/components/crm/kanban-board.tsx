"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, Trash2 } from "lucide-react";

import { deleteDealAction, moveDealAction } from "@/app/(app)/pipeline/actions";
import { formatCurrency } from "@/lib/format";
import { LEAD_STAGES, STAGE_LABELS } from "@/validators/lead";
import { cn } from "@/lib/utils";

export type KanbanDeal = {
  id: string;
  title: string;
  value: number | null;
  stage: string;
  expectedCloseDate: string | null;
  leadName: string | null;
  companyName: string | null;
};

/**
 * Kanban com drag&drop nativo (desktop) + botões ←/→ (acessível/mobile).
 * A movimentação chama a server action `moveDealAction` — sem estado local
 * otimista enganoso; o servidor é a fonte da verdade.
 */
export function KanbanBoard({ deals }: { deals: KanbanDeal[] }) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function move(dealId: string, stage: string) {
    startTransition(async () => {
      await moveDealAction(dealId, stage);
    });
  }

  function handleDrop(stage: string) {
    if (draggedId) {
      move(draggedId, stage);
    }
    setDraggedId(null);
    setDropTarget(null);
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {LEAD_STAGES.map((stage) => {
        const stageDeals = deals.filter((deal) => deal.stage === stage);
        const stageTotal = stageDeals.reduce((sum, deal) => sum + (deal.value ?? 0), 0);

        return (
          <div
            key={stage}
            onDragOver={(event) => {
              event.preventDefault();
              setDropTarget(stage);
            }}
            onDragLeave={() => setDropTarget((target) => (target === stage ? null : target))}
            onDrop={() => handleDrop(stage)}
            className={cn(
              "flex w-56 shrink-0 flex-col rounded-xl border bg-card/50",
              dropTarget === stage && "border-primary/60 bg-primary/5"
            )}
          >
            <div className="border-b border-border/60 p-3">
              <p className="flex items-center justify-between text-xs font-semibold">
                {STAGE_LABELS[stage]}
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">
                  {stageDeals.length}
                </span>
              </p>
              {stageTotal > 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {formatCurrency(stageTotal)}
                </p>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-2 p-2">
              {stageDeals.map((deal) => {
                const stageIndex = LEAD_STAGES.indexOf(deal.stage as (typeof LEAD_STAGES)[number]);
                return (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={() => setDraggedId(deal.id)}
                    onDragEnd={() => {
                      setDraggedId(null);
                      setDropTarget(null);
                    }}
                    className={cn(
                      "cursor-grab rounded-lg border bg-card p-3 shadow-sm transition-all active:cursor-grabbing",
                      draggedId === deal.id && "opacity-50"
                    )}
                  >
                    <p className="truncate text-xs font-medium">{deal.title}</p>
                    {(deal.leadName || deal.companyName) && (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {deal.companyName ?? deal.leadName}
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-emerald-400">
                        {deal.value ? formatCurrency(deal.value) : "—"}
                      </span>
                      <div className="flex items-center gap-0.5">
                        {stageIndex > 0 && stageIndex < LEAD_STAGES.length - 2 && (
                          <button
                            type="button"
                            aria-label="Mover para o estágio anterior"
                            onClick={() =>
                              move(deal.id, LEAD_STAGES[stageIndex - 1])
                            }
                            className="rounded p-1 text-muted-foreground hover:bg-secondary"
                          >
                            <ArrowLeft className="size-3" aria-hidden="true" />
                          </button>
                        )}
                        {stageIndex < LEAD_STAGES.length - 2 && (
                          <button
                            type="button"
                            aria-label="Mover para o próximo estágio"
                            onClick={() =>
                              move(deal.id, LEAD_STAGES[stageIndex + 1])
                            }
                            className="rounded p-1 text-muted-foreground hover:bg-secondary"
                          >
                            <ArrowRight className="size-3" aria-hidden="true" />
                          </button>
                        )}
                        <form action={deleteDealAction}>
                          <input type="hidden" name="dealId" value={deal.id} />
                          <button
                            type="submit"
                            aria-label="Excluir deal"
                            className="rounded p-1 text-muted-foreground/50 hover:bg-red-500/10 hover:text-red-400"
                          >
                            <Trash2 className="size-3" aria-hidden="true" />
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                );
              })}
              {stageDeals.length === 0 && (
                <p className="py-4 text-center text-[11px] text-muted-foreground/50">
                  vazio
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
