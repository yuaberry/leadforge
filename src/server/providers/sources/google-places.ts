import "server-only";

import type { CompanySearchQuery, SourceProvider, SearchResultPage } from "./types";
import { SourceProviderError } from "./types";
import { parsePlacesResponse } from "./places-parser";

const PLACES_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

// Campos permitidos pelos ToS do Google — armazenamos apenas estes.
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.primaryTypeDisplayName",
  "places.rating",
  "places.userRatingCount",
  "nextPageToken",
].join(",");

async function searchText(
  apiKey: string,
  body: Record<string, unknown>
): Promise<SearchResultPage> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(PLACES_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      if (response.status === 429) {
        throw new SourceProviderError(
          "Google Places: rate limit atingido. Aguarde e tente de novo — o LeadForge nunca contorna limites."
        );
      }
      throw new SourceProviderError(
        `Google Places ${response.status}${text ? `: ${text.slice(0, 200)}` : ""}`
      );
    }

    return parsePlacesResponse(await response.json());
  } catch (erro) {
    if (erro instanceof SourceProviderError) throw erro;
    if (controller.signal.aborted) throw new SourceProviderError("Places API demorou demais.");
    throw new SourceProviderError("Falha de rede ao contactar a Places API.");
  } finally {
    clearTimeout(timeout);
  }
}

export const googlePlacesProvider: SourceProvider = {
  sourceId: "google_places",
  label: "Google Places",

  async searchCompanies(query: CompanySearchQuery): Promise<SearchResultPage> {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      throw new SourceProviderError("GOOGLE_PLACES_API_KEY não configurada.");
    }

    const textQuery = `${query.keyword} em ${query.location}`;
    const remaining = Math.min(query.maxResults, 60);
    const collected = [];
    let nextPageToken: string | null = null;

    do {
      const page: SearchResultPage = await searchText(apiKey, {
        textQuery,
        languageCode: "pt-BR",
        maxResultCount: Math.min(20, remaining - collected.length),
        ...(nextPageToken ? { pageToken: nextPageToken } : {}),
      });
      collected.push(...page.companies);
      nextPageToken = page.nextPageToken;
    } while (nextPageToken && collected.length < remaining);

    return { companies: collected.slice(0, remaining), nextPageToken };
  },
};

export { parsePlacesResponse };
