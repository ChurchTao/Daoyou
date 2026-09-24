import { z } from 'zod';
import type { ItemGrant } from '../inventory';
import type { Quality } from '../types/constants';

export const ManualMigrationConfigSchema = z
  .object({
    s2: z.number().int().positive().max(2147483646),
    s3: z.number().int().positive().max(2147483647),
    distribution: z.literal('existing'),
  })
  .strict()
  .refine((v) => v.s3 > v.s2, 'S3 必须大于 S2');
export type ManualMigrationConfig = z.infer<typeof ManualMigrationConfigSchema>;
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
export type ManualMigrationSource = {
  id: string;
  name: string;
  quality: string | null;
  score: number;
};
export type ManualMigrationGrant = { definitionId: string; quantity: number };
export type ManualMigrationRule = {
  count: number;
  realms: string[];
  weights: number[];
};
export type ManualMigrationPolicy = {
  config: ManualMigrationConfig;
  rules: Record<Quality, ManualMigrationRule>;
  catalog: { definitionId: string; name: string; realm: string }[];
};
export type ManualMigrationResult = {
  randomGrants: ManualMigrationGrant[];
  selectedGrants: ManualMigrationGrant[];
  bonusGrants: ItemGrant[];
};
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
export type ManualMigrationAdminView = {
  policy: ManualMigrationPolicy | null;
  stats: {
    quality: string;
    count: number;
    min: number;
    median: number;
    p90: number;
    max: number;
  }[];
  owners: {
    ownerId: string;
    name: string;
    pending: number;
    problems: number;
  }[];
};
