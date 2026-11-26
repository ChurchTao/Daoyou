CREATE TABLE "wanjiedaoyou_alchemy_contest_entries" (
	"week" date NOT NULL,
	"user_id" uuid NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"name" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"attempts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"standing" jsonb,
	"rank" integer,
	"reward" jsonb,
	"mailed_at" timestamp with time zone,
	CONSTRAINT "wanjiedaoyou_alchemy_contest_entries_week_user_id_pk" PRIMARY KEY("week","user_id")
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_alchemy_contest_rounds" (
	"week" date PRIMARY KEY NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"paper" jsonb NOT NULL,
	"reserve" jsonb,
	"reward_pool" jsonb NOT NULL,
	"announced_at" timestamp with time zone,
	"settled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_alchemy_contest_entries" ADD CONSTRAINT "wanjiedaoyou_alchemy_contest_entries_week_wanjiedaoyou_alchemy_contest_rounds_week_fk" FOREIGN KEY ("week") REFERENCES "public"."wanjiedaoyou_alchemy_contest_rounds"("week") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alchemy_contest_rank_idx" ON "wanjiedaoyou_alchemy_contest_entries" USING btree ("week","rank");--> statement-breakpoint
CREATE INDEX "alchemy_contest_mail_idx" ON "wanjiedaoyou_alchemy_contest_entries" USING btree ("week") WHERE "wanjiedaoyou_alchemy_contest_entries"."reward" is not null and "wanjiedaoyou_alchemy_contest_entries"."mailed_at" is null;--> statement-breakpoint
CREATE INDEX "alchemy_contest_round_settlement_idx" ON "wanjiedaoyou_alchemy_contest_rounds" USING btree ("closes_at") WHERE "wanjiedaoyou_alchemy_contest_rounds"."settled_at" is null;