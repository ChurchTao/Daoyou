ALTER TABLE "wanjiedaoyou_story_intents" ALTER COLUMN "thread_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_story_intents" ADD COLUMN "source_type" varchar(40);--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_story_intents" ADD COLUMN "source_id" varchar(128);--> statement-breakpoint
CREATE UNIQUE INDEX "story_intents_cultivator_source_beat_uidx" ON "wanjiedaoyou_story_intents" USING btree ("cultivator_id","source_type","source_id","beat_type") WHERE "wanjiedaoyou_story_intents"."source_type" is not null and "wanjiedaoyou_story_intents"."source_id" is not null;