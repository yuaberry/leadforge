"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOrgContext } from "@/server/auth/session";
import { withTenantDb } from "@/server/db/tenant";
import {
  getImportBatch,
  insertImportBatch,
  runImportChunk,
  updateImportBatch,
  type ImportProgress,
} from "@/server/db/repositories/imports";
import { guessMapping, IMPORT_LIMITS, parseCsv, type ImportMapping } from "@/server/services/csv";
import { createImportBatchSchema, importMappingSchema } from "@/validators/import";

type ImportState = { error?: string } | null;

export async function createImportBatchAction(
  _prev: ImportState,
  formData: FormData
): Promise<ImportState> {
  const ctx = await requireOrgContext();

  const parsed = createImportBatchSchema.safeParse({
    provenanceSource: String(formData.get("provenanceSource") ?? ""),
    legalBasis: String(formData.get("legalBasis") ?? ""),
    confirmedRights: formData.get("confirmedRights") === "on" ? "on" : "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione um arquivo CSV." };
  }
  if (file.size > IMPORT_LIMITS.maxFileBytes) {
    return { error: "Arquivo maior que 2 MB." };
  }
  if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
    return { error: "Envie um arquivo .csv." };
  }

  const text = await file.text();
  const { headers, rows } = parseCsv(text);

  if (headers.length === 0) return { error: "Arquivo vazio ou sem cabeçalho." };
  if (headers.length > IMPORT_LIMITS.maxColumns) {
    return { error: `Máximo de ${IMPORT_LIMITS.maxColumns} colunas.` };
  }
  if (rows.length === 0) return { error: "Nenhuma linha de dados encontrada." };
  if (rows.length > IMPORT_LIMITS.maxRows) {
    return { error: `Máximo de ${IMPORT_LIMITS.maxRows} linhas por importação (recebidas: ${rows.length}).` };
  }

  let batchId: string;

  try {
    const batch = await withTenantDb(ctx.accessToken, (db) =>
      insertImportBatch(db, {
        organizationId: ctx.organization.id,
        createdBy: ctx.user.id,
        filename: file.name,
        provenanceSource: parsed.data.provenanceSource,
        legalBasis: parsed.data.legalBasis,
        headers,
        rows,
        mapping: guessMapping(headers),
        totalRows: rows.length,
      })
    );
    batchId = batch.id;
  } catch (erro) {
    return { error: erro instanceof Error ? erro.message : "Erro ao preparar a importação." };
  }

  revalidatePath("/import");
  redirect(`/import/${batchId}`);
}

export async function saveMappingAction(
  _prev: ImportState,
  formData: FormData
): Promise<ImportState> {
  const ctx = await requireOrgContext();

  const parsed = importMappingSchema.safeParse({
    batchId: String(formData.get("batchId") ?? ""),
    mapping: String(formData.get("mapping") ?? "{}"),
  });
  if (!parsed.success) return { error: "Mapeamento inválido." };

  let mapping: ImportMapping;
  try {
    mapping = JSON.parse(parsed.data.mapping) as ImportMapping;
  } catch {
    return { error: "Mapeamento inválido." };
  }

  const headersCount = Number(formData.get("headersCount") ?? "0");
  for (const [field, index] of Object.entries(mapping)) {
    if (typeof index !== "number" || index < 0 || index >= headersCount) {
      return { error: `Coluna inválida para o campo "${field}".` };
    }
  }

  try {
    const ok = await withTenantDb(ctx.accessToken, async (db) => {
      const batch = await getImportBatch(db, ctx.organization.id, parsed.data.batchId);
      if (!batch || batch.status !== "preview") return false;
      await updateImportBatch(db, ctx.organization.id, batch.id, {
        mapping,
        status: "mapped",
      });
      return true;
    });
    if (!ok) return { error: "Lote não encontrado ou já mapeado." };
  } catch (erro) {
    return { error: erro instanceof Error ? erro.message : "Erro ao salvar mapeamento." };
  }

  revalidatePath(`/import/${parsed.data.batchId}`);
  return null;
}

export type ChunkResult =
  | { ok: true; done: boolean; progress: ImportProgress }
  | { ok: false; error: string };

/**
 * Executa UM chunk do lote. A UI chama repetidamente até done=true —
 * na Fase 6 isto vira job da fila (worker), sem mudar o contrato.
 */
export async function runImportChunkAction(batchId: string): Promise<ChunkResult> {
  const ctx = await requireOrgContext();

  try {
    return await withTenantDb(ctx.accessToken, async (db) => {
      const batch = await getImportBatch(db, ctx.organization.id, batchId);
      if (!batch) return { ok: false as const, error: "Lote não encontrado." };
      if (batch.status === "completed") {
        return {
          ok: true as const,
          done: true,
          progress: (batch.results as ImportProgress | null) ?? {
            processed: batch.totalRows,
            createdLeads: 0,
            createdCompanies: 0,
            createdContacts: 0,
            duplicates: 0,
            errors: [],
          },
        };
      }
      if (batch.status !== "mapped") {
        return { ok: false as const, error: "Salve o mapeamento antes de importar." };
      }

      const { done, progress } = await runImportChunk(db, {
        organizationId: ctx.organization.id,
        userId: ctx.user.id,
        batch,
      });

      return { ok: true as const, done, progress };
    });
  } catch (erro) {
    return {
      ok: false,
      error: erro instanceof Error ? erro.message : "Erro ao processar o lote.",
    };
  }
}
