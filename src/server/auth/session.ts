import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { ACTIVE_ORG_COOKIE } from "@/lib/constants";
import { organizationMembers, organizations } from "@/server/db/schema";
import type { TenantDb } from "@/server/db/tenant";
import { withTenantDb } from "@/server/db/tenant";

import { createSupabaseServerClient } from "./server-client";

export type SessionContext = {
  user: User;
  accessToken: string;
};

/** Exige usuário autenticado (redirect /login caso contrário). */
export async function requireAuth(): Promise<SessionContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    redirect("/login");
  }
  return { user: session.user, accessToken: session.access_token };
}

export type OrgContext = {
  user: User;
  accessToken: string;
  organization: typeof organizations.$inferSelect;
  organizationList: (typeof organizations.$inferSelect)[];
  membership: typeof organizationMembers.$inferSelect;
  memberships: (typeof organizationMembers.$inferSelect)[];
};

/**
 * Contexto completo do usuário: sessão + memberships + organização ativa.
 * Retorna null quando o usuário ainda não pertence a nenhuma org
 * (fluxo do onboarding).
 */
export async function getOrgContext(): Promise<OrgContext | null> {
  const session = await requireAuth();

  return withTenantDb(session.accessToken, async (db) => {
    const memberships = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, session.user.id))
      .orderBy(asc(organizationMembers.createdAt));

    if (memberships.length === 0) {
      return null;
    }

    const cookieStore = await cookies();
    const cookieOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
    const active = memberships.find((m) => m.organizationId === cookieOrgId) ?? memberships[0];

    const orgList = await db
      .select()
      .from(organizations)
      .where(
        inArray(
          organizations.id,
          memberships.map((m) => m.organizationId)
        )
      )
      .orderBy(asc(organizations.createdAt));

    const organization = orgList.find((o) => o.id === active.organizationId);
    if (!organization) {
      return null;
    }

    return {
      user: session.user,
      accessToken: session.accessToken,
      organization,
      organizationList: orgList,
      membership: active,
      memberships,
    };
  });
}

/** Exige usuário autenticado E organização ativa (redirect /onboarding). */
export async function requireOrgContext(): Promise<OrgContext> {
  const ctx = await getOrgContext();
  if (!ctx) {
    redirect("/onboarding");
  }
  return ctx;
}

/** Busca a membership do usuário numa org (null se não for membro). */
export async function findMembership(
  db: TenantDb,
  userId: string,
  organizationId: string
): Promise<typeof organizationMembers.$inferSelect | null> {
  const [membership] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1);
  return membership ?? null;
}
