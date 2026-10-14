/**
 * Parser da Places API (New) — função pura e tolerante.
 *
 * Resposta de referência (POST places:searchText):
 * {
 *   "places": [{
 *     "id": "ChIJ...",
 *     "displayName": {"text": "Clínica Vida"},
 *     "formattedAddress": "R. Augusta, 123 - São Paulo/SP",
 *     "nationalPhoneNumber": "+55 11 98765-4321",
 *     "websiteUri": "https://clinica.com.br",
 *     "primaryTypeDisplayName": {"text": "Clínica odontológica"},
 *     "rating": 4.6,
 *     "userRatingCount": 137
 *   }],
 *   "nextPageToken": "..."
 * }
 */

import type { RawCompany, SearchResultPage } from "./types";

type Json = Record<string, unknown>;

function isJson(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parsePlacesResponse(raw: unknown): SearchResultPage {
  if (!isJson(raw) || !Array.isArray(raw.places)) {
    return { companies: [], nextPageToken: null };
  }

  const companies: RawCompany[] = [];
  for (const place of raw.places) {
    if (!isJson(place) || typeof place.id !== "string") continue;
    const displayName = isJson(place.displayName) && typeof place.displayName.text === "string"
      ? place.displayName.text
      : null;

    companies.push({
      sourceId: "google_places",
      externalId: place.id,
      name: displayName ?? "(sem nome)",
      address: typeof place.formattedAddress === "string" ? place.formattedAddress : null,
      phone: typeof place.nationalPhoneNumber === "string" ? place.nationalPhoneNumber : null,
      website: typeof place.websiteUri === "string" ? place.websiteUri : null,
      category:
        isJson(place.primaryTypeDisplayName) &&
        typeof place.primaryTypeDisplayName.text === "string"
          ? place.primaryTypeDisplayName.text
          : null,
      rating: typeof place.rating === "number" ? place.rating : null,
      userRatingCount: typeof place.userRatingCount === "number" ? place.userRatingCount : null,
    });
  }

  return {
    companies,
    nextPageToken: typeof raw.nextPageToken === "string" ? raw.nextPageToken : null,
  };
}
