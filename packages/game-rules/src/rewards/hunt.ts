import { createHuntRewardSnapshotSchema } from '@daoyou/game-domain/hunts';

import { DropPoolSchema } from '@daoyou/game-domain/rewards';
import { rollDrops } from '../drops/index.js';

import { YieldCalculator } from '../yield/YieldCalculator.js';

import type { HuntEvent } from '@daoyou/game-domain/hunts';

import { ItemGrantSchema } from '../inventory/index.js';

import { findItemDefinition } from '@daoyou/game-content/items';

import { REWARDS_HUNT_DATA as raw } from '@daoyou/game-content/rewards/hunt';

export const HuntRewardSnapshotSchema =
  createHuntRewardSnapshotSchema(ItemGrantSchema);
export const HUNT_REWARD_HOURS = 6;

export const HuntDropPoolSchema = DropPoolSchema.superRefine((pool, ctx) => {
  for (const [index, group] of pool.groups.entries()) {
    for (const entry of group.entries) {
      if (
        entry.rewardId !== 'hunt.material' &&
        !findItemDefinition(entry.rewardId)
      )
        ctx.addIssue({
          code: 'custom',
          path: ['groups', index],
          message: '未知讨伐道具',
        });
    }
  }
  if (
    !pool.groups.some(
      (group) =>
        group.chance === 1 &&
        group.entries.every((e) => e.rewardId === 'hunt.material'),
    )
  )
    ctx.addIssue({ code: 'custom', message: '讨伐必须保底掉落材料' });
});

export const HUNT_DROP_POOL = HuntDropPoolSchema.parse(raw);

/** Six hours at the BOSS realm's middle stage, independent of the recipient's realm. */
export function planHuntReward(
  event: Pick<HuntEvent, 'realm'>,
  random: (stream: string) => () => number,
  pool = HUNT_DROP_POOL,
) {
  const resources = YieldCalculator.calculateCultivatorYield(
    { realm: event.realm, realmStage: '中期', hoursElapsed: HUNT_REWARD_HOURS },
    random('hunt.resources:1'),
  );
  const drops = rollDrops(pool, (group) =>
    random(`${pool.id}:${pool.version}:${group}`),
  );
  return {
    poolId: drops.poolId,
    poolVersion: drops.version,
    experience: resources.find((r) => r.type === 'cultivation_exp')?.value ?? 0,
    spiritStones: resources.find((r) => r.type === 'spirit_stones')?.value ?? 0,
    insight:
      resources.find((r) => r.type === 'comprehension_insight')?.value ?? 0,
    materialCount: drops.rewards
      .filter((r) => r.rewardId === 'hunt.material')
      .reduce((n, r) => n + r.quantity, 0),
    items: drops.rewards
      .filter((r) => r.rewardId !== 'hunt.material')
      .map((r) => ({ definitionId: r.rewardId, quantity: r.quantity })),
  };
}
