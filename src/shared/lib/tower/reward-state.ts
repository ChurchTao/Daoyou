import { z } from 'zod';
import type { TowerReward } from '../../contracts/combatV6Tower';
import { ItemGrantSchema } from '../../inventory';

export const TowerRewardSchema = z.strictObject({
  floor: z.union([z.literal(5), z.literal(10), z.literal(15), z.literal(20)]),
  spiritStones: z.number().int().nonnegative(),
  reputation: z.number().int().nonnegative(),
  items: z.array(ItemGrantSchema),
});
const claim = z.strictObject({
  battleId: z.uuid().nullable(), // Null only for imported pre-cutover receipts.
  claimedAt: z.iso.datetime(),
  reward: TowerRewardSchema,
});
export const TowerClaimsSchema = z
  .partialRecord(z.enum(['5', '10', '15', '20']), claim)
  .superRefine((claims, ctx) => {
    for (const [floor, entry] of Object.entries(claims)) {
      if (entry && entry.reward.floor !== Number(floor))
        ctx.addIssue({ code: 'custom', message: '领奖档位不一致' });
    }
  });
export type TowerClaims = z.infer<typeof TowerClaimsSchema>;
export interface TowerRewardState {
  seasonKey: string;
  claims: TowerClaims;
}
export function towerRewards(
  state: TowerRewardState | null,
  seasonKey: string,
): TowerReward[] {
  return state?.seasonKey === seasonKey
    ? Object.values(state.claims).flatMap((c) => (c ? [c.reward] : []))
    : [];
}
export function advanceTowerRewardWeek(
  state: TowerRewardState | null,
  seasonKey: string,
): TowerRewardState {
  if (state && state.seasonKey > seasonKey) throw new Error('领奖周次不能回退');
  return state?.seasonKey === seasonKey ? state : { seasonKey, claims: {} };
}
