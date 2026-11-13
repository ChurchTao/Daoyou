CREATE TABLE "wanjiedaoyou_achievement_metrics" (
	"cultivator_id" uuid NOT NULL,
	"metric" varchar(160) NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wanjiedaoyou_achievement_metrics_cultivator_id_metric_pk" PRIMARY KEY("cultivator_id","metric"),
	CONSTRAINT "achievement_metrics_value_valid" CHECK ("wanjiedaoyou_achievement_metrics"."value" >= 0)
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_achievement_metrics" ADD CONSTRAINT "wanjiedaoyou_achievement_metrics_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;