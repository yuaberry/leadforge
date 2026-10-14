import type { Metadata } from "next";
import { Trash2, Trophy } from "lucide-react";

import {
  ContributeForm,
  CreateGoalForm,
  GoalSettingsForm,
  MigrateDreamForm,
} from "@/components/crm/goal-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { requireOrgContext } from "@/server/auth/session";
import { listGoals } from "@/server/db/repositories/crm";
import { withTenantDb } from "@/server/db/tenant";
import { goalProgress } from "@/server/services/goals";
import { parseOrgSettings } from "@/validators/org";
import { deleteGoalAction, pauseGoalAction } from "./actions";

export const metadata: Metadata = {
  title: "Metas",
};

const STATUS_LABELS: Record<string, { label: string; variant: "secondary" | "success" | "destructive" | "warning" }> = {
  dreaming: { label: "Sonhando", variant: "secondary" },
  saving: { label: "Juntando", variant: "warning" },
  reached: { label: "Conquistada! 🎉", variant: "success" },
  paused: { label: "Pausada", variant: "destructive" },
};

export default async function GoalsPage() {
  const ctx = await requireOrgContext();
  const settings = parseOrgSettings(ctx.organization.settings);

  const goals = await withTenantDb(ctx.accessToken, (db) =>
    listGoals(db, ctx.organization.id)
  );

  const withProgress = goals.map(({ goal, contributed }) => ({
    goal,
    progress: goalProgress(contributed, goal.targetAmount),
  }));

  const hasDreamToMigrate = Boolean(settings.dream) && goals.length === 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">🎯 Metas & Sonhos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O que você vai conquistar. Cada venda registrada enche a barra — automaticamente.
        </p>
      </div>

      {hasDreamToMigrate && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col items-start justify-between gap-3 pt-6 sm:flex-row sm:items-center">
            <p className="text-sm text-muted-foreground">
              Você já contou no onboarding que quer{" "}
              <span className="text-foreground">{settings.dream?.name}</span>. Quer importar
              como meta com barra de progresso?
            </p>
            <MigrateDreamForm />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {withProgress.map(({ goal, progress }) => {
          const status = STATUS_LABELS[goal.status] ?? STATUS_LABELS.dreaming;
          return (
            <Card
              key={goal.id}
              className={
                goal.status === "reached"
                  ? "overflow-hidden border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-violet-500/10 to-cyan-400/10"
                  : "overflow-hidden"
              }
            >
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-start gap-4">
                  {goal.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- imagem informada pelo usuário via URL arbitrária
                    <img
                      src={goal.imageUrl}
                      alt={goal.name}
                      className="size-20 shrink-0 rounded-xl border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600/20 via-violet-500/20 to-cyan-400/20 text-2xl">
                      🎯
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-semibold">{goal.name}</p>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    {goal.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {goal.description}
                      </p>
                    )}
                    {goal.productUrl && (
                      <a
                        href={goal.productUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-xs text-primary hover:underline"
                      >
                        ver anúncio/produto ↗
                      </a>
                    )}
                  </div>
                </div>

                {/* Barra de progresso */}
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-semibold text-emerald-400">
                      {formatCurrency(progress.contributed)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      de {formatCurrency(progress.target)}
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-400 transition-all"
                      style={{ width: `${progress.percent}%` }}
                      role="progressbar"
                      aria-valuenow={Math.round(progress.percent)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Progresso da meta ${goal.name}`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{Math.round(progress.percent)}%</span>
                    {!progress.reached && (
                      <span className="text-muted-foreground">
                        faltam {formatCurrency(progress.remaining)}
                      </span>
                    )}
                    {progress.reached && (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Trophy className="size-3" aria-hidden="true" /> conquistada!
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <ContributeForm goalId={goal.id} />
                  <div className="flex gap-1">
                    {goal.status !== "reached" && (
                      <form action={pauseGoalAction}>
                        <input type="hidden" name="goalId" value={goal.id} />
                        <input
                          type="hidden"
                          name="pause"
                          value={goal.status === "paused" ? "false" : "true"}
                        />
                        <button
                          type="submit"
                          className="rounded border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary"
                        >
                          {goal.status === "paused" ? "Reativar" : "Pausar"}
                        </button>
                      </form>
                    )}
                    <form action={deleteGoalAction}>
                      <input type="hidden" name="goalId" value={goal.id} />
                      <button
                        type="submit"
                        aria-label="Excluir meta"
                        className="rounded border p-1.5 text-muted-foreground/50 hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 className="size-3" aria-hidden="true" />
                      </button>
                    </form>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nova meta / sonho</CardTitle>
            <CardDescription>
              Notebook, carro, viagem, curso — qualquer conquista. A imagem e o link do anúncio
              mantêm a motivação à vista.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateGoalForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alocação automática</CardTitle>
            <CardDescription>
              Defina um % da comissão de cada venda paga que vai direto para a meta escolhida —
              a barra sobe sozinha a cada venda.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GoalSettingsForm
              goals={withProgress.map(({ goal }) => ({ id: goal.id, name: goal.name }))}
              autoAllocatePercent={settings.goalSettings.autoAllocatePercent}
              targetGoalId={settings.goalSettings.targetGoalId}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
