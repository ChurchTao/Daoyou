CREATE TABLE "wanjiedaoyou_combat_v6_beast_lineups" (
	"cultivator_id" uuid PRIMARY KEY NOT NULL,
	"lineup" jsonb NOT NULL,
	"starter_beast_id" uuid
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_combat_v6_beasts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"individual" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_combat_v6_beast_lineups" ADD CONSTRAINT "wanjiedaoyou_combat_v6_beast_lineups_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_combat_v6_beasts" ADD CONSTRAINT "wanjiedaoyou_combat_v6_beasts_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "combat_v6_beasts_owner_idx" ON "wanjiedaoyou_combat_v6_beasts" USING btree ("cultivator_id");