UPDATE "wanjiedaoyou_materials"
SET "type" = 'herb'
WHERE "type" = 'seed'
  AND "details"->>'kind' = 'herb_seed';
