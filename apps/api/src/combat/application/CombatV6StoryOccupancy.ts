import type { StoryBattleRuntime } from '@daoyou/contracts/combat/story-battle';
import { redis } from '@server/lib/redis/index.js';
import { parseRedisJson } from '@server/lib/redis/json.js';

export const storyBattleKey = (cultivatorId: string) =>
  `combat:v6:story:${cultivatorId}`;

export async function hasStoryBattle(cultivatorId: string) {
  const key = storyBattleKey(cultivatorId);
  const runtime = parseRedisJson<StoryBattleRuntime>(await redis.get(key), key);
  return !!runtime && !runtime.settled;
}
