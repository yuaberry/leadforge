import "server-only";

import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";
import { decodeJwtClaims, jwtClaimSettings } from "@/server/auth/jwt-claims";

/**
 * Executa `fn` numa transação Postgres com:
 *   - claims da sessão do usuário (mesma fonte do PostgREST)
 *   - role = authenticated
 *
 * Assim, TODA query dentro do callback roda sob Row Level Security —
 * um bug de repository (ex.: WHERE organization_id esquecido) retorna
 * vazio, nunca dados de outro tenant. Defense in depth real.
 *
 * ⚠️ Driver: postgres-js (`drizzle-orm/postgres-js`) + pacote `postgres`.
 *    O adapter `drizzle-orm/node-postgres` exige o pacote `pg`, que NÃO
 *    faz parte das dependências — usá-lo com o cliente postgres.js quebrava
 *    toda query em runtime ("Cannot find package 'pg'").
 *
 * Nota: connection per-request (max: 1). Otimização com pool por usuário
 * fica registrada para a Phase 9 (hardening).
 */

export type TenantDb = PostgresJsDatabase<typeof schema>;

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
      // Claims no formato esperado pelo Supabase (payload JSON do JWT +
      // claims individuais). Ver src/server/auth/jwt-claims.ts.
      const claims = jwtClaimSettings(decodeJwtClaims(accessToken));
      for (const claim of claims) {
        await tx.execute(
          sql`SELECT set_config(${claim.name}, ${claim.value}, true)`
        );
      }
      await tx.execute(sql`SET LOCAL ROLE authenticated`);
      return fn(tx as unknown as TenantDb);
    });
  } finally {
    await client.end({ timeout: 5 });
  }
}
