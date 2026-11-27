-- Stop the old API before running this migration so it cannot write new archives.
DELETE FROM "wanjiedaoyou_combat_replay_archives"
WHERE "source_type" = 'ancient-demon-invasion';
