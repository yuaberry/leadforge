/**
 * LEADFORGE — regras puras de metas e lucro (determinísticas, testáveis).
 */

/** Contribuição automática: % da comissão (ou valor bruto) da venda paga. */
export function computeAutoContribution(
  percent: number,
  saleAmount: number | null,
  saleCommission: number | null
): number {
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const base = saleCommission ?? saleAmount ?? 0;
  if (base <= 0 || clampedPercent <= 0) return 0;
  return Math.round((base * clampedPercent) / 100 * 100) / 100;
}

export type GoalProgress = {
  contributed: number;
  target: number;
  remaining: number;
  percent: number;
  reached: boolean;
};

export function goalProgress(contributed: number, target: number): GoalProgress {
  const safeTarget = target > 0 ? target : 0;
  const percent = safeTarget > 0 ? Math.min(100, (contributed / safeTarget) * 100) : 0;
  return {
    contributed,
    target: safeTarget,
    remaining: Math.max(0, safeTarget - contributed),
    percent,
    reached: safeTarget > 0 && contributed >= safeTarget,
  };
}

/** Balde mensal (YYYY-MM) — usado nos gráficos do Profit Dashboard. */
export function monthBucket(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export type MonthlyPoint = { month: string; revenue: number; expense: number; profit: number };

/** Agrega lançamentos em série mensal (últimos N meses). */
export function monthlySeries(
  transactions: { type: "revenue" | "expense"; amount: number; occurredAt: string }[],
  months = 6,
  now = new Date()
): MonthlyPoint[] {
  const points: MonthlyPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    points.push({ month, revenue: 0, expense: 0, profit: 0 });
  }
  const index = new Map(points.map((point, i) => [point.month, i]));

  for (const transaction of transactions) {
    const bucket = monthBucket(transaction.occurredAt);
    const target = index.get(bucket);
    if (target === undefined) continue;
    if (transaction.type === "revenue") {
      points[target].revenue += transaction.amount;
    } else {
      points[target].expense += transaction.amount;
    }
  }
  for (const point of points) {
    point.revenue = round2(point.revenue);
    point.expense = round2(point.expense);
    point.profit = round2(point.revenue - point.expense);
  }
  return points;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Rótulos pt-BR curtos para os meses (2026-03 → "mar/26"). */
export function monthLabel(bucket: string): string {
  const [year, month] = bucket.split("-");
  const labels = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const index = Number(month) - 1;
  return `${labels[index] ?? month}/${year.slice(2)}`;
}
