/**
 * LEADFORGE — planos e limites (billing prep, Stripe na integração futura).
 *
 * Os limites já são ENFORCADOS nos pontos de entrada (leads, membros,
 * mensagens/mês, análises IA/mês, campanhas ativas, integrações).
 * `null` = ilimitado (Enterprise sob consulta).
 */

export type PlanKey = "starter" | "professional" | "agency" | "enterprise";

export type PlanLimits = {
  leads: number | null;
  users: number | null;
  messagesPerMonth: number | null;
  aiAnalysesPerMonth: number | null;
  activeCampaigns: number | null;
  integrations: number | null;
};

export type Plan = {
  key: PlanKey;
  label: string;
  description: string;
  limits: PlanLimits;
  priceHint: string;
};

export const PLANS: Record<PlanKey, Plan> = {
  starter: {
    key: "starter",
    label: "Starter",
    description: "Para começar a forjar as primeiras vendas",
    limits: {
      leads: 500,
      users: 2,
      messagesPerMonth: 1000,
      aiAnalysesPerMonth: 100,
      activeCampaigns: 3,
      integrations: 2,
    },
    priceHint: "R$ 0 / lançamento",
  },
  professional: {
    key: "professional",
    label: "Professional",
    description: "Operação séria de vendas digitais",
    limits: {
      leads: 5000,
      users: 10,
      messagesPerMonth: 10000,
      aiAnalysesPerMonth: 500,
      activeCampaigns: 10,
      integrations: 5,
    },
    priceHint: "em breve",
  },
  agency: {
    key: "agency",
    label: "Agency",
    description: "Times e agências com volume",
    limits: {
      leads: 25000,
      users: 25,
      messagesPerMonth: 50000,
      aiAnalysesPerMonth: 2000,
      activeCampaigns: 25,
      integrations: 15,
    },
    priceHint: "em breve",
  },
  enterprise: {
    key: "enterprise",
    label: "Enterprise",
    description: "Sob consulta",
    limits: {
      leads: null,
      users: null,
      messagesPerMonth: null,
      aiAnalysesPerMonth: null,
      activeCampaigns: null,
      integrations: null,
    },
    priceHint: "sob consulta",
  },
};

export type UsageMetric =
  | "leads"
  | "users"
  | "messagesPerMonth"
  | "aiAnalysesPerMonth"
  | "activeCampaigns"
  | "integrations";

export class PlanLimitError extends Error {
  readonly metric: UsageMetric;
  readonly limit: number | null;

  constructor(metric: UsageMetric, limit: number | null) {
    super(limit === null ? `Limite indisponível para ${metric}.` : `Limite do plano atingido (${metric}: ${limit}).`);
    this.name = "PlanLimitError";
    this.metric = metric;
    this.limit = limit;
  }
}

export function getPlan(plan: string | null | undefined): Plan {
  return PLANS[(plan as PlanKey) ?? "starter"] ?? PLANS.starter;
}

/** Checagem pura: cabe `incoming` unidades a mais? */
export function fitsInLimit(
  plan: Plan,
  metric: UsageMetric,
  current: number,
  incoming: number = 1
): boolean {
  const limit = plan.limits[metric];
  if (limit === null) return true;
  return current + incoming <= limit;
}

export function limitLabel(limit: number | null): string {
  return limit === null ? "Ilimitado" : String(limit);
}
