/**
 * Acesso centralizado a variáveis de ambiente.
 * Regras de segurança:
 * - NEXT_PUBLIC_* podem ser lidos no cliente (animação de config UI);
 * - TODO o resto é server-only e jamais deve ser importado por componentes.
 */

export const CONFIG_PENDING_MESSAGE =
  "Supabase ainda não configurado. Crie um projeto em supabase.com, defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local e reinicie o servidor.";

export function getSupabaseEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseEnv();
  return Boolean(url && anonKey);
}
