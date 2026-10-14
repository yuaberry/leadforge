import { z } from "zod";

/**
 * LEADFORGE — Sistema de pontuação (spec §9).
 *
 * Pesos configuráveis por organização (stored em organizations.settings).
 * A IA entra como um SINAL (necessidade detectada) — nunca inventa pontos.
 */

export const SCORE_WEIGHT_KEYS = [
  "no_website",
  "old_website",
  "social_active",
  "established",
  "many_reviews",
  "contact_available",
  "segment_match",
  "ai_need",
] as const;

export type ScoreWeightKey = (typeof SCORE_WEIGHT_KEYS)[number];

export const SCORE_WEIGHT_LABELS: Record<ScoreWeightKey, string> = {
  no_website: "Website inexistente",
  old_website: "Website antigo/fraco",
  social_active: "Presença social ativa",
  established: "Empresa estabelecida",
  many_reviews: "Muitas avaliações (discovery)",
  contact_available: "Contato comercial disponível",
  segment_match: "Segmento compatível",
  ai_need: "Necessidade detectada pela IA",
};

/** Defaults da spec §9. */
export const DEFAULT_SCORE_WEIGHTS: Record<ScoreWeightKey, number> = {
  no_website: 25,
  old_website: 10,
  social_active: 10,
  established: 15,
  many_reviews: 10,
  contact_available: 5,
  segment_match: 10,
  ai_need: 15,
};

const weightField = z.coerce.number().int("Use números inteiros").min(0).max(100);

export const scoreWeightsSchema = z.object({
  no_website: weightField,
  old_website: weightField,
  social_active: weightField,
  established: weightField,
  many_reviews: weightField,
  contact_available: weightField,
  segment_match: weightField,
  ai_need: weightField,
});

export type ScoreWeights = z.infer<typeof scoreWeightsSchema>;

export type ScoreClassification = "cold" | "warm" | "hot" | "priority";

export const CLASSIFICATION_LABELS: Record<ScoreClassification, string> = {
  cold: "Frio",
  warm: "Morno",
  hot: "Quente",
  priority: "Prioritário",
};

export const SCORE_CLASS_STYLES: Record<ScoreClassification, string> = {
  cold: "bg-blue-500/15 text-blue-400",
  warm: "bg-amber-500/15 text-amber-400",
  hot: "bg-orange-500/15 text-orange-400",
  priority: "bg-emerald-500/15 text-emerald-400",
};

// ---------- Geração de mensagens (spec §11) ----------

export const MESSAGE_TONES = [
  { value: "profissional", label: "Profissional" },
  { value: "amigavel", label: "Amigável" },
  { value: "direto", label: "Direto" },
  { value: "consultivo", label: "Consultivo" },
  { value: "premium", label: "Premium" },
] as const;

export const MESSAGE_CHANNELS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "E-mail" },
] as const;

export type MessageTone = (typeof MESSAGE_TONES)[number]["value"];
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number]["value"];

export const generateMessageFormSchema = z.object({
  leadId: z.string().uuid(),
  analysisId: z.string().uuid().optional().or(z.literal("")),
  productId: z.string().uuid().optional().or(z.literal("")),
  tone: z.enum(["profissional", "amigavel", "direto", "consultivo", "premium"]),
  channel: z.enum(["whatsapp", "email"]),
});

export const saveDraftEditSchema = z.object({
  draftId: z.string().uuid(),
  subject: z.string().max(300),
  body: z.string().min(1, "Mensagem vazia").max(6000),
});

export const discardDraftSchema = z.object({
  draftId: z.string().uuid(),
});
