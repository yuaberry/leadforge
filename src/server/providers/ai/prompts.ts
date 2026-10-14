import type { LeadAnalysisInput, MessageGenerationInput } from "./types";

/**
 * Prompts do AI Sales Assistant (spec §10/§11).
 *
 * Regras de ouro embutidas no prompt:
 *  - NUNCA inventar dados do lead (separar fatos / inferências / hipóteses)
 *  - recommended_product_id DEVE ser um dos ids fornecidos ou null
 *  - nada de promessas de resultado garantido
 */

export function buildAnalysisPrompts(input: LeadAnalysisInput): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = `Você é o assistente comercial do LeadForge. Sua função é analisar um lead B2C/B2B e recomendar a melhor oferta do catálogo do usuário.

REGRAS INEGOCIÁVEIS:
1. Separe rigorosamente: "facts" (dados presentes na entrada), "inferences" (deduções razoáveis a partir dos fatos) e "hypotheses" (hipóteses não verificadas).
2. NUNCA invente nome de dono, problema inexistente ou informação ausente. O que não estiver nos dados vai em "hypotheses" ou fica vazio.
3. "recommended_product_id" DEVE ser exatamente um dos ids de produto fornecidos, ou null se nenhum servir.
4. Nada de resultados garantidos ("vai dobrar suas vendas") — argumentos devem ser plausíveis e verificáveis.
5. Responda APENAS com um objeto JSON válido, sem texto fora do JSON.

FORMATO DO JSON:
{
  "who_is_this": "quem é este lead em 1-2 frases",
  "probable_need": "o que ele provavelmente precisa",
  "commercial_problem": "qual problema comercial pode ser resolvido",
  "recommended_product_id": "id do produto ou null",
  "opportunity_score": 0-100,
  "suggested_offer": "oferta recomendada em 1-2 frases",
  "price_range": "faixa de preço a considerar ou null",
  "argument": "argumento comercial principal",
  "channel": "whatsapp" | "email" | null,
  "facts": ["..."],
  "inferences": ["..."],
  "hypotheses": ["..."]
}`;

  const produtos = input.products.length
    ? input.products
        .map(
          (p) =>
            `- id=${p.id} | ${p.name} (${p.type === "own" ? "autoral" : "afiliado"}) | categoria: ${p.category ?? "—"} | público: ${p.targetAudience ?? "—"} | argumentos: ${p.sellingArguments.slice(0, 5).join("; ") || "—"}${p.price ? ` | preço: ${p.price}` : ""}`
        )
        .join("\n")
    : "— catálogo vazio —";

  const lead = input.lead;
  const userPrompt = `DADOS DO LEAD:
- Contato: ${lead.contactName ?? "não informado"}
- E-mail: ${lead.contactEmail ?? "não informado"}
- Telefone: ${lead.contactPhone ?? "não informado"}
- Empresa: ${lead.companyName ?? "não informada"}
- Website: ${lead.companyWebsite ?? "não possui"}
- Categoria da empresa: ${lead.companyCategory ?? "não informada"}
- Local: ${[lead.companyCity, lead.companyState].filter(Boolean).join(" / ") || "não informado"}
- Origem do lead: ${lead.source}
- Observações: ${lead.notes ?? "—"}

CATEGORIAS DE NEGÓCIO DO USUÁRIO: ${input.orgCategories.join(", ") || "não configuradas"}

CATÁLOGO DE PRODUTOS DO USUÁRIO:
${produtos}

Analise o lead e responda no formato JSON especificado.`;

  return { systemPrompt, userPrompt };
}

export function buildMessagePrompts(input: MessageGenerationInput): {
  systemPrompt: string;
  userPrompt: string;
} {
  const canal =
    input.channel === "whatsapp"
      ? "WhatsApp (curta: até 600 caracteres, sem assunto, tom de conversa, 1 CTA claro)"
      : "E-mail (assunto + corpo de até 1500 caracteres, estrutura profissional)";

  const systemPrompt = `Você é redator comercial do LeadForge. Gere UMA mensagem personalizada de prospecção/venta no canal ${canal}.

REGRAS:
1. Use SOMENTE os fatos fornecidos sobre o lead — nada de inventar nome, dor ou situação.
2. Tom exigido: ${input.tone}.
3. Objetivo: ${input.goal}.
4. Não prometa resultados garantidos.
5. Se um link rastreado for fornecido, inclua-o como chamada para ação.
6. Responda APENAS com JSON: {"subject": "assunto ou string vazia para WhatsApp", "body": "mensagem"}`;

  const product = input.product;
  const analysis = input.analysis;

  const userPrompt = `LEAD:
- Nome: ${input.lead.contactName ?? "não informado"}
- Empresa: ${input.lead.companyName ?? "não informada"}
- Contexto: ${input.lead.companyCategory ?? "—"} ${input.lead.companyCity ? `(${input.lead.companyCity})` : ""}
- Fonte: ${input.lead.source}

${product ? `PRODUTO A OFERTAR: ${product.name}${product.category ? ` (${product.category})` : ""}` : "OFERTA: genérica, sem produto específico"}

${analysis ? `ARGUMENTO DA ANÁLISE: ${analysis.argument}\nNECESSIDADE DETECTADA: ${analysis.probableNeed}\nOFERTA SUGERIDA: ${analysis.suggestedOffer}` : ""}

${input.trackedLink ? `LINK RASTREADO PARA O CTA: ${input.trackedLink}` : ""}

Gere a mensagem em português do Brasil, no JSON especificado.`;

  return { systemPrompt, userPrompt };
}
