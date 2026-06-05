CREATE TABLE "wanjiedaoyou_qi_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"action" varchar(64) NOT NULL,
	"action_instance_id" varchar(128) NOT NULL,
	"status" varchar(32) NOT NULL,
	"qi_cost" integer DEFAULT 0 NOT NULL,
	"qi_gain" integer DEFAULT 0 NOT NULL,
	"qi_before" integer NOT NULL,
	"qi_after" integer NOT NULL,
	"source" varchar(64),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivators" ADD COLUMN "qi" integer DEFAULT 200 NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivators" ADD COLUMN "qi_last_refreshed_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_qi_logs" ADD CONSTRAINT "wanjiedaoyou_qi_logs_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "qi_logs_action_instance_uidx" ON "wanjiedaoyou_qi_logs" USING btree ("action_instance_id");--> statement-breakpoint
CREATE INDEX "qi_logs_cultivator_created_idx" ON "wanjiedaoyou_qi_logs" USING btree ("cultivator_id","created_at");--> statement-breakpoint
CREATE INDEX "qi_logs_status_created_idx" ON "wanjiedaoyou_qi_logs" USING btree ("status","created_at");