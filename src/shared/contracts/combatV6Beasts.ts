import { z } from 'zod';
import {
  BeastLineupSchema,
  type BeastRoster,
} from '../engine/combat-v6/beasts';
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
export type BeastManagementView = BeastRoster & { starterClaimed: boolean };
