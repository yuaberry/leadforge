import "server-only";

import type { AIProvider, AIProviderKind } from "./types";
import { openRouterProvider } from "./openrouter";
import { mockProvider } from "./mock";

/**
 * Factory — OpenRouter quando a chave existe; mock (demonstração) caso
 * contrário. Nenhuma tela quebra por falta de chave.
 */
export function getAIProvider(): AIProvider {
  if (process.env.OPENROUTER_API_KEY) {
    return openRouterProvider;
  }
  return mockProvider;
}

export function activeAIProviderKind(): AIProviderKind {
  return process.env.OPENROUTER_API_KEY ? "openrouter" : "mock";
}

export { AIProviderError } from "./types";
export { extractJson } from "./json";
