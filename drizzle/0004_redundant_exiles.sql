CREATE TABLE "wanjiedaoyou_breakthrough_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"from_realm" varchar(20) NOT NULL,
	"from_stage" varchar(10) NOT NULL,
	"to_realm" varchar(20) NOT NULL,
	"to_stage" varchar(10) NOT NULL,
	"age" integer NOT NULL,
	"years_spent" integer NOT NULL,
	"story" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_retreat_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"realm" varchar(20) NOT NULL,
	"realm_stage" varchar(10) NOT NULL,
	"years" integer NOT NULL,
	"success" boolean DEFAULT false NOT NULL,
	"chance" double precision NOT NULL,
	"roll" double precision NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"modifiers" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivators" ADD COLUMN "closed_door_years_total" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_breakthrough_history" ADD CONSTRAINT "wanjiedaoyou_breakthrough_history_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_retreat_records" ADD CONSTRAINT "wanjiedaoyou_retreat_records_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;