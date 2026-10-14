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
