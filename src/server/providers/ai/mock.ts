import {
  AIProviderError,
  leadAnalysisResponseSchema,
  type AIProvider,
  type GeneratedMessage,
  type LeadAnalysisInput,
  type LeadAnalysisResult,
  type MessageGenerationInput,
} from "./types";

/**
 * MockProvider — modo demonstração quando não há OPENROUTER_API_KEY.
 *
 * Determinístico (testável), constrói a análise a partir dos DADOS REAIS do
 * lead — nunca inventa. O UI mostra claramente "modo demonstração".
 */

const TONE_OPENERS: Record<string, string> = {
  profissional: "Olá",
  amigavel: "Oi, tudo bem?",
  direto: "Oi",
  consultivo: "Olá",
  premium: "Olá",
};

function heuristicOpportunityScore(input: LeadAnalysisInput): number {
  let score = 40;
  if (!input.lead.companyWebsite) score += 30;
  if (input.lead.companyCity) score += 5;
  if (input.lead.contactEmail || input.lead.contactPhone) score += 10;
  if (input.products.length > 0) score += 5;
  return Math.min(100, score);
}

export const mockProvider: AIProvider = {
  kind: "mock",
  model: "demonstração",

  async generateText() {
    return "(modo demonstração — configure OPENROUTER_API_KEY para respostas reais)";
  },

  async analyzeLead(input: LeadAnalysisInput): Promise<LeadAnalysisResult> {
    const lead = input.lead;
    const product = input.products[0] ?? null;
    const opportunityScore = heuristicOpportunityScore(input);

    const raw = {
      who_is_this:
        `${lead.companyName ? `${lead.contactName ?? "Contato"} da empresa ${lead.companyName}` : lead.contactName ?? "Lead captado"}${lead.companyCategory ? `, segmento ${lead.companyCategory}` : ""}${lead.companyCity ? `, em ${lead.companyCity}` : ""}.`,
      probable_need: lead.companyWebsite
        ? "Presença digital existe; provavelmente busca converter mais visitantes em clientes."
        : "Não possui website próprio — perde vendas de quem pesquisa antes de comprar.",
      commercial_problem: lead.companyWebsite
        ? "Canais digitais provavelmente não estão gerando volume previsível de novos clientes."
        : "Clientes não encontram a empresa online; a concorrência que aparece primeiro leva a venda.",
      recommended_product_id: product?.id ?? null,
      opportunity_score: opportunityScore,
      suggested_offer: product
        ? `${product.name} — aplicado ao contexto de ${lead.companyCategory ?? "negócio"}${lead.companyCity ? ` em ${lead.companyCity}` : ""}.`
        : "Configure produtos no catálogo para receber uma oferta recomendada.",
      price_range: product?.price ? `a partir de R$ ${product.price}` : null,
      argument: lead.companyWebsite
        ? "Estruturar um fluxo de aquisição previsível (captura + follow-up) com o que já existe."
        : "Um website profissional com página de captura e WhatsApp resolve a invisibilidade online.",
      channel: lead.contactPhone ? "whatsapp" : "email",
      facts: [
        lead.contactName ? `Nome do contato: ${lead.contactName}` : "Nome do contato não informado",
        lead.companyName ? `Empresa: ${lead.companyName}` : "Empresa não informada",
        lead.companyWebsite ? `Website: ${lead.companyWebsite}` : "Não possui website",
        lead.contactEmail ? `E-mail disponível: ${lead.contactEmail}` : "E-mail não informado",
        lead.contactPhone ? `Telefone disponível: ${lead.contactPhone}` : "Telefone não informado",
        `Origem do lead: ${lead.source}`,
      ],
      inferences: [
        lead.companyWebsite
          ? "Já investe em presença digital — tende a valorizar soluções de conversão."
          : "A ausência de website sugere dependência de indicação ou tráfego pago de terceiros.",
      ],
      hypotheses: [
        "Pode estar insatisfeita com o volume atual de clientes (não verificado).",
        "Possui orçamento para investir em solução digital (hipótese).",
      ],
    };

    const parsed = leadAnalysisResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AIProviderError("Mock produziu análise inválida (bug interno).");
    }

    return {
      whoIsThis: parsed.data.who_is_this,
      probableNeed: parsed.data.probable_need,
      commercialProblem: parsed.data.commercial_problem,
      recommendedProductId: parsed.data.recommended_product_id,
      opportunityScore: parsed.data.opportunity_score,
      suggestedOffer: parsed.data.suggested_offer,
      priceRange: parsed.data.price_range,
      argument: parsed.data.argument,
      channel: parsed.data.channel,
      facts: parsed.data.facts,
      inferences: parsed.data.inferences,
      hypotheses: parsed.data.hypotheses,
    };
  },

  async generateMessage(input: MessageGenerationInput): Promise<GeneratedMessage> {
    const lead = input.lead;
    const opener = TONE_OPENERS[input.tone] ?? "Olá";
    const name = lead.contactName?.split(" ")[0] ?? "tudo bem";
    const product = input.product;

    const lines: string[] = [];
    lines.push(`${opener}, ${name}!`);
    lines.push(
      lead.companyName
        ? `Vi o trabalho de vocês${lead.companyCategory ? ` no segmento ${lead.companyCategory}` : ""}${lead.companyCity ? ` aí em ${lead.companyCity}` : ""} e identifiquei uma oportunidade direta.`
        : "Trabalho ajudando negócios a vender mais através do digital e identifiquei uma oportunidade para você."
    );
    lines.push(
      input.analysis?.probableNeed ??
        (lead.companyWebsite
          ? "A ideia é transformar a presença digital que vocês já têm em um fluxo previsível de novos clientes."
          : "Hoje quem pesquisa vocês online não encontra nada — um website profissional com WhatsApp resolve isso e começa a gerar contato direto.")
    );
    if (product) {
      lines.push(`A aplicação ideal aqui é: ${product.name}.`);
    }
    if (input.trackedLink) {
      lines.push(`Quer ver como funciona? Está tudo aqui: ${input.trackedLink}`);
    }
    lines.push("Se fizer sentido, me responde por aqui que eu detalho. 👊");

    const body = lines.join(input.channel === "whatsapp" ? "\n" : "\n\n");

    if (input.channel === "email") {
      const subject = product
        ? `${lead.companyName ?? lead.contactName ?? "Para você"} — ${product.name}`
        : "Uma ideia para gerar mais clientes pelo digital";
      return { subject, body };
    }

    return { subject: null, body: body.slice(0, 600) };
  },
};

export type { MessageGenerationInput };
