import { z } from "zod";

export const createCampaignSchema = z.object({
  name: z.string().trim().min(2, "Dê um nome à campanha").max(120),
  description: z.string().trim().max(400).optional().or(z.literal("")),
  mode: z.enum(["manual", "automated"], { message: "Selecione o modo" }),
  productId: z.string().uuid().optional().or(z.literal("")),
  dailyCap: z.coerce.number().int().min(1).max(500).default(50),
  activeHourStart: z.coerce.number().int().min(0).max(23).default(8),
  activeHourEnd: z.coerce.number().int().min(1).max(24).default(20),
});

export const createStepSchema = z.object({
  campaignId: z.string().uuid(),
  waitDays: z.coerce.number().int().min(0).max(60),
  subject: z.string().trim().max(200).optional().or(z.literal("")),
  body: z.string().trim().min(5, "Escreva a mensagem da etapa").max(6000),
});

export const addLeadsByFilterSchema = z.object({
  campaignId: z.string().uuid(),
  stage: z
    .enum([
      "new",
      "qualified",
      "contacted",
      "replied",
      "meeting",
      "proposal",
      "negotiation",
      "won",
      "lost",
    ])
    .optional()
    .or(z.literal("")),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
});

export const campaignControlSchema = z.object({
  campaignId: z.string().uuid(),
  status: z.enum(["draft", "active", "paused", "cancelled"]),
});

export const approveMessageSchema = z.object({
  messageId: z.string().uuid(),
  campaignId: z.string().uuid().optional().or(z.literal("")),
});

export const discardMessageSchema = z.object({
  messageId: z.string().uuid(),
});

export const emailAccountSchema = z.object({
  fromEmail: z.string().trim().email("E-mail de envio inválido").max(200),
  fromName: z.string().trim().min(2, "Informe o nome do remetente").max(120),
});

export const addSuppressionSchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(200),
  reason: z.enum(["manual", "unsubscribe", "bounce", "complaint", "optout_keyword"]),
  note: z.string().trim().max(200).optional().or(z.literal("")),
});

export const removeSuppressionSchema = z.object({
  suppressionId: z.string().uuid(),
});
