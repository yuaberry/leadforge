import { z } from "zod";

export const IMPORT_LEGAL_BASES = [
  { value: "consent", label: "Consentimento dos contatos" },
  { value: "legitimate_interest", label: "Legítimo interesse (contatos B2B/públicos)" },
  { value: "contract", label: "Relação contratual existente" },
] as const;

/** Step 1: upload + declaração de proveniência (obrigatória — LGPD). */
export const createImportBatchSchema = z.object({
  provenanceSource: z
    .string()
    .trim()
    .min(5, "Descreva a origem dos dados (ex.: lista própria de e-mails da loja)")
    .max(300),
  legalBasis: z.enum(["consent", "legitimate_interest", "contract"], {
    message: "Selecione a base legal",
  }),
  confirmedRights: z.literal("on", { message: "Confirme a procedência e o direito de uso" }),
});

/** Step 2: mapeamento de colunas. */
export const importMappingSchema = z.object({
  batchId: z.string().uuid(),
  mapping: z.string().max(20000), // JSON stringificado { field: headerIndex }
});

export type ImportRowRaw = Record<string, string | undefined>;
