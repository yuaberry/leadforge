import "server-only";

import { and, asc, count, desc, eq, lte, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "@/server/db/schema";
import {
  deals,
  financialTransactions,
  goalContributions,
  goals,
  tasks,
} from "@/server/db/schema";
import { products } from "@/server/db/schema";
import type { TenantDb } from "@/server/db/tenant";

type AnyDb = NodePgDatabase<typeof schema>;

// ---------- Deals (pipeline) ----------

export async function listDeals(db: AnyDb, organizationId: string) {
  return db
    .select({
      deal: deals,
      leadName: schema.contacts.fullName,
      companyName: schema.companies.name,
    })
    .from(deals)
    .leftJoin(schema.leads, eq(schema.leads.id, deals.leadId))
    .leftJoin(schema.contacts, eq(schema.contacts.id, schema.leads.contactId))
    .leftJoin(schema.companies, eq(schema.companies.id, schema.leads.companyId))
    .where(eq(deals.organizationId, organizationId))
    .orderBy(desc(deals.updatedAt));
}

export async function insertDeal(
  db: TenantDb,
  values: typeof deals.$inferInsert
): Promise<typeof deals.$inferSelect> {
  const [deal] = await db.insert(deals).values(values).returning();
  return deal;
}

export async function moveDealStage(
  db: TenantDb,
  organizationId: string,
  dealId: string,
  stage: string
): Promise<typeof deals.$inferSelect | null> {
  const [deal] = await db
    .update(deals)
    .set({ stage: stage as "new", updatedAt: new Date().toISOString() })
    .where(and(eq(deals.organizationId, organizationId), eq(deals.id, dealId)))
    .returning();
  return deal ?? null;
}

export async function deleteDeal(
  db: TenantDb,
  organizationId: string,
  dealId: string
): Promise<void> {
  await db.delete(deals).where(and(eq(deals.organizationId, organizationId), eq(deals.id, dealId)));
}

export async function pipelineTotals(db: AnyDb, organizationId: string) {
  return db
    .select({
      stage: deals.stage,
      total: count(),
      value: sql<number>`coalesce(sum(${deals.value}), 0)`.mapWith(Number),
    })
    .from(deals)
    .where(eq(deals.organizationId, organizationId))
    .groupBy(deals.stage);
}

// ---------- Tasks ----------

export async function listTasks(db: AnyDb, organizationId: string, status?: string) {
  const conditions = [eq(tasks.organizationId, organizationId)];
  if (status === "open" || status === "done" || status === "cancelled") {
    conditions.push(eq(tasks.status, status));
  }
  return db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(asc(tasks.dueAt), desc(tasks.createdAt))
    .limit(100);
}

export async function insertTask(
  db: TenantDb,
  values: typeof tasks.$inferInsert
): Promise<typeof tasks.$inferSelect> {
  const [task] = await db.insert(tasks).values(values).returning();
  return task;
}

export async function setTaskStatus(
  db: TenantDb,
  organizationId: string,
  taskId: string,
  status: "open" | "done" | "cancelled"
): Promise<void> {
  await db
    .update(tasks)
    .set({
      status,
      completedAt: status === "done" ? new Date().toISOString() : null,
    })
    .where(and(eq(tasks.organizationId, organizationId), eq(tasks.id, taskId)));
}

export async function deleteTask(db: TenantDb, organizationId: string, taskId: string): Promise<void> {
  await db.delete(tasks).where(and(eq(tasks.organizationId, organizationId), eq(tasks.id, taskId)));
}

/** Tarefas abertas atrasadas ou para hoje (badge do dashboard). */
export async function urgentTasksCount(db: AnyDb, organizationId: string): Promise<number> {
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  const [row] = await db
    .select({ total: count() })
    .from(tasks)
    .where(
      and(
        eq(tasks.organizationId, organizationId),
        eq(tasks.status, "open"),
        lte(tasks.dueAt, endOfDay.toISOString())
      )
    );
  return Number(row?.total ?? 0);
}

// ---------- Financeiro ----------

export async function insertFinancialTransaction(
  db: AnyDb,
  values: typeof financialTransactions.$inferInsert
): Promise<typeof financialTransactions.$inferInsert> {
  const [transaction] = await db.insert(financialTransactions).values(values).returning();
  return transaction;
}

export async function listFinancialTransactions(
  db: AnyDb,
  organizationId: string,
  limit = 50
) {
  return db
    .select()
    .from(financialTransactions)
    .where(eq(financialTransactions.organizationId, organizationId))
    .orderBy(desc(financialTransactions.occurredAt))
    .limit(limit);
}

/**
 * Reconcilia o lançamento financeiro de uma venda (idempotente):
 *  - paga → garante receita registrada (categoria por tipo do produto);
 *  - não paga (refund/cancelada) → remove a receita automática vinculada.
 */
export async function reconcileSaleFinance(
  db: AnyDb,
  input: {
    saleId: string;
    organizationId: string;
    isPaid: boolean;
    amount: number | null;
    commissionAmount: number | null;
    productType: "own" | "affiliate" | null;
    platform: string;
    externalOrderId: string;
    occurredAt: string;
  }
): Promise<void> {
  if (!input.isPaid) {
    await db
      .delete(financialTransactions)
      .where(
        and(
          eq(financialTransactions.organizationId, input.organizationId),
          eq(financialTransactions.saleId, input.saleId)
        )
      );
    return;
  }

  const revenue = input.commissionAmount ?? input.amount ?? 0;
  if (revenue <= 0) return;

  const [existing] = await db
    .select({ id: financialTransactions.id })
    .from(financialTransactions)
    .where(
      and(
        eq(financialTransactions.organizationId, input.organizationId),
        eq(financialTransactions.saleId, input.saleId)
      )
    )
    .limit(1);

  const values = {
    organizationId: input.organizationId,
    type: "revenue" as const,
    category: (input.productType === "affiliate" ? "affiliate_commission" : "own_sale") as
      | "affiliate_commission"
      | "own_sale",
    description: `Venda ${input.externalOrderId} (${input.platform})`,
    amount: revenue,
    occurredAt: input.occurredAt,
    source: "sale_webhook" as const,
    saleId: input.saleId,
  };

  if (existing) {
    await db
      .update(financialTransactions)
      .set(values)
      .where(eq(financialTransactions.id, existing.id));
  } else {
    await db.insert(financialTransactions).values(values);
  }
}

export async function financialTotals(db: AnyDb, organizationId: string) {
  const [row] = await db
    .select({
      revenue: sql<number>`coalesce(sum(${financialTransactions.amount}) filter (where ${financialTransactions.type} = 'revenue'), 0)`.mapWith(
        Number
      ),
      expense: sql<number>`coalesce(sum(${financialTransactions.amount}) filter (where ${financialTransactions.type} = 'expense'), 0)`.mapWith(
        Number
      ),
    })
    .from(financialTransactions)
    .where(eq(financialTransactions.organizationId, organizationId));

  const revenue = row?.revenue ?? 0;
  const expense = row?.expense ?? 0;
  return { revenue, expense, profit: revenue - expense };
}

/** Receita por produto (ROI por produto no Profit Dashboard). */
export async function revenueByProduct(db: AnyDb, organizationId: string) {
  return db
    .select({
      productId: products.id,
      productName: products.name,
      revenue: sql<number>`coalesce(sum(${financialTransactions.amount}), 0)`.mapWith(Number),
    })
    .from(financialTransactions)
    .innerJoin(schema.sales, eq(schema.sales.id, financialTransactions.saleId))
    .innerJoin(products, eq(products.id, schema.sales.productId))
    .where(
      and(
        eq(financialTransactions.organizationId, organizationId),
        eq(financialTransactions.type, "revenue")
      )
    )
    .groupBy(products.id, products.name)
    .orderBy(desc(sql`coalesce(sum(${financialTransactions.amount}), 0)`))
    .limit(10);
}

// ---------- Metas ----------

export async function listGoals(db: AnyDb, organizationId: string) {
  return db
    .select({
      goal: goals,
      contributed: sql<number>`coalesce((
        select sum(${goalContributions.amount}) from ${goalContributions}
        where ${goalContributions.goalId} = ${goals.id}
      ), 0)`.mapWith(Number),
    })
    .from(goals)
    .where(eq(goals.organizationId, organizationId))
    .orderBy(asc(goals.createdAt));
}

export async function insertGoal(
  db: AnyDb,
  values: typeof goals.$inferInsert
): Promise<typeof goals.$inferSelect> {
  const [goal] = await db.insert(goals).values(values).returning();
  return goal;
}

export async function updateGoal(
  db: TenantDb,
  organizationId: string,
  goalId: string,
  patch: Partial<typeof goals.$inferInsert>
): Promise<void> {
  await db
    .update(goals)
    .set(patch)
    .where(and(eq(goals.organizationId, organizationId), eq(goals.id, goalId)));
}

export async function deleteGoal(db: TenantDb, organizationId: string, goalId: string): Promise<void> {
  await db.delete(goals).where(and(eq(goals.organizationId, organizationId), eq(goals.id, goalId)));
}

export async function addGoalContribution(
  db: AnyDb,
  input: {
    organizationId: string;
    goalId: string;
    amount: number;
    source: "manual" | "auto_sale";
    saleId?: string | null;
    note?: string | null;
  }
): Promise<{ inserted: boolean }> {
  try {
    await db.insert(goalContributions).values({
      organizationId: input.organizationId,
      goalId: input.goalId,
      amount: input.amount,
      source: input.source,
      saleId: input.saleId ?? null,
      note: input.note ?? null,
    });
    return { inserted: true };
  } catch (erro) {
    // violação do índice único (goal, sale) → contribuição já existente
    if ((erro as { code?: string }).code === "23505") {
      return { inserted: false };
    }
    throw erro;
  }
}

export async function listGoalContributions(
  db: AnyDb,
  organizationId: string,
  goalId: string,
  limit = 20
) {
  return db
    .select()
    .from(goalContributions)
    .where(
      and(
        eq(goalContributions.organizationId, organizationId),
        eq(goalContributions.goalId, goalId)
      )
    )
    .orderBy(desc(goalContributions.createdAt))
    .limit(limit);
}

export async function markGoalReachedIfDue(
  db: AnyDb,
  organizationId: string,
  goalId: string
): Promise<boolean> {
  const [row] = await db
    .select({
      target: goals.targetAmount,
      contributed: sql<number>`coalesce((
        select sum(${goalContributions.amount}) from ${goalContributions}
        where ${goalContributions.goalId} = ${goals.id}
      ), 0)`.mapWith(Number),
      status: goals.status,
    })
    .from(goals)
    .where(and(eq(goals.organizationId, organizationId), eq(goals.id, goalId)))
    .limit(1);

  if (!row) return false;
  if (row.contributed >= row.target && row.status !== "reached") {
    await db
      .update(goals)
      .set({ status: "reached", reachedAt: new Date().toISOString() })
      .where(and(eq(goals.organizationId, organizationId), eq(goals.id, goalId)));
    return true;
  }
  return false;
}
