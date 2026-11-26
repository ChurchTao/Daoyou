CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_baixiao_entries" (
	"week" date NOT NULL,
	"user_id" uuid NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"gender" text,
	"realm" text NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"issued_at" timestamp with time zone,
	"challenge_id" uuid,
	"paper" jsonb NOT NULL,
	"answers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"focus_penalties" integer DEFAULT 0 NOT NULL,
	"status" text,
	"budget" jsonb NOT NULL,
	"earned" jsonb NOT NULL,
	"score" jsonb,
	"rank" integer,
	"reward" jsonb,
	CONSTRAINT "wanjiedaoyou_baixiao_entries_week_user_id_pk" PRIMARY KEY("week","user_id"),
	CONSTRAINT "baixiao_entry_status_valid" CHECK ("wanjiedaoyou_baixiao_entries"."status" in ('cleared', 'eliminated', 'expired'))
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_baixiao_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"knowledge_key" text NOT NULL,
	"question" jsonb NOT NULL,
	"sample_key" double precision DEFAULT random() NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "baixiao_question_status_valid" CHECK ("wanjiedaoyou_baixiao_questions"."status" in ('published', 'retired'))
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_baixiao_rounds" (
	"week" date PRIMARY KEY NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"question_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"books" jsonb NOT NULL,
	"materials" jsonb NOT NULL,
	"announced_at" timestamp with time zone,
	"settled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_baixiao_entries" ADD CONSTRAINT "wanjiedaoyou_baixiao_entries_week_wanjiedaoyou_baixiao_rounds_week_fk" FOREIGN KEY ("week") REFERENCES "public"."wanjiedaoyou_baixiao_rounds"("week") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "baixiao_entry_rank_idx" ON "wanjiedaoyou_baixiao_entries" USING btree ("week","rank");--> statement-breakpoint
CREATE UNIQUE INDEX "baixiao_published_knowledge_idx" ON "wanjiedaoyou_baixiao_questions" USING btree ("knowledge_key") WHERE "wanjiedaoyou_baixiao_questions"."status" = 'published';--> statement-breakpoint
CREATE INDEX "baixiao_published_sample_idx" ON "wanjiedaoyou_baixiao_questions" USING btree (("question"->>'category'),("question"->>'difficulty'),("question"->>'kind'),"sample_key","id") WHERE "wanjiedaoyou_baixiao_questions"."status" = 'published';--> statement-breakpoint
CREATE INDEX "baixiao_question_prompt_search_idx" ON "wanjiedaoyou_baixiao_questions" USING gin ((regexp_replace(lower(normalize("question"->>'prompt', NFKC)), '[[:punct:][:space:]]', '', 'g')) gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "baixiao_round_settlement_idx" ON "wanjiedaoyou_baixiao_rounds" USING btree ("closes_at") WHERE "wanjiedaoyou_baixiao_rounds"."settled_at" is null;
