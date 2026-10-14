import "server-only";

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Conexão de SERVIÇO (bypassa RLS — o owner das tabelas não é afetado por policies).
 *
 * ⚠️ USO RESTRITO: migrations, seeds e jobs administrativos futuros.
 * Toda operação de negócio deve usar withTenantDb (src/server/db/tenant.ts),
 * que roda sob RLS com as claims do usuário autenticado.
 */

export type ServiceDb = NodePgDatabase<typeof schema>;

let serviceDb: ServiceDb | null = null;

export function getServiceDb(): ServiceDb {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL não configurado. Veja .env.example.");
  }
  if (!serviceDb) {
    const client = postgres(url, { max: 3, idle_timeout: 20, connect_timeout: 10 });
    serviceDb = drizzle(client, { schema });
  }
  return serviceDb;
}
