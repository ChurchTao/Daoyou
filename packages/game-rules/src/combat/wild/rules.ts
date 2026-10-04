import type { WildResources } from '@daoyou/game-domain/wild';
import { WILD_PACK } from '@daoyou/game-content/combat/wild';

export const WILD_EXPLORATION_COOLDOWN_MS =
  WILD_PACK.activity.explorationCooldownMs;

export function settleWildResources(
  final: WildResources,
  entry: WildResources,
  technicalAbort: boolean,
): WildResources {
  const source = technicalAbort ? entry : final;
  if (
    ![source.hp, source.mp, entry.maxHp, entry.maxMp].every(Number.isFinite) ||
    entry.maxHp < 1 ||
    entry.maxMp < 0
  )
    throw new Error('INVALID_WILD_SETTLEMENT');
  return {
    hp: Math.max(
      technicalAbort ? 0 : 1,
      Math.min(entry.maxHp, Math.floor(source.hp)),
    ),
    mp: Math.max(0, Math.min(entry.maxMp, Math.floor(source.mp))),
    maxHp: entry.maxHp,
    maxMp: entry.maxMp,
  };
}
