import { z } from 'zod';
import type { EnlightenmentPreview } from '../manuals/enlightenment';
import { REALM_VALUES, type RealmType } from '../types/constants';

export const EnlightenmentRequestSchema = z
  .object({
    requestId: z.uuid(),
    materials: z
      .array(
        z
          .object({
            id: z.string().min(1).max(160),
            revision: z.number().int().nonnegative(),
            quantity: z.number().int().min(1).max(4),
          })
          .strict(),
      )
      .min(1)
      .max(4),
    expected: z
      .object({
        realm: z.enum(REALM_VALUES),
        insightMultiplier: z.number().finite().nonnegative(),
        qi: z.number().int().min(1).max(24),
        insight: z.number().int().positive(),
      })
      .strict(),
  })
  .strict()
  .refine(
    (v) =>
      new Set(v.materials.map((m) => m.id)).size === v.materials.length &&
      v.materials.reduce((sum, m) => sum + m.quantity, 0) <= 4,
    '最多投入四本，重复堆叠需合并数量',
  );
export type EnlightenmentRequest = z.infer<typeof EnlightenmentRequestSchema>;
export type EnlightenmentView = {
  ownerId: string;
  realm: RealmType;
  gender: string;
  qi: number;
  insight: number;
  insightMultiplier: number;
  blockedReason: string | null;
};
export type EnlightenmentResult = {
  requestId: string;
  jadeDefinitionId: string | null;
  cost: EnlightenmentPreview['cost'];
};
