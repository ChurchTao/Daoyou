import { redis } from '../redis';
import { parseRedisJson } from '../redis/json';

export const towerRunKey = (owner: string) => `tower:v6:run:${owner}`;
export async function hasActiveTower(owner: string) {
  const key = towerRunKey(owner);
  const state = parseRedisJson<{
    status: string;
    season: { seasonEndsAt: string };
  }>(await redis.get(key), key);
  return (
    !!state &&
    state.status !== 'FINISHED' &&
    (state.status === 'WAITING_BATTLE' ||
      Date.parse(state.season.seasonEndsAt) > Date.now())
  );
}
