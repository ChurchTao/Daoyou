import { z } from 'zod';

const quantity = z
  .object({
    min: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    max: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  })
  .strict()
  .refine((v) => v.min <= v.max);
const reward = z
  .object({ rewardId: z.string().min(1).max(160), quantity })
  .strict();
const group = z
  .object({
    id: z.string().min(1).max(100),
    chance: z.number().finite().min(0).max(1),
    entries: z
      .array(
        reward.extend({ weight: z.number().finite().positive().max(1000000) }),
      )
      .min(1)
      .max(1000),
  })
  .strict();
export const DropPoolSchema = z
  .object({
    id: z.string().min(1).max(100),
    version: z.number().int().positive(),
    groups: z.array(group).min(1).max(100),
  })
  .strict()
  .refine(
    (v) => new Set(v.groups.map((g) => g.id)).size === v.groups.length,
    'Duplicate drop group ID',
  );
export type DropPool = z.infer<typeof DropPoolSchema>;
export type DropResult = {
  poolId: string;
  version: number;
  rewards: { groupId: string; rewardId: string; quantity: number }[];
};

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
