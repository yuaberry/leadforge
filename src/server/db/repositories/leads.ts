import "server-only";

import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";

import { companyDedupKeys, normalizeCompany, normalizeContact, type NormalizedCompany } from "@/server/services/normalization";
import { computeLeadScore, signalsFromRawInput } from "@/server/services/scoring";
import { DEFAULT_SCORE_WEIGHTS } from "@/validators/scoring";
import type { LeadStage } from "@/validators/lead";
import {
  activities,
  companies,
  contacts,
  leadSources,
  leadTags,
  leads,
  tags,
} from "@/server/db/schema";
import type { TenantDb } from "@/server/db/tenant";
import { saveLeadScore } from "@/server/db/repositories/scoring";

// ---------- Activities ----------

export async function recordActivity(
  db: TenantDb,
  input: {
    organizationId: string;
    type: string;
    entityType: string;
    entityId: string;
    actorId?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await db.insert(activities).values({
    organizationId: input.organizationId,
    type: input.type,
    entityType: input.entityType,
    entityId: input.entityId,
    actorId: input.actorId ?? null,
    metadata: input.metadata ?? {},
  });
}

// ---------- Sources ----------

export async function getOrCreateSource(
  db: TenantDb,
  organizationId: string,
  name: string,
  type: "manual" | "csv" | "capture" | "discovery"
): Promise<typeof leadSources.$inferSelect> {
  const [existing] = await db
    .select()
    .from(leadSources)
    .where(
      and(
        eq(leadSources.organizationId, organizationId),
        eq(leadSources.type, type),
        eq(leadSources.name, name)
      )
    )
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(leadSources)
    .values({ organizationId, name, type })
    .returning();
  return created;
}

// ---------- Companies (dedup) ----------

/** Busca empresa existente pelas 4 chaves de dedup (dentro da org). */
export async function findCompanyByDedupKeys(
  db: TenantDb,
  organizationId: string,
  normalized: NormalizedCompany
): Promise<typeof companies.$inferSelect | null> {
  const keys = companyDedupKeys(normalized);
  const conditions = [eq(companies.organizationId, organizationId)];

  if (keys.domain) conditions.push(eq(companies.domain, keys.domain));
  if (keys.phoneNormalized) conditions.push(eq(companies.phoneNormalized, keys.phoneNormalized));
  if (keys.emailNormalized) conditions.push(eq(companies.emailNormalized, keys.emailNormalized));
  if (keys.nameAddressHash) conditions.push(eq(companies.nameAddressHash, keys.nameAddressHash));
  if (keys.externalId) conditions.push(eq(companies.externalId, keys.externalId));

  if (conditions.length === 1) return null; // nenhuma chave disponível

  const [existing] = await db
    .select()
    .from(companies)
    .where(or(...conditions))
    .orderBy(desc(companies.updatedAt))
    .limit(1);
  return existing ?? null;
}

/** Cria (ou atualiza, em dedup) a empresa normalizada. */
export async function upsertCompany(
  db: TenantDb,
  organizationId: string,
  input: Parameters<typeof normalizeCompany>[0],
  sourceId: string | null
): Promise<{ company: typeof companies.$inferSelect; created: boolean }> {
  const normalized = normalizeCompany(input);
  const existing = await findCompanyByDedupKeys(db, organizationId, normalized);

  if (existing) {
    // preenche campos vazios — nunca sobrescreve dados existentes
    const merged = {
      category: existing.category ?? normalized.category,
      description: existing.description ?? normalized.description,
      website: existing.website ?? normalized.website,
      domain: existing.domain ?? normalized.domain,
      phone: existing.phone ?? normalized.phone,
      phoneNormalized: existing.phoneNormalized ?? normalized.phoneNormalized,
      email: existing.email ?? normalized.email,
      emailNormalized: existing.emailNormalized ?? normalized.emailNormalized,
      addressLine: existing.addressLine ?? normalized.addressLine,
      city: existing.city ?? normalized.city,
      state: existing.state ?? normalized.state,
      country: existing.country ?? normalized.country,
      sourceId: existing.sourceId ?? sourceId,
      rating: existing.rating ?? normalized.rating,
      userRatingCount: existing.userRatingCount ?? normalized.userRatingCount,
    };
    const [updated] = await db
      .update(companies)
      .set({ ...merged, updatedAt: new Date().toISOString() })
      .where(eq(companies.id, existing.id))
      .returning();
    return { company: updated, created: false };
  }

  const [created] = await db
    .insert(companies)
    .values({
      organizationId,
      ...normalized,
      name: normalized.name || "—",
      sourceId,
    })
    .returning();
  return { company: created, created: true };
}

// ---------- Contacts (dedup) ----------

export async function findContactByEmailOrPhone(
  db: TenantDb,
  organizationId: string,
  emailNormalized: string | null,
  phoneNormalized: string | null
): Promise<typeof contacts.$inferSelect | null> {
  const conditions = [eq(contacts.organizationId, organizationId)];
  const keys = [];
  if (emailNormalized) keys.push(eq(contacts.emailNormalized, emailNormalized));
  if (phoneNormalized) keys.push(eq(contacts.phoneNormalized, phoneNormalized));
  if (keys.length === 0) return null;

  const [existing] = await db
    .select()
    .from(contacts)
    .where(and(...conditions, or(...keys)))
    .limit(1);
  return existing ?? null;
}

export async function upsertContact(
  db: TenantDb,
  organizationId: string,
  input: Parameters<typeof normalizeContact>[0],
  options: {
    companyId?: string | null;
    sourceId?: string | null;
    legalBasis?: "consent" | "legitimate_interest" | "contract" | "other" | null;
    consentStatus?: "unknown" | "granted" | "refused";
    consentAt?: string | null;
  }
): Promise<{ contact: typeof contacts.$inferSelect; created: boolean }> {
  const normalized = normalizeContact(input);
  const existing = await findContactByEmailOrPhone(
    db,
    organizationId,
    normalized.emailNormalized,
    normalized.phoneNormalized
  );

  if (existing) {
    const merged = {
      companyId: existing.companyId ?? options.companyId ?? null,
      fullName: normalized.fullName || existing.fullName,
      jobTitle: existing.jobTitle ?? normalized.jobTitle,
      email: existing.email ?? normalized.email,
      emailNormalized: existing.emailNormalized ?? normalized.emailNormalized,
      phone: existing.phone ?? normalized.phone,
      phoneNormalized: existing.phoneNormalized ?? normalized.phoneNormalized,
      notes: existing.notes ?? normalized.notes,
      legalBasis: existing.legalBasis ?? options.legalBasis ?? null,
      consentStatus:
        options.consentStatus === "granted" ? ("granted" as const) : existing.consentStatus,
      consentAt:
        options.consentStatus === "granted"
          ? (options.consentAt ?? new Date().toISOString())
          : existing.consentAt,
    };
    const [updated] = await db
      .update(contacts)
      .set({ ...merged, updatedAt: new Date().toISOString() })
      .where(eq(contacts.id, existing.id))
      .returning();
    return { contact: updated, created: false };
  }

  const [created] = await db
    .insert(contacts)
    .values({
      organizationId,
      companyId: options.companyId ?? null,
      fullName: normalized.fullName || "—",
      jobTitle: normalized.jobTitle,
      email: normalized.email,
      emailNormalized: normalized.emailNormalized,
      phone: normalized.phone,
      phoneNormalized: normalized.phoneNormalized,
      notes: normalized.notes,
      legalBasis: options.legalBasis ?? null,
      consentStatus: options.consentStatus ?? "unknown",
      consentAt: options.consentStatus === "granted" ? (options.consentAt ?? new Date().toISOString()) : null,
    })
    .returning();
  return { contact: created, created: true };
}

// ---------- Leads (dedup + fluxo central) ----------

/**
 * Lead B2B por empresa (sem contato nominal) — usado pelo discovery.
 * Dedup: um lead por empresa (app-level; índice parcial cobre pares com contato).
 */
export async function upsertCompanyLead(
  db: TenantDb,
  organizationId: string,
  companyId: string,
  options: {
    sourceId: string | null;
    sourceName: string;
    orgCategories: string[];
    scoreWeights: Record<string, number>;
  }
): Promise<{ lead: typeof leads.$inferSelect; created: boolean }> {
  const [existing] = await db
    .select()
    .from(leads)
    .where(
      and(eq(leads.organizationId, organizationId), eq(leads.companyId, companyId))
    )
    .limit(1);

  if (existing) {
    return { lead: existing, created: false };
  }

  const [company] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  const [lead] = await db
    .insert(leads)
    .values({
      organizationId,
      companyId,
      contactId: null,
      stage: "new",
      sourceId: options.sourceId,
      // Listagem pública de empresa via API oficial — base legal B2B declarada
      legalBasis: "legitimate_interest",
      consentStatus: "unknown",
    })
    .returning();

  const { computeLeadScore, signalsFromLeadData } = await import(
    "@/server/services/scoring"
  );
  const { saveLeadScore } = await import("@/server/db/repositories/scoring");
  const score = computeLeadScore(
    signalsFromLeadData({
      company: company
        ? {
            website: company.website,
            instagram: company.instagram,
            facebook: company.facebook,
            linkedin: company.linkedin,
            city: company.city,
            state: company.state,
            addressLine: company.addressLine,
            phone: company.phone,
            category: company.category,
            externalId: company.externalId,
            userRatingCount: company.userRatingCount,
          }
        : null,
      contact: null,
      orgCategories: options.orgCategories,
      latestAnalysisOpportunityScore: null,
    }),
    options.scoreWeights
  );

  await saveLeadScore(db, {
    organizationId,
    leadId: lead.id,
    total: score.total,
    classification: score.classification,
    breakdown: score.breakdown,
    weightsSnapshot: options.scoreWeights,
  });

  await recordActivity(db, {
    organizationId,
    type: "lead_created",
    entityType: "lead",
    entityId: lead.id,
    metadata: { source: options.sourceName, sourceType: "discovery" },
  });

  return { lead, created: true };
}

export type UpsertLeadResult = {
  lead: typeof leads.$inferSelect;
  created: boolean;
  companyCreated: boolean;
  contactCreated: boolean;
};

/**
 * Fluxo central de entrada de leads (manual, captura, CSV):
 * normaliza → dedup empresa → dedup contato → dedup lead.
 * Nunca cria duplicados (gate da Phase 2).
 */
export async function upsertLead(
  db: TenantDb,
  organizationId: string,
  input: {
    contactName: string;
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    category?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    jobTitle?: string | null;
    notes?: string | null;
    sourceUrl?: string | null;
  },
  options: {
    sourceId: string | null;
    sourceName: string;
    sourceType: "manual" | "csv" | "capture" | "discovery";
    actorId?: string | null;
    legalBasis?: "consent" | "legitimate_interest" | "contract" | "other" | null;
    consentStatus?: "unknown" | "granted" | "refused";
    extraMetadata?: Record<string, unknown>;
    /** Categorias do negócio da org — alimentam o sinal segment_match. */
    orgCategories?: string[];
    /** Pesos de scoring configurados (defaults da spec se ausentes). */
    scoreWeights?: Record<string, number>;
  }
): Promise<UpsertLeadResult> {
  const hasCompany = Boolean(input.companyName && input.companyName.trim());

  const { company, created: companyCreated } = hasCompany
    ? await upsertCompany(db, organizationId, input, options.sourceId)
    : { company: null as typeof companies.$inferSelect | null, created: false };

  const { contact, created: contactCreated } = await upsertContact(
    db,
    organizationId,
    {
      fullName: input.contactName,
      email: input.email,
      phone: input.phone,
      jobTitle: input.jobTitle,
      notes: input.notes,
    },
    {
      companyId: company?.id ?? null,
      legalBasis: options.legalBasis ?? null,
      consentStatus: options.consentStatus,
    }
  );

  // dedup lead: (company, contact) ou contato isolado
  const leadConditions = [eq(leads.organizationId, organizationId)];
  if (company) leadConditions.push(eq(leads.companyId, company.id));
  leadConditions.push(eq(leads.contactId, contact.id));

  const [existingLead] = await db
    .select()
    .from(leads)
    .where(and(...leadConditions))
    .limit(1);

  if (existingLead) {
    return {
      lead: existingLead,
      created: false,
      companyCreated: false,
      contactCreated: false,
    };
  }

  const now = new Date().toISOString();
  const [lead] = await db
    .insert(leads)
    .values({
      organizationId,
      companyId: company?.id ?? null,
      contactId: contact.id,
      stage: "new",
      sourceId: options.sourceId,
      sourceUrl: input.sourceUrl ?? null,
      legalBasis: options.legalBasis ?? null,
      consentStatus: options.consentStatus ?? "unknown",
      consentAt: options.consentStatus === "granted" ? now : null,
      notes: input.notes ?? null,
    })
    .returning();

  // Score de nascimento — determinístico e auditável (histórico em lead_scores)
  const score = computeLeadScore(
    signalsFromRawInput({
      companyName: input.companyName ?? null,
      website: input.website ?? null,
      category: input.category ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      orgCategories: options.orgCategories,
    }),
    options.scoreWeights ?? DEFAULT_SCORE_WEIGHTS
  );

  await saveLeadScore(db, {
    organizationId,
    leadId: lead.id,
    total: score.total,
    classification: score.classification,
    breakdown: score.breakdown,
    weightsSnapshot: options.scoreWeights ?? DEFAULT_SCORE_WEIGHTS,
  });

  await recordActivity(db, {
    organizationId,
    type: "lead_created",
    entityType: "lead",
    entityId: lead.id,
    actorId: options.actorId ?? null,
    metadata: {
      source: options.sourceName,
      sourceType: options.sourceType,
      ...options.extraMetadata,
    },
  });

  return { lead, created: true, companyCreated, contactCreated };
}

// ---------- Listagens ----------

export type LeadListItem = {
  id: string;
  stage: LeadStage;
  score: number | null;
  createdAt: string;
  consentStatus: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  cityName: string | null;
  stateName: string | null;
  sourceName: string | null;
  sourceType: string | null;
};

export async function listLeads(
  db: TenantDb,
  organizationId: string,
  filters: { q?: string; stage?: LeadStage; page: number; pageSize: number }
): Promise<{ items: LeadListItem[]; total: number }> {
  const conditions = [eq(leads.organizationId, organizationId)];
  if (filters.stage) conditions.push(eq(leads.stage, filters.stage));

  const whereLeads = filters.q
    ? and(
        ...conditions,
        or(
          ilike(contacts.fullName, `%${filters.q}%`),
          ilike(companies.name, `%${filters.q}%`),
          ilike(contacts.email, `%${filters.q}%`)
        )
      )
    : and(...conditions);

  const rows = await db
    .select({
      id: leads.id,
      stage: leads.stage,
      score: leads.score,
      createdAt: leads.createdAt,
      consentStatus: leads.consentStatus,
      contactName: contacts.fullName,
      email: contacts.email,
      phone: contacts.phone,
      companyName: companies.name,
      cityName: companies.city,
      stateName: companies.state,
      sourceName: leadSources.name,
      sourceType: leadSources.type,
    })
    .from(leads)
    .leftJoin(contacts, eq(contacts.id, leads.contactId))
    .leftJoin(companies, eq(companies.id, leads.companyId))
    .leftJoin(leadSources, eq(leadSources.id, leads.sourceId))
    .where(whereLeads)
    .orderBy(desc(leads.createdAt))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);

  const [totals] = await db
    .select({ total: count() })
    .from(leads)
    .leftJoin(contacts, eq(contacts.id, leads.contactId))
    .leftJoin(companies, eq(companies.id, leads.companyId))
    .where(whereLeads);

  return { items: rows, total: Number(totals?.total ?? 0) };
}

export type LeadDetail = NonNullable<Awaited<ReturnType<typeof getLeadById>>>;

export async function getLeadById(
  db: TenantDb,
  organizationId: string,
  leadId: string
) {
  const [lead] = await db
    .select({
      lead: leads,
      contact: contacts,
      company: companies,
      sourceName: leadSources.name,
      sourceType: leadSources.type,
    })
    .from(leads)
    .leftJoin(contacts, eq(contacts.id, leads.contactId))
    .leftJoin(companies, eq(companies.id, leads.companyId))
    .leftJoin(leadSources, eq(leadSources.id, leads.sourceId))
    .where(and(eq(leads.organizationId, organizationId), eq(leads.id, leadId)))
    .limit(1);
  return lead ?? null;
}

export async function listLeadActivities(
  db: TenantDb,
  organizationId: string,
  leadId: string,
  limit = 50
) {
  return db
    .select()
    .from(activities)
    .where(
      and(
        eq(activities.organizationId, organizationId),
        eq(activities.entityType, "lead"),
        eq(activities.entityId, leadId)
      )
    )
    .orderBy(desc(activities.createdAt))
    .limit(limit);
}

export async function listLeadTags(db: TenantDb, organizationId: string, leadId: string) {
  return db
    .select({ id: tags.id, name: tags.name, color: tags.color })
    .from(leadTags)
    .innerJoin(tags, eq(tags.id, leadTags.tagId))
    .where(
      and(
        eq(leadTags.leadId, leadId),
        eq(tags.organizationId, organizationId)
      )
    )
    .orderBy(asc(tags.name));
}

export async function listOrgTags(db: TenantDb, organizationId: string) {
  return db
    .select()
    .from(tags)
    .where(eq(tags.organizationId, organizationId))
    .orderBy(asc(tags.name));
}

export async function getOrCreateTag(
  db: TenantDb,
  organizationId: string,
  name: string
): Promise<typeof tags.$inferSelect> {
  const [existing] = await db
    .select()
    .from(tags)
    .where(
      and(
        eq(tags.organizationId, organizationId),
        sql`lower(${tags.name}) = lower(${name})`
      )
    )
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(tags)
    .values({ organizationId, name })
    .returning();
  return created;
}

export async function attachLeadTag(
  db: TenantDb,
  leadId: string,
  tagId: string
): Promise<void> {
  await db.insert(leadTags).values({ leadId, tagId }).onConflictDoNothing();
}

export async function detachLeadTag(
  db: TenantDb,
  leadId: string,
  tagId: string
): Promise<void> {
  await db
    .delete(leadTags)
    .where(and(eq(leadTags.leadId, leadId), eq(leadTags.tagId, tagId)));
}

export async function updateLeadStage(
  db: TenantDb,
  organizationId: string,
  leadId: string,
  stage: LeadStage,
  actorId?: string | null
): Promise<void> {
  await db
    .update(leads)
    .set({ stage, updatedAt: new Date().toISOString() })
    .where(and(eq(leads.organizationId, organizationId), eq(leads.id, leadId)));

  await recordActivity(db, {
    organizationId,
    type: "stage_changed",
    entityType: "lead",
    entityId: leadId,
    actorId: actorId ?? null,
    metadata: { stage },
  });
}

// ---------- Companies (listagem) ----------

export async function listCompanies(
  db: TenantDb,
  organizationId: string,
  filters: { q?: string; page: number; pageSize: number }
) {
  const conditions = [eq(companies.organizationId, organizationId)];
  if (filters.q) {
    const q = `%${filters.q}%`;
    conditions.push(
      or(ilike(companies.name, q), ilike(companies.city, q), ilike(companies.category, q))!
    );
  }
  const where = and(...conditions);

  const rows = await db
    .select({
      id: companies.id,
      name: companies.name,
      category: companies.category,
      city: companies.city,
      state: companies.state,
      website: companies.website,
      phone: companies.phone,
      leadCount: count(leads.id),
    })
    .from(companies)
    .leftJoin(leads, eq(leads.companyId, companies.id))
    .where(where)
    .groupBy(companies.id)
    .orderBy(desc(companies.updatedAt))
    .limit(filters.pageSize)
    .offset((filters.page - 1) * filters.pageSize);

  const [totals] = await db
    .select({ total: count() })
    .from(companies)
    .where(where);

  return { items: rows, total: Number(totals?.total ?? 0) };
}

// ---------- Dashboard ----------

export async function leadsOverviewCounts(db: TenantDb, organizationId: string) {
  const rows = await db
    .select({ stage: leads.stage, total: count() })
    .from(leads)
    .where(eq(leads.organizationId, organizationId))
    .groupBy(leads.stage);
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.stage] = Number(row.total);
    return acc;
  }, {});
}

export async function recentLeads(
  db: TenantDb,
  organizationId: string,
  limit = 5
): Promise<LeadListItem[]> {
  const { items } = await listLeads(db, organizationId, { page: 1, pageSize: limit });
  return items;
}

export async function leadsByIds(db: TenantDb, organizationId: string, ids: string[]) {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(leads)
    .where(and(eq(leads.organizationId, organizationId), inArray(leads.id, ids)));
}
