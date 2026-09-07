ALTER TABLE "wanjiedaoyou_inventory_items" ADD COLUMN "stack_key" varchar(200);--> statement-breakpoint
UPDATE "wanjiedaoyou_inventory_items" SET "stack_key" = CASE
 WHEN "definition_id" = 'equipment.v6' THEN NULL
 WHEN "definition_id" = 'material.v1' THEN 'material.v1:' || encode(sha256(convert_to(
 octet_length("instance_data"->>'name')::text || ':' || ("instance_data"->>'name') ||
 octet_length("instance_data"->>'type')::text || ':' || ("instance_data"->>'type') ||
 octet_length("instance_data"->>'rank')::text || ':' || ("instance_data"->>'rank') ||
 octet_length(coalesce("instance_data"->>'element', ''))::text || ':' || coalesce("instance_data"->>'element', '') ||
 octet_length(coalesce("instance_data"->>'description', ''))::text || ':' || coalesce("instance_data"->>'description', '')
 , 'UTF8')), 'hex')
 ELSE 'definition.v1:' || "definition_id"
 END;--> statement-breakpoint
CREATE INDEX "inventory_stack_lookup_idx" ON "wanjiedaoyou_inventory_items" USING btree ("cultivator_id","location","definition_id","stack_key");
