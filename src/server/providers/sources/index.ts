import "server-only";

import type { SourceProvider } from "./types";
import { googlePlacesProvider } from "./google-places";
import { mockSourceProvider } from "./mock";

/**
 * Factory — Google Places quando a chave existe; mock determinístico
 * caso contrário (o pipeline de discovery é 100% testável sem chave).
 */
export function getSourceProvider(): SourceProvider {
  return process.env.GOOGLE_PLACES_API_KEY ? googlePlacesProvider : mockSourceProvider;
}

export function sourceProviderKind(): "google_places" | "mock" {
  return process.env.GOOGLE_PLACES_API_KEY ? "google_places" : "mock";
}

export { SourceProviderError } from "./types";
export { parsePlacesResponse } from "./places-parser";
