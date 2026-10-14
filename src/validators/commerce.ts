import { z } from "zod";

export const COMMERCE_PLATFORMS = [
  { value: "kiwify", label: "Kiwify" },
  { value: "kirvano", label: "Kirvano" },
  { value: "hotmart", label: "Hotmart" },
  { value: "eduzz", label: "Eduzz" },
  { value: "braip", label: "Braip" },
  { value: "monetizze", label: "Monetizze" },
  { value: "custom", label: "Outro" },
] as const;

export const commercePlatformValues = COMMERCE_PLATFORMS.map((p) => p.value) as [
  string,
  ...string[],
];

function moneyString(schema: z.ZodString) {
  return schema
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v && v.length > 0 ? v : null))
    .transform((v) => {
      if (v === null) return null;
      const normalized = v.replace(/\./g, "").replace(",", ".").trim();
      const num = Number(normalized);
      return Number.isFinite(num) && num > 0 ? num : null;
    });
}

// ---------- Produtos ----------

export const createProductSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome").max(160),
  type: z.enum(["own", "affiliate"], { message: "Selecione o tipo" }),
  platform: z.enum(["kiwify", "kirvano", "hotmart", "eduzz", "braip", "monetizze", "custom"], {
    message: "Selecione a plataforma",
  }),
  checkoutUrl: z.string().trim().url("Informe o link de checkout válido").max(1000),
  price: moneyString(z.string()),
  commissionPercent: moneyString(z.string()),
  category: z.string().trim().max(120).optional().or(z.literal("")),
  niche: z.string().trim().max(120).optional().or(z.literal("")),
  imageUrl: z.string().trim().url("Link inválido").optional().or(z.literal("")),
  targetAudience: z.string().trim().max(400).optional().or(z.literal("")),
  sellingArguments: z.string().trim().max(4000).optional().or(z.literal("")),
  externalProductId: z.string().trim().max(120).optional().or(z.literal("")),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial().extend({
  productId: z.string().uuid(),
  status: z.enum(["active", "archived"]).optional(),
});

export const archiveProductSchema = z.object({
  productId: z.string().uuid(),
  status: z.enum(["active", "archived"]),
});

/** sellingArguments chega como texto (uma linha por argumento). */
export function parseSellingArguments(raw: string | undefined | null): string[] {
  return (raw ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 20);
}

// ---------- Integrações ----------

export const createIntegrationSchema = z.object({
  platform: z.enum(["kiwify", "kirvano", "hotmart", "eduzz", "braip", "monetizze", "custom"], {
    message: "Selecione a plataforma",
  }),
  name: z.string().trim().min(2, "Dê um nome à integração").max(80),
});

// ---------- Link tokens ----------

export const createLinkTokenSchema = z.object({
  productId: z.string().uuid(),
  label: z
    .string()
    .trim()
    .min(2, "Descreva onde o link será usado")
    .max(80),
});

export const toggleLinkTokenSchema = z.object({
  tokenId: z.string().uuid(),
  active: z.boolean(),
});

// ---------- Venda manual ----------

export const createManualSaleSchema = z.object({
  productId: z.string().uuid().optional().or(z.literal("")),
  platform: z.enum(["kiwify", "kirvano", "hotmart", "eduzz", "braip", "monetizze", "custom"], {
    message: "Selecione a plataforma",
  }),
  externalOrderId: z.string().trim().min(3, "Informe o ID do pedido").max(120),
  customerName: z.string().trim().max(160).optional().or(z.literal("")),
  customerEmail: z.string().trim().email("E-mail inválido").optional().or(z.literal("")),
  amount: moneyString(z.string()),
  commissionAmount: moneyString(z.string()),
  occurredAt: z.string().trim().max(30).optional().or(z.literal("")),
});

export type ManualSaleInput = z.infer<typeof createManualSaleSchema>;
