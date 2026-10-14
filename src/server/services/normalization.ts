import { createHash } from "node:crypto";

import { cleanDigits, isValidEmail, normalizeEmail, normalizePhoneBR } from "@/lib/format";

/**
 * Normalização de dados de leads — FUNÇÃO PURA (mesma lógica para
 * importação CSV, captura pública, criação manual e discovery).
 *
 * Regra de ouro (plano §7): toda entrada passa por aqui antes de
 * tocar o banco. As 4 chaves de dedup são derivadas aqui:
 *   1. (source_id, external_id)  — vindo da fonte (Phase 4)
 *   2. domain do website
 *   3. phone_normalized
 *   4. email_normalized
 *   5. name_address_hash (nome + cidade/estado)
 */

export type CompanyInput = {
  name?: string | null;
  category?: string | null;
  description?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  linkedin?: string | null;
  addressLine?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  externalId?: string | null;
};

export type NormalizedCompany = {
  name: string;
  category: string | null;
  description: string | null;
  website: string | null;
  domain: string | null;
  phone: string | null;
  phoneNormalized: string | null;
  email: string | null;
  emailNormalized: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  externalId: string | null;
  nameAddressHash: string | null;
};

function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Normaliza website → URL canônica + domínio (sem "www.").
 * Retorna null para entradas inválidas — nunca inventa dado.
 */
export function normalizeWebsite(
  raw: string | null | undefined
): { website: string | null; domain: string | null } {
  const value = trimOrNull(raw);
  if (!value) return { website: null, domain: null };

  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname.includes(".")) return { website: null, domain: null };
    const domain = url.hostname.toLowerCase().replace(/^www\./, "");
    return { website: url.toString().replace(/\/$/, ""), domain };
  } catch {
    return { website: null, domain: null };
  }
}

/** Hash sha256 de nome normalizado + cidade + estado (chave de dedup 5). */
export function companyNameAddressHash(
  name: string | null,
  city: string | null,
  state: string | null
): string | null {
  const normName = trimOrNull(name);
  if (!normName) return null;
  const key = [normName.toLowerCase(), (city ?? "").trim().toLowerCase(), (state ?? "").trim().toLowerCase()]
    .join("|");
  return createHash("sha256").update(key).digest("hex");
}

export function normalizeCompany(input: CompanyInput): NormalizedCompany {
  const name = trimOrNull(input.name) ?? "";
  const { website, domain } = normalizeWebsite(input.website);
  const phone = trimOrNull(input.phone);
  const phoneNormalized = phone ? normalizePhoneBR(phone) : null;
  const email = trimOrNull(input.email);
  const emailNormalized = email && isValidEmail(email) ? normalizeEmail(email) : null;
  const city = trimOrNull(input.city);
  const state = trimOrNull(input.state);

  return {
    name,
    category: trimOrNull(input.category),
    description: trimOrNull(input.description),
    website,
    domain,
    phone,
    phoneNormalized,
    email,
    emailNormalized,
    instagram: trimOrNull(input.instagram),
    facebook: trimOrNull(input.facebook),
    linkedin: trimOrNull(input.linkedin),
    addressLine: trimOrNull(input.addressLine),
    city,
    state,
    country: trimOrNull(input.country),
    externalId: trimOrNull(input.externalId),
    nameAddressHash: companyNameAddressHash(name, city, state),
  };
}

export type ContactInput = {
  fullName?: string | null;
  jobTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
};

export type NormalizedContact = {
  fullName: string;
  jobTitle: string | null;
  email: string | null;
  emailNormalized: string | null;
  phone: string | null;
  phoneNormalized: string | null;
  notes: string | null;
};

export function normalizeContact(input: ContactInput): NormalizedContact {
  const email = trimOrNull(input.email);
  const phone = trimOrNull(input.phone);

  return {
    fullName: trimOrNull(input.fullName) ?? "",
    jobTitle: trimOrNull(input.jobTitle),
    email,
    emailNormalized: email && isValidEmail(email) ? normalizeEmail(email) : null,
    phone,
    phoneNormalized: phone ? normalizePhoneBR(phone) : null,
    notes: trimOrNull(input.notes),
  };
}

/**
 * Chaves de dedup prontas para consulta.
 * Uso: findCompanyByDedupKeys(db, orgId, normalized).
 */
export type CompanyDedupKeys = {
  domain: string | null;
  phoneNormalized: string | null;
  emailNormalized: string | null;
  nameAddressHash: string | null;
  externalId: string | null;
};

export function companyDedupKeys(company: NormalizedCompany): CompanyDedupKeys {
  return {
    domain: company.domain,
    phoneNormalized: company.phoneNormalized,
    emailNormalized: company.emailNormalized,
    nameAddressHash: company.nameAddressHash,
    externalId: company.externalId,
  };
}

/** Digits util reexport para uso em pipelines. */
export { cleanDigits };
