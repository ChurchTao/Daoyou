CREATE TABLE "wanjiedaoyou_cultivator_beast_fusions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"fingerprint" varchar(64) NOT NULL,
	"parents" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivator_beast_fusions" ADD CONSTRAINT "wanjiedaoyou_cultivator_beast_fusions_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cultivator_beast_fusions_request_unique" ON "wanjiedaoyou_cultivator_beast_fusions" USING btree ("cultivator_id","request_id");