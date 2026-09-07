import { z } from 'zod';
import type { CultivatorManualStateV1 } from '../engine/combat-v6/manuals/types';
import type { InventoryItem } from '../inventory';
import type { RealmType } from '../types/constants';

const target = {
  expectedRevision: z.number().int().nonnegative(),
  slot: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
  ]),
};
export const ManualActionSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('learn'),
      ...target,
      expectedManualId: z.string().min(1).max(160).nullable(),
      item: z
        .object({
          id: z.string().min(1).max(160),
          revision: z.number().int().nonnegative(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal('forget'),
      ...target,
      expectedManualId: z.string().min(1).max(160),
    })
    .strict(),
]);
export type ManualAction = z.infer<typeof ManualActionSchema>;
export interface ManualView {
  realm: RealmType;
  state: CultivatorManualStateV1 | null;
  items: InventoryItem[];
  blockedReason: string | null;
}
