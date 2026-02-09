CREATE TABLE "wanjiedaoyou_admin_message_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" varchar(20) NOT NULL,
	"name" varchar(120) NOT NULL,
	"subject_template" varchar(300),
	"content_template" text NOT NULL,
	"default_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
