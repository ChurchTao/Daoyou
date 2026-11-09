CREATE TABLE "wanjiedaoyou_ai_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"scene_id" varchar(120) NOT NULL,
	"credential_source" varchar(12) NOT NULL,
	"provider" varchar(120) NOT NULL,
	"model_id" varchar(240) NOT NULL,
	"model_alias" varchar(120),
	"step" integer NOT NULL,
	"attempt" integer NOT NULL,
	"fallback" boolean NOT NULL,
	"stream" boolean NOT NULL,
	"input_tokens" bigint NOT NULL,
	"output_tokens" bigint NOT NULL,
	"total_tokens" bigint NOT NULL,
	"cached_input_tokens" bigint NOT NULL,
	"reasoning_tokens" bigint NOT NULL,
	"duration_ms" bigint NOT NULL,
	"finish_reason" varchar(100) NOT NULL,
	"estimated_cost" numeric,
	"currency" varchar(12),
	"pricing_snapshot" jsonb,
	CONSTRAINT "ai_usage_events_source_check" CHECK ("wanjiedaoyou_ai_usage_events"."credential_source" in ('server', 'byok')),
	CONSTRAINT "ai_usage_events_counts_check" CHECK ("wanjiedaoyou_ai_usage_events"."step" >= 0 and "wanjiedaoyou_ai_usage_events"."attempt" >= 1 and "wanjiedaoyou_ai_usage_events"."input_tokens" >= 0 and "wanjiedaoyou_ai_usage_events"."output_tokens" >= 0 and "wanjiedaoyou_ai_usage_events"."total_tokens" >= 0 and "wanjiedaoyou_ai_usage_events"."cached_input_tokens" >= 0 and "wanjiedaoyou_ai_usage_events"."reasoning_tokens" >= 0 and "wanjiedaoyou_ai_usage_events"."duration_ms" >= 0),
	CONSTRAINT "ai_usage_events_cost_check" CHECK (("wanjiedaoyou_ai_usage_events"."estimated_cost" is null and "wanjiedaoyou_ai_usage_events"."currency" is null and "wanjiedaoyou_ai_usage_events"."pricing_snapshot" is null) or ("wanjiedaoyou_ai_usage_events"."estimated_cost" is not null and "wanjiedaoyou_ai_usage_events"."estimated_cost" >= 0 and "wanjiedaoyou_ai_usage_events"."currency" is not null and "wanjiedaoyou_ai_usage_events"."pricing_snapshot" is not null))
);
--> statement-breakpoint
CREATE INDEX "ai_usage_events_source_recorded_idx" ON "wanjiedaoyou_ai_usage_events" USING btree ("credential_source","recorded_at");--> statement-breakpoint
CREATE INDEX "ai_usage_events_scene_recorded_idx" ON "wanjiedaoyou_ai_usage_events" USING btree ("scene_id","recorded_at");--> statement-breakpoint
CREATE INDEX "ai_usage_events_provider_model_recorded_idx" ON "wanjiedaoyou_ai_usage_events" USING btree ("provider","model_id","recorded_at");--> statement-breakpoint
CREATE INDEX "ai_usage_events_recorded_idx" ON "wanjiedaoyou_ai_usage_events" USING btree ("recorded_at");