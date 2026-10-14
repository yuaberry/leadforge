/**
 * Configurações da organização — armazenadas em organizations.settings (JSONB).
 * O zod schema correspondente está em src/validators/org.ts.
 */

export type BusinessMode = "affiliate" | "own" | "both";

export type OrgChannels = {
  email: boolean;
  whatsapp: boolean;
};

export type OrgDream = {
  name: string;
  amount: number | null;
  imageUrl: string | null;
  productUrl: string | null;
};

export type OrgSettings = {
  businessMode: BusinessMode | null;
  categories: string[];
  channels: OrgChannels;
  dream: OrgDream | null;
  dreamSkipped: boolean;
  onboardedAt: string | null;
  scoreWeights: OrgScoreWeights;
};

/** Pesos de scoring — chaves de ScoreWeightKey com valores 0..100. */
export type OrgScoreWeights = Record<string, number>;

export const DEFAULT_ORG_SETTINGS: OrgSettings = {
  businessMode: null,
  categories: [],
  channels: { email: false, whatsapp: false },
  dream: null,
  dreamSkipped: false,
  onboardedAt: null,
  scoreWeights: {},
};

/** Categorias sugeridas no onboarding (o usuário pode escolher qualquer uma). */
export const BUSINESS_CATEGORIES = [
  "Infoprodutos",
  "Cursos online",
  "E-books",
  "Mentorias",
  "SaaS / Software",
  "Serviços",
  "Automação / IA",
  "E-commerce",
  "Outro",
] as const;
