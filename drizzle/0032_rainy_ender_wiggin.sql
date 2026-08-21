ALTER TABLE "wanjiedaoyou_sect_memberships" ADD COLUMN "lifetime_contribution" integer DEFAULT 0 NOT NULL;
UPDATE "wanjiedaoyou_sect_memberships"
SET "lifetime_contribution" = "contribution"
WHERE "lifetime_contribution" = 0 AND "contribution" > 0;
