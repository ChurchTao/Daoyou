ALTER TABLE "wanjiedaoyou_redeem_code_claims" DROP CONSTRAINT "wanjiedaoyou_redeem_code_claims_mail_id_wanjiedaoyou_mails_id_fk";
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_redeem_code_claims" ALTER COLUMN "mail_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_redeem_code_claims" ADD CONSTRAINT "wanjiedaoyou_redeem_code_claims_mail_id_wanjiedaoyou_mails_id_fk" FOREIGN KEY ("mail_id") REFERENCES "public"."wanjiedaoyou_mails"("id") ON DELETE set null ON UPDATE no action;