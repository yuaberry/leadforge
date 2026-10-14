import { z } from "zod";

/**
 * LEADFORGE — AIProvider
 *
 * Abstração única para o assistente de vendas (OpenRouter inicial;
 * qualquer provider HTTP/SDK pode ser adicionado sem tocar o negócio).
 * A chave vive APENAS em environment variables (server-only).
 */

export type AIProviderKind = "openrouter" | "mock";

export type AIRequest = {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
};

export type LeadAnalysisInput = {
  lead: {
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    companyName: string | null;
    companyWebsite: string | null;
    companyCategory: string | null;
    companyCity: string | null;
    companyState: string | null;
    notes: string | null;
    source: string;
    consentStatus: string;
  };
  products: Array<{
    id: string;
    name: string;
    type: string;
    category: string | null;
    targetAudience: string | null;
    sellingArguments: string[];
    price: number | null;
  }>;
  orgCategories: string[];
};

export type LeadAnalysisResult = {
  whoIsThis: string;
  probableNeed: string;
  commercialProblem: string;
  recommendedProductId: string | null;
  opportunityScore: number;
  suggestedOffer: string;
  priceRange: string | null;
  argument: string;
  channel: "whatsapp" | "email" | null;
  facts: string[];
  inferences: string[];
  hypotheses: string[];
};

export type MessageGenerationInput = {
  channel: "whatsapp" | "email";
  tone: string;
  goal: string;
  lead: LeadAnalysisInput["lead"];
  product: { id: string; name: string; category: string | null } | null;
  analysis: { argument: string; probableNeed: string; suggestedOffer: string } | null;
  trackedLink: string | null;
};

export type GeneratedMessage = {
  subject: string | null;
  body: string;
};

export interface AIProvider {
  readonly kind: AIProviderKind;
  readonly model: string;
  generateText(request: AIRequest): Promise<string>;
  analyzeLead(input: LeadAnalysisInput): Promise<LeadAnalysisResult>;
  generateMessage(input: MessageGenerationInput): Promise<GeneratedMessage>;
}

export class AIProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIProviderError";
  }
}

// ---------- Validação da resposta (tolerante) ----------

export const leadAnalysisResponseSchema = z.object({
  who_is_this: z.string().default(""),
  probable_need: z.string().default(""),
  commercial_problem: z.string().default(""),
  recommended_product_id: z
    .union([z.string(), z.null()])
    .transform((v) => (v && v.length > 0 ? v : null))
    .default(null),
  opportunity_score: z.coerce.number().min(0).max(100).catch(50),
  suggested_offer: z.string().default(""),
  price_range: z.union([z.string(), z.null()]).default(null),
  argument: z.string().default(""),
  channel: z
    .union([z.literal("whatsapp"), z.literal("email"), z.literal(""), z.null()])
    .transform((v) => (v === "" || v === null ? null : (v as "whatsapp" | "email" | null)))
    .default(null),
  facts: z.array(z.string()).default([]),
  inferences: z.array(z.string()).default([]),
  hypotheses: z.array(z.string()).default([]),
});

export const messageResponseSchema = z.object({
  subject: z.union([z.string(), z.null()]).transform((v) => v ?? "").default(""),
  body: z.string().min(1, "Mensagem vazia"),
});
