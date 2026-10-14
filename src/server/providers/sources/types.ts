/**
 * LEADFORGE — SourceProvider
 *
 * Abstração de fontes de dados de empresas. Google Places (New) inicial;
 * CSV/manual já existem como fontes internas. Providers futuros (APIs
 * autorizadas de terceiros) implementam a mesma interface.
 *
 * Regras de ouro (plano §1/§44):
 *  - apenas APIs oficiais; jamais scraping, bypass de CAPTCHA/rate limit;
 *  - armazenar somente campos permitidos pelos termos da fonte;
 *  - o external_id é a chave de dedup e refresh da fonte.
 */

export type CompanySearchQuery = {
  /** Segmento/palavra-chave (ex.: "clínica odontológica"). */
  keyword: string;
  /** Localização (cidade/região, ex.: "São Paulo"). */
  location: string;
  /** Máximo de resultados (20-60 para Places). */
  maxResults: number;
};

export type RawCompany = {
  sourceId: string;
  externalId: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  category: string | null;
  rating: number | null;
  userRatingCount: number | null;
};

export type SearchResultPage = {
  companies: RawCompany[];
  nextPageToken: string | null;
};

export interface SourceProvider {
  readonly sourceId: string;
  readonly label: string;
  searchCompanies(query: CompanySearchQuery): Promise<SearchResultPage>;
}

export class SourceProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceProviderError";
  }
}
