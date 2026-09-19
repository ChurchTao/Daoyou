CREATE TABLE "wanjiedaoyou_combat_replay_archives" (
	"battle_id" uuid PRIMARY KEY NOT NULL,
	"metadata_version" integer NOT NULL,
	"source_type" varchar(64) NOT NULL,
	"battle_type" varchar(64) NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"engine_version" varchar(40) NOT NULL,
	"ruleset_version" varchar(60) NOT NULL,
	"started_at" timestamp NOT NULL,
	"finished_at" timestamp NOT NULL,
	"outcome" varchar(24) NOT NULL,
	"replay" jsonb NOT NULL,
	"round_count" integer DEFAULT 0 NOT NULL,
	"sides" jsonb DEFAULT '[[],[]]'::jsonb NOT NULL,
	"playable" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_combat_replay_participants" (
	"battle_id" uuid NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"side" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "wanjiedaoyou_combat_replay_participants_battle_id_cultivator_id_pk" PRIMARY KEY("battle_id","cultivator_id")
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_cultivator_beast_lineups" (
	"cultivator_id" uuid PRIMARY KEY NOT NULL,
	"lineup" jsonb NOT NULL,
	"starter_claimed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_cultivator_beasts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"cultivator_id" uuid NOT NULL,
	"individual" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_cultivator_equipment_slots" (
	"cultivator_id" uuid NOT NULL,
	"slot" varchar(32) NOT NULL,
	"equipment_instance_id" varchar(160) NOT NULL,
	CONSTRAINT "wanjiedaoyou_cultivator_equipment_slots_cultivator_id_slot_pk" PRIMARY KEY("cultivator_id","slot")
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_cultivator_manual_slots" (
	"cultivator_id" uuid NOT NULL,
	"slot" integer NOT NULL,
	"manual_id" varchar(160) NOT NULL,
	CONSTRAINT "wanjiedaoyou_cultivator_manual_slots_cultivator_id_slot_pk" PRIMARY KEY("cultivator_id","slot"),
	CONSTRAINT "cultivator_manual_slot_valid" CHECK ("wanjiedaoyou_cultivator_manual_slots"."slot" BETWEEN 1 AND 4)
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_cultivator_manual_states" (
	"cultivator_id" uuid PRIMARY KEY NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"learned" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cultivator_manual_revision_valid" CHECK ("wanjiedaoyou_cultivator_manual_states"."revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_sect_combat_states" (
	"membership_id" uuid PRIMARY KEY NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"active_path_id" varchar(160),
	"meridian_depth" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sect_combat_progress_valid" CHECK ("wanjiedaoyou_sect_combat_states"."revision" >= 0 AND "wanjiedaoyou_sect_combat_states"."meridian_depth" BETWEEN 0 AND 7)
);
--> statement-breakpoint
CREATE TABLE "wanjiedaoyou_sect_meridian_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loadout_id" uuid NOT NULL,
	"node_id" varchar(160) NOT NULL,
	"layer" integer NOT NULL
);
--> statement-breakpoint
-- Unreleased V6 hard cutover: discard replaced state, without migrating old payloads.
DROP TABLE "wanjiedaoyou_combat_v6_manual_slots";--> statement-breakpoint
DROP TABLE "wanjiedaoyou_combat_v6_manual_states";--> statement-breakpoint
DROP TABLE "wanjiedaoyou_combat_v6_equipment_loadouts";--> statement-breakpoint
DROP TABLE "wanjiedaoyou_combat_v6_meridian_nodes";--> statement-breakpoint
DROP TABLE "wanjiedaoyou_combat_v6_meridian_loadouts";--> statement-breakpoint
DROP TABLE "wanjiedaoyou_combat_v6_method_progress";--> statement-breakpoint
DROP TABLE "wanjiedaoyou_combat_v6_build_profiles";--> statement-breakpoint
DROP TABLE "wanjiedaoyou_combat_v6_beast_lineups";--> statement-breakpoint
DROP TABLE "wanjiedaoyou_combat_v6_beasts";--> statement-breakpoint
DROP TABLE "wanjiedaoyou_combat_v6_replay_participants";--> statement-breakpoint
DROP TABLE "wanjiedaoyou_combat_v6_replay_archives";--> statement-breakpoint
DROP TABLE "wanjiedaoyou_sect_ability_loadouts";--> statement-breakpoint
DROP TABLE "wanjiedaoyou_sect_path_progress";--> statement-breakpoint
DELETE FROM "wanjiedaoyou_sect_meridian_loadouts";--> statement-breakpoint
DELETE FROM "wanjiedaoyou_sect_method_progress";--> statement-breakpoint
DROP INDEX "sect_meridian_membership_path_slot_unique";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_meridian_loadouts" ALTER COLUMN "path_id" SET DATA TYPE varchar(160);--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_meridian_loadouts" ALTER COLUMN "path_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_method_progress" ALTER COLUMN "method_id" SET DATA TYPE varchar(160);--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_meridian_loadouts" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_combat_replay_participants" ADD CONSTRAINT "wanjiedaoyou_combat_replay_participants_battle_id_wanjiedaoyou_combat_replay_archives_battle_id_fk" FOREIGN KEY ("battle_id") REFERENCES "public"."wanjiedaoyou_combat_replay_archives"("battle_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivator_beast_lineups" ADD CONSTRAINT "wanjiedaoyou_cultivator_beast_lineups_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivator_beasts" ADD CONSTRAINT "wanjiedaoyou_cultivator_beasts_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_owner_id_unique" ON "wanjiedaoyou_inventory_items" USING btree ("cultivator_id","id");--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivator_equipment_slots" ADD CONSTRAINT "wanjiedaoyou_cultivator_equipment_slots_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivator_equipment_slots" ADD CONSTRAINT "wanjiedaoyou_cultivator_equipment_slots_cultivator_id_equipment_instance_id_wanjiedaoyou_inventory_items_cultivator_id_id_fk" FOREIGN KEY ("cultivator_id","equipment_instance_id") REFERENCES "public"."wanjiedaoyou_inventory_items"("cultivator_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivator_manual_slots" ADD CONSTRAINT "wanjiedaoyou_cultivator_manual_slots_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_cultivator_manual_states" ADD CONSTRAINT "wanjiedaoyou_cultivator_manual_states_cultivator_id_wanjiedaoyou_cultivators_id_fk" FOREIGN KEY ("cultivator_id") REFERENCES "public"."wanjiedaoyou_cultivators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_combat_states" ADD CONSTRAINT "wanjiedaoyou_sect_combat_states_membership_id_wanjiedaoyou_sect_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."wanjiedaoyou_sect_memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_meridian_nodes" ADD CONSTRAINT "wanjiedaoyou_sect_meridian_nodes_loadout_id_wanjiedaoyou_sect_meridian_loadouts_id_fk" FOREIGN KEY ("loadout_id") REFERENCES "public"."wanjiedaoyou_sect_meridian_loadouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "combat_replay_source_idempotency_uidx" ON "wanjiedaoyou_combat_replay_archives" USING btree ("source_type","idempotency_key");--> statement-breakpoint
CREATE INDEX "combat_replay_finished_idx" ON "wanjiedaoyou_combat_replay_archives" USING btree ("finished_at");--> statement-breakpoint
CREATE INDEX "combat_replay_participant_cultivator_idx" ON "wanjiedaoyou_combat_replay_participants" USING btree ("cultivator_id","battle_id");--> statement-breakpoint
CREATE INDEX "cultivator_beasts_owner_idx" ON "wanjiedaoyou_cultivator_beasts" USING btree ("cultivator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cultivator_equipment_instance_unique" ON "wanjiedaoyou_cultivator_equipment_slots" USING btree ("equipment_instance_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cultivator_manual_unique" ON "wanjiedaoyou_cultivator_manual_slots" USING btree ("cultivator_id","manual_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sect_meridian_loadout_node_unique" ON "wanjiedaoyou_sect_meridian_nodes" USING btree ("loadout_id","node_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sect_meridian_loadout_layer_unique" ON "wanjiedaoyou_sect_meridian_nodes" USING btree ("loadout_id","layer");--> statement-breakpoint
CREATE UNIQUE INDEX "sect_meridian_membership_path_unique" ON "wanjiedaoyou_sect_meridian_loadouts" USING btree ("membership_id","path_id");--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_memberships" DROP COLUMN "active_path_id";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_meridian_loadouts" DROP COLUMN "slot";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_meridian_loadouts" DROP COLUMN "node_ids";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_meridian_loadouts" DROP COLUMN "version";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_meridian_loadouts" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_sect_method_progress" DROP COLUMN "updated_at";