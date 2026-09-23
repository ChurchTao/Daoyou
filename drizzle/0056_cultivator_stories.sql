CREATE TABLE "wanjiedaoyou_cultivator_stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"track" varchar(32) NOT NULL,
	"story_id" varchar(80) NOT NULL,
	"beat_id" varchar(80) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"acks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"grants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"marks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivator_stories" ADD CONSTRAINT "wanjiedaoyou_cultivator_stories_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cultivator_stories_owner_track_story_unique" ON "wanjiedaoyou_cultivator_stories" USING btree ("cultivator_id","track","story_id");--> statement-breakpoint
CREATE INDEX "cultivator_stories_owner_track_status_idx" ON "wanjiedaoyou_cultivator_stories" USING btree ("cultivator_id","track","status");--> statement-breakpoint
INSERT INTO "wanjiedaoyou_cultivator_stories" (
	"cultivator_id",
	"track",
	"story_id",
	"beat_id",
	"status",
	"acks",
	"grants",
	"marks"
)
SELECT
	"id",
	'main',
	'arrival',
	'entered',
	'active',
	'[]'::jsonb,
	'[]'::jsonb,
	'[]'::jsonb
FROM "wanjiedaoyou_cultivators";
