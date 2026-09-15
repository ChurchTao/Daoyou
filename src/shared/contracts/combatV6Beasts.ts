import { z } from 'zod';
import {
  BeastLineupSchema,
  type BeastRoster,
} from '../engine/combat-v6/beasts';
import { BeastAllocationSchema } from '../engine/combat-v6/beasts/progression';
export const BeastClaimSchema = z
  .object({ speciesId: z.string().min(1).max(160) })
  .strict();
export const BeastLineupRequestSchema = BeastLineupSchema;
export const BeastRestSchema = z
  .object({
    beastId: z.uuid(),
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();
export const BeastAllocateSchema = BeastRestSchema.extend({
  points: BeastAllocationSchema,
});
export type BeastManagementView = BeastRoster & {
  starterClaimed: boolean;
  ownerLevel: number;
  spiritStones: number;
};
