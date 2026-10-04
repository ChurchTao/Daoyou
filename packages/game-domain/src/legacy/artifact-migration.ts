import type { RealmType } from '@daoyou/constants/realms';
import type { ItemGrant } from '../items/inventory.js';
import type { DaoEquipmentInstanceV1 } from '../equipment/types.js';

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

export type ArtifactMigrationResult = {
  equipment: DaoEquipmentInstanceV1;
  blueprints: { definitionId: string; quantity: number }[];
  bonusGrants: ItemGrant[];
  spiritStones: number;
};
