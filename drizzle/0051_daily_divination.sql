CREATE TABLE "wanjiedaoyou_daily_divinations" (
	"cultivator_id" uuid PRIMARY KEY NOT NULL,
	"draw_id" uuid NOT NULL,
	"day_key" varchar(10) NOT NULL,
	"direction" varchar(24) NOT NULL,
	"dice" jsonb NOT NULL,
	"omen_id" varchar(32) NOT NULL,
	"generation_id" uuid,
	"interpretation" text,
	"fallback" boolean DEFAULT false NOT NULL,
	"reward_granted_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
