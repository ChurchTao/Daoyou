CREATE TABLE "wanjiedaoyou_transfer_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"target_server_id" varchar(160) NOT NULL,
	"target_request_id" uuid NOT NULL,
	"challenge" text NOT NULL,
	"package" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_transfer_import_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'issued' NOT NULL,
	"challenge" text NOT NULL,
	"package" text,
	"package_hash" varchar(64),
	"source_server_id" varchar(160),
	"source_cultivator_id" uuid,
	"preview" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"review_note" text,
	"imported_cultivator_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_transfer_trusted_servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" varchar(160) NOT NULL,
	"signing_public_key" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wanjiedaoyou_transfer_trusted_servers_server_id_unique" UNIQUE("server_id")
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_transfer_exports" ADD CONSTRAINT "wanjiedaoyou_transfer_exports_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_transfer_import_requests" ADD CONSTRAINT "wanjiedaoyou_transfer_import_requests_imported_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("imported_cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "transfer_export_cultivator_unique" ON "wanjiedaoyou_transfer_exports" USING btree ("cultivator_id") WHERE "wanjiedaoyou_transfer_exports"."status" <> 'rejected';--> statement-breakpoint
CREATE UNIQUE INDEX "transfer_export_target_request_unique" ON "wanjiedaoyou_transfer_exports" USING btree ("target_server_id","target_request_id");--> statement-breakpoint
CREATE INDEX "transfer_import_status_created_idx" ON "wanjiedaoyou_transfer_import_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "transfer_import_source_character_unique" ON "wanjiedaoyou_transfer_import_requests" USING btree ("source_server_id","source_cultivator_id") WHERE "wanjiedaoyou_transfer_import_requests"."status" = 'imported';