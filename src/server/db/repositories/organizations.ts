import "server-only";

import { and, asc, count, desc, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";

import { slugify, slugifyWithSuffix } from "@/lib/slug";
import type { MemberRole } from "@/validators/org";
import type { OrgSettings } from "@/types/org";
import {
  invites,
  organizationMembers,
  organizations,
  users,
} from "@/server/db/schema";
import type { TenantDb } from "@/server/db/tenant";

// ---------- Organizations ----------

function isUniqueViolation(erro: unknown): boolean {
  return (erro as { code?: string }).code === "23505";
}

/**
 * Cria a organização com slug único (retry com sufixo em colisão).
 * O trigger on_organization_created promove o criador a owner
 * (RLS do authenticated permite INSERT; membership via SECURITY DEFINER).
 */
export async function insertOrganizationWithSlug(
  db: TenantDb,
  name: string
): Promise<typeof organizations.$inferSelect> {
  const base = slugify(name);

  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = randomBytes(2).toString("hex");
    const slug = attempt === 0 ? base || `org-${suffix}` : slugifyWithSuffix(name, suffix);

    try {
      const [org] = await db
        .insert(organizations)
        .values({ name, slug })
        .returning();
      return org;
    } catch (erro) {
      if (isUniqueViolation(erro)) continue;
      throw erro;
    }
  }

  throw new Error("Não foi possível gerar um slug único. Tente outro nome.");
}

export async function updateOrganizationName(
  db: TenantDb,
  organizationId: string,
  name: string
): Promise<void> {
  await db
    .update(organizations)
    .set({ name, updatedAt: new Date().toISOString() })
    .where(eq(organizations.id, organizationId));
}

export async function updateOrganizationSettings(
  db: TenantDb,
  organizationId: string,
  settings: OrgSettings
): Promise<void> {
  await db
    .update(organizations)
    .set({ settings, updatedAt: new Date().toISOString() })
    .where(eq(organizations.id, organizationId));
}

// ---------- Members ----------

/** Org primária do usuário (a primeira membership criada) — usada no onboarding. */
export async function getPrimaryOrg(
  db: TenantDb,
  userId: string
): Promise<{
  organization: typeof organizations.$inferSelect;
  membership: typeof organizationMembers.$inferSelect;
} | null> {
  const [row] = await db
    .select({ organization: organizations, membership: organizationMembers })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
    .where(eq(organizationMembers.userId, userId))
    .orderBy(asc(organizationMembers.createdAt))
    .limit(1);
  return row ?? null;
}

export type MemberRow = {
  userId: string;
  role: MemberRole;
  memberSince: string;
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
};

export async function listMembers(db: TenantDb, organizationId: string): Promise<MemberRow[]> {
  const rows = await db
    .select({
      userId: organizationMembers.userId,
      role: organizationMembers.role,
      memberSince: organizationMembers.createdAt,
      fullName: users.fullName,
      email: users.email,
      avatarUrl: users.avatarUrl,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(eq(organizationMembers.organizationId, organizationId))
    .orderBy(asc(organizationMembers.createdAt));
  return rows;
}

export async function countOwners(db: TenantDb, organizationId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.role, "owner")
      )
    );
  return Number(row?.total ?? 0);
}

export async function updateMemberRole(
  db: TenantDb,
  organizationId: string,
  userId: string,
  role: MemberRole
): Promise<void> {
  await db
    .update(organizationMembers)
    .set({ role })
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      )
    );
}

export async function removeMember(
  db: TenantDb,
  organizationId: string,
  userId: string
): Promise<void> {
  await db
    .delete(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      )
    );
}

export async function memberExists(
  db: TenantDb,
  organizationId: string,
  userId: string
): Promise<boolean> {
  const [row] = await db
    .select({ userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1);
  return Boolean(row);
}

/** Busca a membership (org, usuário) — null se não existir. */
export async function findMembershipInDb(
  db: TenantDb,
  organizationId: string,
  userId: string
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

// ---------- Invites ----------

export function generateInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function insertInvite(
  db: TenantDb,
  input: {
    organizationId: string;
    role: MemberRole;
    email: string | null;
    token: string;
    createdBy: string;
    expiresAt: string;
  }
): Promise<typeof invites.$inferSelect> {
  const [invite] = await db.insert(invites).values(input).returning();
  return invite;
}

export async function listInvites(
  db: TenantDb,
  organizationId: string
): Promise<(typeof invites.$inferSelect)[]> {
  return db
    .select()
    .from(invites)
    .where(eq(invites.organizationId, organizationId))
    .orderBy(desc(invites.createdAt));
}

export async function countPendingInvites(
  db: TenantDb,
  organizationId: string
): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(invites)
    .where(
      and(
        eq(invites.organizationId, organizationId),
        eq(invites.status, "pending")
      )
    );
  return Number(row?.total ?? 0);
}

export async function revokeInvite(
  db: TenantDb,
  organizationId: string,
  inviteId: string
): Promise<void> {
  await db
    .update(invites)
    .set({ status: "revoked" })
    .where(and(eq(invites.id, inviteId), eq(invites.organizationId, organizationId)));
}

export async function getInviteByToken(
  db: TenantDb,
  token: string
): Promise<{ invite: typeof invites.$inferSelect; organizationName: string } | null> {
  const [row] = await db
    .select({
      invite: invites,
      organizationName: organizations.name,
    })
    .from(invites)
    .innerJoin(organizations, eq(organizations.id, invites.organizationId))
    .where(eq(invites.token, token))
    .limit(1);
  return row ?? null;
}

/** Aceite de convite: cria a membership (validada pela policy de invites). */
export async function insertMemberFromInvite(
  db: TenantDb,
  organizationId: string,
  userId: string,
  role: MemberRole
): Promise<void> {
  await db.insert(organizationMembers).values({ organizationId, userId, role });
}

export async function markInviteAccepted(
  db: TenantDb,
  inviteId: string,
  userId: string
): Promise<void> {
  await db
    .update(invites)
    .set({
      status: "accepted",
      acceptedBy: userId,
      acceptedAt: new Date().toISOString(),
    })
    .where(eq(invites.id, inviteId));
}

export async function countOtherPendingInvitesForEmail(
  db: TenantDb,
  organizationId: string,
  email: string
): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(invites)
    .where(
      and(
        eq(invites.organizationId, organizationId),
        eq(invites.status, "pending"),
        eq(invites.email, email)
      )
    );
  return Number(row?.total ?? 0);
}
