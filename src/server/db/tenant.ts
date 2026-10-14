import "server-only";

import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Executa `fn` numa transação Postgres com:
 *   - request.jwt.claims = access token do usuário (mesma fonte do PostgREST)
 *   - role = authenticated
 *
 * Assim, TODA query dentro do callback roda sob Row Level Security —
 * um bug de repository (ex.: WHERE organization_id esquecido) retorna
 * vazio, nunca dados de outro tenant. Defense in depth real.
 *
 * Nota: connection per-request (max: 1). Otimização com pool por usuário
 * fica registrada para a Phase 9 (hardening).
 */

export type TenantDb = NodePgDatabase<typeof schema>;

export async function withTenantDb<T>(
  accessToken: string,
  fn: (db: TenantDb) => Promise<T>
): Promise<T> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL não configurado. Veja .env.example.");
  }

  const client = postgres(url, { max: 1, idle_timeout: 5, connect_timeout: 10 });
  const db = drizzle(client, { schema });

  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('request.jwt.claims', ${accessToken}, true)`);
      await tx.execute(sql`SET LOCAL ROLE authenticated`);
      return fn(tx as unknown as TenantDb);
    });
  } finally {
    await client.end({ timeout: 5 });
  }
}
