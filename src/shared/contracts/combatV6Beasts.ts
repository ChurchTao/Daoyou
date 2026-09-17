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
export const BEAST_NAME_MAX_LENGTH = 7;
export const BeastNameSchema = z
  .string()
  .trim()
  .superRefine((name, ctx) => {
    const length = Array.from(name).length;
    if (length < 1 || length > BEAST_NAME_MAX_LENGTH)
      ctx.addIssue({ code: 'custom', message: '灵兽名字需为 1～7 字' });
    if (/[\s\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}]/u.test(name))
      ctx.addIssue({
        code: 'custom',
        message: '名字不能包含空白、控制或不可见字符',
      });
  });
export const BeastRenameSchema = BeastRestSchema.extend({
  name: BeastNameSchema,
});
