import Link from "next/link";

/**
 * Paginação via query string (server-rendered, sem JS).
 * buildHref é injetado porque cada página tem seus próprios params.
 */
export function Pagination({
  page,
  total,
  pageSize,
  buildHref,
}: {
  page: number;
  total: number;
  pageSize: number;
  buildHref: (page: number) => string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav className="flex items-center justify-between pt-4" aria-label="Paginação">
      {hasPrev ? (
        <Link
          href={buildHref(page - 1)}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary"
        >
          ← Anterior
        </Link>
      ) : (
        <span className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground/40">
          ← Anterior
        </span>
      )}

      <span className="text-xs text-muted-foreground">
        Página {page} de {totalPages} · {total} registro{total === 1 ? "" : "s"}
      </span>

      {hasNext ? (
        <Link
          href={buildHref(page + 1)}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-secondary"
        >
          Próxima →
        </Link>
      ) : (
        <span className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground/40">
          Próxima →
        </span>
      )}
    </nav>
  );
}
