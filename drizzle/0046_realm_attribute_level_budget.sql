-- Deploy with the new application rules while character writes are stopped.
-- Drizzle's migration journal applies this one-time additive rebasing exactly once.
-- Do not execute this SQL manually a second time.
LOCK TABLE "wanjiedaoyou_cultivators" IN SHARE ROW EXCLUSIVE MODE;
--> statement-breakpoint
-- Unknown realm/stage or attributes below the old natural floor cannot be safely
-- interpreted as old natural growth plus allocated/extra points. Abort, don't reset.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "wanjiedaoyou_cultivators"
    WHERE array_position(ARRAY['炼气','筑基','金丹','元婴','化神','炼虚','合体','大乘','渡劫'], realm) IS NULL
       OR array_position(ARRAY['初期','中期','后期','圆满'], realm_stage) IS NULL
       OR LEAST(vitality, strength, spirit, endurance, speed, willpower) <
          10
          + (array_position(ARRAY['炼气','筑基','金丹','元婴','化神','炼虚','合体','大乘','渡劫'], realm) - 1) * 10
          + (array_position(ARRAY['初期','中期','后期','圆满'], realm_stage) - 1) * 2
       OR unallocated_attribute_points < 0
  ) THEN
    RAISE EXCEPTION 'Realm attribute migration: invalid old realm/stage or attribute budget; inspect affected characters before retrying';
  END IF;
END $$;
--> statement-breakpoint
-- Old natural per attribute: 10 + 10*r + 2*s.
-- New natural per attribute: 10 + 5*(4*r + s + 1).
-- Old free budget: 50*r + 10*s. New free budget: 25*(4*r + s + 1).
-- Add only the deltas, retaining existing allocations and extra earned rewards.
WITH ranks AS (
  SELECT id,
    array_position(ARRAY['炼气','筑基','金丹','元婴','化神','炼虚','合体','大乘','渡劫'], realm) - 1 AS r,
    array_position(ARRAY['初期','中期','后期','圆满'], realm_stage) - 1 AS s
  FROM "wanjiedaoyou_cultivators"
), deltas AS (
  SELECT id, 5 + 10*r + 3*s AS natural_delta, 25 + 50*r + 15*s AS free_delta
  FROM ranks
)
UPDATE "wanjiedaoyou_cultivators" AS c
SET vitality = c.vitality + d.natural_delta,
    strength = c.strength + d.natural_delta,
    spirit = c.spirit + d.natural_delta,
    endurance = c.endurance + d.natural_delta,
    speed = c.speed + d.natural_delta,
    willpower = c.willpower + d.natural_delta,
    unallocated_attribute_points = c.unallocated_attribute_points + d.free_delta
FROM deltas AS d
WHERE c.id = d.id;
-- Persistent HP/MP, realm, lifespan, cultivation progress and extra tracks stay intact.
