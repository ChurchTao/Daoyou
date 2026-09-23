DROP INDEX "reputation_shop_item_library_item_uidx";--> statement-breakpoint
DROP INDEX "sect_shop_item_library_item_uidx";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_reputation_shop_items" ALTER COLUMN "item_library_item_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_reputation_shop_purchases" ALTER COLUMN "item_library_item_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_shop_items" ALTER COLUMN "item_library_item_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_shop_purchases" ALTER COLUMN "item_library_item_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_reputation_shop_items" ADD COLUMN "item_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_shop_items" ADD COLUMN "item_snapshot" jsonb;
--> statement-breakpoint
-- Preserve product IDs/prices and weekly history. Only ordinary V1 materials can
-- be migrated losslessly. Other legacy shelves remain archived for reconfiguration.
UPDATE wanjiedaoyou_reputation_shop_items s SET item_snapshot = jsonb_build_object(
  'definitionId', 'material.v1', 'instanceData', jsonb_build_object(
    'name', l.payload->>'name', 'type', l.payload->>'type', 'rank', l.payload->>'rank',
    'element', l.payload->'element', 'description', COALESCE(l.payload->>'description', '')
  )) FROM wanjiedaoyou_item_library l
WHERE s.item_library_item_id = l.item_id AND l.type = 'material'
  AND l.payload->>'type' IN ('herb','ore','tcdb','aux','monster','gongfa_manual','skill_manual')
  AND l.payload->>'rank' IN ('凡品','灵品','玄品','真品','地品','天品','仙品','神品')
  AND (l.payload->>'element' IS NULL OR l.payload->>'element' IN ('金','木','水','火','土','风','雷','冰'))
  AND length(trim(l.payload->>'name')) BETWEEN 1 AND 100
  AND length(COALESCE(l.payload->>'description', '')) <= 4000;
--> statement-breakpoint
UPDATE wanjiedaoyou_sect_shop_items s SET item_snapshot = jsonb_build_object(
  'definitionId', 'material.v1', 'instanceData', jsonb_build_object(
    'name', l.payload->>'name', 'type', l.payload->>'type', 'rank', l.payload->>'rank',
    'element', l.payload->'element', 'description', COALESCE(l.payload->>'description', '')
  )) FROM wanjiedaoyou_item_library l
WHERE s.item_library_item_id = l.item_id AND l.type = 'material'
  AND l.payload->>'type' IN ('herb','ore','tcdb','aux','monster','gongfa_manual','skill_manual')
  AND l.payload->>'rank' IN ('凡品','灵品','玄品','真品','地品','天品','仙品','神品')
  AND (l.payload->>'element' IS NULL OR l.payload->>'element' IN ('金','木','水','火','土','风','雷','冰'))
  AND length(trim(l.payload->>'name')) BETWEEN 1 AND 100
  AND length(COALESCE(l.payload->>'description', '')) <= 4000;
--> statement-breakpoint
UPDATE wanjiedaoyou_reputation_shop_items s SET status = 'archived'
WHERE item_snapshot IS NULL OR EXISTS (SELECT 1 FROM wanjiedaoyou_item_library l WHERE l.item_id = s.item_library_item_id AND l.status <> 'published');
--> statement-breakpoint
UPDATE wanjiedaoyou_sect_shop_items s SET status = 'archived'
WHERE item_snapshot IS NULL OR EXISTS (SELECT 1 FROM wanjiedaoyou_item_library l WHERE l.item_id = s.item_library_item_id AND l.status <> 'published');
--> statement-breakpoint
UPDATE wanjiedaoyou_item_library SET status = 'archived' WHERE type IN ('artifact', 'consumable');
