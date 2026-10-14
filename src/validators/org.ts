import { z } from "zod";

import { DEFAULT_ORG_SETTINGS, type OrgSettings } from "@/types/org";

// ---------- Organization ----------

export const createOrganizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "O nome deve ter pelo menos 2 caracteres")
    .max(80, "O nome deve ter no máximo 80 caracteres"),
});

export const orgSettingsSchema = z.object({
  businessMode: z.enum(["affiliate", "own", "both"]).nullable(),
  categories: z.array(z.string().min(1).max(48)).max(12),
  channels: z.object({
    email: z.boolean(),
    whatsapp: z.boolean(),
  }),
  dream: z
    .object({
      name: z.string().trim().min(2).max(120),
      amount: z.number().positive().nullable(),
      imageUrl: z.string().url().nullable().or(z.literal("")).nullable(),
      productUrl: z.string().url().nullable().or(z.literal("")).nullable(),
    })
    .nullable(),
  dreamSkipped: z.boolean(),
  onboardedAt: z.string().datetime().nullable(),
});

export function parseOrgSettings(raw: unknown): OrgSettings {
  const parsed = orgSettingsSchema.safeParse(raw);
  if (parsed.success) {
    return parsed.data as OrgSettings;
  }
  return { ...DEFAULT_ORG_SETTINGS };
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
