import type { Metadata } from "next";
import Link from "next/link";

import { TaskForm, TaskItem } from "@/components/crm/task-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrgContext } from "@/server/auth/session";
import { listTasks } from "@/server/db/repositories/crm";
import { recentLeads } from "@/server/db/repositories/leads";
import { withTenantDb } from "@/server/db/tenant";

export const metadata: Metadata = {
  title: "Tarefas",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TasksPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireOrgContext();
  const sp = await searchParams;
  const statusFilter = typeof sp.status === "string" ? sp.status : "open";

  const { tasks, leads } = await withTenantDb(ctx.accessToken, async (db) => ({
    tasks: await listTasks(db, ctx.organization.id, statusFilter),
    leads: await recentLeads(db, ctx.organization.id, 50),
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tarefas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ligações, follow-ups, propostas — o trabalho que move o pipeline.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nova tarefa</CardTitle>
        </CardHeader>
        <CardContent>
          <TaskForm
            leads={leads.map((lead) => ({
              id: lead.id,
              label: lead.contactName ?? lead.companyName ?? lead.id,
            }))}
          />
        </CardContent>
      </Card>

      <div className="flex gap-2">
        {(["open", "done", "cancelled", "all"] as const).map((option) => (
          <Link
            key={option}
            href={`/tasks?status=${option}`}
            className="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
          >
            {option === "open"
              ? "Abertas"
              : option === "done"
                ? "Concluídas"
                : option === "cancelled"
                  ? "Canceladas"
                  : "Todas"}
            {statusFilter === option ? " •" : ""}
          </Link>
        ))}
      </div>

      <div className="space-y-2">
        {tasks.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma tarefa neste filtro.
            </CardContent>
          </Card>
        ) : (
          tasks.map((task) => <TaskItem key={task.id} task={task} />)
        )}
      </div>
    </div>
  );
}
