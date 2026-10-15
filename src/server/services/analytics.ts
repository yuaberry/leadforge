/**
 * LEADFORGE — métricas de conversão (funções puras, testáveis).
 *
 * Definições honestas (sem vanity metrics):
 *  - Taxa de resposta  = leads que chegaram a "Respondeu+" / leads contatados+
 *  - Taxa de reunião    = leads em "Reunião"+ / leads em "Respondeu"+
 *  - Taxa de conversão = leads "Ganho" / total de leads
 *  - ROI                = (receita − tráfego pago) / tráfego pago
 */

export const STAGE_ORDER = [
  "new",
  "qualified",
  "contacted",
  "replied",
  "meeting",
  "proposal",
  "negotiation",
  "won",
] as const;

export type StageCount = Partial<
  Record<(typeof STAGE_ORDER)[number] | "lost", number>
>;

function atLeast(counts: StageCount, stage: (typeof STAGE_ORDER)[number]): number {
  const index = STAGE_ORDER.indexOf(stage);
  return STAGE_ORDER.slice(index).reduce((sum, key) => sum + (counts[key] ?? 0), 0);
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export type FunnelMetrics = {
  totalLeads: number;
  stages: Array<{ stage: string; count: number; percentOfTotal: number }>;
  responseRate: number | null; // %
  meetingRate: number | null; // %
  conversionRate: number | null; // %
  lostCount: number;
};

export function computeFunnelMetrics(counts: StageCount): FunnelMetrics {
  const totalLeads = STAGE_ORDER.reduce((sum, key) => sum + (counts[key] ?? 0), 0);
  const lostCount = counts.lost ?? 0;

  const contactedPlus = atLeast(counts, "contacted");
  const repliedPlus = atLeast(counts, "replied");
  const meetingPlus = atLeast(counts, "meeting");
  const won = counts.won ?? 0;

  return {
    totalLeads,
    stages: STAGE_ORDER.map((stage) => ({
      stage,
      count: counts[stage] ?? 0,
      percentOfTotal: totalLeads > 0 ? Math.round(((counts[stage] ?? 0) / totalLeads) * 100) : 0,
    })),
    responseRate: rate(repliedPlus, contactedPlus),
    meetingRate: rate(meetingPlus, repliedPlus),
    conversionRate: rate(won, totalLeads),
    lostCount,
  };
}

/** ROI sobre tráfego pago: (receita − adSpend) / adSpend. null sem investimento. */
export function computeRoi(revenue: number, adSpend: number): number | null {
  if (adSpend <= 0) return null;
  return Math.round(((revenue - adSpend) / adSpend) * 100) / 100;
}
