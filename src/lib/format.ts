/**
 * Utilitários de formatação e normalização de dados.
 * Usados pela UI e pelos pipelines de normalização de leads (Phase 2+).
 */

export function normalizeEmail(raw: string): string {
  return (raw ?? "").trim().toLowerCase();
}

export function isValidEmail(raw: string): boolean {
  const email = normalizeEmail(raw);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function cleanDigits(raw: string): string {
  return (raw ?? "").replace(/\D+/g, "");
}

/**
 * Normaliza telefones brasileiros para o formato E.164 sem "+"
 * (padrão usado pelo WhatsApp Cloud API e pela deduplicação).
 * Retorna null quando o número não é plausível.
 *
 * Exemplos:
 *  "(11) 98765-4321"    -> "5511987654321"
 *  "+55 11 98765 4321"  -> "5511987654321"
 *  "11987654321"        -> "5511987654321"
 */
export function normalizePhoneBR(raw: string): string | null {
  const digits = cleanDigits(raw);
  if (!digits) return null;

  const national = digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;
  if (national.length < 10 || national.length > 11) return null;

  return `55${national}`;
}

export function formatCurrency(value: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}

/** Recebe fração (0.0823 -> "8,2%") */
export function formatPercent(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits).replace(".", ",")}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}
