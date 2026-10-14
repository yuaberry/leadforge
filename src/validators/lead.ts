import { z } from "zod";

export const LEAD_STAGES = [
  "new",
  "qualified",
  "contacted",
  "replied",
  "meeting",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

export const STAGE_LABELS: Record<LeadStage, string> = {
  new: "Novo",
  qualified: "Qualificado",
  contacted: "Contatado",
  replied: "Respondeu",
  meeting: "Reunião",
  proposal: "Proposta",
  negotiation: "Negociação",
  won: "Ganho",
  lost: "Perdido",
};

// ---------- Criação manual ----------

export const createLeadSchema = z.object({
  contactName: z.string().trim().min(2, "Informe o nome").max(120),
  companyName: z.string().trim().max(160).optional().or(z.literal("")),
  email: z.string().trim().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  website: z.string().trim().max(300).optional().or(z.literal("")),
  category: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().max(120).optional().or(z.literal("")),
  state: z.string().trim().max(120).optional().or(z.literal("")),
  jobTitle: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;

// ---------- Ações sobre lead ----------

export const updateLeadStageSchema = z.object({
  leadId: z.string().uuid(),
  stage: z.enum(LEAD_STAGES),
});

export const addLeadTagSchema = z.object({
  leadId: z.string().uuid(),
  tagName: z
    .string()
    .trim()
    .min(1, "Informe o nome da tag")
    .max(48)
    .transform((v) => v.replace(/\s+/g, " ")),
});

export const removeLeadTagSchema = z.object({
  leadId: z.string().uuid(),
  tagId: z.string().uuid(),
});

export const addLeadNoteSchema = z.object({
  leadId: z.string().uuid(),
  note: z.string().trim().min(1, "Escreva a nota").max(2000),
});

// ---------- Listagem (query string) ----------

export const leadListQuerySchema = z.object({
  q: z.string().trim().max(160).optional(),
  stage: z.enum(LEAD_STAGES).optional(),
  source: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const companyListQuerySchema = z.object({
  q: z.string().trim().max(160).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const PAGE_SIZE = 25;
