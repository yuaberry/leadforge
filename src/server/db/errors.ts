/**
 * LEADFORGE — Acesso ao código de erro do Postgres.
 *
 * O Drizzle com o adapter postgres-js encapsula o erro do driver:
 *
 *   erro.message  → "Failed query: insert into ..."
 *   erro.cause    → PostgresError { code: "23505", ... }
 *
 * O `code` do Postgres (23505 = unique_violation, 23503 = foreign_key_violation)
 * fica no `cause`, não no erro externo. Checar apenas `erro.code` faz o
 * tratamento de conflito silenciosamente falhar — o app deixaria de tratar
 * duplicatas (retry de slug, captura pública, idempotência de meta).
 *
 * Esta função normaliza os dois formatos (com e sem `cause`).
 */

export function postgresErrorCode(erro: unknown): string | null {
  if (!erro || typeof erro !== "object") return null;

  const direct = (erro as { code?: unknown }).code;
  if (typeof direct === "string") return direct;

  const cause = (erro as { cause?: unknown }).cause;
  if (cause && typeof cause === "object") {
    const nested = (cause as { code?: unknown }).code;
    if (typeof nested === "string") return nested;
  }

  return null;
}

/** true quando o erro é violação de chave única (23505). */
export function isUniqueViolation(erro: unknown): boolean {
  return postgresErrorCode(erro) === "23505";
}
