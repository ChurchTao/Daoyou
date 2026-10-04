import { DropPoolSchema, type DropPool, type DropResult } from '@daoyou/game-domain/rewards';


/** Opaque reward IDs only. A caller supplies independent deterministic streams by group ID. */
export function rollDrops(
  pool: DropPool,
  stream: (groupId: string) => () => number,
): DropResult {
  const validated = DropPoolSchema.parse(pool);
  const rewards: DropResult['rewards'] = [];
  for (const group of validated.groups) {
    const source = stream(group.id);
    const random = () => {
      const value = source();
      if (!Number.isFinite(value) || value < 0 || value >= 1)
        throw new Error('Drop RNG must return [0, 1)');
      return value;
    };
    if (group.chance === 0 || (group.chance < 1 && random() >= group.chance))
      continue;
    let cursor =
      random() * group.entries.reduce((sum, entry) => sum + entry.weight, 0);
    let chosen = group.entries[group.entries.length - 1];
    for (const entry of group.entries) {
      cursor -= entry.weight;
      if (cursor < 0) {
        chosen = entry;
        break;
      }
    }
    const count =
      chosen.quantity.min +
      Math.floor(random() * (chosen.quantity.max - chosen.quantity.min + 1));
    rewards.push({
      groupId: group.id,
      rewardId: chosen.rewardId,
      quantity: count,
    });
  }
  return { poolId: validated.id, version: validated.version, rewards };
}
