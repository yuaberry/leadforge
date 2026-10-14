import { describe, expect, it } from "vitest";

import { parsePlacesResponse } from "@/server/providers/sources/places-parser";
import { mockSourceProvider } from "@/server/providers/sources/mock";

describe("parsePlacesResponse", () => {
  it("normaliza payload típico da Places API (New)", () => {
    const page = parsePlacesResponse({
      places: [
        {
          id: "ChIJabc",
          displayName: { text: "Clínica Vida" },
          formattedAddress: "R. Augusta, 123 - São Paulo/SP",
          nationalPhoneNumber: "+55 11 98765-4321",
          websiteUri: "https://clinicavida.com.br",
          primaryTypeDisplayName: { text: "Clínica odontológica" },
          rating: 4.6,
          userRatingCount: 137,
        },
      ],
      nextPageToken: "tok_1",
    });

    expect(page.companies).toHaveLength(1);
    expect(page.companies[0]).toEqual({
      sourceId: "google_places",
      externalId: "ChIJabc",
      name: "Clínica Vida",
      address: "R. Augusta, 123 - São Paulo/SP",
      phone: "+55 11 98765-4321",
      website: "https://clinicavida.com.br",
      category: "Clínica odontológica",
      rating: 4.6,
      userRatingCount: 137,
    });
    expect(page.nextPageToken).toBe("tok_1");
  });

  it("tolera places incompletos e payloads vazios", () => {
    expect(parsePlacesResponse({})).toEqual({ companies: [], nextPageToken: null });
    expect(parsePlacesResponse({ places: [{}, { id: "x" }] }).companies).toHaveLength(1);
    expect(parsePlacesResponse("lixo").companies).toHaveLength(0);
  });
});

describe("mockSourceProvider (modo demonstração)", () => {
  it("é determinístico para a mesma query", async () => {
    const query = { keyword: "clínica odontológica", location: "São Paulo", maxResults: 20 };
    const first = await mockSourceProvider.searchCompanies(query);
    const second = await mockSourceProvider.searchCompanies(query);

    expect(first.companies).toEqual(second.companies);
    expect(first.companies).toHaveLength(20);
  });

  it("gera empresas com e sem website (cenário de oportunidade)", async () => {
    const page = await mockSourceProvider.searchCompanies({
      keyword: "clínica odontológica",
      location: "Recife",
      maxResults: 60,
    });
    expect(page.companies).toHaveLength(60);
    expect(page.companies.some((c) => c.website === null)).toBe(true);
    expect(page.companies.some((c) => c.website !== null)).toBe(true);
    expect(page.companies.every((c) => c.externalId.length > 0)).toBe(true);
  });

  it("categoriza pelo keyword", async () => {
    const page = await mockSourceProvider.searchCompanies({
      keyword: "restaurante",
      location: "Curitiba",
      maxResults: 5,
    });
    expect(page.companies[0].category).toBe("Restaurante");
  });
});
