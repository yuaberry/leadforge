/**
 * LEADFORGE — Mock local da API de Auth do Supabase (SOMENTE TESTES).
 *
 * POR QUE EXISTE:
 *   O LeadForge usa o Supabase Auth (GoTrue) para login. Para testar o app
 *   de ponta a ponta em uma máquina local — sem um projeto Supabase real —
 *   este servidor implementa o contrato HTTP que o @supabase/ssr usa:
 *
 *     POST /auth/v1/token?grant_type=password  → sessão (access_token JWT)
 *     POST /auth/v1/token?grant_type=refresh_token → renova a sessão
 *     POST /auth/v1/signup                      → cria usuário + sessão
 *     GET  /auth/v1/user                        → usuário do Bearer token
 *     POST /auth/v1/logout                      → encerra
 *
 *   O access_token é um JWT sem assinatura (HS256, chave fixa local). O
 *   servidor do LeadForge NÃO valida a assinatura — ele decodifica o payload
 *   e usa as claims para o RLS (ver src/server/auth/jwt-claims.ts). Então,
 *   para testes, basta um JWT bem formado.
 *
 * ⚠️ NÃO É PARA PRODUÇÃO. Nunca aponte NEXT_PUBLIC_SUPABASE_URL para este
 *    servidor em um ambiente real: qualquer pessoa consegue entrar.
 *
 * Uso:
 *   bun run scripts/mock-supabase-auth.ts        # porta 54399
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=local-anon-key
 */
import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import postgres from "postgres";

const PORT = Number(process.env.MOCK_AUTH_PORT ?? 54399);
const SECRET = "leadforge-local-mock-secret";
const TOKEN_TTL_SECONDS = 60 * 60 * 8;

/**
 * O GoTrue real grava o usuário em auth.users (e o trigger do LeadForge cria
 * o perfil em public.users). O mock faz o mesmo, para que o app funcione
 * de ponta a ponta contra o banco local.
 */
const dbUrl = process.env.DATABASE_URL;
const sql = dbUrl ? postgres(dbUrl, { max: 2 }) : null;

type MockUser = {
  id: string;
  aud: string;
  role: string;
  email: string;
  email_confirmed_at: string;
  phone: string;
  confirmed_at: string;
  last_sign_in_at: string;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, string>;
  identities: unknown[];
  created_at: string;
  updated_at: string;
  is_anonymous: boolean;
};

/** usuários do mock — persistidos em memória durante o processo */
const users = new Map<string, MockUser>();
const passwords = new Map<string, string>();

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function signJwt(payload: Record<string, unknown>): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(
    JSON.stringify({ ...payload, iat: now, exp: now + TOKEN_TTL_SECONDS, iss: "leadforge-local" })
  );
  const signature = base64url(`${header}.${body}.${SECRET}`);
  return `${header}.${body}.${signature}`;
}

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function publicUser(user: MockUser) {
  return {
    id: user.id,
    aud: user.aud,
    role: user.role,
    email: user.email,
    email_confirmed_at: user.email_confirmed_at,
    phone: user.phone,
    confirmed_at: user.confirmed_at,
    last_sign_in_at: user.last_sign_in_at,
    app_metadata: user.app_metadata,
    user_metadata: user.user_metadata,
    identities: [],
    created_at: user.created_at,
    updated_at: user.updated_at,
    is_anonymous: false,
  };
}

function sessionFor(user: MockUser) {
  const accessToken = signJwt({
    sub: user.id,
    email: user.email,
    phone: user.phone,
    role: "authenticated",
    aud: "authenticated",
    session_id: randomUUID(),
  });
  return {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: TOKEN_TTL_SECONDS,
    expires_at: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    refresh_token: signJwt({ sub: user.id, type: "refresh" }),
    user: publicUser(user),
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
  });
}

function error(message: string, status = 400, code = "400"): Response {
  return json({ message, error_code: code, error: message }, status);
}

function parseJson(raw: string): Record<string, unknown> {
  try {
    return (JSON.parse(raw || "{}") ?? {}) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function findUserByEmail(email: string): MockUser | undefined {
  return [...users.values()].find((user) => user.email.toLowerCase() === email.toLowerCase());
}

/** Garante o usuário em auth.users (dispara o trigger que cria public.users). */
async function ensureAuthUser(user: MockUser): Promise<void> {
  if (!sql) return;
  try {
    await sql`
      INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at)
      VALUES (
        ${user.id},
        ${user.email},
        ${sql.json(user.user_metadata)},
        ${user.created_at},
        ${user.updated_at}
      )
      ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            raw_user_meta_data = EXCLUDED.raw_user_meta_data,
            updated_at = now()
    `;
  } catch (erro) {
    console.error("[mock-supabase-auth] falha ao gravar em auth.users:", erro);
  }
}

async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  const rawBody = Buffer.concat(chunks).toString("utf8");

  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
  const path = url.pathname;
  const method = request.method ?? "GET";

  const reply = (result: Response) => {
    const headers: Record<string, string> = {};
    result.headers.forEach((value, key) => {
      headers[key] = value;
    });
    response.writeHead(result.status, headers);
    response.end(result.status === 204 ? undefined : result.body);
  };

  try {
    if (method === "OPTIONS") {
      reply(json({}, 204));
      return;
    }

    // ---------- token (password / refresh) ----------
    if (path === "/auth/v1/token") {
      const grantType = url.searchParams.get("grant_type");

      if (grantType === "refresh_token") {
        const body = parseJson(rawBody);
        const claims = decodeJwt(String(body.refresh_token ?? ""));
        const user = claims?.sub ? users.get(String(claims.sub)) : undefined;
        if (!user) {
          reply(error("Invalid Refresh Token: Refresh Token Not Found", 400, "refresh_token_not_found"));
          return;
        }
        reply(json(sessionFor(user)));
        return;
      }

      const body = parseJson(rawBody);
      const email = String(body.email ?? "");
      const password = String(body.password ?? "");
      const user = findUserByEmail(email);

      if (!user || passwords.get(user.id) !== password) {
        reply(error("Invalid login credentials", 400, "invalid_credentials"));
        return;
      }

      user.last_sign_in_at = new Date().toISOString();
      await ensureAuthUser(user);
      reply(json(sessionFor(user)));
      return;
    }

    // ---------- signup ----------
    if (path === "/auth/v1/signup" && method === "POST") {
      const body = parseJson(rawBody);
      const email = String(body.email ?? "");
      const password = String(body.password ?? "");
      const metadata = (body.data ?? {}) as Record<string, unknown>;

      if (!email || password.length < 6) {
        reply(error("Password should be at least 6 characters", 422, "weak_password"));
        return;
      }
      if (findUserByEmail(email)) {
        reply(error("User already registered", 422, "user_already_exists"));
        return;
      }

      const now = new Date().toISOString();
      const user: MockUser = {
        id: randomUUID(),
        aud: "authenticated",
        role: "authenticated",
        email,
        email_confirmed_at: now,
        phone: "",
        confirmed_at: now,
        last_sign_in_at: now,
        app_metadata: { provider: "email", providers: ["email"] },
        user_metadata: Object.fromEntries(
          Object.entries(metadata).map(([key, value]) => [key, String(value)])
        ),
        identities: [],
        created_at: now,
        updated_at: now,
        is_anonymous: false,
      };
      users.set(user.id, user);
      passwords.set(user.id, password);
      await ensureAuthUser(user);

      reply(json(sessionFor(user)));
      return;
    }

    // ---------- user (Bearer) ----------
    if (path === "/auth/v1/user") {
      const auth = request.headers.authorization ?? "";
      const token = auth.replace(/^Bearer\s+/i, "");
      const claims = decodeJwt(token);
      const user = claims?.sub ? users.get(String(claims.sub)) : undefined;
      if (!user) {
        reply(error("Invalid JWT", 401, "invalid_jwt"));
        return;
      }
      reply(json(publicUser(user)));
      return;
    }

    // ---------- logout ----------
    if (path === "/auth/v1/logout") {
      reply(json({}, 204));
      return;
    }

    if (path === "/auth/v1/health") {
      reply(json({ version: "local-mock", name: "LeadForge Local Auth" }));
      return;
    }

    reply(error(`Rota não suportada pelo mock: ${method} ${path}`, 404, "not_found"));
  } catch (erro) {
    console.error("[mock-supabase-auth] erro:", erro);
    reply(error("Erro interno do mock", 500, "internal_error"));
  }
}

const server = createServer((request, response) => {
  void handleRequest(request, response);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[mock-supabase-auth] ouvindo em http://127.0.0.1:${PORT}`);
  console.log("[mock-supabase-auth] use NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399");
});
