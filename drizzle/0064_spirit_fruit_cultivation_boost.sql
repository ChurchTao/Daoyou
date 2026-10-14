-- 修为灵果曾按感悟基数直接加修为。改为同品质丹药 80% 的下次闭关加成，并改写已保存的果实。
CREATE FUNCTION pg_temp.cultivation_fruit_operations(quality text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE quality
    WHEN '凡品' THEN jsonb_build_array(jsonb_build_object(
      'type', 'add_status', 'status', 'cultivation_boost', 'usesRemaining', 1,
      'payload', jsonb_build_object('boostPercent', 0.32::numeric, 'retreatExpMultiplier', 1.32::numeric)))
    WHEN '灵品' THEN jsonb_build_array(jsonb_build_object(
      'type', 'add_status', 'status', 'cultivation_boost', 'usesRemaining', 1,
      'payload', jsonb_build_object('boostPercent', 0.56::numeric, 'retreatExpMultiplier', 1.56::numeric)))
    WHEN '玄品' THEN jsonb_build_array(jsonb_build_object(
      'type', 'add_status', 'status', 'cultivation_boost', 'usesRemaining', 1,
      'payload', jsonb_build_object('boostPercent', 0.96::numeric, 'retreatExpMultiplier', 1.96::numeric)))
    WHEN '真品' THEN jsonb_build_array(jsonb_build_object(
      'type', 'add_status', 'status', 'cultivation_boost', 'usesRemaining', 1,
      'payload', jsonb_build_object('boostPercent', 1.6::numeric, 'retreatExpMultiplier', 2.6::numeric)))
    WHEN '地品' THEN jsonb_build_array(jsonb_build_object(
      'type', 'add_status', 'status', 'cultivation_boost', 'usesRemaining', 1,
      'payload', jsonb_build_object('boostPercent', 2.56::numeric, 'retreatExpMultiplier', 3.56::numeric)))
    WHEN '天品' THEN jsonb_build_array(jsonb_build_object(
      'type', 'add_status', 'status', 'cultivation_boost', 'usesRemaining', 1,
      'payload', jsonb_build_object('boostPercent', 3.6::numeric, 'retreatExpMultiplier', 4.6::numeric)))
    WHEN '仙品' THEN jsonb_build_array(jsonb_build_object(
      'type', 'add_status', 'status', 'cultivation_boost', 'usesRemaining', 1,
      'payload', jsonb_build_object('boostPercent', 4.8::numeric, 'retreatExpMultiplier', 5.8::numeric)))
    WHEN '神品' THEN jsonb_build_array(jsonb_build_object(
      'type', 'add_status', 'status', 'cultivation_boost', 'usesRemaining', 1,
      'payload', jsonb_build_object('boostPercent', 6.4::numeric, 'retreatExpMultiplier', 7.4::numeric)))
    ELSE NULL
  END
$$;
--> statement-breakpoint
CREATE FUNCTION pg_temp.fix_cultivation_fruit(value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  current jsonb := value;
  entry record;
  child jsonb;
  operations jsonb;
BEGIN
  IF jsonb_typeof(value) = 'array' THEN
    FOR entry IN
      SELECT ordinality, element.value
      FROM jsonb_array_elements(value) WITH ORDINALITY AS element(value, ordinality)
    LOOP
      child := pg_temp.fix_cultivation_fruit(entry.value);
      IF child IS DISTINCT FROM entry.value THEN
        current := jsonb_set(current, ARRAY[(entry.ordinality - 1)::text], child, false);
      END IF;
    END LOOP;
    RETURN current;
  ELSIF jsonb_typeof(value) = 'object' THEN
    operations := pg_temp.cultivation_fruit_operations(value->>'quality');
    IF operations IS NOT NULL
      AND value #>> '{spec,kind}' = 'spirit_fruit'
      AND value #>> '{spec,family}' = 'cultivation'
      AND jsonb_typeof(value #> '{spec,operations}') = 'array'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(value #> '{spec,operations}') AS operation(value)
        WHERE operation.value->>'type' = 'gain_progress'
          AND operation.value->>'target' = 'cultivation_exp'
      ) THEN
      current := jsonb_set(current, '{spec,operations}', operations, true);
    END IF;
    FOR entry IN SELECT key, nested.value FROM jsonb_each(current) AS nested(key, value)
    LOOP
      child := pg_temp.fix_cultivation_fruit(entry.value);
      IF child IS DISTINCT FROM entry.value THEN
        current := jsonb_set(current, ARRAY[entry.key], child, false);
      END IF;
    END LOOP;
    RETURN current;
  END IF;
  RETURN value;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION pg_temp.canonical_consumable_json(value jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE serialized text;
BEGIN
  IF jsonb_typeof(value) = 'object' THEN
    SELECT string_agg(to_jsonb(entry.key)::text || ':' || pg_temp.canonical_consumable_json(entry.value), ',' ORDER BY entry.key COLLATE "C")
      INTO serialized
      FROM jsonb_each(value) AS entry(key, value);
    RETURN '{' || coalesce(serialized, '') || '}';
  ELSIF jsonb_typeof(value) = 'array' THEN
    SELECT string_agg(pg_temp.canonical_consumable_json(entry.value), ',' ORDER BY entry.position)
      INTO serialized
      FROM jsonb_array_elements(value) WITH ORDINALITY AS entry(value, position);
    RETURN '[' || coalesce(serialized, '') || ']';
  ELSIF jsonb_typeof(value) = 'number' THEN
    RETURN trim_scale((value #>> '{}')::numeric)::text;
  END IF;
  RETURN value::text;
END;
$$;
--> statement-breakpoint
UPDATE "wanjiedaoyou_inventory_items" AS item
SET "instance_data" = fixed.data,
    "stack_key" = 'consumable.v1:' || encode(sha256(convert_to(
      'consumable.v2:[' ||
      to_jsonb(fixed.data->>'name')::text || ',' ||
      to_jsonb(fixed.data->>'type')::text || ',' ||
      to_jsonb(fixed.data->>'quality')::text || ',' ||
      to_jsonb(pg_temp.canonical_consumable_json(fixed.data->'spec'))::text ||
      ']'
    , 'UTF8')), 'hex'),
    "revision" = item."revision" + 1,
    "updated_at" = now()
FROM (
  SELECT "id", pg_temp.fix_cultivation_fruit("instance_data") AS data
  FROM "wanjiedaoyou_inventory_items"
  WHERE "definition_id" = 'consumable.v1'
    AND "instance_data" #>> '{spec,kind}' = 'spirit_fruit'
    AND "instance_data" #>> '{spec,family}' = 'cultivation'
) AS fixed
WHERE item."id" = fixed."id"
  AND fixed.data IS DISTINCT FROM item."instance_data";
--> statement-breakpoint
UPDATE "wanjiedaoyou_auction_listings"
SET "item_snapshot" = pg_temp.fix_cultivation_fruit("item_snapshot")
WHERE "item_snapshot"::text LIKE '%spirit_fruit%'
  AND "item_snapshot"::text LIKE '%cultivation_exp%'
  AND pg_temp.fix_cultivation_fruit("item_snapshot") IS DISTINCT FROM "item_snapshot";
--> statement-breakpoint
UPDATE "wanjiedaoyou_mails"
SET "attachments" = pg_temp.fix_cultivation_fruit("attachments")
WHERE "attachments"::text LIKE '%spirit_fruit%'
  AND "attachments"::text LIKE '%cultivation_exp%'
  AND pg_temp.fix_cultivation_fruit("attachments") IS DISTINCT FROM "attachments";
--> statement-breakpoint
UPDATE "wanjiedaoyou_system_mail_campaigns"
SET "reward_selections" = pg_temp.fix_cultivation_fruit("reward_selections")
WHERE "reward_selections"::text LIKE '%spirit_fruit%'
  AND "reward_selections"::text LIKE '%cultivation_exp%'
  AND pg_temp.fix_cultivation_fruit("reward_selections") IS DISTINCT FROM "reward_selections";
--> statement-breakpoint
UPDATE "wanjiedaoyou_redeem_codes"
SET "reward_attachments" = pg_temp.fix_cultivation_fruit("reward_attachments")
WHERE "reward_attachments"::text LIKE '%spirit_fruit%'
  AND "reward_attachments"::text LIKE '%cultivation_exp%'
  AND pg_temp.fix_cultivation_fruit("reward_attachments") IS DISTINCT FROM "reward_attachments";
--> statement-breakpoint
UPDATE "wanjiedaoyou_reputation_shop_items"
SET "item_snapshot" = pg_temp.fix_cultivation_fruit("item_snapshot")
WHERE "item_snapshot"::text LIKE '%spirit_fruit%'
  AND "item_snapshot"::text LIKE '%cultivation_exp%'
  AND pg_temp.fix_cultivation_fruit("item_snapshot") IS DISTINCT FROM "item_snapshot";
--> statement-breakpoint
UPDATE "wanjiedaoyou_sect_shop_items"
SET "item_snapshot" = pg_temp.fix_cultivation_fruit("item_snapshot")
WHERE "item_snapshot"::text LIKE '%spirit_fruit%'
  AND "item_snapshot"::text LIKE '%cultivation_exp%'
  AND pg_temp.fix_cultivation_fruit("item_snapshot") IS DISTINCT FROM "item_snapshot";
--> statement-breakpoint
UPDATE "wanjiedaoyou_chat_messages"
SET "payload" = pg_temp.fix_cultivation_fruit("payload")
WHERE "payload"::text LIKE '%spirit_fruit%'
  AND "payload"::text LIKE '%cultivation_exp%'
  AND pg_temp.fix_cultivation_fruit("payload") IS DISTINCT FROM "payload";
--> statement-breakpoint
UPDATE "wanjiedaoyou_chat_red_packets"
SET "message_snapshot" = pg_temp.fix_cultivation_fruit("message_snapshot")
WHERE "message_snapshot"::text LIKE '%spirit_fruit%'
  AND "message_snapshot"::text LIKE '%cultivation_exp%'
  AND pg_temp.fix_cultivation_fruit("message_snapshot") IS DISTINCT FROM "message_snapshot";
--> statement-breakpoint
UPDATE "wanjiedaoyou_consumables"
SET "spec" = jsonb_set("spec", '{operations}', pg_temp.cultivation_fruit_operations("quality"), true)
WHERE "spec"->>'kind' = 'spirit_fruit'
  AND "spec"->>'family' = 'cultivation'
  AND pg_temp.cultivation_fruit_operations("quality") IS NOT NULL
  AND jsonb_typeof("spec"->'operations') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements("spec"->'operations') AS operation(value)
    WHERE operation.value->>'type' = 'gain_progress'
      AND operation.value->>'target' = 'cultivation_exp'
  );
--> statement-breakpoint
DROP FUNCTION pg_temp.fix_cultivation_fruit(jsonb);
--> statement-breakpoint
DROP FUNCTION pg_temp.cultivation_fruit_operations(text);
--> statement-breakpoint
DROP FUNCTION pg_temp.canonical_consumable_json(jsonb);
