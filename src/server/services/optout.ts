/**
 * LEADFORGE — Detecção de opt-out por palavra-chave (WhatsApp).
 *
 * Quando detectado: suppression + opted_out_at — o contato NUNCA mais
 * recebe disparos. Reativação apenas por ação válida (settings/suppression).
 */

export const OPTOUT_KEYWORDS = [
  "sair",
  "parar",
  "stop",
  "unsubscribe",
  "descadastrar",
  "remover",
  "cancelar",
  "nao quero",
  "nao desejo",
  "remover lista",
] as const;

/** Normaliza: lowercase, sem acentos, sem pontuação nas bordas. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

/** true quando a mensagem É uma ordem de opt-out (frase inteira). */
export function isOptOutMessage(text: string): boolean {
  const normalized = normalize(text);
  if (!normalized) return false;

  // frase inteira — "sair", "quero sair", "sair da lista", "por favor parar"
  if (OPTOUT_KEYWORDS.some((keyword) => normalized === keyword)) return true;

  const startsWithOptout = /^(quero |por favor[,\s]+|favor[,\s]+|please[,\s]+|porfavor[,\s]+)?(gostaria de )?/;
  const stripped = normalized
    .replace(startsWithOptout, "")
    .replace(/ (da lista|messages|mensagens|da lista de mensagens|list|sms|zap|whatsapp|agora|urgente)$/, "");

  return OPTOUT_KEYWORDS.some((keyword) => stripped === keyword);
}

/** Mensagem automática de confirmação do opt-out (boa prática da Meta). */
export function optOutConfirmationMessage(): string {
  return "Pronto! Você foi removido da nossa lista e não receberá mais mensagens. Se mudar de ideia, é só nos chamar. 👋";
}
