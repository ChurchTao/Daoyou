CREATE TABLE "wanjiedaoyou_inventory_items" (
	"id" varchar(160) PRIMARY KEY NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"location" varchar(16) NOT NULL,
	"slot_index" integer,
	"definition_id" varchar(160) NOT NULL,
	"quantity" integer NOT NULL,
	"instance_data" jsonb,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_quantity_positive" CHECK ("wanjiedaoyou_inventory_items"."quantity" > 0 AND "wanjiedaoyou_inventory_items"."revision" >= 0),
	CONSTRAINT "inventory_slot_valid" CHECK (("wanjiedaoyou_inventory_items"."location" = 'bag' AND "wanjiedaoyou_inventory_items"."slot_index" IS NOT NULL AND "wanjiedaoyou_inventory_items"."slot_index" BETWEEN 0 AND 39) OR ("wanjiedaoyou_inventory_items"."location" = 'storage' AND "wanjiedaoyou_inventory_items"."slot_index" IS NULL))
);
--> statement-breakpoint
-- Preserve v6 identities and frozen equipment facts. Equipped items get bag priority.
WITH ranked AS (
 SELECT e.*, row_number() OVER (PARTITION BY e.cultivator_id ORDER BY
 EXISTS (SELECT 1 FROM wanjiedaoyou_combat_v6_equipment_loadouts l WHERE l.equipment_instance_id = e.id) DESC,
 e.created_at, e.id) - 1 AS position
 FROM wanjiedaoyou_combat_v6_equipment_instances e
)
INSERT INTO wanjiedaoyou_inventory_items
 (id, cultivator_id, location, slot_index, definition_id, quantity, instance_data, revision, created_at)
SELECT id, cultivator_id, CASE WHEN position < 40 THEN 'bag' ELSE 'storage' END,
 CASE WHEN position < 40 THEN position::integer ELSE NULL END,
 'equipment.v6', 1, instance, 0, created_at FROM ranked;
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_combat_v6_equipment_loadouts" DROP CONSTRAINT "wanjiedaoyou_combat_v6_equipment_loadouts_equipment_instance_id_wanjiedaoyou_combat_v6_equipment_instances_id_fk";
--> statement-breakpoint
DROP TABLE "wanjiedaoyou_combat_v6_equipment_instances";
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_inventory_items" ADD CONSTRAINT "wanjiedaoyou_inventory_items_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_owner_location_idx" ON "wanjiedaoyou_inventory_items" USING btree ("cultivator_id","location");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_bag_slot_unique" ON "wanjiedaoyou_inventory_items" USING btree ("cultivator_id","slot_index") WHERE "wanjiedaoyou_inventory_items"."location" = 'bag';--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_combat_v6_equipment_loadouts" ADD CONSTRAINT "wanjiedaoyou_combat_v6_equipment_loadouts_equipment_instance_id_wanjiedaoyou_inventory_items_id_fk" FOREIGN KEY ("equipment_instance_id") REFERENCES "public"."wanjiedaoyou_inventory_items"("id") ON DELETE restrict ON UPDATE no action;
