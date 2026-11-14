CREATE TABLE "wanjiedaoyou_achievement_unlocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"achievement_id" varchar(160) NOT NULL,
	"source_key" varchar(200) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_mentorship_relations" ADD COLUMN "graduation_rewarded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_mentorship_relations" ADD COLUMN "mentor_reputation_reward" integer;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_mentorship_relations" ADD COLUMN "disciple_reputation_reward" integer;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_achievement_unlocks" ADD CONSTRAINT "wanjiedaoyou_achievement_unlocks_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "achievement_unlocks_character_definition_uidx" ON "wanjiedaoyou_achievement_unlocks" USING btree ("cultivator_id","achievement_id");--> statement-breakpoint
CREATE INDEX "achievement_unlocks_character_time_idx" ON "wanjiedaoyou_achievement_unlocks" USING btree ("cultivator_id","unlocked_at");