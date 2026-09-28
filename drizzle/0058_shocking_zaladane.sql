ALTER TABLE "wanjiedaoyou_combat_replay_archives" ADD COLUMN "share_code" uuid;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_combat_replay_archives" ADD COLUMN "share_viewer_cultivator_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "combat_replay_share_code_uidx" ON "wanjiedaoyou_combat_replay_archives" USING btree ("share_code");