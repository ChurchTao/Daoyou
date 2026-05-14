CREATE TABLE "wanjiedaoyou_app_settings" (
	"key" varchar(128) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);
