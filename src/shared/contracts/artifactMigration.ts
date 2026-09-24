import { z } from 'zod';
import {
  DAO_EQUIPMENT_SLOTS,
  type DaoEquipmentInstanceV1,
} from '../engine/combat-v6/equipment/types';
import {
  DAO_WEAPON_TYPES,
  equipmentWeaponTypeProblem,
} from '../engine/combat-v6/equipment/weapons';
import type { ItemGrant } from '../inventory';
import type { RealmType } from '../types/constants';

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
export type ArtifactMigrationPlan = {
  anchorRealm: RealmType | null;
  realm: RealmType;
  equipmentLevel: number;
  fallback: boolean;
  blueprints: number;
  bonusGrants: ItemGrant[];
  spiritStones: number;
};
export type ArtifactMigrationSource = ArtifactMigrationPlan & {
  id: string;
  name: string;
  quality: string | null;
  score: number;
  problem: string | null;
};
export type ArtifactMigrationView = {
  ownerId: string;
  blockedReason: string | null;
  pending: ArtifactMigrationSource[];
};
export type ArtifactMigrationResult = {
  equipment: DaoEquipmentInstanceV1;
  blueprints: { definitionId: string; quantity: number }[];
  bonusGrants: ItemGrant[];
  spiritStones: number;
};
