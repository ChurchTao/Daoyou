DROP INDEX "auction_status_expires_idx";--> statement-breakpoint
DROP INDEX "auction_item_type_idx";--> statement-breakpoint
DROP INDEX "feedback_user_id_idx";--> statement-breakpoint
DROP INDEX "feedback_status_idx";--> statement-breakpoint
DROP INDEX "feedback_type_idx";--> statement-breakpoint
DROP INDEX "feedback_created_at_idx";--> statement-breakpoint
CREATE INDEX "admin_templates_channel_status_created_idx" ON "wanjiedaoyou_admin_message_templates" USING btree ("channel","status","created_at");--> statement-breakpoint
CREATE INDEX "artifacts_cultivator_idx" ON "wanjiedaoyou_artifacts" USING btree ("cultivator_id");--> statement-breakpoint
CREATE INDEX "artifacts_score_idx" ON "wanjiedaoyou_artifacts" USING btree ("score");--> statement-breakpoint
CREATE INDEX "auction_status_expires_created_idx" ON "wanjiedaoyou_auction_listings" USING btree ("status","expires_at","created_at");--> statement-breakpoint
CREATE INDEX "auction_status_expires_price_idx" ON "wanjiedaoyou_auction_listings" USING btree ("status","expires_at","price");--> statement-breakpoint
CREATE INDEX "auction_status_expires_item_type_idx" ON "wanjiedaoyou_auction_listings" USING btree ("status","expires_at","item_type");--> statement-breakpoint
CREATE INDEX "battle_records_cultivator_created_idx" ON "wanjiedaoyou_battle_records" USING btree ("cultivator_id","created_at");--> statement-breakpoint
CREATE INDEX "battle_records_opponent_created_idx" ON "wanjiedaoyou_battle_records" USING btree ("opponent_cultivator_id","created_at");--> statement-breakpoint
CREATE INDEX "breakthrough_history_cultivator_created_idx" ON "wanjiedaoyou_breakthrough_history" USING btree ("cultivator_id","created_at");--> statement-breakpoint
CREATE INDEX "consumables_cultivator_idx" ON "wanjiedaoyou_consumables" USING btree ("cultivator_id");--> statement-breakpoint
CREATE INDEX "consumables_cultivator_name_quality_idx" ON "wanjiedaoyou_consumables" USING btree ("cultivator_id","name","quality");--> statement-breakpoint
CREATE INDEX "consumables_score_idx" ON "wanjiedaoyou_consumables" USING btree ("score");--> statement-breakpoint
CREATE INDEX "cultivation_techniques_cultivator_idx" ON "wanjiedaoyou_cultivation_techniques" USING btree ("cultivator_id");--> statement-breakpoint
CREATE INDEX "cultivators_user_status_updated_idx" ON "wanjiedaoyou_cultivators" USING btree ("user_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "cultivators_status_created_idx" ON "wanjiedaoyou_cultivators" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "dungeon_histories_cultivator_created_idx" ON "wanjiedaoyou_dungeon_histories" USING btree ("cultivator_id","created_at");--> statement-breakpoint
CREATE INDEX "feedback_user_created_at_idx" ON "wanjiedaoyou_feedbacks" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "feedback_status_type_created_at_idx" ON "wanjiedaoyou_feedbacks" USING btree ("status","type","created_at");--> statement-breakpoint
CREATE INDEX "mails_cultivator_created_idx" ON "wanjiedaoyou_mails" USING btree ("cultivator_id","created_at");--> statement-breakpoint
CREATE INDEX "mails_cultivator_is_read_created_idx" ON "wanjiedaoyou_mails" USING btree ("cultivator_id","is_read","created_at");--> statement-breakpoint
CREATE INDEX "materials_cultivator_idx" ON "wanjiedaoyou_materials" USING btree ("cultivator_id");--> statement-breakpoint
CREATE INDEX "materials_cultivator_name_idx" ON "wanjiedaoyou_materials" USING btree ("cultivator_id","name");--> statement-breakpoint
CREATE INDEX "materials_cultivator_name_rank_idx" ON "wanjiedaoyou_materials" USING btree ("cultivator_id","name","rank");--> statement-breakpoint
CREATE INDEX "pre_heaven_fates_cultivator_idx" ON "wanjiedaoyou_pre_heaven_fates" USING btree ("cultivator_id");--> statement-breakpoint
CREATE INDEX "retreat_records_cultivator_timestamp_idx" ON "wanjiedaoyou_retreat_records" USING btree ("cultivator_id","timestamp");--> statement-breakpoint
CREATE INDEX "skills_cultivator_idx" ON "wanjiedaoyou_skills" USING btree ("cultivator_id");--> statement-breakpoint
CREATE INDEX "skills_score_idx" ON "wanjiedaoyou_skills" USING btree ("score");--> statement-breakpoint
CREATE INDEX "spiritual_roots_cultivator_idx" ON "wanjiedaoyou_spiritual_roots" USING btree ("cultivator_id");