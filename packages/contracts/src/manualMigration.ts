import type {
  ManualMigrationPolicy,
  ManualMigrationSource,
} from '@daoyou/game-domain/legacy/migrations';
import { z } from 'zod';

import type { ItemGrant } from '@daoyou/game-domain/inventory';

export const ExchangeManualSchema = z
  .object({
    productId: z.uuid(),
    selections: z
      .array(
        z
          .object({
            definitionId: z.string().min(1).max(160),
            quantity: z.number().int().min(1).max(2),
          })
          .strict(),
      )
      .max(2),
  })
  .strict()
  .refine(
    (v) =>
      new Set(v.selections.map((s) => s.definitionId)).size ===
        v.selections.length &&
      v.selections.reduce((n, s) => n + s.quantity, 0) <= 2,
    '同名玉简请合并，每本旧功法最多自选 2 本',
  );

export type ExchangeManual = z.infer<typeof ExchangeManualSchema>;

export type ManualMigrationView = {
  ownerId: string;
  available: boolean;
  blockedReason: string | null;
  policy: ManualMigrationPolicy | null;
  pending: (ManualMigrationSource & {
    count: number;
    choices: number;
    bonusGrants: ItemGrant[];
    problem: string | null;
  })[];
  learned: { manualId: string; level: number }[];
};
