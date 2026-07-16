CREATE TABLE "wanjiedaoyou_account_deletion_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"cultivator_ids" uuid[] NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE UNIQUE INDEX "account_deletion_records_user_uidx" ON "wanjiedaoyou_account_deletion_records" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_deletion_records_status_requested_idx" ON "wanjiedaoyou_account_deletion_records" USING btree ("status","requested_at");