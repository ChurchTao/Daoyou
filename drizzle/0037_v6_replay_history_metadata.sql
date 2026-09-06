ALTER TABLE "wanjiedaoyou_combat_v6_replay_archives" ADD COLUMN "round_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_combat_v6_replay_archives" ADD COLUMN "sides" jsonb DEFAULT '[[],[]]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_combat_v6_replay_archives" ADD COLUMN "playable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "wanjiedaoyou_combat_v6_replay_participants" ADD COLUMN "side" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
-- Extract once during migration, never during history requests.
UPDATE "wanjiedaoyou_combat_v6_replay_archives" a SET
  "round_count" = COALESCE((a.replay->'finalState'->>'round')::integer, 0),
  "sides" = jsonb_build_array(
    COALESCE((SELECT jsonb_agg(u->>'name' ORDER BY ord) FROM jsonb_array_elements(a.replay->'initialUnits') WITH ORDINALITY AS units(u, ord) WHERE u->>'side' = '0'), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(u->>'name' ORDER BY ord) FROM jsonb_array_elements(a.replay->'initialUnits') WITH ORDINALITY AS units(u, ord) WHERE u->>'side' = '1'), '[]'::jsonb)
  );
--> statement-breakpoint
UPDATE "wanjiedaoyou_combat_v6_replay_participants" p SET "side" = (participant->>'side')::integer
FROM "wanjiedaoyou_combat_v6_replay_archives" a, LATERAL jsonb_array_elements(a.replay->'participants') participant
WHERE p.battle_id = a.battle_id AND p.cultivator_id::text = participant->>'cultivatorId';
