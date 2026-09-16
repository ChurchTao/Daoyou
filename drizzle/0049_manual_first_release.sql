-- Unreleased manual prototype: discard learned progress and all old jade assets.
-- Run during maintenance before the 24-manual content is made available.
DELETE FROM "wanjiedaoyou_cultivator_manual_slots";
--> statement-breakpoint
-- Keep the concurrency revision monotonic so a pre-reset request cannot replay.
UPDATE "wanjiedaoyou_cultivator_manual_states"
SET "learned" = '[]'::jsonb, "revision" = "revision" + 1, "updated_at" = now();
--> statement-breakpoint
DELETE FROM "wanjiedaoyou_inventory_items"
WHERE starts_with("definition_id", 'jade.character_manual.');
--> statement-breakpoint
DELETE FROM "wanjiedaoyou_auction_listings"
WHERE "item_type" = 'manual_jade'
   OR starts_with("item_snapshot" #>> '{item,definitionId}', 'jade.character_manual.');
--> statement-breakpoint
-- Remove only jade attachments; retain the mail and any unrelated rewards.
UPDATE "wanjiedaoyou_mails" AS m
SET "attachments" = (
  SELECT coalesce(jsonb_agg(a.value ORDER BY a.ordinality), '[]'::jsonb)
  FROM jsonb_array_elements(m."attachments") WITH ORDINALITY AS a(value, ordinality)
  WHERE NOT coalesce(starts_with(a.value #>> '{inventory,definitionId}', 'jade.character_manual.'), false)
)
WHERE jsonb_typeof(m."attachments") = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(m."attachments") AS a(value)
    WHERE starts_with(a.value #>> '{inventory,definitionId}', 'jade.character_manual.')
  );
--> statement-breakpoint
UPDATE "wanjiedaoyou_redeem_codes" AS r
SET "reward_attachments" = (
  SELECT coalesce(jsonb_agg(a.value ORDER BY a.ordinality), '[]'::jsonb)
  FROM jsonb_array_elements(r."reward_attachments") WITH ORDINALITY AS a(value, ordinality)
  WHERE NOT coalesce(starts_with(a.value #>> '{inventory,definitionId}', 'jade.character_manual.'), false)
)
WHERE jsonb_typeof(r."reward_attachments") = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(r."reward_attachments") AS a(value)
    WHERE starts_with(a.value #>> '{inventory,definitionId}', 'jade.character_manual.')
  );
