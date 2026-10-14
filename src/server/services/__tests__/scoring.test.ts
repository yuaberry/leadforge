import { describe, expect, it } from "vitest";

import {
  classify,
  computeLeadScore,
  signalsFromRawInput,
  AI_NEED_THRESHOLD,
} from "@/server/services/scoring";
import { DEFAULT_SCORE_WEIGHTS } from "@/validators/scoring";

describe("classify", () => {
  it("respeita as faixas da spec", () => {
    expect(classify(0)).toBe("cold");
    expect(classify(30)).toBe("cold");
    expect(classify(31)).toBe("warm");
    expect(classify(60)).toBe("warm");
    expect(classify(61)).toBe("hot");
    expect(classify(80)).toBe("hot");
    expect(classify(81)).toBe("priority");
    expect(classify(100)).toBe("priority");
  });
});

describe("computeLeadScore", () => {
  it("lead sem website e sem contato → cold/fraco", () => {
    const result = computeLeadScore(
      {
        hasWebsite: false,
        oldWebsite: false,
        socialActive: false,
        established: false,
        manyReviews: false,
        contactAvailable: false,
        segmentMatch: false,
        aiNeed: false,
      },
      DEFAULT_SCORE_WEIGHTS
    );
    // sem website aplica mesmo sem contato (sinal de oportunidade)
    expect(result.total).toBe(DEFAULT_SCORE_WEIGHTS.no_website);
    expect(result.classification).toBe("cold");
  });

  it("lead com tudo (ideal para venda) → high score", () => {
    const result = computeLeadScore(
      {
        hasWebsite: false,
        oldWebsite: false,
        socialActive: true,
        established: true,
        manyReviews: false,
        contactAvailable: true,
        segmentMatch: true,
        aiNeed: true,
      },
      DEFAULT_SCORE_WEIGHTS
    );
    const expected =
      DEFAULT_SCORE_WEIGHTS.no_website +
      DEFAULT_SCORE_WEIGHTS.social_active +
      DEFAULT_SCORE_WEIGHTS.established +
      DEFAULT_SCORE_WEIGHTS.contact_available +
      DEFAULT_SCORE_WEIGHTS.segment_match +
      DEFAULT_SCORE_WEIGHTS.ai_need;
    expect(result.total).toBe(expected);
    expect(result.classification).toBe("hot"); // 80 pontos = limite superior de hot
  });

  it("limita o total a 100 mesmo com pesos altos", () => {
    const result = computeLeadScore(
      {
        hasWebsite: false,
        oldWebsite: false,
        socialActive: true,
        established: true,
        manyReviews: true,
        contactAvailable: true,
        segmentMatch: true,
        aiNeed: true,
      },
      { no_website: 60, social_active: 40, established: 40, many_reviews: 40, contact_available: 40, segment_match: 40, old_website: 0, ai_need: 40 }
    );
    expect(result.total).toBe(100);
  });

  it("respeita pesos customizados (zerar um sinal)", () => {
    const result = computeLeadScore(
      {
        hasWebsite: false,
        oldWebsite: false,
        socialActive: false,
        established: false,
        manyReviews: false,
        contactAvailable: false,
        segmentMatch: false,
        aiNeed: false,
      },
      { ...DEFAULT_SCORE_WEIGHTS, no_website: 0 }
    );
    expect(result.total).toBe(0);
  });

  it("website presente desativa o sinal de website inexistente", () => {
    const result = computeLeadScore(
      {
        hasWebsite: true,
        oldWebsite: false,
        socialActive: false,
        established: false,
        manyReviews: false,
        contactAvailable: false,
        segmentMatch: false,
        aiNeed: false,
      },
      DEFAULT_SCORE_WEIGHTS
    );
    expect(result.total).toBe(0);
    expect(result.breakdown.find((b) => b.key === "no_website")?.applied).toBe(false);
  });
});

describe("signalsFromRawInput", () => {
  it("deriva sinais da entrada de import/captura", () => {
    const signals = signalsFromRawInput({
      companyName: "Clínica Vale",
      website: null,
      category: "Saúde",
      city: "São Paulo",
      state: "SP",
      email: "contato@vale.com",
      phone: "11987654321",
      orgCategories: ["Saúde", "Serviços"],
    });

    expect(signals.hasWebsite).toBe(false);
    expect(signals.established).toBe(true);
    expect(signals.contactAvailable).toBe(true);
    expect(signals.segmentMatch).toBe(true);
    expect(signals.aiNeed).toBe(false);
  });

  it("segmento só casa quando a org tem categorias", () => {
    const signals = signalsFromRawInput({
      companyName: "X",
      category: "Saúde",
    });
    expect(signals.segmentMatch).toBe(false);
  });

  it("threshold da IA é 60", () => {
    expect(AI_NEED_THRESHOLD).toBe(60);
  });
});
