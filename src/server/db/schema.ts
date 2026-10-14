import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { DEFAULT_ORG_SETTINGS, type OrgSettings } from "@/types/org";

/**
 * LEADFORGE — Schema do banco (Drizzle ORM)
 *
 * Convenções:
 * - id uuid (gen_random_uuid) — chaves primárias
 * - organization_id em toda tabela tenant-scoped (RLS obrigatória)
 * - timestamps com timezone em mode string
 * - Toda tabela nova segue as policies em drizzle/*_rls_*.sql
 *
 * FASES (ver IMPLEMENTATION_PLAN.md):
 * - Phase 1 (este arquivo): users, organizations, organization_members, invites
 * - Phase 2: companies, contacts, leads, tags, activities
 * - Phase 3: products, sales, link_tokens, link_clicks, capture_pages
 */

// ---------- Enums ----------

export const memberRoleEnum = pgEnum("member_role", ["owner", "admin", "member", "viewer"]);

export const orgPlanEnum = pgEnum("org_plan", [
  "starter",
  "professional",
  "agency",
  "enterprise",
]);

export const inviteStatusEnum = pgEnum("invite_status", [
  "pending",
  "accepted",
  "revoked",
  "expired",
]);

// ---------- Identidade ----------

/**
 * Perfil público — espelha auth.users via trigger on_auth_user_created.
 * Nota: sem FK para auth.users para permitir testes de RLS com claims
 * sintéticas (documentado em docs/PROGRESS.md); a trigger garante integridade.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name"),
  email: text("email"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

// ---------- Tenancy ----------

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    plan: orgPlanEnum("plan").default("starter").notNull(),
    settings: jsonb("settings").$type<OrgSettings>().default(DEFAULT_ORG_SETTINGS).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("organizations_slug_unique").on(table.slug)]
);

export const organizationMembers = pgTable(
  "organization_members",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").default("member").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.organizationId, table.userId] }),
    index("organization_members_org_idx").on(table.organizationId),
  ]
);

// ---------- Convites ----------

export const invites = pgTable(
  "invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** E-mail opcional: quando definido, só quem tem esse e-mail pode aceitar. */
    email: text("email"),
    role: memberRoleEnum("role").notNull(),
    token: text("token").notNull(),
    status: inviteStatusEnum("status").default("pending").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    acceptedBy: uuid("accepted_by").references(() => users.id, { onDelete: "set null" }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "string" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("invites_token_unique").on(table.token),
    index("invites_org_status_idx").on(table.organizationId, table.status),
  ]
);

// ---------- Relations (joins tipados) ----------

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [organizationMembers.userId],
    references: [users.id],
  }),
}));

export const invitesRelations = relations(invites, ({ one }) => ({
  organization: one(organizations, {
    fields: [invites.organizationId],
    references: [organizations.id],
  }),
  createdByUser: one(users, {
    fields: [invites.createdBy],
    references: [users.id],
  }),
}));
