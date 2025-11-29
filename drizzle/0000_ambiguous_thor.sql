CREATE TABLE "wanjiedaoyou_active_effects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"battle_profile_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(50) NOT NULL,
	"value" integer NOT NULL,
	"duration" integer NOT NULL,
	"source" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_battle_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"max_hp" integer NOT NULL,
	"hp" integer NOT NULL,
	"vitality" integer NOT NULL,
	"spirit" integer NOT NULL,
	"wisdom" integer NOT NULL,
	"speed" integer NOT NULL,
	"element" varchar(20),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "wanjiedaoyou_battle_profiles_cultivator_id_unique" UNIQUE("cultivator_id")
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_cultivators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
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
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"bonus" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_pre_heaven_fates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(10) NOT NULL,
	"effect" text NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(20) NOT NULL,
	"power" integer NOT NULL,
	"element" varchar(20) NOT NULL,
	"effects" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255),
	"password_hash" varchar(255),
	"is_anonymous" boolean DEFAULT false,
	"anonymous_id" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "wanjiedaoyou_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_active_effects" ADD CONSTRAINT "wanjiedaoyou_active_effects_battle_profile_id_wanjiedaoyou_battle_profiles_id_fk" FOREIGN KEY ("battle_profile_id") REFERENCES "public"."wanjiedaoyou_battle_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_battle_profiles" ADD CONSTRAINT "wanjiedaoyou_battle_profiles_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivators" ADD CONSTRAINT "wanjiedaoyou_cultivators_user_id_wanjiedaoyou_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."wanjiedaoyou_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_equipment" ADD CONSTRAINT "wanjiedaoyou_equipment_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_pre_heaven_fates" ADD CONSTRAINT "wanjiedaoyou_pre_heaven_fates_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_skills" ADD CONSTRAINT "wanjiedaoyou_skills_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE no action ON UPDATE no action;