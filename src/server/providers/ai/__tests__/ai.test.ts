import { describe, expect, it } from "vitest";

import { extractJson } from "@/server/providers/ai/json";
import { mockProvider } from "@/server/providers/ai/mock";
import {
  buildAnalysisPrompts,
  buildMessagePrompts,
} from "@/server/providers/ai/prompts";

describe("extractJson", () => {
  it("parse JSON direto", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("parse JSON cercado de fence ```json", () => {
    expect(extractJson('Aqui está:\n```json\n{"a": 2}\n```\nFim')).toEqual({ a: 2 });
  });

  it("parse JSON com texto ao redor", () => {
    expect(extractJson('Claro! {"a": 3, "b": {"c": 4}} Espero ajudar.')).toEqual({
      a: 3,
      b: { c: 4 },
    });
  });

  it("encontra o bloco balanceado correto entre chaves aninhadas", () => {
    const text = 'intro {"x": {"y": 1}} texto {"descartar": true}';
    expect(extractJson(text)).toEqual({ x: { y: 1 } });
  });

  it("lança para texto sem JSON", () => {
    expect(() => extractJson("sem json aqui { incompleto")).toThrow();
  });
});

describe("prompts", () => {
  it("prompt de análise embute as regras anti-alucinação e o catálogo", () => {
    const { systemPrompt, userPrompt } = buildAnalysisPrompts({
      lead: {
        contactName: "Maria",
        contactEmail: "maria@x.com",
        contactPhone: null,
        companyName: "Loja X",
        companyWebsite: null,
        companyCategory: "Moda",
        companyCity: "Recife",
        companyState: "PE",
        notes: null,
        source: "captura",
        consentStatus: "granted",
      },
      products: [
        {
          id: "prod-1",
          name: "Website Pro",
          type: "own",
          category: "Serviços",
          targetAudience: "lojas locais",
          sellingArguments: ["entrega em 7 dias"],
          price: 1500,
        },
      ],
      orgCategories: ["Moda"],
    });

    expect(systemPrompt).toContain("hypotheses");
    expect(systemPrompt).toContain("recommended_product_id");
    expect(userPrompt).toContain("prod-1");
    expect(userPrompt).toContain("Loja X");
    expect(userPrompt).toContain("não possui");
  });

  it("prompt de mensagem embute tom, canal e link rastreado", () => {
    const { systemPrompt, userPrompt } = buildMessagePrompts({
      channel: "whatsapp",
      tone: "direto",
      goal: "agendar conversa",
      lead: {
        contactName: "João",
        contactEmail: null,
        contactPhone: "5581...",
        companyName: "Padaria X",
        companyWebsite: null,
        companyCategory: "Alimentos",
        companyCity: "Olinda",
        companyState: "PE",
        notes: null,
        source: "captura",
        consentStatus: "granted",
      },
      product: { id: "p1", name: "Website", category: null },
      analysis: {
        argument: "Invisibilidade online",
        probableNeed: "website",
        suggestedOffer: "Website + WhatsApp",
      },
      trackedLink: "https://app/go/abc",
    });

    expect(systemPrompt).toContain("direto");
    expect(systemPrompt).toContain("WhatsApp");
    expect(userPrompt).toContain("https://app/go/abc");
    expect(userPrompt).toContain("Padaria X");
  });
});

describe("mockProvider", () => {
  const input = {
    lead: {
      contactName: "Maria Silva",
      contactEmail: "maria@x.com",
      contactPhone: null,
      companyName: "Clínica Vale",
      companyWebsite: null,
      companyCategory: "Saúde",
      companyCity: "São Paulo",
      companyState: "SP",
      notes: null,
      source: "captura",
      consentStatus: "granted",
    },
    products: [
      {
        id: "prod-1",
        name: "Website Profissional",
        type: "own",
        category: "Serviços",
        targetAudience: "clínicas",
        sellingArguments: ["entrega em 7 dias"],
        price: 1500,
      },
    ],
    orgCategories: ["Saúde"],
  };

  it("análise é determinística e usa dados reais", async () => {
    const first = await mockProvider.analyzeLead(input);
    const second = await mockProvider.analyzeLead(input);

    expect(first).toEqual(second);
    expect(first.whoIsThis).toContain("Clínica Vale");
    expect(first.recommendedProductId).toBe("prod-1");
    expect(first.facts.some((f) => f.includes("Não possui website"))).toBe(true);
    expect(first.opportunityScore).toBeGreaterThan(60);
  });

  it("mensagem respeita o canal e inclui o link", async () => {
    const message = await mockProvider.generateMessage({
      channel: "whatsapp",
      tone: "amigavel",
      goal: "agendar",
      lead: input.lead,
      product: { id: "prod-1", name: "Website Profissional", category: "Serviços" },
      analysis: {
        argument: "invisibilidade online",
        probableNeed: "website",
        suggestedOffer: "Website + WhatsApp",
      },
      trackedLink: "https://x.com/go/tok",
    });

    expect(message.subject).toBeNull();
    expect(message.body).toContain("Website Profissional");
    expect(message.body).toContain("https://x.com/go/tok");
    expect(message.body.length).toBeLessThanOrEqual(600);
  });

  it("e-mail gera assunto", async () => {
    const message = await mockProvider.generateMessage({
      channel: "email",
      tone: "profissional",
      goal: "apresentar",
      lead: input.lead,
      product: { id: "prod-1", name: "Website Profissional", category: null },
      analysis: null,
      trackedLink: null,
    });
    expect(message.subject).toBeTruthy();
    expect(message.body).not.toHaveLength(0);
  });
});
