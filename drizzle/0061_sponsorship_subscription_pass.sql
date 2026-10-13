CREATE TABLE "wanjiedaoyou_sponsorship_daily_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"grant_date" date NOT NULL,
	"plan_key" varchar(64) NOT NULL,
	"level" integer NOT NULL,
	"mail_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_sponsorship_provider_links" (
	"provider" varchar(32) NOT NULL,
	"provider_user_id" varchar(80) NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"bound_at" timestamp DEFAULT now() NOT NULL,
	"rebound_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wanjiedaoyou_sponsorship_provider_links_provider_provider_user_id_pk" PRIMARY KEY("provider","provider_user_id")
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_sponsorship_subscription_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"provider" varchar(32) NOT NULL,
	"provider_user_id" varchar(80) NOT NULL,
	"plan_key" varchar(64) NOT NULL,
	"level" integer NOT NULL,
	"afdian_plan_id" varchar(80) NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp,
	"provisional" boolean DEFAULT false NOT NULL,
	"last_synced_at" timestamp,
	"source_order_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sponsorship_daily_grants" ADD CONSTRAINT "wanjiedaoyou_sponsorship_daily_grants_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sponsorship_daily_grants" ADD CONSTRAINT "wanjiedaoyou_sponsorship_daily_grants_mail_id_wanjiedaoyou_mails_id_fk" FOREIGN KEY ("mail_id") REFERENCES "public"."wanjiedaoyou_mails"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sponsorship_provider_links" ADD CONSTRAINT "wanjiedaoyou_sponsorship_provider_links_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sponsorship_subscription_terms" ADD CONSTRAINT "wanjiedaoyou_sponsorship_subscription_terms_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sponsorship_subscription_terms" ADD CONSTRAINT "wanjiedaoyou_sponsorship_subscription_terms_source_order_id_wanjiedaoyou_sponsorship_orders_id_fk" FOREIGN KEY ("source_order_id") REFERENCES "public"."wanjiedaoyou_sponsorship_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sponsorship_daily_grants_cultivator_date_uidx" ON "wanjiedaoyou_sponsorship_daily_grants" USING btree ("cultivator_id","grant_date");--> statement-breakpoint
CREATE INDEX "sponsorship_provider_links_cultivator_idx" ON "wanjiedaoyou_sponsorship_provider_links" USING btree ("cultivator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sponsorship_terms_cultivator_plan_uidx" ON "wanjiedaoyou_sponsorship_subscription_terms" USING btree ("cultivator_id","afdian_plan_id");--> statement-breakpoint
CREATE INDEX "sponsorship_terms_provider_user_idx" ON "wanjiedaoyou_sponsorship_subscription_terms" USING btree ("provider","provider_user_id");--> statement-breakpoint
CREATE INDEX "sponsorship_terms_provisional_end_idx" ON "wanjiedaoyou_sponsorship_subscription_terms" USING btree ("provisional","ends_at");