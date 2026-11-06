import { z } from "zod";

import { DEFAULT_ORG_SETTINGS, type OrgSettings } from "@/types/org";
import { DEFAULT_SCORE_WEIGHTS, SCORE_WEIGHT_KEYS } from "@/validators/scoring";

// ---------- Organization ----------

export const createOrganizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "O nome deve ter pelo menos 2 caracteres")
    .max(80, "O nome deve ter no máximo 80 caracteres"),
});

/**
 * Schema das settings da org.
 *
 * ⚠️ Todos os campos têm DEFAULT: as settings são gravadas como JSONB e
 * podem ter sido criadas por uma versão anterior (sem um campo novo) ou
 * atualizadas parcialmente. Sem defaults, o safeParse falhava e o
 * `parseOrgSettings` trocava a configuração INTEIRA da org pelo default —
 * apagando silenciosamente a alocação da meta, os pesos de score, etc.
 * Com defaults, o que falta é preenchido e o que existe é preservado.
 */
export const orgSettingsSchema = z.object({
  businessMode: z.enum(["affiliate", "own", "both"]).nullable().default(null),
  categories: z.array(z.string().min(1).max(48)).max(12).default([]),
  channels: z
    .object({
      email: z.boolean().default(false),
      whatsapp: z.boolean().default(false),
    })
    .default({ email: false, whatsapp: false }),
  dream: z
    .object({
      name: z.string().trim().min(2).max(120),
      amount: z.number().positive().nullable().default(null),
      imageUrl: z.string().url().nullable().or(z.literal("")).nullable().default(null),
      productUrl: z.string().url().nullable().or(z.literal("")).nullable().default(null),
    })
    .nullable()
    .default(null),
  dreamSkipped: z.boolean().default(false),
  onboardedAt: z.string().datetime().nullable().default(null),
  scoreWeights: z.record(z.string(), z.number()).default({}),
  goalSettings: z
    .object({
      autoAllocatePercent: z.number().min(0).max(100).default(0),
      targetGoalId: z.string().uuid().nullable().default(null),
    })
    .default({ autoAllocatePercent: 0, targetGoalId: null }),
});

/** Mescla pesos salvos com os defaults (chaves novas sempre têm valor). */
export function parseScoreWeights(raw: unknown): Record<string, number> {
  const weights: Record<string, number> = { ...DEFAULT_SCORE_WEIGHTS };
  if (typeof raw === "object" && raw !== null) {
    for (const key of SCORE_WEIGHT_KEYS) {
      const value = (raw as Record<string, unknown>)[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        weights[key] = Math.max(0, Math.min(100, Math.round(value)));
      }
    }
  }
  return weights;
}

export function parseOrgSettings(raw: unknown): OrgSettings {
  const parsed = orgSettingsSchema.safeParse(raw);
  if (parsed.success) {
    return {
      ...parsed.data,
      dream: parsed.data.dream as OrgSettings["dream"],
      scoreWeights: parseScoreWeights(parsed.data.scoreWeights),
      goalSettings: {
        autoAllocatePercent: Math.max(
          0,
          Math.min(100, Math.round(parsed.data.goalSettings?.autoAllocatePercent ?? 0))
        ),
        targetGoalId: parsed.data.goalSettings?.targetGoalId ?? null,
      },
    } as OrgSettings;
  }
  return {
    ...DEFAULT_ORG_SETTINGS,
    scoreWeights: { ...DEFAULT_SCORE_WEIGHTS },
  };
}

// ---------- Onboarding steps ----------

export const onboardingBusinessSchema = z.object({
  businessMode: z.enum(["affiliate", "own", "both"], { message: "Escolha como você vende" }),
  categories: z.array(z.string()).min(1, "Escolha pelo menos uma categoria"),
});

export const onboardingChannelsSchema = z.object({
  email: z.boolean(),
  whatsapp: z.boolean(),
});

export const onboardingDreamSchema = z.object({
  dreamName: z.string().trim().min(2, "Dê um nome para sua meta").max(120),
  dreamAmount: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(/\./g, "").replace(",", ".") : null))
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || v > 0, "Informe um valor válido"),
  dreamImageUrl: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 && /^https?:\/\/.+/.test(v) ? v : null)),
  dreamProductUrl: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 && /^https?:\/\/.+/.test(v) ? v : null)),
});

// ---------- Members ----------

export const memberRoleValues = ["owner", "admin", "member", "viewer"] as const;
export type MemberRole = (typeof memberRoleValues)[number];

export const assignableRoles = ["admin", "member", "viewer"] as const;
export type AssignableRole = (typeof assignableRoles)[number];

export const updateMemberRoleSchema = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(memberRoleValues),
});

export const removeMemberSchema = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
});

// ---------- Invites ----------

export const createInviteSchema = z.object({
  role: z.enum(assignableRoles, { message: "Papel inválido" }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .transform((v) => (v && v.includes("@") ? v : null))
    .refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), "E-mail inválido"),
  expiresInDays: z.coerce.number().int().min(1).max(30).default(7),
});

export const revokeInviteSchema = z.object({
  inviteId: z.string().uuid(),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(20).max(128),
});
