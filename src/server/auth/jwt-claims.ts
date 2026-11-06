import "server-only";

/**
 * LEADFORGE — Claims do JWT para o Postgres.
 *
 * POR QUE ISTO EXISTE:
 *   O Postgres não sabe decodificar JWT. O Supabase resolve isso em
 *   `auth.uid()` / `auth.jwt()` lendo as claims da sessão:
 *
 *     - `request.jwt.claims`       → payload JSON completo do JWT
 *     - `request.jwt.claim.sub`    → apenas o subject (implementação antiga)
 *     - `request.jwt.claim.role`   → role do JWT
 *     - `request.jwt.claim.email`  → e-mail do JWT
 *
 *   Bug original: o app gravava o ACCESS TOKEN CRU em `request.jwt.claims`.
 *   Nenhuma das implementações do Supabase entende um JWT como JSON:
 *     - na versão por `claim.sub` → auth.uid() retorna NULL (RLS nega tudo);
 *     - na versão por `::jsonb`    → erro "invalid input syntax for type json".
 *   Ou seja: o app inteiro não enxergaria dados com um Supabase real.
 *
 *   A correção é decodificar o payload do JWT e gravar as claims no formato
 *   que o Supabase espera — exatamente o que o PostgREST faz.
 */

export type JwtClaims = {
  sub?: string;
  role?: string;
  email?: string;
  [key: string]: unknown;
};

export type ClaimSetting = { name: string; value: string };

/**
 * Extrai as claims de um access token.
 *
 * Aceita dois formatos:
 *   1. JWT (header.payload.signature) — payload em base64url (produção);
 *   2. JSON já decodificado — usado por testes e integrações internas.
 *
 * Nunca lança: token inválido devolve claims vazias (a sessão é rejeitada
 * pelas policies de RLS, que é o comportamento seguro).
 */
export function decodeJwtClaims(accessToken: string): JwtClaims {
  const token = accessToken.trim();
  if (!token) return {};

  // 1) JSON direto
  if (token.startsWith("{")) {
    const parsed = tryParseJson(token);
    if (parsed) return parsed;
  }

  // 2) JWT — payload é a segunda parte, em base64url
  const parts = token.split(".");
  if (parts.length === 3 && parts[1]) {
    try {
      const payload = Buffer.from(parts[1], "base64url").toString("utf8");
      const parsed = tryParseJson(payload);
      if (parsed) return parsed;
    } catch {
      // token malformado → sem claims
    }
  }

  return {};
}

/**
 * Converte as claims em settings de sessão do Postgres.
 * Sempre inclui `request.jwt.claims` (JSON) e, quando presentes, as
 * claims individuais (`request.jwt.claim.*`) — cobrindo as duas
 * implementações de auth.uid() que coexistem no Supabase.
 */
export function jwtClaimSettings(claims: JwtClaims): ClaimSetting[] {
  const settings: ClaimSetting[] = [
    { name: "request.jwt.claims", value: JSON.stringify(claims) },
  ];

  if (claims.sub) {
    settings.push({ name: "request.jwt.claim.sub", value: String(claims.sub) });
  }
  if (claims.role) {
    settings.push({ name: "request.jwt.claim.role", value: String(claims.role) });
  }
  if (claims.email) {
    settings.push({ name: "request.jwt.claim.email", value: String(claims.email) });
  }

  return settings;
}

function tryParseJson(value: string): JwtClaims | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as JwtClaims;
    }
  } catch {
    // não é JSON
  }
  return null;
}
