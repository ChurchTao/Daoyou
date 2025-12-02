CREATE TABLE "wanjiedaoyou_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"slot" varchar(20) NOT NULL,
	"element" varchar(10) NOT NULL,
	"bonus" jsonb NOT NULL,
	"special_effects" jsonb DEFAULT '[]'::jsonb,
	"curses" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_consumables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(20) NOT NULL,
	"effect" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_cultivation_techniques" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"bonus" jsonb NOT NULL,
	"required_realm" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_cultivators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"gender" varchar(10),
	"origin" varchar(100),
	"personality" text,
	"background" text,
	"prompt" text NOT NULL,
	"realm" varchar(20) NOT NULL,
	"realm_stage" varchar(10) NOT NULL,
	"age" integer DEFAULT 18 NOT NULL,
	"lifespan" integer DEFAULT 100 NOT NULL,
	"vitality" integer NOT NULL,
	"spirit" integer NOT NULL,
	"wisdom" integer NOT NULL,
	"speed" integer NOT NULL,
	"willpower" integer NOT NULL,
	"max_skills" integer DEFAULT 4 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_equipped_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"weapon_id" uuid,
	"armor_id" uuid,
	"accessory_id" uuid,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "wanjiedaoyou_equipped_items_cultivator_id_unique" UNIQUE("cultivator_id")
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_pre_heaven_fates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(10) NOT NULL,
	"attribute_mod" jsonb NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(20) NOT NULL,
	"element" varchar(10) NOT NULL,
	"power" integer NOT NULL,
	"cost" integer DEFAULT 0,
	"cooldown" integer DEFAULT 0 NOT NULL,
	"effect" varchar(50),
	"duration" integer,
	"target_self" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_spiritual_roots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"element" varchar(10) NOT NULL,
	"strength" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_temp_cultivators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"cultivator_data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_artifacts" ADD CONSTRAINT "wanjiedaoyou_artifacts_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_consumables" ADD CONSTRAINT "wanjiedaoyou_consumables_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivation_techniques" ADD CONSTRAINT "wanjiedaoyou_cultivation_techniques_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_equipped_items" ADD CONSTRAINT "wanjiedaoyou_equipped_items_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_equipped_items" ADD CONSTRAINT "wanjiedaoyou_equipped_items_weapon_id_wanjiedaoyou_artifacts_id_fk" FOREIGN KEY ("weapon_id") REFERENCES "public"."wanjiedaoyou_artifacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_equipped_items" ADD CONSTRAINT "wanjiedaoyou_equipped_items_armor_id_wanjiedaoyou_artifacts_id_fk" FOREIGN KEY ("armor_id") REFERENCES "public"."wanjiedaoyou_artifacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_equipped_items" ADD CONSTRAINT "wanjiedaoyou_equipped_items_accessory_id_wanjiedaoyou_artifacts_id_fk" FOREIGN KEY ("accessory_id") REFERENCES "public"."wanjiedaoyou_artifacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_pre_heaven_fates" ADD CONSTRAINT "wanjiedaoyou_pre_heaven_fates_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_skills" ADD CONSTRAINT "wanjiedaoyou_skills_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_spiritual_roots" ADD CONSTRAINT "wanjiedaoyou_spiritual_roots_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;