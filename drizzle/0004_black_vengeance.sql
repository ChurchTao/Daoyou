CREATE TABLE "wanjiedaoyou_consumables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"effect" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now()
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
	CONSTRAINT "wanjiedaoyou_equipped_items_cultivator_id_unique" UNIQUE("cultivator_id"),
	CONSTRAINT "wanjiedaoyou_equipped_items_weapon_id_unique" UNIQUE("weapon_id"),
	CONSTRAINT "wanjiedaoyou_equipped_items_armor_id_unique" UNIQUE("armor_id"),
	CONSTRAINT "wanjiedaoyou_equipped_items_accessory_id_unique" UNIQUE("accessory_id")
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivators" ADD COLUMN "max_equipments" integer DEFAULT 3;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivators" ADD COLUMN "max_skills" integer DEFAULT 4;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_equipment" ADD COLUMN "type" varchar(20);--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_equipment" ADD COLUMN "element" varchar(20);--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_equipment" ADD COLUMN "special_effect" text;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_consumables" ADD CONSTRAINT "wanjiedaoyou_consumables_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_equipped_items" ADD CONSTRAINT "wanjiedaoyou_equipped_items_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_equipped_items" ADD CONSTRAINT "wanjiedaoyou_equipped_items_weapon_id_wanjiedaoyou_equipment_id_fk" FOREIGN KEY ("weapon_id") REFERENCES "public"."wanjiedaoyou_equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_equipped_items" ADD CONSTRAINT "wanjiedaoyou_equipped_items_armor_id_wanjiedaoyou_equipment_id_fk" FOREIGN KEY ("armor_id") REFERENCES "public"."wanjiedaoyou_equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_equipped_items" ADD CONSTRAINT "wanjiedaoyou_equipped_items_accessory_id_wanjiedaoyou_equipment_id_fk" FOREIGN KEY ("accessory_id") REFERENCES "public"."wanjiedaoyou_equipment"("id") ON DELETE no action ON UPDATE no action;