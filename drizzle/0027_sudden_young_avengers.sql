CREATE TABLE "wanjiedaoyou_feedbacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"cultivator_id" uuid,
	"type" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_feedbacks" ADD CONSTRAINT "wanjiedaoyou_feedbacks_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_user_id_idx" ON "wanjiedaoyou_feedbacks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "feedback_status_idx" ON "wanjiedaoyou_feedbacks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "feedback_type_idx" ON "wanjiedaoyou_feedbacks" USING btree ("type");--> statement-breakpoint
CREATE INDEX "feedback_created_at_idx" ON "wanjiedaoyou_feedbacks" USING btree ("created_at");