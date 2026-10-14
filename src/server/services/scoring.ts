import {
  DEFAULT_SCORE_WEIGHTS,
  SCORE_WEIGHT_KEYS,
  SCORE_WEIGHT_LABELS,
  type ScoreClassification,
  type ScoreWeightKey,
} from "@/validators/scoring";

/**
 * LEADFORGE — Engine de pontuação (pura e determinística).
 *
 * A IA NÃO pontua: ela fornece SINAIS (necessidade detectada) que entram
 * com o peso configurado. Toda a matemática é auditável aqui.
 */

export type ScoreSignals = {
  hasWebsite: boolean;
  oldWebsite: boolean;
  socialActive: boolean;
  established: boolean;
  manyReviews: boolean;
  contactAvailable: boolean;
  segmentMatch: boolean;
  aiNeed: boolean;
};

export type ScoreBreakdownItem = {
  key: ScoreWeightKey;
  label: string;
  points: number;
  applied: boolean;
};

export type ScoreResult = {
  total: number;
  classification: ScoreClassification;
  breakdown: ScoreBreakdownItem[];
};

export const AI_NEED_THRESHOLD = 60;

export function classify(total: number): ScoreClassification {
  if (total > 80) return "priority";
  if (total > 60) return "hot";
  if (total > 30) return "warm";
  return "cold";
}

export function computeLeadScore(
  signals: ScoreSignals,
  weights: Partial<Record<ScoreWeightKey, number>> = DEFAULT_SCORE_WEIGHTS
): ScoreResult {
  const appliedByKey: Record<ScoreWeightKey, boolean> = {
    no_website: !signals.hasWebsite,
    old_website: signals.hasWebsite && signals.oldWebsite,
    social_active: signals.socialActive,
    established: signals.established,
    many_reviews: signals.manyReviews,
    contact_available: signals.contactAvailable,
    segment_match: signals.segmentMatch,
    ai_need: signals.aiNeed,
  };

  let total = 0;
  const breakdown: ScoreBreakdownItem[] = SCORE_WEIGHT_KEYS.map((key) => {
    const points = weights[key] ?? DEFAULT_SCORE_WEIGHTS[key] ?? 0;
    const applied = appliedByKey[key];
    if (applied) total += points;
    return { key, label: SCORE_WEIGHT_LABELS[key], points, applied };
  });

  total = Math.min(100, total);

  return { total, classification: classify(total), breakdown };
}

/**
 * Deriva os sinais dos dados do lead (normalizados).
 * `latestAnalysisOpportunityScore` alimenta o sinal da IA quando existir
 * análise recente com score >= AI_NEED_THRESHOLD.
 */
export function signalsFromLeadData(input: {
  company: {
    website: string | null;
    instagram: string | null;
    facebook: string | null;
    linkedin: string | null;
    city: string | null;
    state: string | null;
    addressLine: string | null;
    phone: string | null;
    category: string | null;
    externalId: string | null;
  } | null;
  contact: {
    email: string | null;
    phone: string | null;
  } | null;
  orgCategories: string[];
  latestAnalysisOpportunityScore: number | null;
}): ScoreSignals {
  const company = input.company;
  const contact = input.contact;
  const category = (company?.category ?? "").trim().toLowerCase();

  return {
    hasWebsite: Boolean(company?.website),
    // Detecção de "website antigo" exige análise (Phase 8/9); sinal honesto: false.
    oldWebsite: false,
    socialActive: Boolean(
      company && (company.instagram || company.facebook || company.linkedin)
    ),
    established: Boolean(
      company &&
        (company.city || company.state || company.addressLine) &&
        (company.phone || contact?.email || contact?.phone)
    ),
    manyReviews: false, // disponível com Google Places (Phase 8)
    contactAvailable: Boolean(contact?.email || contact?.phone || company?.phone),
    segmentMatch:
      input.orgCategories.length > 0 &&
      category.length > 0 &&
      input.orgCategories.some(
        (orgCategory) =>
          orgCategory.trim().toLowerCase() === category ||
          orgCategory.trim().toLowerCase().includes(category) ||
          category.includes(orgCategory.trim().toLowerCase())
      ),
    aiNeed:
      input.latestAnalysisOpportunityScore !== null &&
      input.latestAnalysisOpportunityScore >= AI_NEED_THRESHOLD,
  };
}

/** Sinais a partir dos dados brutos no momento da criação (import/captura/manual). */
export function signalsFromRawInput(input: {
  companyName?: string | null;
  website?: string | null;
  category?: string | null;
  city?: string | null;
  state?: string | null;
  email?: string | null;
  phone?: string | null;
  orgCategories?: string[];
}): ScoreSignals {
  return signalsFromLeadData({
    company: input.companyName
      ? {
          website: input.website ?? null,
          instagram: null,
          facebook: null,
          linkedin: null,
          city: input.city ?? null,
          state: input.state ?? null,
          addressLine: null,
          phone: input.phone ?? null,
          category: input.category ?? null,
          externalId: null,
        }
      : null,
    contact: { email: input.email ?? null, phone: input.phone ?? null },
    orgCategories: input.orgCategories ?? [],
    latestAnalysisOpportunityScore: null,
  });
}
