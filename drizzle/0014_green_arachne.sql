CREATE TABLE "wanjiedaoyou_player_mutation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"source" varchar(96) NOT NULL,
	"request_id" varchar(128) NOT NULL,
	"request_fingerprint" varchar(128) NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_player_mutation_requests" ADD CONSTRAINT "wanjiedaoyou_player_mutation_requests_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "player_mutation_requests_scope_unique" ON "wanjiedaoyou_player_mutation_requests" USING btree ("cultivator_id","source","request_id");--> statement-breakpoint
CREATE INDEX "player_mutation_requests_created_idx" ON "wanjiedaoyou_player_mutation_requests" USING btree ("created_at");