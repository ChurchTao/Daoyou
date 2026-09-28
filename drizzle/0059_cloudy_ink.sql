CREATE TABLE "wanjiedaoyou_cultivator_auto_strategies" (
	"cultivator_id" uuid NOT NULL,
	"path_id" varchar(160) NOT NULL,
	"strategy" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wanjiedaoyou_cultivator_auto_strategies_cultivator_id_path_id_pk" PRIMARY KEY("cultivator_id","path_id")
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivator_auto_strategies" ADD CONSTRAINT "wanjiedaoyou_cultivator_auto_strategies_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;