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
$$;--> statement-breakpoint
UPDATE "wanjiedaoyou_inventory_items"
SET "stack_key" = 'consumable.v1:' || encode(sha256(convert_to(
  'consumable.v2:[' ||
  to_jsonb("instance_data"->>'name')::text || ',' ||
  to_jsonb("instance_data"->>'type')::text || ',' ||
  to_jsonb("instance_data"->>'quality')::text || ',' ||
  to_jsonb(pg_temp.canonical_consumable_json("instance_data"->'spec'))::text ||
  ']'
, 'UTF8')), 'hex')
WHERE "definition_id" = 'consumable.v1'
  AND "instance_data" ?& array['name', 'type', 'quality', 'spec'];--> statement-breakpoint
DROP FUNCTION pg_temp.canonical_consumable_json(jsonb);
