import type { ArtifactMigrationSource } from '@daoyou/game-domain/legacy/migrations';
import { z } from 'zod';

import {
  DAO_EQUIPMENT_SLOTS,
  DAO_WEAPON_TYPES,
  equipmentWeaponTypeProblem,
} from '@daoyou/game-domain/equipment';


export const ExchangeArtifactSchema = z
  .object({
    productId: z.uuid(),
    slot: z.enum(DAO_EQUIPMENT_SLOTS),
    weaponType: z.enum(DAO_WEAPON_TYPES).optional(),
  })
  .strict()
  .refine(
    (input) =>
      !equipmentWeaponTypeProblem({
        ...input,
        generatorVersion: 'dao_equipment_generator_v5',
      }),
    '法兵必须选择器形，其他部位不能指定器形',
  );

export type ExchangeArtifact = z.infer<typeof ExchangeArtifactSchema>;

export type ArtifactMigrationView = {
  ownerId: string;
  blockedReason: string | null;
  pending: ArtifactMigrationSource[];
};
