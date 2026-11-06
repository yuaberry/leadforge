/**
 * LEADFORGE — Teste de precedência de env (regressão).
 *
 * PROBLEMA HISTÓRICO: o app desktop não era self-contained. O servidor
 * lia a URL do Supabase de `NEXT_PUBLIC_SUPABASE_URL`, que o Next.js
 * INLINE no bundle durante o build. Resultado: o app instalado não conseguia
 * ler a config do usuário — a URL ficava congelada no build da CI.
 *
 * SOLUÇÃO: o servidor lê `SUPABASE_URL` / `SUPABASE_ANON_KEY` (server-only,
 * em runtime) e usa as NEXT_PUBLIC_* apenas como fallback (deploy web).
 *
 * Este teste garante que a precedência server-only NÃO seja perdida.
 */
import { describe, expect, it, afterEach, vi } from "vitest";

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

async function loadEnvModule() {
  // Import dinâmico: o módulo lê process.env no momento da chamada, então
  // basta reimportar para pegar o ambiente alterado.
  vi.resetModules();
  return import("@/lib/env");
}

describe("precedência de env (config de runtime do app desktop)", () => {
  it("SUPABASE_URL (server-only) tem prioridade sobre NEXT_PUBLIC_SUPABASE_URL", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://inlined-no-build.supabase.co";
    process.env.SUPABASE_URL = "http://127.0.0.1:54398";

    const { getSupabaseUrl } = await loadEnvModule();
    expect(getSupabaseUrl()).toBe("http://127.0.0.1:54398");
  });

  it("SUPABASE_ANON_KEY (server-only) tem prioridade sobre NEXT_PUBLIC_SUPABASE_ANON_KEY", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-inlined";
    process.env.SUPABASE_ANON_KEY = "anon-runtime";

    const { getSupabaseAnonKey } = await loadEnvModule();
    expect(getSupabaseAnonKey()).toBe("anon-runtime");
  });

  it("usa a NEXT_PUBLIC_* como fallback quando não há env server-only (deploy web)", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fallback.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-fallback";

    const { getSupabaseEnv, isSupabaseConfigured } = await loadEnvModule();
    expect(getSupabaseEnv().url).toBe("https://fallback.supabase.co");
    expect(getSupabaseEnv().anonKey).toBe("anon-fallback");
    expect(isSupabaseConfigured()).toBe(true);
  });

  it("isSupabaseConfigured() é falso quando nenhuma fonte está definida", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const { isSupabaseConfigured } = await loadEnvModule();
    expect(isSupabaseConfigured()).toBe(false);
  });
});
