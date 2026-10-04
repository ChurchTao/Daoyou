import { z } from 'zod';
import type { createInventorySchemas } from '../items/inventory.js';

const amount = z.number().int().nonnegative().max(2147483647);

export function createHuntRewardSnapshotSchema(
  ItemGrantSchema: ReturnType<typeof createInventorySchemas>['ItemGrantSchema'],
) {
  return z
    .object({
      poolId: z.string(),
      poolVersion: z.number().int().positive(),
      experience: amount,
      spiritStones: amount,
      insight: amount,
      items: z.array(ItemGrantSchema),
    })
    .strict();
}

export type HuntRewardSnapshot = z.infer<
  ReturnType<typeof createHuntRewardSnapshotSchema>
>;
