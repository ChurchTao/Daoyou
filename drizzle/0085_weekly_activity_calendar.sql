-- Align prepared Baixiao rounds with the natural-week cutoff.
UPDATE "wanjiedaoyou_baixiao_rounds"
SET "closes_at" = (("week" + 7)::timestamp AT TIME ZONE 'Asia/Shanghai')
WHERE "settled_at" IS NULL
  AND "week" >= date_trunc('week', now() AT TIME ZONE 'Asia/Shanghai')::date
  AND "closes_at" IS DISTINCT FROM (("week" + 7)::timestamp AT TIME ZONE 'Asia/Shanghai');
