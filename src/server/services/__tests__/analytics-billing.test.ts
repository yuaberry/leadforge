import { describe, expect, it } from "vitest";

import { computeFunnelMetrics, computeRoi } from "@/server/services/analytics";
import { PLANS, fitsInLimit, getPlan } from "@/server/services/billing";

describe("computeFunnelMetrics", () => {
  it("calcula funil e taxas com as definições honestas", () => {
    const metrics = computeFunnelMetrics({
      new: 100,
      qualified: 40,
      contacted: 30,
      replied: 12,
      meeting: 6,
      proposal: 3,
      negotiation: 2,
      won: 2,
      lost: 5,
    });

    // total = 100+40+30+12+6+3+2+2 = 195
    expect(metrics.totalLeads).toBe(195);
    // contatados+ = 30+12+6+3+2+2 = 55; respondidos+ = 12+6+3+2+2 = 25
    expect(metrics.responseRate).toBeCloseTo(45.5, 1);
    // reuniões+ = 6+3+2+2 = 13 sobre respondidos+ 25
    expect(metrics.meetingRate).toBeCloseTo(52, 1);
    expect(metrics.conversionRate).toBeCloseTo(1, 1); // 2/195
    expect(metrics.lostCount).toBe(5);
    expect(metrics.stages).toHaveLength(8);
    expect(metrics.stages[0].percentOfTotal).toBeCloseTo(51, 0);
  });

  it("sem leads → taxas null (nunca divide por zero)", () => {
    const metrics = computeFunnelMetrics({});
    expect(metrics.totalLeads).toBe(0);
    expect(metrics.responseRate).toBeNull();
    expect(metrics.meetingRate).toBeNull();
    expect(metrics.conversionRate).toBeNull();
  });

  it("respondeu direto sem contatados também computa", () => {
    const metrics = computeFunnelMetrics({ contacted: 10, replied: 5, meeting: 5 });
    // contatados+ = 20, respondidos+ = 10 → 50%; reuniões+ = 5 → 50%
    expect(metrics.responseRate).toBe(50);
    expect(metrics.meetingRate).toBe(50);
  });
});

describe("computeRoi", () => {
  it("ROI sobre tráfego pago", () => {
    expect(computeRoi(5000, 1000)).toBe(4);
    expect(computeRoi(800, 1000)).toBe(-0.2);
  });

  it("sem investimento → null (não inventa ROI infinito)", () => {
    expect(computeRoi(1000, 0)).toBeNull();
  });
});

describe("billing — limites", () => {
  it("starter cabe até o limite", () => {
    const starter = getPlan("starter");
    expect(fitsInLimit(starter, "leads", 498, 2)).toBe(true);
    expect(fitsInLimit(starter, "leads", 499, 2)).toBe(false);
    expect(fitsInLimit(starter, "leads", 500, 1)).toBe(false);
  });

  it("enterprise é ilimitado", () => {
    const enterprise = getPlan("enterprise");
    expect(fitsInLimit(enterprise, "leads", 999999, 999999)).toBe(true);
  });

  it("plano desconhecido cai no starter", () => {
    expect(getPlan("x").key).toBe("starter");
    expect(PLANS.professional.limits.messagesPerMonth).toBe(10000);
  });
});
