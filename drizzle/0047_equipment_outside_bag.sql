ALTER TABLE "wanjiedaoyou_inventory_items" DROP CONSTRAINT "inventory_slot_valid";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_inventory_items" ADD CONSTRAINT "inventory_slot_valid" CHECK (("wanjiedaoyou_inventory_items"."location" = 'bag' AND "wanjiedaoyou_inventory_items"."slot_index" IS NOT NULL AND "wanjiedaoyou_inventory_items"."slot_index" >= 0) OR ("wanjiedaoyou_inventory_items"."location" = 'storage' AND "wanjiedaoyou_inventory_items"."slot_index" IS NULL) OR ("wanjiedaoyou_inventory_items"."location" = 'equipped' AND "wanjiedaoyou_inventory_items"."slot_index" IS NULL AND "wanjiedaoyou_inventory_items"."definition_id" = 'equipment.v6'));--> statement-breakpoint
UPDATE "wanjiedaoyou_inventory_items" AS item
SET "location" = 'equipped', "slot_index" = NULL,
    "revision" = item."revision" + 1, "updated_at" = now()
FROM "wanjiedaoyou_cultivator_equipment_slots" AS equipped
WHERE equipped."equipment_instance_id" = item."id"
  AND equipped."cultivator_id" = item."cultivator_id"
  AND item."definition_id" = 'equipment.v6'
  AND item."location" = 'bag';
