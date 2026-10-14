import "server-only";

import { and, eq } from "drizzle-orm";

import { IMPORT_FIELDS, type ImportFieldKey, type ImportMapping } from "@/server/services/csv";
import { importBatches } from "@/server/db/schema";
import type { TenantDb } from "@/server/db/tenant";
import { getOrCreateSource, recordActivity, upsertLead } from "@/server/db/repositories/leads";

// ---------- Batch lifecycle ----------

export async function insertImportBatch(
  db: TenantDb,
  values: typeof importBatches.$inferInsert
): Promise<typeof importBatches.$inferSelect> {
  const [batch] = await db.insert(importBatches).values(values).returning();
  return batch;
}

export async function getImportBatch(
  db: TenantDb,
  organizationId: string,
  batchId: string
): Promise<typeof importBatches.$inferSelect | null> {
  const [batch] = await db
    .select()
    .from(importBatches)
    .where(
      and(eq(importBatches.organizationId, organizationId), eq(importBatches.id, batchId))
    )
    .limit(1);
  return batch ?? null;
}

export async function updateImportBatch(
  db: TenantDb,
  organizationId: string,
  batchId: string,
  patch: Partial<typeof importBatches.$inferInsert>
): Promise<void> {
  await db
    .update(importBatches)
    .set(patch)
    .where(
      and(eq(importBatches.organizationId, organizationId), eq(importBatches.id, batchId))
    );
}

// ---------- Validação de linhas ----------

export type RowValidation = { valid: boolean; error?: string };

/** Regra: precisa de e-mail OU telefone OU (empresa + nome). */
export function validateMappedRow(row: Record<string, string | undefined>): RowValidation {
  const email = (row.email ?? "").trim();
  const phone = (row.phone ?? "").trim();
  const company = (row.company ?? "").trim();
  const name = (row.name ?? "").trim();

  if (email.length > 200) return { valid: false, error: "E-mail muito longo" };
  if (phone.length > 40) return { valid: false, error: "Telefone muito longo" };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { valid: false, error: `E-mail inválido: "${email}"` };
  }

  const hasContactKey = email.length > 0 || phone.length > 0;
  const hasCompanyLead = company.length > 0 && name.length > 0;

  if (!hasContactKey && !hasCompanyLead) {
    return {
      valid: false,
      error: "Linha sem e-mail, telefone ou empresa+nome — impossível criar um lead",
    };
  }

  if (!name && !company) {
    return { valid: false, error: "Sem nome e sem empresa para identificar o lead" };
  }

  return { valid: true };
}

export function mapRow(
  rawRow: string[],
  mapping: ImportMapping
): Record<string, string | undefined> {
  const mapped: Record<string, string | undefined> = {};
  for (const field of IMPORT_FIELDS) {
    const index = mapping[field.key as ImportFieldKey];
    if (typeof index === "number" && index >= 0) {
      mapped[field.key] = (rawRow[index] ?? "").trim() || undefined;
    }
  }
  return mapped;
}

// ---------- Execução em chunks ----------

export type ImportProgress = {
  processed: number;
  createdLeads: number;
  createdCompanies: number;
  createdContacts: number;
  duplicates: number;
  errors: { row: number; message: string }[];
};

export const IMPORT_CHUNK_SIZE = 50;

/**
 * Processa o próximo chunk de linhas do lote (idempotente e resumível —
 * o progresso vive em batch.results). Na Phase 6 isto migra para o worker
 * da fila; por ora, a UI conduz os chunks com feedback honesto.
 */
export async function runImportChunk(
  db: TenantDb,
  input: {
    organizationId: string;
    userId: string;
    batch: typeof importBatches.$inferSelect;
    orgCategories?: string[];
    scoreWeights?: Record<string, number>;
  }
): Promise<{ done: boolean; progress: ImportProgress }> {
  const { batch, organizationId, userId } = input;

  const rows = batch.rows as string[][];
  const mapping = batch.mapping as ImportMapping;
  const progress: ImportProgress = {
    processed: 0,
    createdLeads: 0,
    createdCompanies: 0,
    createdContacts: 0,
    duplicates: 0,
    ...(typeof batch.results === "object" && batch.results !== null
      ? ((batch.results as Partial<ImportProgress>))
      : {}),
    errors:
      typeof batch.results === "object" && batch.results !== null &&
      Array.isArray((batch.results as ImportProgress).errors)
        ? ((batch.results as ImportProgress).errors)
        : [],
  };

  // linhas inválidas ficam de fora do processamento, mas contam no progresso
  const startAt = Number(progress.processed ?? 0);
  if (startAt >= rows.length) {
    return { done: true, progress };
  }

  // pré-valida o chunk inteiro
  const chunkPlan: { rowIndex: number; row: Record<string, string | undefined> }[] = [];
  let cursor = startAt;
  let planned = 0;

  while (cursor < rows.length && planned < IMPORT_CHUNK_SIZE) {
    const mapped = mapRow(rows[cursor], mapping);
    const validation = validateMappedRow(mapped);
    if (!validation.valid) {
      progress.errors.push({ row: cursor + 1, message: validation.error ?? "Erro" });
    } else {
      chunkPlan.push({ rowIndex: cursor, row: mapped });
    }
    cursor++;
    planned++;
  }

  progress.processed = cursor;

  // executa o chunk
  const source = await getOrCreateSource(
    db,
    organizationId,
    batch.provenanceSource.slice(0, 200),
    "csv"
  );

  for (const { row } of chunkPlan) {
    const result = await upsertLead(
      db,
      organizationId,
      {
        contactName: row.name ?? "",
        companyName: row.company ?? null,
        email: row.email ?? null,
        phone: row.phone ?? null,
        website: row.website ?? null,
        category: row.category ?? null,
        city: row.city ?? null,
        state: row.state ?? null,
        country: row.country ?? null,
        jobTitle: row.jobTitle ?? null,
        notes: row.notes ?? null,
      },
      {
        sourceId: source.id,
        sourceName: batch.provenanceSource,
        sourceType: "csv",
        actorId: userId,
        legalBasis: batch.legalBasis,
        consentStatus: batch.legalBasis === "consent" ? "granted" : "unknown",
        orgCategories: input.orgCategories,
        scoreWeights: input.scoreWeights,
        extraMetadata: { importBatchId: batch.id, filename: batch.filename },
      }
    );

    if (result.created) progress.createdLeads++;
    else progress.duplicates++;
    if (result.companyCreated) progress.createdCompanies++;
    if (result.contactCreated) progress.createdContacts++;
  }

  const done = cursor >= rows.length;

  await updateImportBatch(db, organizationId, batch.id, {
    status: done ? "completed" : "mapped",
    results: progress,
    completedAt: done ? new Date().toISOString() : null,
  });

  if (done) {
    await recordActivity(db, {
      organizationId,
      type: "import_completed",
      entityType: "import_batch",
      entityId: batch.id,
      actorId: userId,
      metadata: {
        filename: batch.filename,
        total: rows.length,
        createdLeads: progress.createdLeads,
        duplicates: progress.duplicates,
        errors: progress.errors.length,
        legalBasis: batch.legalBasis,
        provenance: batch.provenanceSource,
      },
    });
  }

  return { done, progress };
}
