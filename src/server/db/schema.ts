import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

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
 * - Phase 1: users, organizations, organization_members, invites
 * - Phase 2: companies, contacts, leads, tags, lead_tags,
 *   activities, lead_sources, capture_pages, form_submissions, import_batches
 * - Phase 3 (este arquivo): products, commerce_integrations, link_tokens,
 *   link_clicks, sales
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

// ---------- Phase 2: Domínio de Leads ----------

export const leadStageEnum = pgEnum("lead_stage", [
  "new",
  "qualified",
  "contacted",
  "replied",
  "meeting",
  "proposal",
  "negotiation",
  "won",
  "lost",
]);

export const consentStatusEnum = pgEnum("consent_status", [
  "unknown",
  "granted",
  "refused",
]);

export const legalBasisEnum = pgEnum("legal_basis", [
  "consent",
  "legitimate_interest",
  "contract",
  "other",
]);

export const leadSourceTypeEnum = pgEnum("lead_source_type", [
  "manual",
  "csv",
  "capture",
  "discovery",
]);

export const capturePageStatusEnum = pgEnum("capture_page_status", [
  "draft",
  "published",
  "archived",
]);

export const importBatchStatusEnum = pgEnum("import_batch_status", [
  "preview",
  "mapped",
  "completed",
  "failed",
]);

/** Catálogo de fontes de leads por org (proveniência rastreável). */
export const leadSources = pgTable(
  "lead_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: leadSourceTypeEnum("type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("lead_sources_org_idx").on(table.organizationId)]
);

/**
 * Empresas — dados normalizados com chaves de dedup:
 * (source_id + external_id), domain, phone_normalized, email_normalized, name_address_hash.
 */
export const companies = pgTable(
  "companies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category"),
    description: text("description"),
    website: text("website"),
    domain: text("domain"),
    phone: text("phone"),
    phoneNormalized: text("phone_normalized"),
    email: text("email"),
    emailNormalized: text("email_normalized"),
    instagram: text("instagram"),
    facebook: text("facebook"),
    linkedin: text("linkedin"),
    addressLine: text("address_line"),
    city: text("city"),
    state: text("state"),
    country: text("country"),
    sourceId: uuid("source_id").references(() => leadSources.id, { onDelete: "set null" }),
    externalId: text("external_id"),
    nameAddressHash: text("name_address_hash"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("companies_org_idx").on(table.organizationId),
    index("companies_org_name_idx").on(table.organizationId, table.name),
    uniqueIndex("companies_org_external_uq")
      .on(table.organizationId, table.sourceId, table.externalId)
      .where(sql`${table.externalId} is not null`),
    uniqueIndex("companies_org_domain_uq")
      .on(table.organizationId, table.domain)
      .where(sql`${table.domain} is not null`),
    uniqueIndex("companies_org_phone_uq")
      .on(table.organizationId, table.phoneNormalized)
      .where(sql`${table.phoneNormalized} is not null`),
    uniqueIndex("companies_org_email_uq")
      .on(table.organizationId, table.emailNormalized)
      .where(sql`${table.emailNormalized} is not null`),
    uniqueIndex("companies_org_hash_uq")
      .on(table.organizationId, table.nameAddressHash)
      .where(sql`${table.nameAddressHash} is not null`),
  ]
);

/** Contatos — pessoas (com ou sem empresa vinculada). */
export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    fullName: text("full_name").notNull(),
    jobTitle: text("job_title"),
    email: text("email"),
    emailNormalized: text("email_normalized"),
    phone: text("phone"),
    phoneNormalized: text("phone_normalized"),
    notes: text("notes"),
    legalBasis: legalBasisEnum("legal_basis"),
    consentStatus: consentStatusEnum("consent_status").default("unknown").notNull(),
    consentAt: timestamp("consent_at", { withTimezone: true, mode: "string" }),
    collectedAt: timestamp("collected_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    sourceUrl: text("source_url"),
    optedOutAt: timestamp("opted_out_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("contacts_org_idx").on(table.organizationId),
    index("contacts_company_idx").on(table.companyId),
    uniqueIndex("contacts_org_email_uq")
      .on(table.organizationId, table.emailNormalized)
      .where(sql`${table.emailNormalized} is not null`),
  ]
);

/** Leads — a unidade do pipeline (empresa × contato). */
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    stage: leadStageEnum("stage").default("new").notNull(),
    sourceId: uuid("source_id").references(() => leadSources.id, { onDelete: "set null" }),
    sourceUrl: text("source_url"),
    score: integer("score"),
    scoredAt: timestamp("scored_at", { withTimezone: true, mode: "string" }),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    legalBasis: legalBasisEnum("legal_basis"),
    consentStatus: consentStatusEnum("consent_status").default("unknown").notNull(),
    consentAt: timestamp("consent_at", { withTimezone: true, mode: "string" }),
    collectedAt: timestamp("collected_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    optedOutAt: timestamp("opted_out_at", { withTimezone: true, mode: "string" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("leads_org_created_idx").on(table.organizationId, table.createdAt),
    index("leads_org_stage_idx").on(table.organizationId, table.stage),
    index("leads_contact_idx").on(table.contactId),
    index("leads_company_idx").on(table.companyId),
    uniqueIndex("leads_org_company_contact_uq")
      .on(table.organizationId, table.companyId, table.contactId)
      .where(sql`${table.companyId} is not null and ${table.contactId} is not null`),
    uniqueIndex("leads_org_contact_uq")
      .on(table.organizationId, table.contactId)
      .where(sql`${table.companyId} is null and ${table.contactId} is not null`),
  ]
);

/** Tags por org. */
export const tags = pgTable(
  "tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("tags_org_name_uq").on(table.organizationId, sql`lower(${table.name})`),
  ]
);

/** Lead × Tag. */
export const leadTags = pgTable(
  "lead_tags",
  {
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.leadId, table.tagId] }),
    index("lead_tags_tag_idx").on(table.tagId),
  ]
);

/** Timeline de eventos (auditoria de negócio — o audit_logs de segurança vem na Fase 9). */
export const activities = pgTable(
  "activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("activities_org_entity_idx").on(
      table.organizationId,
      table.entityType,
      table.entityId,
      table.createdAt
    ),
    index("activities_org_created_idx").on(table.organizationId, table.createdAt),
  ]
);

/** Páginas públicas de captura (/p/[slug]) — consent-first. */
export const capturePages = pgTable(
  "capture_pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    headline: text("headline").notNull(),
    subheadline: text("subheadline"),
    body: text("body"),
    leadMagnetUrl: text("lead_magnet_url"),
    consentText: text("consent_text")
      .default(
        "Concordo em receber conteúdos e comunicações e sei que posso cancelar quando quiser."
      )
      .notNull(),
    thankYouMessage: text("thank_you_message"),
    formConfig: jsonb("form_config").default({}).notNull(),
    status: capturePageStatusEnum("status").default("draft").notNull(),
    submissionsCount: integer("submissions_count").default(0).notNull(),
    viewsCount: integer("views_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("capture_pages_slug_uq").on(table.slug),
    index("capture_pages_org_idx").on(table.organizationId),
  ]
);

/** Cada envio de formulário público — proveniência LGPD completa. */
export const formSubmissions = pgTable(
  "form_submissions", {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    capturePageId: uuid("capture_page_id")
      .notNull()
      .references(() => capturePages.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    data: jsonb("data").default({}).notNull(),
    legalBasis: legalBasisEnum("legal_basis").default("consent").notNull(),
    consentGrantedAt: timestamp("consent_granted_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    utm: jsonb("utm").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("form_submissions_page_idx").on(table.capturePageId, table.createdAt),
    index("form_submissions_org_idx").on(table.organizationId, table.createdAt),
  ]
);

/** Lote de importação CSV — preview → mapeamento → execução → relatório. */
export const importBatches = pgTable(
  "import_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    filename: text("filename").notNull(),
    /** Proveniência declarada (obrigatória) — requisito LGPD do plano. */
    provenanceSource: text("provenance_source").notNull(),
    legalBasis: legalBasisEnum("legal_basis").notNull(),
    headers: jsonb("headers").notNull(),
    mapping: jsonb("mapping").default({}).notNull(),
    rows: jsonb("rows").notNull(),
    status: importBatchStatusEnum("status").default("preview").notNull(),
    totalRows: integer("total_rows").default(0).notNull(),
    validRows: integer("valid_rows").default(0).notNull(),
    invalidRows: integer("invalid_rows").default(0).notNull(),
    results: jsonb("results"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [index("import_batches_org_idx").on(table.organizationId, table.createdAt)]
);

// ---------- Phase 3: Produtos, Vendas e Atribuição ----------

export const productTypeEnum = pgEnum("product_type", ["own", "affiliate"]);

export const commercePlatformEnum = pgEnum("commerce_platform", [
  "kiwify",
  "kirvano",
  "hotmart",
  "eduzz",
  "braip",
  "monetizze",
  "custom",
]);

export const productStatusEnum = pgEnum("product_status", ["active", "archived"]);

export const saleStatusEnum = pgEnum("sale_status", [
  "pending",
  "paid",
  "refunded",
  "chargedback",
  "canceled",
]);

export const saleSourceEnum = pgEnum("sale_source", ["webhook", "manual"]);

/** Catálogo do usuário — autorais ou de afiliado (total autonomia). */
export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    type: productTypeEnum("type").notNull(),
    platform: commercePlatformEnum("platform").notNull(),
    checkoutUrl: text("checkout_url").notNull(),
    price: numeric("price", { precision: 12, scale: 2, mode: "number" }),
    commissionPercent: numeric("commission_percent", { precision: 5, scale: 2, mode: "number" }),
    category: text("category"),
    niche: text("niche"),
    imageUrl: text("image_url"),
    targetAudience: text("target_audience"),
    /** Um argumento por linha — insumo da IA na Fase 4. */
    sellingArguments: jsonb("selling_arguments").default([]).notNull(),
    status: productStatusEnum("status").default("active").notNull(),
    /** ID do produto na plataforma (casa com webhooks quando disponível). */
    externalProductId: text("external_product_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("products_org_idx").on(table.organizationId),
    index("products_org_platform_idx").on(table.organizationId, table.platform),
  ]
);

/**
 * Conexão com o checkout (Kiwify/Kirvano/...). O webhook_token roteia e
 * autentica os webhooks por organização: /api/webhooks/commerce/[platform]?token=...
 */
export const commerceIntegrations = pgTable(
  "commerce_integrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    platform: commercePlatformEnum("platform").notNull(),
    name: text("name").notNull(),
    /** Roteamento + autenticação do webhook (secreto — nunca listado sem permissão). */
    webhookToken: text("webhook_token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("commerce_integrations_token_uq").on(table.webhookToken),
    index("commerce_integrations_org_idx").on(table.organizationId),
  ]
);

/** Links rastreados /go/[token] — a fonte de verdade da atribuição. */
export const linkTokens = pgTable(
  "link_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    /** Rótulo de onde o link é usado (bio, descrição do vídeo, story...). */
    label: text("label").notNull(),
    token: text("token").notNull(),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    active: boolean("active").default(true).notNull(),
    clickCount: integer("click_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("link_tokens_token_uq").on(table.token),
    index("link_tokens_org_idx").on(table.organizationId),
    index("link_tokens_product_idx").on(table.productId),
  ]
);

/** Log de cliques em links rastreados (gravação via serviceDb — /go/ é público). */
export const linkClicks = pgTable(
  "link_clicks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    linkTokenId: uuid("link_token_id")
      .notNull()
      .references(() => linkTokens.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    destinationUrl: text("destination_url").notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    referrer: text("referrer"),
    clickedAt: timestamp("clicked_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("link_clicks_token_idx").on(table.linkTokenId, table.clickedAt),
    index("link_clicks_org_idx").on(table.organizationId),
  ]
);

/**
 * Vendas — entram via webhook (automático) ou lançamento manual.
 * Idempotente por (organization_id, platform, external_order_id).
 */
export const sales = pgTable(
  "sales",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    integrationId: uuid("integration_id").references(() => commerceIntegrations.id, {
      onDelete: "set null",
    }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    platform: commercePlatformEnum("platform").notNull(),
    externalOrderId: text("external_order_id").notNull(),
    customerName: text("customer_name"),
    customerEmail: text("customer_email"),
    customerEmailNormalized: text("customer_email_normalized"),
    amount: numeric("amount", { precision: 12, scale: 2, mode: "number" }),
    commissionAmount: numeric("commission_amount", { precision: 12, scale: 2, mode: "number" }),
    currency: text("currency").default("BRL").notNull(),
    status: saleStatusEnum("status").notNull(),
    source: saleSourceEnum("source").default("webhook").notNull(),
    utm: jsonb("utm").default({}).notNull(),
    /** Atribuição: link rastreado que gerou a venda (via utm_campaign lf_*). */
    linkTokenId: uuid("link_token_id").references(() => linkTokens.id, { onDelete: "set null" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("sales_org_platform_order_uq").on(
      table.organizationId,
      table.platform,
      table.externalOrderId
    ),
    index("sales_org_occurred_idx").on(table.organizationId, table.occurredAt),
    index("sales_product_idx").on(table.productId),
  ]
);

// ---------- Phase 4: Scoring, IA e rascunhos ----------

/** Histórico de pontuação — a última execução é o score vigente. */
export const leadScores = pgTable(
  "lead_scores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    total: integer("total").notNull(),
    classification: text("classification").notNull(),
    breakdown: jsonb("breakdown").default([]).notNull(),
    weightsSnapshot: jsonb("weights_snapshot").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("lead_scores_lead_idx").on(table.leadId, table.createdAt),
    index("lead_scores_org_idx").on(table.organizationId),
  ]
);

/** Análises do AI Sales Assistant — fatos/inferências/hipóteses separados. */
export const leadAnalyses = pgTable(
  "lead_analyses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    status: text("status").notNull().default("completed"),
    whoIsThis: text("who_is_this"),
    probableNeed: text("probable_need"),
    commercialProblem: text("commercial_problem"),
    recommendedProductId: uuid("recommended_product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    opportunityScore: integer("opportunity_score"),
    suggestedOffer: text("suggested_offer"),
    priceRange: text("price_range"),
    argument: text("argument"),
    channel: text("channel"),
    facts: jsonb("facts").default([]).notNull(),
    inferences: jsonb("inferences").default([]).notNull(),
    hypotheses: jsonb("hypotheses").default([]).notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("lead_analyses_lead_idx").on(table.leadId, table.createdAt),
    index("lead_analyses_org_idx").on(table.organizationId),
  ]
);

/** Rascunhos gerados pela IA — revisão humana antes de qualquer envio. */
export const messageDrafts = pgTable(
  "message_drafts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    analysisId: uuid("analysis_id").references(() => leadAnalyses.id, { onDelete: "set null" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    channel: text("channel").notNull(),
    tone: text("tone").notNull(),
    subject: text("subject"),
    body: text("body").notNull(),
    status: text("status").default("draft").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("message_drafts_lead_idx").on(table.leadId, table.createdAt),
    index("message_drafts_org_idx").on(table.organizationId),
  ]
);

// ---------- Phase 5: CRM, Financeiro e Metas ----------

export const taskTypeEnum = pgEnum("task_type", [
  "call",
  "whatsapp",
  "email",
  "meeting",
  "proposal",
  "followup",
]);

export const taskPriorityEnum = pgEnum("task_priority", ["low", "medium", "high", "urgent"]);

export const taskStatusEnum = pgEnum("task_status", ["open", "done", "cancelled"]);

export const financialTypeEnum = pgEnum("financial_type", ["revenue", "expense"]);

export const financialCategoryEnum = pgEnum("financial_category", [
  "own_sale",
  "affiliate_commission",
  "ad_spend",
  "tools",
  "fees",
  "other",
]);

export const financialSourceEnum = pgEnum("financial_source", ["manual", "sale_webhook"]);

export const goalStatusEnum = pgEnum("goal_status", [
  "dreaming",
  "saving",
  "reached",
  "paused",
]);

export const goalContributionSourceEnum = pgEnum("goal_contribution_source", [
  "manual",
  "auto_sale",
]);

/** Oportunidades do pipeline (forecast de CRM). */
export const deals = pgTable(
  "deals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    stage: leadStageEnum("stage").default("new").notNull(),
    value: numeric("value", { precision: 12, scale: 2, mode: "number" }),
    expectedCloseDate: timestamp("expected_close_date", { withTimezone: true, mode: "string" }),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("deals_org_stage_idx").on(table.organizationId, table.stage),
    index("deals_lead_idx").on(table.leadId),
  ]
);

/** Tarefas do time comercial. */
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "cascade" }),
    assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    type: taskTypeEnum("type").default("followup").notNull(),
    priority: taskPriorityEnum("priority").default("medium").notNull(),
    status: taskStatusEnum("status").default("open").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "string" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("tasks_org_status_idx").on(table.organizationId, table.status, table.dueAt),
    index("tasks_assignee_idx").on(table.assigneeId),
  ]
);

/**
 * Lançamentos financeiros — receitas (vendas autorais + comissões, automáticas
 * via webhook reconciliado) e despesas (tráfego, ferramentas, taxas).
 */
export const financialTransactions = pgTable(
  "financial_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    type: financialTypeEnum("type").notNull(),
    category: financialCategoryEnum("category").notNull(),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    source: financialSourceEnum("source").default("manual").notNull(),
    saleId: uuid("sale_id").references(() => sales.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("financial_org_occurred_idx").on(table.organizationId, table.occurredAt),
    uniqueIndex("financial_sale_uq")
      .on(table.saleId)
      .where(sql`${table.saleId} is not null`),
  ]
);

/** Metas & Sonhos — o motor motivacional. */
export const goals = pgTable(
  "goals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    productUrl: text("product_url"),
    targetAmount: numeric("target_amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
    status: goalStatusEnum("status").default("dreaming").notNull(),
    targetDate: timestamp("target_date", { withTimezone: true, mode: "string" }),
    reachedAt: timestamp("reached_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("goals_org_idx").on(table.organizationId)]
);

/** Contribuições para as metas — manuais ou automáticas (% de cada venda). */
export const goalContributions = pgTable(
  "goal_contributions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
    source: goalContributionSourceEnum("source").default("manual").notNull(),
    saleId: uuid("sale_id").references(() => sales.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("goal_contributions_goal_idx").on(table.goalId, table.createdAt),
    // idempotência: a mesma venda nunca contribui duas vezes para a mesma meta
    uniqueIndex("goal_contributions_goal_sale_uq")
      .on(table.goalId, table.saleId)
      .where(sql`${table.saleId} is not null`),
  ]
);

// ---------- Phase 6: E-mail, Campanhas e Suppression ----------

export const campaignChannelEnum = pgEnum("campaign_channel", ["email", "whatsapp"]);

export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "active",
  "paused",
  "completed",
  "cancelled",
]);

export const campaignModeEnum = pgEnum("campaign_mode", ["manual", "automated"]);

export const campaignLeadStatusEnum = pgEnum("campaign_lead_status", [
  "pending",
  "active",
  "awaiting_approval",
  "completed",
  "excluded",
]);

export const messageStatusEnum = pgEnum("message_status", [
  "pending_approval",
  "queued",
  "sending",
  "sent",
  "delivered",
  "bounced",
  "replied",
  "failed",
  "unsubscribed",
  "discarded",
]);

export const messageDirectionEnum = pgEnum("message_direction", ["outbound", "inbound"]);

export const suppressionChannelEnum = pgEnum("suppression_channel", ["email", "whatsapp", "all"]);

export const suppressionReasonEnum = pgEnum("suppression_reason", [
  "unsubscribe",
  "bounce",
  "complaint",
  "manual",
  "optout_keyword",
]);

export const emailProviderEnum = pgEnum("email_provider", ["resend", "mock"]);

/** Campanhas de outreach (steps com esperas, caps e modo manual/automated). */
export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    channel: campaignChannelEnum("channel").default("email").notNull(),
    mode: campaignModeEnum("mode").default("manual").notNull(),
    status: campaignStatusEnum("status").default("draft").notNull(),
    /** Produto promovido — gera links rastreados por lead nas mensagens. */
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    /** Limite diário de envios desta campanha. */
    dailyCap: integer("daily_cap").default(50).notNull(),
    activeHourStart: integer("active_hour_start").default(8).notNull(),
    activeHourEnd: integer("active_hour_end").default(20).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("campaigns_org_status_idx").on(table.organizationId, table.status),
  ]
);

/** Etapas da campanha — sequência com esperas (nunca loops infinitos). */
export const campaignSteps = pgTable(
  "campaign_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    /** Dias de espera ANTES desta etapa (0 = primeiro contato imediato). */
    waitDays: integer("wait_days").default(0).notNull(),
    subject: text("subject").default("").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("campaign_steps_position_uq").on(table.campaignId, table.position),
  ]
);

/** Estado de cada lead dentro de uma campanha (máquina de estados). */
export const campaignLeads = pgTable(
  "campaign_leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    status: campaignLeadStatusEnum("status").default("pending").notNull(),
    /** Próxima etapa (position) — começa em 1. */
    currentStep: integer("current_step").default(1).notNull(),
    nextStepAt: timestamp("next_step_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    excludedReason: text("excluded_reason"),
    addedAt: timestamp("added_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("campaign_leads_uq").on(table.campaignId, table.leadId),
    index("campaign_leads_due_idx").on(
      table.organizationId,
      table.campaignId,
      table.status,
      table.nextStepAt
    ),
  ]
);

/** Mensagens enviadas/na fila — com status de ciclo de vida completo. */
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }),
    stepId: uuid("step_id").references(() => campaignSteps.id, { onDelete: "set null" }),
    channel: campaignChannelEnum("channel").default("email").notNull(),
    direction: messageDirectionEnum("direction").default("outbound").notNull(),
    toAddress: text("to_address").notNull(),
    subject: text("subject"),
    body: text("body").notNull(),
    status: messageStatusEnum("status").default("queued").notNull(),
    provider: text("provider"),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("messages_org_campaign_idx").on(table.organizationId, table.campaignId, table.status),
    index("messages_lead_idx").on(table.leadId, table.createdAt),
    index("messages_provider_id_idx").on(table.providerMessageId),
  ]
);

/** Identidade de envio da org (from) + roteamento do webhook de eventos. */
export const emailAccounts = pgTable(
  "email_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: emailProviderEnum("provider").default("resend").notNull(),
    fromEmail: text("from_email").notNull(),
    fromName: text("from_name").notNull(),
    /** Roteamento/autenticação do webhook de bounce/complaint/delivery. */
    webhookToken: text("webhook_token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("email_accounts_token_uq").on(table.webhookToken),
    index("email_accounts_org_idx").on(table.organizationId),
  ]
);

/**
 * SUPPRESSION LIST — invariável do sistema: contato aqui NUNCA recebe mensagem
 * (o gate de elegibilidade consulta esta tabela em TODO path de envio).
 */
export const suppressionList = pgTable(
  "suppression_list",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    emailNormalized: text("email_normalized"),
    phoneNormalized: text("phone_normalized"),
    channel: suppressionChannelEnum("channel").default("all").notNull(),
    reason: suppressionReasonEnum("reason").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("suppression_email_uq")
      .on(table.organizationId, table.emailNormalized)
      .where(sql`${table.emailNormalized} is not null`),
    uniqueIndex("suppression_phone_uq")
      .on(table.organizationId, table.phoneNormalized)
      .where(sql`${table.phoneNormalized} is not null`),
    index("suppression_org_idx").on(table.organizationId),
  ]
);

// ---------- Phase 7: WhatsApp e Inbox ----------

export const conversationChannelEnum = pgEnum("conversation_channel", ["email", "whatsapp"]);

export const conversationStatusEnum = pgEnum("conversation_status", ["open", "closed"]);

export const conversationDirectionEnum = pgEnum("conversation_direction", ["inbound", "outbound"]);

export const conversationMessageStatusEnum = pgEnum("conversation_message_status", [
  "received",
  "sent",
  "delivered",
  "read",
  "failed",
]);

/** Conta WhatsApp Business (Cloud API) por org — roteia o webhook. */
export const whatsappAccounts = pgTable(
  "whatsapp_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** phone_number_id da Meta (identifica o número no webhook). */
    phoneNumberId: text("phone_number_id").notNull(),
    displayPhone: text("display_phone").notNull(),
    displayName: text("display_name").notNull(),
    /** Roteamento/autenticação do webhook de entrada/status. */
    webhookToken: text("webhook_token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("whatsapp_accounts_token_uq").on(table.webhookToken),
    index("whatsapp_accounts_phone_idx").on(table.phoneNumberId),
    index("whatsapp_accounts_org_idx").on(table.organizationId),
  ]
);

/** Conversas da inbox unificada — uma por (lead, canal). */
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    channel: conversationChannelEnum("channel").notNull(),
    status: conversationStatusEnum("status").default("open").notNull(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    lastMessagePreview: text("last_message_preview"),
    lastDirection: conversationDirectionEnum("last_direction").default("outbound").notNull(),
    unreadCount: integer("unread_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("conversations_lead_channel_uq").on(table.leadId, table.channel),
    index("conversations_org_last_idx").on(table.organizationId, table.lastMessageAt),
  ]
);

/** Mensagens das conversas (in e out) com status do provedor. */
export const conversationMessages = pgTable(
  "conversation_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    channel: conversationChannelEnum("channel").notNull(),
    direction: conversationDirectionEnum("direction").notNull(),
    body: text("body").notNull(),
    status: conversationMessageStatusEnum("status").default("sent").notNull(),
    providerMessageId: text("provider_message_id"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("conversation_messages_conv_idx").on(table.conversationId, table.createdAt),
    index("conversation_messages_provider_idx").on(table.providerMessageId),
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

export const leadsRelations = relations(leads, ({ one }) => ({
  company: one(companies, {
    fields: [leads.companyId],
    references: [companies.id],
  }),
  contact: one(contacts, {
    fields: [leads.contactId],
    references: [contacts.id],
  }),
  source: one(leadSources, {
    fields: [leads.sourceId],
    references: [leadSources.id],
  }),
}));
