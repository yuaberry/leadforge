"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { requireOrgContext } from "@/server/auth/session";
import { withTenantDb } from "@/server/db/tenant";
import { deleteTask, insertTask, setTaskStatus } from "@/server/db/repositories/crm";

type TaskState = { error?: string; success?: string } | null;

const createTaskSchema = z.object({
  title: z.string().trim().min(2, "Descreva a tarefa").max(200),
  type: z.enum(["call", "whatsapp", "email", "meeting", "proposal", "followup"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  dueAt: z.string().trim().max(30).optional().or(z.literal("")),
  leadId: z.string().uuid().optional().or(z.literal("")),
});

export async function createTaskAction(
  _prev: TaskState,
  formData: FormData
): Promise<TaskState> {
  const ctx = await requireOrgContext();

  const parsed = createTaskSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    type: String(formData.get("type") ?? "followup"),
    priority: String(formData.get("priority") ?? "medium"),
    dueAt: String(formData.get("dueAt") ?? ""),
    leadId: String(formData.get("leadId") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await withTenantDb(ctx.accessToken, (db) =>
    insertTask(db, {
      organizationId: ctx.organization.id,
      title: parsed.data.title,
      type: parsed.data.type,
      priority: parsed.data.priority,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt).toISOString() : null,
      leadId: parsed.data.leadId || null,
      assigneeId: ctx.user.id,
    })
  );

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return { success: "Tarefa criada." };
}

export async function completeTaskAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext();
  const taskId = String(formData.get("taskId") ?? "");
  if (!taskId) return;
  await withTenantDb(ctx.accessToken, (db) =>
    setTaskStatus(db, ctx.organization.id, taskId, "done")
  );
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function cancelTaskAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext();
  const taskId = String(formData.get("taskId") ?? "");
  if (!taskId) return;
  await withTenantDb(ctx.accessToken, (db) =>
    setTaskStatus(db, ctx.organization.id, taskId, "cancelled")
  );
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function reopenTaskAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext();
  const taskId = String(formData.get("taskId") ?? "");
  if (!taskId) return;
  await withTenantDb(ctx.accessToken, (db) =>
    setTaskStatus(db, ctx.organization.id, taskId, "open")
  );
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function deleteTaskAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext();
  const taskId = String(formData.get("taskId") ?? "");
  if (!taskId) return;
  await withTenantDb(ctx.accessToken, (db) => deleteTask(db, ctx.organization.id, taskId));
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}
