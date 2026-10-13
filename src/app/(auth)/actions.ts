"use server";

import { redirect } from "next/navigation";

import { CONFIG_PENDING_MESSAGE, isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/server/auth/server-client";
import type { AuthState } from "@/validators/auth";
import { signInSchema, signUpSchema } from "@/validators/auth";

function traduzErroAuth(message: string): string {
  const mapa: Record<string, string> = {
    "Invalid login credentials": "E-mail ou senha incorretos.",
    "Email not confirmed": "Confirme seu e-mail antes de entrar.",
    "User already registered": "Este e-mail já está cadastrado. Tente entrar.",
    "Password should be at least 6 characters": "A senha deve ter pelo menos 6 caracteres.",
  };
  return mapa[message] ?? message;
}

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signInSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  if (!isSupabaseConfigured()) {
    return { error: CONFIG_PENDING_MESSAGE };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) {
      return { error: traduzErroAuth(error.message) };
    }
  } catch (erro) {
    return { error: erro instanceof Error ? erro.message : "Erro inesperado ao entrar." };
  }

  redirect("/dashboard");
}

export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  if (!isSupabaseConfigured()) {
    return { error: CONFIG_PENDING_MESSAGE };
  }

  let hasSession = false;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { full_name: parsed.data.name },
      },
    });

    if (error) {
      return { error: traduzErroAuth(error.message) };
    }

    hasSession = Boolean(data.session);
  } catch (erro) {
    return { error: erro instanceof Error ? erro.message : "Erro inesperado ao criar a conta." };
  }

  if (hasSession) {
    redirect("/dashboard");
  }

  return { success: "Conta criada! Verifique seu e-mail para confirmar e entrar." };
}
