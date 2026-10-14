"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ACTIVE_ORG_COOKIE } from "@/lib/constants";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/server/auth/server-client";
import { findMembership, requireAuth } from "@/server/auth/session";
import { withTenantDb } from "@/server/db/tenant";

export async function signOutAction() {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
    } catch {
      // Sessão já inválida — apenas redireciona.
    }
  }
  redirect("/");
}

/**
 * Troca a organização ativa (cookie). Valida membership antes de gravar —
 * nunca confia no valor enviado pelo cliente.
 */
export async function setActiveOrganizationAction(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");

  const session = await requireAuth();

  const membership = await withTenantDb(session.accessToken, async (db) =>
    findMembership(db, session.user.id, organizationId)
  );

  if (membership) {
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_ORG_COOKIE, organizationId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  redirect("/dashboard");
}
