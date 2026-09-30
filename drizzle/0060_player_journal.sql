CREATE TABLE "wanjiedaoyou_player_journal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"operation_key" varchar(160) NOT NULL,
	"request_fingerprint" varchar(128),
	"event" jsonb,
	"created_at" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_player_journal" ADD CONSTRAINT "wanjiedaoyou_player_journal_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "player_journal_operation_unique" ON "wanjiedaoyou_player_journal" USING btree ("cultivator_id","operation_key");--> statement-breakpoint
CREATE INDEX "player_journal_timeline_idx" ON "wanjiedaoyou_player_journal" USING btree ("cultivator_id","created_at","id");
