CREATE TABLE "wanjiedaoyou_system_mail_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creation_fingerprint" text NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"reward_selections" jsonb NOT NULL,
	"conditions" jsonb NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_mails" ADD COLUMN "system_mail_campaign_id" uuid;--> statement-breakpoint
CREATE INDEX "system_mail_campaigns_window_idx" ON "wanjiedaoyou_system_mail_campaigns" USING btree ("status","ends_at","starts_at");--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_mails" ADD CONSTRAINT "wanjiedaoyou_mails_system_mail_campaign_id_wanjiedaoyou_system_mail_campaigns_id_fk" FOREIGN KEY ("system_mail_campaign_id") REFERENCES "public"."wanjiedaoyou_system_mail_campaigns"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "mails_campaign_cultivator_unique" ON "wanjiedaoyou_mails" USING btree ("system_mail_campaign_id","cultivator_id");