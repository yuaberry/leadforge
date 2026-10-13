import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

/**
 * Factory do cliente Drizzle (postgres-js).
 * A conexão é lazy — só é criada quando a factory é invocada com
 * DATABASE_URL válido. Nenhum módulo deve instanciar no import-time.
 *
 * Na Phase 1 o schema real é adicionado e o client passa a ser
 * instanciado por request (com o pooler do Supabase).
 */
export type Db = PostgresJsDatabase<Record<string, never>>;

export function createDb(databaseUrl: string): Db {
  const client = postgres(databaseUrl, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return drizzle(client);
}
