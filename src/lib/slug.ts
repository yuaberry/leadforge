/**
 * Slugify determinístico para nomes de organizações.
 * Charset seguro: a-z, 0-9 e hífen (máx. 48 caracteres).
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Gera um slug com sufixo aleatório (usado em colisões de unique). */
export function slugifyWithSuffix(input: string, suffix: string): string {
  const base = slugify(input) || "org";
  return `${base}-${suffix}`.slice(0, 56);
}
