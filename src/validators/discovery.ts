import { z } from "zod";

export const discoverySearchSchema = z.object({
  keyword: z
    .string()
    .trim()
    .min(2, "Informe o segmento (ex.: clínica odontológica)")
    .max(120),
  location: z.string().trim().min(2, "Informe a localização (ex.: São Paulo)").max(120),
  maxResults: z.coerce.number().int().min(20).max(60).default(20),
});

export type DiscoverySearchInput = z.infer<typeof discoverySearchSchema>;
