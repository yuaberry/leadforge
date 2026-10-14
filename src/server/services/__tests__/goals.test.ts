import { describe, expect, it } from "vitest";

import {
  computeAutoContribution,
  goalProgress,
  monthLabel,
  monthlySeries,
} from "@/server/services/goals";

describe("computeAutoContribution", () => {
  it("aplica o percentual sobre a comissão quando existe", () => {
    expect(computeAutoContribution(30, 297, 148.5)).toBe(44.55);
  });

  it("usa o valor bruto quando não há comissão", () => {
    expect(computeAutoContribution(50, 200, null)).toBe(100);
  });

  it("retorna 0 para venda sem valor", () => {
    expect(computeAutoContribution(30, null, null)).toBe(0);
  });

  it("limita o percentual a 0-100", () => {
    expect(computeAutoContribution(150, 100, null)).toBe(100);
    expect(computeAutoContribution(-10, 100, null)).toBe(0);
  });
});

describe("goalProgress", () => {
  it("calcula percentual e restante", () => {
    const progress = goalProgress(300, 1000);
    expect(progress.percent).toBe(30);
    expect(progress.remaining).toBe(700);
    expect(progress.reached).toBe(false);
  });

  it("detecta meta atingida (e trava em 100%)", () => {
    const progress = goalProgress(1200, 1000);
    expect(progress.percent).toBe(100);
    expect(progress.reached).toBe(true);
    expect(progress.remaining).toBe(0);
  });

  it("meta sem alvo não conta como atingida", () => {
    const progress = goalProgress(50, 0);
    expect(progress.reached).toBe(false);
    expect(progress.percent).toBe(0);
  });
});

describe("monthlySeries", () => {
  const fixedNow = new Date("2026-10-15T12:00:00Z");

  it("agrega 6 meses com receita, despesa e lucro", () => {
    const series = monthlySeries(
      [
        { type: "revenue", amount: 1000, occurredAt: "2026-10-01T10:00:00Z" },
        { type: "revenue", amount: 500, occurredAt: "2026-10-05T10:00:00Z" },
        { type: "expense", amount: 300, occurredAt: "2026-10-06T10:00:00Z" },
        { type: "revenue", amount: 700, occurredAt: "2026-09-06T10:00:00Z" },
        { type: "revenue", amount: 999, occurredAt: "2025-01-01T10:00:00Z" }, // fora da janela
      ],
      6,
      fixedNow
    );

    expect(series).toHaveLength(6);
    const october = series[5];
    expect(october.month).toBe("2026-10");
    expect(october.revenue).toBe(1500);
    expect(october.expense).toBe(300);
    expect(october.profit).toBe(1200);
    const september = series[4];
    expect(september.revenue).toBe(700);
    // fora da janela ignorado
    expect(series[0].revenue).toBe(0);
  });
});

describe("monthLabel", () => {
  it("formata mês em pt-BR curto", () => {
    expect(monthLabel("2026-10")).toBe("out/26");
    expect(monthLabel("2026-01")).toBe("jan/26");
  });
});
