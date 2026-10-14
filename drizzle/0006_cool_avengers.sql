CREATE TABLE "lead_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"who_is_this" text,
	"probable_need" text,
	"commercial_problem" text,
	"recommended_product_id" uuid,
	"opportunity_score" integer,
	"suggested_offer" text,
	"price_range" text,
	"argument" text,
	"channel" text,
	"facts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"inferences" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hypotheses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"total" integer NOT NULL,
	"classification" text NOT NULL,
	"breakdown" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"weights_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"analysis_id" uuid,
	"product_id" uuid,
	"channel" text NOT NULL,
	"tone" text NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "settings" SET DEFAULT '{"businessMode":null,"categories":[],"channels":{"email":false,"whatsapp":false},"dream":null,"dreamSkipped":false,"onboardedAt":null,"scoreWeights":{}}'::jsonb;--> statement-breakpoint
ALTER TABLE "lead_analyses" ADD CONSTRAINT "lead_analyses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_analyses" ADD CONSTRAINT "lead_analyses_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_analyses" ADD CONSTRAINT "lead_analyses_recommended_product_id_products_id_fk" FOREIGN KEY ("recommended_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_scores" ADD CONSTRAINT "lead_scores_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_scores" ADD CONSTRAINT "lead_scores_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_drafts" ADD CONSTRAINT "message_drafts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_drafts" ADD CONSTRAINT "message_drafts_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_drafts" ADD CONSTRAINT "message_drafts_analysis_id_lead_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."lead_analyses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_drafts" ADD CONSTRAINT "message_drafts_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_analyses_lead_idx" ON "lead_analyses" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE INDEX "lead_analyses_org_idx" ON "lead_analyses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "lead_scores_lead_idx" ON "lead_scores" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE INDEX "lead_scores_org_idx" ON "lead_scores" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "message_drafts_lead_idx" ON "message_drafts" USING btree ("lead_id","created_at");--> statement-breakpoint
CREATE INDEX "message_drafts_org_idx" ON "message_drafts" USING btree ("organization_id");