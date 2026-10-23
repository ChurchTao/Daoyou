import type { createBeastAllocationSchema } from '@daoyou/game-domain/beasts';
import {
  BeastLineupSchema,
  BeastLocationSchema,
  type BeastLineup,
  type BeastRoster,
  type SummonedBeast,
} from '@daoyou/game-domain/beasts';
import { z } from 'zod';
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
export const BeastLockSchema = BeastRestSchema.extend({
  isLocked: z.boolean(),
});
export function createBeastAllocateSchema(
  BeastAllocationSchema: ReturnType<typeof createBeastAllocationSchema>,
) {
  return BeastRestSchema.extend({ points: BeastAllocationSchema });
}
export type BeastAllocateRequest = z.infer<
  ReturnType<typeof createBeastAllocateSchema>
>;
export const BeastFusionRequestSchema = z
  .strictObject({
    requestId: z.uuid(),
    parents: z.tuple([BeastRestSchema, BeastRestSchema]),
  })
  .refine(
    ({ parents }) => parents[0].beastId !== parents[1].beastId,
    '请选择两只不同的灵兽',
  );
export type BeastFusionRequest = z.infer<typeof BeastFusionRequestSchema>;
export type BeastFusionResponse = {
  view: BeastManagementView;
  result: SummonedBeast;
};
export const BEAST_PICKER_PAGE_SIZE = 15;
export const BeastPickerLocationSchema = z.enum(['all', 'bag', 'warehouse']);
export const BeastPickerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  location: BeastPickerLocationSchema.default('all'),
  beast: z.uuid().optional(),
});
export type BeastPickerLocation = z.infer<typeof BeastPickerLocationSchema>;
export type BeastPickerPage = {
  beasts: SummonedBeast[];
  page: number;
  pageSize: number;
  total: number;
  ownerLevel: number;
  spiritStones: number;
  lineup: BeastLineup;
  bagCount: number;
  warehouseCount: number;
};
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
export const BeastPlaceSchema = BeastRestSchema.extend({
  location: BeastLocationSchema,
});
