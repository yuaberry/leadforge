/**
 * Acesso centralizado a variáveis de ambiente.
 *
 * Regras de segurança:
 * - NEXT_PUBLIC_* são embutidas (inlined) no bundle no momento do build —
 *   nunca podem carregar segredo e não servem para config pós-instalação;
 * - server-only (sem NEXT_PUBLIC_) são lidas em RUNTIME — é o que permite ao
 *   app desktop informar a configuração do usuário depois de instalado.
 *
 * Por isso o servidor prioriza SEMPRE as variáveis server-only e só usa as
 * NEXT_PUBLIC_* como fallback (deploy web clássico, onde o build já recebe
 * o .env).
 */

export const CONFIG_PENDING_MESSAGE =
  "Supabase ainda não configurado. Crie um projeto em supabase.com, defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local e reinicie o servidor.";

/** URL do Supabase — server-only tem prioridade (config de runtime). */
export function getSupabaseUrl(): string | undefined {
  return process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
}

/** Chave anon do Supabase — server-only tem prioridade (config de runtime). */
export function getSupabaseAnonKey(): string | undefined {
  return process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export function getSupabaseEnv() {
  return {
    url: getSupabaseUrl(),
    anonKey: getSupabaseAnonKey(),
  };
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseEnv();
  return Boolean(url && anonKey);
}
