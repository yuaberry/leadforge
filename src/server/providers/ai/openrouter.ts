import "server-only";

import {
  AIProviderError,
  leadAnalysisResponseSchema,
  messageResponseSchema,
  type AIProvider,
  type GeneratedMessage,
  type LeadAnalysisInput,
  type LeadAnalysisResult,
  type MessageGenerationInput,
} from "./types";
import { extractJson } from "./json";
import { buildAnalysisPrompts, buildMessagePrompts } from "./prompts";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = process.env.AI_MODEL || "openai/gpt-4o-mini";
const REQUEST_TIMEOUT_MS = 90_000;

type ChatMessage = { role: "system" | "user"; content: string };

async function chat(
  messages: ChatMessage[],
  options: { temperature?: number; maxTokens?: number; jsonMode: boolean }
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new AIProviderError("OPENROUTER_API_KEY não configurada.");
  }

  const body: Record<string, unknown> = {
    model: DEFAULT_MODEL,
    messages,
    temperature: options.temperature ?? 0.4,
    max_tokens: options.maxTokens ?? 1600,
  };
  if (options.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "LeadForge",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new AIProviderError("A IA demorou demais para responder (timeout).");
    }
    throw new AIProviderError("Falha de rede ao contactar a OpenRouter.");
  } finally {
    clearTimeout(timeout);
  }

  // Alguns modelos não aceitam response_format — retry sem json_mode
  if (response.status === 400 && options.jsonMode) {
    return chat(messages, { ...options, jsonMode: false });
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new AIProviderError(
      `OpenRouter respondeu ${response.status}${text ? `: ${text.slice(0, 200)}` : ""}`
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new AIProviderError("Resposta da OpenRouter sem conteúdo.");
  }
  return content;
}

export const openRouterProvider: AIProvider = {
  kind: "openrouter",
  model: DEFAULT_MODEL,

  async generateText(request) {
    return chat(
      [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userPrompt },
      ],
      { temperature: request.temperature, maxTokens: request.maxTokens, jsonMode: false }
    );
  },

  async analyzeLead(input: LeadAnalysisInput): Promise<LeadAnalysisResult> {
    const { systemPrompt, userPrompt } = buildAnalysisPrompts(input);
    const content = await chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.3, jsonMode: true }
    );

    const parsedJson = extractJson(content);
    const parsed = leadAnalysisResponseSchema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new AIProviderError("Resposta da IA fora do formato esperado.");
    }

    // recommended_product_id precisa pertencer ao catálogo — nunca confiar cegamente
    const validProduct =
      parsed.data.recommended_product_id &&
      input.products.some((p) => p.id === parsed.data.recommended_product_id)
        ? parsed.data.recommended_product_id
        : null;

    return {
      whoIsThis: parsed.data.who_is_this,
      probableNeed: parsed.data.probable_need,
      commercialProblem: parsed.data.commercial_problem,
      recommendedProductId: validProduct,
      opportunityScore: Math.round(parsed.data.opportunity_score),
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
    const { systemPrompt, userPrompt } = buildMessagePrompts(input);
    const content = await chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.7, maxTokens: 1200, jsonMode: true }
    );

    const parsed = messageResponseSchema.safeParse(extractJson(content));
    if (!parsed.success) {
      throw new AIProviderError("Resposta da IA fora do formato esperado.");
    }

    const subject = input.channel === "email" ? parsed.data.subject : null;
    return {
      subject,
      body: parsed.data.body,
    };
  },
};
