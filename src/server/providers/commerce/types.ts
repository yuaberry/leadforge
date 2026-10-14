/**
 * LEADFORGE — CommerceProvider
 *
 * Contrato único para checkouts digitais (Kiwify, Kirvano, e futuros).
 * Cada provider traduz o payload do webhook para um SaleEvent normalizado.
 *
 * ⚠️ Nota de engenharia: os parsers usam busca tolerante por aliases porque
 * os payloads variam entre plataformas/versões. Os fixtures de teste são
 * representativos e DEVEM ser validados contra payloads reais durante a
 * conexão da conta (documentado em docs/PROGRESS.md).
 */

export type CommercePlatform =
  | "kiwify"
  | "kirvano"
  | "hotmart"
  | "eduzz"
  | "braip"
  | "monetizze"
  | "custom";

export type SaleStatus = "pending" | "paid" | "refunded" | "chargedback" | "canceled";

export type SaleUtm = {
  source: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
};

export type SaleEvent = {
  externalOrderId: string;
  status: SaleStatus;
  amount: number | null;
  commissionAmount: number | null;
  currency: string;
  customerName: string | null;
  customerEmail: string | null;
  externalProductId: string | null;
  utm: SaleUtm;
  occurredAt: string | null;
};

export class CommerceParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommerceParseError";
  }
}

export interface CommerceProvider {
  readonly platform: CommercePlatform;
  /** Valida e normaliza o payload do webhook. Lança CommerceParseError se inválido. */
  parseSaleEvent(payload: unknown): SaleEvent;
}

// ---------- Helpers tolerantes ----------

type Json = Record<string, unknown>;

function isJson(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(obj: Json, keys: string[]): string | null {
  const wanted = new Set(keys.map((k) => k.toLowerCase()));
  const stack: Json[] = [obj];

  while (stack.length) {
    const current = stack.pop()!;
    for (const [key, value] of Object.entries(current)) {
      if (wanted.has(key.toLowerCase())) {
        if (typeof value === "string" && value.trim().length > 0) return value.trim();
        if (typeof value === "number" && Number.isFinite(value)) return String(value);
      }
      if (isJson(value)) stack.push(value);
    }
  }
  return null;
}

/** Converte valores monetários: "97.00", "97,50", 9750 em campo *_cents → number. */
function pickMoney(obj: Json, keys: string[]): number | null {
  for (const key of keys) {
    const wanted = key.toLowerCase();
    const stack: Json[] = [obj];
    while (stack.length) {
      const current = stack.pop()!;
      for (const [k, value] of Object.entries(current)) {
        if (k.toLowerCase() === wanted && value !== undefined && value !== null) {
          const isCents = /_cents?$/i.test(k);
          const num = toNumber(value, isCents);
          if (num !== null) return num;
        }
        if (isJson(value)) stack.push(value as Json);
      }
    }
  }
  return null;
}

function toNumber(value: unknown, isCents = false): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return isCents ? value / 100 : value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const normalized = value
      .trim()
      .replace(/[^\d.,-]/g, "")
      .replace(/\.(?=\d{3}\b)/g, "")
      .replace(",", ".");
    const num = Number(normalized);
    if (Number.isFinite(num) && num > 0) return isCents ? num / 100 : num;
  }
  return null;
}

function normalizeStatus(raw: string | null, defaultStatus: SaleStatus): SaleStatus {
  const value = (raw ?? "").toLowerCase();
  if (value.includes("refund") || value.includes("reembols")) return "refunded";
  if (value.includes("chargeback")) return "chargedback";
  if (value.includes("cancel")) return "canceled";
  if (value.includes("paid") || value.includes("pago") || value.includes("aprov") || value.includes("paid") || value.includes("approved")) return "paid";
  if (value.includes("pending") || value.includes("aguard") || value.includes("waiting") || value.includes("process")) return "pending";
  return defaultStatus;
}

function pickUtm(obj: Json): SaleUtm {
  const stack: Json[] = [obj];
  const found: SaleUtm = { source: null, campaign: null, content: null, term: null };
  while (stack.length) {
    const current = stack.pop()!;
    for (const [key, value] of Object.entries(current)) {
      const lower = key.toLowerCase();
      if ((lower === "utm_source" || lower === "source") && typeof value === "string") found.source ??= value;
      if ((lower === "utm_campaign" || lower === "campaign") && typeof value === "string") found.campaign ??= value;
      if ((lower === "utm_content" || lower === "content") && typeof value === "string") found.content ??= value;
      if ((lower === "utm_term" || lower === "term") && typeof value === "string") found.term ??= value;
      if (isJson(value)) stack.push(value);
    }
  }
  return found;
}

function pickOccurredAt(obj: Json, keys: string[]): string | null {
  for (const key of keys) {
    const stack: unknown[] = [obj];
    while (stack.length) {
      const current = stack.pop();
      if (isJson(current)) {
        const value = current[key];
        if (typeof value === "string") {
          const date = new Date(value);
          if (!Number.isNaN(date.getTime())) return date.toISOString();
        }
        if (typeof value === "number" && value > 1_000_000_000) {
          const ms = value < 10_000_000_000 ? value * 1000 : value;
          return new Date(ms).toISOString();
        }
        for (const nested of Object.values(current)) {
          if (isJson(nested)) stack.push(nested);
        }
      }
    }
  }
  return null;
}

export {
  isJson,
  normalizeStatus,
  pickMoney,
  pickOccurredAt,
  pickString,
  pickUtm,
  type Json,
};
