ALTER TABLE "wanjiedaoyou_baixiao_questions" DROP CONSTRAINT "baixiao_question_status_valid";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_baixiao_questions" ALTER COLUMN "status" SET DEFAULT 'published';--> statement-breakpoint
UPDATE "wanjiedaoyou_baixiao_questions" SET "status" = 'retired' WHERE "status" = 'draft';--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_baixiao_questions" ADD CONSTRAINT "baixiao_question_status_valid" CHECK ("wanjiedaoyou_baixiao_questions"."status" in ('published', 'retired'));
