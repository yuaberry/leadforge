import { z } from "zod";

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createCapturePageSchema = z.object({
  title: z.string().trim().min(2, "Informe o título").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "Slug mínimo de 2 caracteres")
    .max(64)
    .regex(SLUG_REGEX, "Use apenas letras minúsculas, números e hífen"),
  headline: z.string().trim().min(2, "Informe o título da página").max(200),
  subheadline: z.string().trim().max(400).optional().or(z.literal("")),
  body: z.string().trim().max(5000).optional().or(z.literal("")),
  leadMagnetUrl: z
    .string()
    .trim()
    .url("Link inválido")
    .optional()
    .or(z.literal("")),
  thankYouMessage: z.string().trim().max(400).optional().or(z.literal("")),
  consentText: z.string().trim().min(10, "Descreva o consentimento").max(1000),
});

export const updateCapturePageSchema = createCapturePageSchema.partial().extend({
  pageId: z.string().uuid(),
});

export const setCapturePageStatusSchema = z.object({
  pageId: z.string().uuid(),
  status: z.enum(["draft", "published", "archived"]),
});

/** Formulário público de captura. */
export const captureSubmissionSchema = z.object({
  slug: z.string().trim().min(1).max(64),
  name: z.string().trim().min(2, "Informe seu nome").max(120),
  email: z.string().trim().email("Informe um e-mail válido").max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  consent: z.literal("on", { message: "É necessário aceitar para continuar" }),
  /** Honeypot — campo invisível; preenchido = bot. */
  hp_website: z.string().max(0).optional().or(z.literal("")),
  utm_source: z.string().trim().max(120).optional().or(z.literal("")),
  utm_campaign: z.string().trim().max(120).optional().or(z.literal("")),
  utm_content: z.string().trim().max(120).optional().or(z.literal("")),
});

export type CaptureSubmissionInput = z.infer<typeof captureSubmissionSchema>;
