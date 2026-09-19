import {
  towerRunOccupancy,
  type TowerLifecycleState,
} from '@shared/lib/tower/lifecycle';
import { redis } from '../redis';
import { parseRedisJson } from '../redis/json';

export const towerRunKey = (owner: string) =>
  `tower:v6:configured-v7:run:${owner}`;
export async function hasActiveTower(owner: string) {
  const key = towerRunKey(owner);
  const state = parseRedisJson<TowerLifecycleState>(await redis.get(key), key);
  return towerRunOccupancy(state, Date.now()) !== 'none';
}

/** Between fights equipment and pets may change; unfinished battles/settlement still occupy. */
export async function hasTowerBattle(owner: string) {
  const key = towerRunKey(owner);
  const state = parseRedisJson<TowerLifecycleState>(await redis.get(key), key);
  return towerRunOccupancy(state, Date.now()) === 'battle';
}
