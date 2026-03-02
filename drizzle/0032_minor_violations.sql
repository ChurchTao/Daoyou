CREATE TABLE "wanjiedaoyou_redeem_code_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"redeem_code_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"mail_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_redeem_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"reward_preset_id" varchar(100) NOT NULL,
	"mail_title" varchar(200) NOT NULL,
	"mail_content" text NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"total_limit" integer,
	"claimed_count" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp,
	"ends_at" timestamp,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_redeem_code_claims" ADD CONSTRAINT "wanjiedaoyou_redeem_code_claims_redeem_code_id_wanjiedaoyou_redeem_codes_id_fk" FOREIGN KEY ("redeem_code_id") REFERENCES "public"."wanjiedaoyou_redeem_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_redeem_code_claims" ADD CONSTRAINT "wanjiedaoyou_redeem_code_claims_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_redeem_code_claims" ADD CONSTRAINT "wanjiedaoyou_redeem_code_claims_mail_id_wanjiedaoyou_mails_id_fk" FOREIGN KEY ("mail_id") REFERENCES "public"."wanjiedaoyou_mails"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "redeem_code_claims_code_user_unique" ON "wanjiedaoyou_redeem_code_claims" USING btree ("redeem_code_id","user_id");--> statement-breakpoint
CREATE INDEX "redeem_code_claims_user_idx" ON "wanjiedaoyou_redeem_code_claims" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "redeem_code_claims_code_idx" ON "wanjiedaoyou_redeem_code_claims" USING btree ("redeem_code_id");--> statement-breakpoint
CREATE UNIQUE INDEX "redeem_codes_code_unique" ON "wanjiedaoyou_redeem_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "redeem_codes_status_created_idx" ON "wanjiedaoyou_redeem_codes" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "redeem_codes_created_idx" ON "wanjiedaoyou_redeem_codes" USING btree ("created_at");