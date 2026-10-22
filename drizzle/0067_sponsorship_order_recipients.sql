ALTER TABLE "wanjiedaoyou_sponsorship_daily_grants" DROP CONSTRAINT "wanjiedaoyou_sponsorship_daily_grants_cultivator_id_wanjiedaoyou_cultivators_id_fk";
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sponsorship_subscription_terms" DROP CONSTRAINT "wanjiedaoyou_sponsorship_subscription_terms_cultivator_id_wanjiedaoyou_cultivators_id_fk";
--> statement-breakpoint
DROP INDEX "sponsorship_terms_cultivator_plan_uidx";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sponsorship_daily_grants" ALTER COLUMN "cultivator_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sponsorship_subscription_terms" ALTER COLUMN "cultivator_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sponsorship_daily_grants" ADD COLUMN "subscription_term_id" uuid;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sponsorship_orders" ADD COLUMN "recipient_cultivator_id" uuid;--> statement-breakpoint
-- Keep the original delivered recipient; only matched intents can supply a pending recipient.
UPDATE "wanjiedaoyou_sponsorship_orders" o
SET "recipient_cultivator_id" = COALESCE(
  (SELECT m.cultivator_id FROM "wanjiedaoyou_sponsorship_merit_records" m WHERE m.order_id = o.id),
  (SELECT c.cultivator_id FROM "wanjiedaoyou_sponsorship_claims" c WHERE c.order_id = o.id AND c.status = 'claimed'),
  (SELECT i.cultivator_id FROM "wanjiedaoyou_sponsorship_checkout_intents" i
   WHERE i.id = o.checkout_intent_id AND i.status IN ('matched', 'fulfilled'))
);
--> statement-breakpoint
-- Preserve past deliveries and attach their stable subscription identity where unambiguous.
UPDATE "wanjiedaoyou_sponsorship_daily_grants" g
SET "subscription_term_id" = (
  SELECT (array_agg(t.id))[1] FROM "wanjiedaoyou_sponsorship_subscription_terms" t
  WHERE t.cultivator_id = g.cultivator_id AND t.plan_key = g.plan_key
  HAVING count(*) = 1
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sponsorship_daily_grants" ADD CONSTRAINT "wanjiedaoyou_sponsorship_daily_grants_subscription_term_id_wanjiedaoyou_sponsorship_subscription_terms_id_fk" FOREIGN KEY ("subscription_term_id") REFERENCES "public"."wanjiedaoyou_sponsorship_subscription_terms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sponsorship_daily_grants" ADD CONSTRAINT "wanjiedaoyou_sponsorship_daily_grants_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sponsorship_orders" ADD CONSTRAINT "wanjiedaoyou_sponsorship_orders_recipient_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("recipient_cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sponsorship_subscription_terms" ADD CONSTRAINT "wanjiedaoyou_sponsorship_subscription_terms_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sponsorship_daily_grants_term_date_uidx" ON "wanjiedaoyou_sponsorship_daily_grants" USING btree ("subscription_term_id","grant_date");--> statement-breakpoint
CREATE UNIQUE INDEX "sponsorship_terms_provider_user_plan_uidx" ON "wanjiedaoyou_sponsorship_subscription_terms" USING btree ("provider","provider_user_id","afdian_plan_id");--> statement-breakpoint
CREATE INDEX "sponsorship_terms_cultivator_idx" ON "wanjiedaoyou_sponsorship_subscription_terms" USING btree ("cultivator_id");