CREATE TABLE "wanjiedaoyou_infinite_tower_progress" (
	"cultivator_id" uuid PRIMARY KEY NOT NULL,
	"highest_floor" integer DEFAULT 0 NOT NULL,
	"total_spirit_stones_earned" bigint DEFAULT 0 NOT NULL,
	"first_reached_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_infinite_tower_progress" ADD CONSTRAINT "wanjiedaoyou_infinite_tower_progress_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "infinite_tower_progress_highest_floor_idx" ON "wanjiedaoyou_infinite_tower_progress" USING btree ("highest_floor");