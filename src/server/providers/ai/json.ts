/**
 * Extração tolerante de JSON de respostas de LLM.
 * LLMs às vezes cercam o JSON com ```json ... ``` ou texto extra.
 */
export function extractJson(raw: string): unknown {
  const text = raw.trim();

  // 1. Parse direto
  try {
    return JSON.parse(text);
  } catch {
    // segue
  }

  // 2. Bloco ```json ... ```
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // segue
    }
  }

  // 3. Primeiro '{' até o último '}' balanceado (varredura por profundidade)
  const start = text.indexOf("{");
  if (start >= 0) {
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(text.slice(start, i + 1));
          } catch {
            // segue procurando próximo bloco
          }
        }
      }
    }
  }

  throw new Error("Resposta da IA não contém JSON válido");
}
