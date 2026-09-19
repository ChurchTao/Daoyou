import { redis } from '../redis';
import { parseRedisJson } from '../redis/json';

export const towerRunKey = (owner: string) => `tower:v6:run:${owner}`;
export async function hasActiveTower(owner: string) {
  const key = towerRunKey(owner);
  const state = parseRedisJson<{
    status: string;
    battleId?: string;
    season: { seasonEndsAt: string };
  }>(await redis.get(key), key);
  return (
    !!state &&
    (!!state.battleId ||
      (state.status !== 'FINISHED' &&
        Date.parse(state.season.seasonEndsAt) > Date.now()))
  );
}

/** Between fights equipment and pets may change; unfinished battles/settlement still occupy. */
export async function hasTowerBattle(owner: string) {
  const key = towerRunKey(owner);
  const state = parseRedisJson<{ battleId?: string }>(
    await redis.get(key),
    key,
  );
  return !!state?.battleId;
}
