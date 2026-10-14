import type { CompanySearchQuery, SourceProvider, SearchResultPage } from "./types";

/**
 * MockSourceProvider — modo demonstração sem GOOGLE_PLACES_API_KEY.
 * Determinístico (mesma query → mesmos resultados) para o pipeline ser
 * testável de ponta a ponta. Gera empresas com e sem website — o cenário de
 * oportunidade clássico ("clínicas em São Paulo sem website").
 */

/** Hash simples e determinístico de string. */
function hash(text: string): number {
  let value = 0;
  for (let i = 0; i < text.length; i++) {
    value = (value * 31 + text.charCodeAt(i)) % 100000;
  }
  return value;
}

const SUFFIXES = [
  "Vida",
  "Prime",
  "Centro",
  "Nova",
  "Elite",
  "Real",
  "Solar",
  "Imperial",
  "União",
  "Aurora",
  "Horizonte",
  "Bela Vista",
];

const CATEGORIES_BY_KEYWORD: Array<[RegExp, string]> = [
  [/cl[ií]nica odont/i, "Clínica odontológica"],
  [/cl[ií]nica|sa[uú]de|m[eé]dic/i, "Clínica"],
  [/restaurante|pizzar|lanch/i, "Restaurante"],
  [/advocat|advogad|jur[ií]dic/i, "Escritório de advocacia"],
  [/academia|fitness|cross/i, "Academia de ginástica"],
  [/sal[aã]o|beleza|barbear|est[eé]tic/i, "Salão de beleza"],
  [/loja|store|ecommerce|e-commerce/i, "Loja"],
  [/imobili[aá]ri/i, "Imobiliária"],
];

function categoryFor(keyword: string): string | null {
  for (const [regex, category] of CATEGORIES_BY_KEYWORD) {
    if (regex.test(keyword.toLowerCase())) return category;
  }
  return "Empresa";
}

export const mockSourceProvider: SourceProvider = {
  sourceId: "google_places",
  label: "Google Places (demonstração)",

  async searchCompanies(query: CompanySearchQuery): Promise<SearchResultPage> {
    const total = Math.min(Math.max(query.maxResults, 5), 60);
    const base = hash(`${query.keyword}|${query.location}`.toLowerCase());
    const category = categoryFor(query.keyword);
    const companies = [];

    for (let i = 0; i < total; i++) {
      const seed = (base + i * 7919) % 1000;
      const suffix = SUFFIXES[seed % SUFFIXES.length];
      const hasWebsite = seed % 10 < 3; // 30% sem website = oportunidade
      const hasPhone = seed % 10 < 8;
      const ratingCount = seed % 7 === 0 ? 0 : 20 + (seed % 400);

      companies.push({
        sourceId: "google_places",
        externalId: `mock_place_${query.location.toLowerCase().replace(/\s+/g, "_")}_${i}`,
        name: `${suffix} ${query.keyword.replace(/\b\w/g, (c) => c.toUpperCase())}`,
        address: `Rua ${suffix}, ${(seed % 900) + 1} — ${query.location}`,
        phone: hasPhone ? `+55 11 9${String(seed).padStart(4, "0")}` : null,
        website: hasWebsite
          ? `https://${query.keyword
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^a-z0-9]+/g, "")
              .slice(0, 18)}${i}.com.br`
          : null,
        category,
        rating: ratingCount === 0 ? null : Math.round((3 + (seed % 20) / 10) * 10) / 10,
        userRatingCount: ratingCount,
      });
    }

    return { companies, nextPageToken: null };
  },
};
