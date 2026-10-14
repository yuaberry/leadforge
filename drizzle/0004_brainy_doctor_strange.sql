CREATE TYPE "public"."commerce_platform" AS ENUM('kiwify', 'kirvano', 'hotmart', 'eduzz', 'braip', 'monetizze', 'custom');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('own', 'affiliate');--> statement-breakpoint
CREATE TYPE "public"."sale_source" AS ENUM('webhook', 'manual');--> statement-breakpoint
CREATE TYPE "public"."sale_status" AS ENUM('pending', 'paid', 'refunded', 'chargedback', 'canceled');--> statement-breakpoint
CREATE TABLE "commerce_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"platform" "commerce_platform" NOT NULL,
	"name" text NOT NULL,
	"webhook_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "link_clicks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"link_token_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"destination_url" text NOT NULL,
	"ip" text,
	"user_agent" text,
	"referrer" text,
	"clicked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "link_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"label" text NOT NULL,
	"token" text NOT NULL,
	"lead_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"click_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "product_type" NOT NULL,
	"platform" "commerce_platform" NOT NULL,
	"checkout_url" text NOT NULL,
	"price" numeric(12, 2),
	"commission_percent" numeric(5, 2),
	"category" text,
	"niche" text,
	"image_url" text,
	"target_audience" text,
	"selling_arguments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "product_status" DEFAULT 'active' NOT NULL,
	"external_product_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"integration_id" uuid,
	"product_id" uuid,
	"platform" "commerce_platform" NOT NULL,
	"external_order_id" text NOT NULL,
	"customer_name" text,
	"customer_email" text,
	"customer_email_normalized" text,
	"amount" numeric(12, 2),
	"commission_amount" numeric(12, 2),
	"currency" text DEFAULT 'BRL' NOT NULL,
	"status" "sale_status" NOT NULL,
	"source" "sale_source" DEFAULT 'webhook' NOT NULL,
	"utm" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"link_token_id" uuid,
	"lead_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "commerce_integrations" ADD CONSTRAINT "commerce_integrations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_clicks" ADD CONSTRAINT "link_clicks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_clicks" ADD CONSTRAINT "link_clicks_link_token_id_link_tokens_id_fk" FOREIGN KEY ("link_token_id") REFERENCES "public"."link_tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_clicks" ADD CONSTRAINT "link_clicks_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_tokens" ADD CONSTRAINT "link_tokens_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_tokens" ADD CONSTRAINT "link_tokens_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_tokens" ADD CONSTRAINT "link_tokens_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_integration_id_commerce_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."commerce_integrations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_link_token_id_link_tokens_id_fk" FOREIGN KEY ("link_token_id") REFERENCES "public"."link_tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "commerce_integrations_token_uq" ON "commerce_integrations" USING btree ("webhook_token");--> statement-breakpoint
CREATE INDEX "commerce_integrations_org_idx" ON "commerce_integrations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "link_clicks_token_idx" ON "link_clicks" USING btree ("link_token_id","clicked_at");--> statement-breakpoint
CREATE INDEX "link_clicks_org_idx" ON "link_clicks" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "link_tokens_token_uq" ON "link_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "link_tokens_org_idx" ON "link_tokens" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "link_tokens_product_idx" ON "link_tokens" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "products_org_idx" ON "products" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "products_org_platform_idx" ON "products" USING btree ("organization_id","platform");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_org_platform_order_uq" ON "sales" USING btree ("organization_id","platform","external_order_id");--> statement-breakpoint
CREATE INDEX "sales_org_occurred_idx" ON "sales" USING btree ("organization_id","occurred_at");--> statement-breakpoint
CREATE INDEX "sales_product_idx" ON "sales" USING btree ("product_id");