import { redis } from '../src/server/lib/redis';
import { ArenaRoomService } from '../src/server/lib/services/ArenaRoomService';
import { BattleCleanupManifestSchema } from '../src/shared/contracts/battleTerminal';

// Maintenance utility only. Never import this into runtime or run it during deployment automatically.
const apply = process.argv.includes('--apply');
if (apply && !process.argv.includes('--maintenance'))
  throw new Error(
    'Stop API/coordinators/workers first, then pass --maintenance --apply',
  );
const rooms = new ArenaRoomService();
let cursor = '0';
let count = 0;
do {
  const [next, keys] = await redis.scan(
    cursor,
    'MATCH',
    'battle:online:*',
    'COUNT',
    100,
  );
  cursor = next;
  for (const key of keys) {
    if (
      !/^battle:online:[A-Za-z0-9_-]{1,120}$/.test(key) ||
      (await redis.type(key)) !== 'hash'
    )
      continue;
    const raw = await redis.hget(key, 'cleanup_manifest');
    if (!raw) continue;
    const parsed = BattleCleanupManifestSchema.safeParse(JSON.parse(raw));
    if (
      !parsed.success ||
      parsed.data.kind !== 'arena_sparring' ||
      key !== `battle:online:${parsed.data.matchId}`
    )
      continue;
    const manifest = parsed.data;
    if (await redis.exists(`combat:v6:arena:runtime:${manifest.matchId}`))
      throw new Error('Unexpected v6 identity collision; stopped');
    count++;
    console.info(
      `${apply ? 'CLEAN' : 'DRY RUN'} ${manifest.matchId} room=${manifest.roomId ?? 'expired'} players=${manifest.playerIds.length}`,
    );
    if (!apply) continue;
    await rooms.forceReleaseTerminalBattle(manifest);
    const transaction = redis
      .multi()
      .del(
        key,
        `${key}:command-receipts`,
        `${key}:presentation`,
        `${key}:event-snapshots`,
      );
    for (const index of [
      'battle:online:matches',
      'battle:online:resolving',
      'battle:resolution:task:pending',
    ])
      transaction.srem(index, manifest.matchId);
    for (const index of [
      'battle:online:deadlines',
      'battle:online:waiting',
      'battle:online:deadline-claims',
      'battle:online:waiting-claims',
      ...manifest.playerIds.map((id) => `battle:invites:user:${id}`),
    ])
      transaction.zrem(index, manifest.matchId);
    const results = await transaction.exec();
    if (results?.some(([error]) => error))
      throw new Error('Redis cleanup failed; rerun after correcting key types');
    if (manifest.roomId && manifest.startRequestId) {
      await redis.eval(
        "if redis.call('GET',KEYS[1]) == ARGV[1] then redis.call('DEL',KEYS[1]) end",
        1,
        `battle:arena:start:${manifest.roomId}:${manifest.startRequestId}`,
        manifest.matchId,
      );
    }
  }
} while (cursor !== '0');
console.info(
  `${count} legacy arena matches selected. Replay archives and non-arena battles preserved.`,
);
process.exit(0);
