import { z } from 'zod';
import type { Quality } from '@daoyou/constants/qualities';
import type { ItemGrant } from '../items/inventory.js';

export const ManualMigrationConfigSchema = z
  .object({
    s2: z.number().int().positive().max(2147483646),
    s3: z.number().int().positive().max(2147483647),
    distribution: z.literal('existing'),
  })
  .strict()
  .refine((v) => v.s3 > v.s2, 'S3 必须大于 S2');

export type ManualMigrationConfig = z.infer<typeof ManualMigrationConfigSchema>;

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
