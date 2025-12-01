CREATE TABLE "wanjiedaoyou_temp_battle_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"temp_cultivator_id" uuid NOT NULL,
	"max_hp" integer NOT NULL,
	"hp" integer NOT NULL,
	"vitality" integer NOT NULL,
	"spirit" integer NOT NULL,
	"wisdom" integer NOT NULL,
	"speed" integer NOT NULL,
	"element" varchar(20),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "wanjiedaoyou_temp_battle_profiles_temp_cultivator_id_unique" UNIQUE("temp_cultivator_id")
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_temp_cultivators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar(100) NOT NULL,
	"name" varchar(100) NOT NULL,
	"prompt" text NOT NULL,
	"cultivation_level" varchar(50) NOT NULL,
	"spirit_root" varchar(50) NOT NULL,
	"appearance" text,
	"backstory" text,
	"gender" varchar(20),
	"origin" varchar(100),
	"personality" text,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_temp_equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"temp_cultivator_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"bonus" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_temp_pre_heaven_fates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"temp_cultivator_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(10) NOT NULL,
	"effect" text NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_temp_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"temp_cultivator_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(20) NOT NULL,
	"power" integer NOT NULL,
	"element" varchar(20) NOT NULL,
	"effects" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_temp_battle_profiles" ADD CONSTRAINT "wanjiedaoyou_temp_battle_profiles_temp_cultivator_id_wanjiedaoyou_temp_cultivators_id_fk" FOREIGN KEY ("temp_cultivator_id") REFERENCES "public"."wanjiedaoyou_temp_cultivators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_temp_equipment" ADD CONSTRAINT "wanjiedaoyou_temp_equipment_temp_cultivator_id_wanjiedaoyou_temp_cultivators_id_fk" FOREIGN KEY ("temp_cultivator_id") REFERENCES "public"."wanjiedaoyou_temp_cultivators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_temp_pre_heaven_fates" ADD CONSTRAINT "wanjiedaoyou_temp_pre_heaven_fates_temp_cultivator_id_wanjiedaoyou_temp_cultivators_id_fk" FOREIGN KEY ("temp_cultivator_id") REFERENCES "public"."wanjiedaoyou_temp_cultivators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_temp_skills" ADD CONSTRAINT "wanjiedaoyou_temp_skills_temp_cultivator_id_wanjiedaoyou_temp_cultivators_id_fk" FOREIGN KEY ("temp_cultivator_id") REFERENCES "public"."wanjiedaoyou_temp_cultivators"("id") ON DELETE no action ON UPDATE no action;