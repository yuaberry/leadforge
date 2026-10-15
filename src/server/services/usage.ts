import "server-only";

import { and, count, eq, gte } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "@/server/db/schema";
import { campaigns, conversationMessages, leads, messages } from "@/server/db/schema";
import { commerceIntegrations, emailAccounts, whatsappAccounts, leadAnalyses, organizationMembers } from "@/server/db/schema";
import { fitsInLimit, getPlan, PlanLimitError, type UsageMetric } from "@/server/services/billing";

type AnyDb = NodePgDatabase<typeof schema>;

export type Usage = Record<UsageMetric, number>;

function startOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export async function getUsage(db: AnyDb, organizationId: string): Promise<Usage> {
  const monthStart = startOfMonth();

  const [leadsCount] = await db
    .select({ total: count() })
    .from(leads)
    .where(eq(leads.organizationId, organizationId));

  const [usersCount] = await db
    .select({ total: count() })
    .from(organizationMembers)
    .where(eq(organizationMembers.organizationId, organizationId));

  const [messagesCount] = await db
    .select({ total: count() })
    .from(messages)
    .where(
      and(
        eq(messages.organizationId, organizationId),
        eq(messages.direction, "outbound"),
        gte(messages.sentAt, monthStart)
      )
    );

  // mensagens de inbox também contam como envio
  const [inboxCount] = await db
    .select({ total: count() })
    .from(conversationMessages)
    .where(
      and(
        eq(conversationMessages.organizationId, organizationId),
        eq(conversationMessages.direction, "outbound"),
        gte(conversationMessages.createdAt, monthStart)
      )
    );

  const [aiCount] = await db
    .select({ total: count() })
    .from(leadAnalyses)
    .where(
      and(
        eq(leadAnalyses.organizationId, organizationId),
        eq(leadAnalyses.status, "completed"),
        gte(leadAnalyses.createdAt, monthStart)
      )
    );

  const [campaignsCount] = await db
    .select({ total: count() })
    .from(campaigns)
    .where(
      and(eq(campaigns.organizationId, organizationId), eq(campaigns.status, "active"))
    );

  const [integrationsCount] = await db
    .select({ total: count() })
    .from(commerceIntegrations)
    .where(eq(commerceIntegrations.organizationId, organizationId));

  const [emailAccountsCount] = await db
    .select({ total: count() })
    .from(emailAccounts)
    .where(eq(emailAccounts.organizationId, organizationId));

  const [waAccountsCount] = await db
    .select({ total: count() })
    .from(whatsappAccounts)
    .where(eq(whatsappAccounts.organizationId, organizationId));

  return {
    leads: Number(leadsCount?.total ?? 0),
    users: Number(usersCount?.total ?? 0),
    messagesPerMonth: Number(messagesCount?.total ?? 0) + Number(inboxCount?.total ?? 0),
    aiAnalysesPerMonth: Number(aiCount?.total ?? 0),
    activeCampaigns: Number(campaignsCount?.total ?? 0),
    integrations:
      Number(integrationsCount?.total ?? 0) +
      Number(emailAccountsCount?.total ?? 0) +
      Number(waAccountsCount?.total ?? 0),
  };
}

/**
 * Enforca o limite do plano ANTES da operação. Lança PlanLimitError quando
 * excedido — os actions convertem em mensagem amigável.
 */
export async function assertWithinPlanLimit(
  db: AnyDb,
  organizationId: string,
  plan: string,
  metric: UsageMetric,
  incoming: number = 1
): Promise<void> {
  const planConfig = getPlan(plan);
  const usage = await getUsage(db, organizationId);

  if (!fitsInLimit(planConfig, metric, usage[metric], incoming)) {
    throw new PlanLimitError(metric, planConfig.limits[metric]);
  }
}

export function planLimitMessage(metric: UsageMetric, limit: number | null): string {
  const labels: Record<UsageMetric, string> = {
    leads: "leads",
    users: "usuários",
    messagesPerMonth: "mensagens este mês",
    aiAnalysesPerMonth: "análises de IA este mês",
    activeCampaigns: "campanhas ativas",
    integrations: "integrações",
  };
  return `Limite do plano atingido: ${labels[metric]} (${limit ?? "—"}). Faça upgrade em Configurações → Billing para continuar.`;
}
