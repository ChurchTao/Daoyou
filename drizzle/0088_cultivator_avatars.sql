CREATE TABLE "wanjiedaoyou_cultivator_avatars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"description" varchar(120) NOT NULL,
	"reserved_item" jsonb,
	"status" varchar(12) DEFAULT 'queued' NOT NULL,
	"failure" varchar(12),
	"refund_location" varchar(8),
	"source_url" text,
	"processing_attempts" integer DEFAULT 0 NOT NULL,
	"cleanup_pending" boolean DEFAULT false NOT NULL,
	"lease_until" timestamp with time zone,
	"deadline_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivators" ADD COLUMN "avatar_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "cultivator_avatars_request_idx" ON "wanjiedaoyou_cultivator_avatars" USING btree ("user_id","request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cultivator_avatars_pending_user_idx" ON "wanjiedaoyou_cultivator_avatars" USING btree ("user_id") WHERE "wanjiedaoyou_cultivator_avatars"."status" in ('queued', 'generating', 'processing');--> statement-breakpoint
CREATE INDEX "cultivator_avatars_user_created_idx" ON "wanjiedaoyou_cultivator_avatars" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "cultivator_avatars_work_idx" ON "wanjiedaoyou_cultivator_avatars" USING btree ("status","lease_until","created_at");--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivators" ADD CONSTRAINT "wanjiedaoyou_cultivators_avatar_id_wanjiedaoyou_cultivator_avatars_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."wanjiedaoyou_cultivator_avatars"("id") ON DELETE set null ON UPDATE no action;