"use client";

import { useActionState } from "react";
import { Calendar, Check, RotateCcw, Trash2, X } from "lucide-react";

import {
  cancelTaskAction,
  completeTaskAction,
  createTaskAction,
  deleteTaskAction,
  reopenTaskAction,
} from "@/app/(app)/tasks/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type State = { error?: string; success?: string } | null;

const TYPE_LABELS: Record<string, string> = {
  call: "Ligação",
  whatsapp: "WhatsApp",
  email: "E-mail",
  meeting: "Reunião",
  proposal: "Proposta",
  followup: "Follow-up",
};

const PRIORITY_BADGE: Record<string, "secondary" | "warning" | "destructive" | "default"> = {
  low: "secondary",
  medium: "secondary",
  high: "warning",
  urgent: "destructive",
};

export function TaskForm({ leads }: { leads: { id: string; label: string }[] }) {
  const [state, formAction, pending] = useActionState<State, FormData>(createTaskAction, null);

  return (
    <form action={formAction} className="grid gap-3 lg:grid-cols-5 lg:items-end">
      {state?.error && (
        <Alert variant="destructive" className="lg:col-span-5">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state?.success && (
        <Alert className="lg:col-span-5">
          <AlertDescription>{state.success}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1.5 lg:col-span-2">
        <Label htmlFor="task-title" className="text-xs">Tarefa *</Label>
        <Input id="task-title" name="title" required minLength={2} maxLength={200} className="h-9" placeholder="Ex.: ligar para a clínica Vale" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="task-type" className="text-xs">Tipo</Label>
        <select id="task-type" name="type" defaultValue="followup" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="task-priority" className="text-xs">Prioridade</Label>
        <select id="task-priority" name="priority" defaultValue="medium" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
          <option value="low">Baixa</option>
          <option value="medium">Média</option>
          <option value="high">Alta</option>
          <option value="urgent">Urgente</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="task-due" className="text-xs">Prazo</Label>
        <Input id="task-due" name="dueAt" type="datetime-local" className="h-9" />
      </div>

      <div className="space-y-1.5 lg:col-span-4">
        <Label htmlFor="task-lead" className="text-xs">Lead (opcional)</Label>
        <select id="task-lead" name="leadId" defaultValue="" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
          <option value="">— sem lead —</option>
          {leads.map((lead) => (
            <option key={lead.id} value={lead.id}>{lead.label}</option>
          ))}
        </select>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "..." : "Criar"}
      </Button>
    </form>
  );
}

export function TaskItem({
  task,
}: {
  task: {
    id: string;
    title: string;
    type: string;
    priority: string;
    status: string;
    dueAt: string | null;
    leadId: string | null;
  };
}) {
  const overdue =
    task.status === "open" && task.dueAt && new Date(task.dueAt).getTime() < Date.now();

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {task.status === "done" && (
            <span className="mr-1.5 text-emerald-400 line-through">{task.title}</span>
          )}
          {task.status !== "done" && task.title}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{TYPE_LABELS[task.type] ?? task.type}</Badge>
          <Badge variant={PRIORITY_BADGE[task.priority] ?? "secondary"}>{task.priority}</Badge>
          {task.dueAt && (
            <span
              className={`flex items-center gap-1 text-xs ${overdue ? "text-red-400" : "text-muted-foreground"}`}
            >
              <Calendar className="size-3" aria-hidden="true" />
              {new Date(task.dueAt).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {overdue && " · atrasada"}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {task.status === "open" && (
          <>
            <form action={completeTaskAction}>
              <input type="hidden" name="taskId" value={task.id} />
              <Button type="submit" size="icon" variant="outline" aria-label="Concluir tarefa">
                <Check className="size-3.5 text-emerald-400" aria-hidden="true" />
              </Button>
            </form>
            <form action={cancelTaskAction}>
              <input type="hidden" name="taskId" value={task.id} />
              <Button type="submit" size="icon" variant="outline" aria-label="Cancelar tarefa">
                <X className="size-3.5" aria-hidden="true" />
              </Button>
            </form>
          </>
        )}
        {task.status === "done" && (
          <form action={reopenTaskAction}>
            <input type="hidden" name="taskId" value={task.id} />
            <Button type="submit" size="icon" variant="outline" aria-label="Reabrir tarefa">
              <RotateCcw className="size-3.5" aria-hidden="true" />
            </Button>
          </form>
        )}
        <form action={deleteTaskAction}>
          <input type="hidden" name="taskId" value={task.id} />
          <Button
            type="submit"
            size="icon"
            variant="outline"
            aria-label="Excluir tarefa"
            className="text-muted-foreground/60 hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </Button>
        </form>
      </div>
    </div>
  );
}
